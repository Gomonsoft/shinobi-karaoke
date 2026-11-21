"""Pruebas del inspector de licencias de PyAV con ruedas sintéticas (sin red ni pip)."""

import importlib.util
import sys
import zipfile
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "inspeccionar_av", RAIZ / "scripts" / "inspeccionar_av.py"
)
assert _spec and _spec.loader
ia = importlib.util.module_from_spec(_spec)
sys.modules["inspeccionar_av"] = ia
_spec.loader.exec_module(ia)


CODECS = b" --enable-libsvtav1 --enable-libvpx --enable-libopus"


def _rueda(tmp_path, config: bytes, extra: tuple[str, ...] = ()) -> Path:
    ruta = tmp_path / "av-1-cp312-abi3-x.whl"
    with zipfile.ZipFile(ruta, "w") as z:
        z.writestr(
            "av.libs/avutil-61-abc.dll", b"\0" + config + CODECS + b"\0LGPL version 3 or later\0"
        )
        z.writestr("av/codec.abi3.so", b"x")  # extensión de PyAV: no es una biblioteca de FFmpeg
        for nombre in extra:
            z.writestr(nombre, b"x")
    return ruta


def test_rueda_libre_con_componentes_gpl(tmp_path):
    r = ia.inspeccionar_rueda(
        _rueda(tmp_path, b"--enable-shared --enable-version3 --enable-libx264 --disable-libfdk-aac")
    )
    assert r["ok"] and r["no_libres"] == []
    assert r["componentes_gpl"] == ["libx264"]
    assert r["licencia_declarada_ffmpeg"] == ["LGPL version 3 or later"]
    assert r["bibliotecas"] == ["av.libs/avutil-61-abc.dll"]


@pytest.mark.parametrize(
    ("config", "extra", "esperado"),
    [
        (b"--enable-shared --enable-nonfree", (), "--enable-nonfree"),
        (b"--enable-shared --enable-libnpp", (), "libnpp"),
        (b"--enable-shared", ("av.libs/libfdk-aac-1.dll",), "libfdk"),
    ],
)
def test_falla_con_componentes_no_libres(tmp_path, config, extra, esperado):
    r = ia.inspeccionar_rueda(_rueda(tmp_path, config, extra))
    assert not r["ok"] and esperado in r["no_libres"]


def _rueda_sin(tmp_path, quitar: str) -> Path:
    ruta = tmp_path / "av-1-cp312-abi3-x.whl"
    config = b"--enable-shared " + CODECS.replace(quitar.encode(), b"--enable-libfalso")
    with zipfile.ZipFile(ruta, "w") as z:
        z.writestr("av.libs/avutil-61-abc.dll", b"\0" + config + b"\0LGPL version 3 or later\0")
    return ruta


@pytest.mark.parametrize("codec", ["libsvtav1", "libvpx", "libopus"])
def test_falla_si_falta_un_codec_de_la_exportacion(tmp_path, codec):
    r = ia.inspeccionar_rueda(_rueda_sin(tmp_path, f"--enable-{codec}"))
    assert not r["ok"] and r["codecs_faltantes"] == [codec] and r["no_libres"] == []


def test_un_codec_cuenta_si_esta_como_biblioteca(tmp_path):
    ruta = _rueda_sin(tmp_path, "--enable-libopus")
    with zipfile.ZipFile(ruta, "a") as z:
        z.writestr("av.libs/libopus-0-1a2b.dll", b"x")
    assert ia.inspeccionar_rueda(ruta)["ok"]


def test_sin_configuracion_es_error(tmp_path):
    ruta = tmp_path / "av-1-cp312-abi3-x.whl"
    with zipfile.ZipFile(ruta, "w") as z:
        z.writestr("av.libs/avutil-61-abc.dll", b"\0nada\0")
    with pytest.raises(ia.ErrorInspeccion):
        ia.inspeccionar_rueda(ruta)


def test_version_y_hashes_de_los_requisitos_reales():
    for o in ia.OBJETIVOS:
        version, hashes = ia.version_y_hashes(ia.REQUISITOS / o.requisitos)
        assert version and hashes
