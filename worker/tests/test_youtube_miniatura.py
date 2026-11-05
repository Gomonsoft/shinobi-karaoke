import io
from fractions import Fraction

import av
import numpy as np
import pytest

from shinobi_worker import miniatura


def _imagen(ancho: int, alto: int) -> np.ndarray:
    yy, xx = np.mgrid[0:alto, 0:ancho]
    base = np.stack([xx % 256, yy % 256, (xx + yy) % 256], axis=2)
    ruido = np.random.default_rng(1).integers(0, 20, base.shape)
    return np.clip(base + ruido, 0, 255).astype(np.uint8)


def codificar(arr: np.ndarray, codec: str, pix_fmt: str) -> bytes:
    ctx = av.CodecContext.create(codec, "w")
    ctx.width, ctx.height, ctx.pix_fmt = arr.shape[1], arr.shape[0], pix_fmt
    ctx.time_base = Fraction(1, 1)
    ctx.open()
    trama = av.VideoFrame.from_ndarray(arr, format="rgb24").reformat(format=pix_fmt)
    trama.pts, trama.time_base = 0, Fraction(1, 1)
    return b"".join(bytes(p) for p in [*ctx.encode(trama), *ctx.encode(None)])


FORMATOS = [("libwebp", "yuv420p"), ("png", "rgb24"), ("mjpeg", "yuvj420p")]


def dimensiones(jpeg: bytes) -> tuple[int, int]:
    with av.open(io.BytesIO(jpeg)) as c:
        t = next(c.decode(c.streams.video[0]))
        return t.width, t.height


@pytest.mark.parametrize("codec,pix_fmt", FORMATOS)
def test_convierte_a_jpeg_de_320_de_ancho(codec, pix_fmt):
    jpeg = miniatura.a_jpeg(codificar(_imagen(640, 360), codec, pix_fmt))
    assert jpeg[:3] == b"\xff\xd8\xff"
    assert dimensiones(jpeg) == (320, 180)
    assert len(jpeg) <= 40 * 1024


@pytest.mark.parametrize("codec,pix_fmt", FORMATOS)
def test_no_agranda_una_imagen_pequena(codec, pix_fmt):
    jpeg = miniatura.a_jpeg(codificar(_imagen(160, 90), codec, pix_fmt))
    assert dimensiones(jpeg) == (160, 90)


def test_datos_que_no_son_imagen_fallan():
    with pytest.raises(Exception):  # noqa: B017, PT011
        miniatura.a_jpeg(b"esto no es una imagen")


def test_elegir_la_mas_pequena_con_ancho_suficiente():
    info = {
        "thumbnail": "https://x/unica.jpg",
        "thumbnails": [
            {"url": "https://x/grande.jpg", "width": 1280},
            {"url": "https://x/pequena.jpg", "width": 120},
            {"url": "https://x/media.jpg", "width": 480},
            {"url": "https://x/sin-ancho.jpg"},
        ],
    }
    assert miniatura.elegir_url(info) == "https://x/media.jpg"


def test_elegir_cae_a_thumbnail_y_luego_a_la_mayor():
    assert miniatura.elegir_url({"thumbnail": "https://x/u.jpg"}) == "https://x/u.jpg"
    solo_pequenas = {
        "thumbnails": [{"url": "https://x/a", "width": 100}, {"url": "https://x/b", "width": 200}]
    }
    assert miniatura.elegir_url(solo_pequenas) == "https://x/b"
    assert miniatura.elegir_url({}) is None
