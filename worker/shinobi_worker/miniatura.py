"""Miniaturas de YouTube: elegir, descargar y convertir a JPEG con PyAV (ADR 0003).

No usa `ffmpeg` ni `--convert-thumbnails` de yt-dlp: YouTube suele servir WebP y el
protocolo de medios de la app solo sirve JPEG.
"""

from __future__ import annotations

import io
from collections.abc import Mapping, Sequence
from fractions import Fraction
from typing import Any

import av
from av.codec.context import Flags

ANCHO_MINIMO = 320
ANCHO_MAXIMO = 320
CALIDAD_QSCALE = 3  # mjpeg: 2 (mejor) a 31; ~3 equivale a una calidad JPEG de ~85
MAX_BYTES_ORIGEN = 5 * 1024 * 1024


def elegir_url(info: Mapping[str, Any]) -> str | None:
    """La miniatura más pequeña con ancho >= 320; si ninguna lo declara, `thumbnail`."""
    con_ancho: list[tuple[int, str]] = []
    for m in info.get("thumbnails") or []:
        if not isinstance(m, Mapping):
            continue
        url, ancho = m.get("url"), m.get("width")
        if isinstance(url, str) and url and isinstance(ancho, int) and ancho >= ANCHO_MINIMO:
            con_ancho.append((ancho, url))
    if con_ancho:
        return min(con_ancho, key=lambda t: t[0])[1]
    unica = info.get("thumbnail")
    if isinstance(unica, str) and unica:
        return unica
    return _mayor_disponible(info.get("thumbnails") or [])


def _mayor_disponible(miniaturas: Sequence[Any]) -> str | None:
    validas = [m for m in miniaturas if isinstance(m, Mapping) and isinstance(m.get("url"), str)]
    if not validas:
        return None
    return max(validas, key=lambda m: m.get("width") or 0)["url"]


def a_jpeg(datos: bytes, ancho_max: int = ANCHO_MAXIMO) -> bytes:
    """Decodifica una imagen (WebP, PNG, JPEG...) y la codifica a JPEG de <= `ancho_max` px."""
    with av.open(io.BytesIO(datos)) as contenedor:
        trama = next(contenedor.decode(contenedor.streams.video[0]))
    ancho, alto = trama.width, trama.height
    if ancho > ancho_max:
        alto = round(alto * ancho_max / ancho)
        ancho = ancho_max
    ancho, alto = max(2, ancho - ancho % 2), max(2, alto - alto % 2)  # yuv420p exige pares
    trama = trama.reformat(width=ancho, height=alto, format="yuvj420p")
    trama.pts, trama.time_base = 0, Fraction(1, 1)

    codificador = av.CodecContext.create("mjpeg", "w")
    codificador.width, codificador.height, codificador.pix_fmt = ancho, alto, "yuvj420p"
    codificador.time_base = Fraction(1, 1)
    codificador.flags |= Flags.qscale
    codificador.global_quality = CALIDAD_QSCALE * 118  # FF_QP2LAMBDA
    codificador.open()
    paquetes = [*codificador.encode(trama), *codificador.encode(None)]
    return b"".join(bytes(p) for p in paquetes)
