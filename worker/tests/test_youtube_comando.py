"""`info-youtube` de punta a punta con el doble `FuenteYoutubeFalsa` (sin red)."""

import base64
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from test_youtube_miniatura import FORMATOS, _imagen, codificar

from shinobi_worker import youtube

FIXTURES = Path(__file__).parent / "fixtures" / "youtube"


@pytest.fixture
def directorio_falso(tmp_path: Path) -> Path:
    shutil.copytree(FIXTURES, tmp_path / "yt")
    destino = tmp_path / "yt"
    (destino / "aaaaaaaaaaa.webp").write_bytes(codificar(_imagen(640, 360), *FORMATOS[0]))
    return destino


def ejecutar(directorio: Path, url: str):
    entorno = {**os.environ, youtube.VARIABLE_DOBLE: str(directorio)}
    p = subprocess.run(
        [
            sys.executable,
            "-m",
            "shinobi_worker",
            "info-youtube",
            "--args",
            json.dumps({"url": url}),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=entorno,
        timeout=60,
    )
    return p, [json.loads(linea) for linea in p.stdout.splitlines()]


def test_vista_previa_completa(directorio_falso):
    p, msgs = ejecutar(directorio_falso, "https://youtu.be/aaaaaaaaaaa?si=zzz")
    assert p.returncode == 0, p.stderr
    datos = msgs[-1]["datos"]
    assert datos["id_video"] == "aaaaaaaaaaa"
    assert datos["titulo_original"].startswith("Artista Ejemplo - ")
    assert datos["canal"] == "ArtistaEjemploVEVO"
    assert datos["duracion_s"] == 215
    assert datos["metadatos"] == {
        "titulo": "Canción de prueba",
        "artista": "Artista Ejemplo",
        "album": "",
    }
    jpeg = base64.b64decode(datos["miniatura_jpeg_base64"])
    assert jpeg[:3] == b"\xff\xd8\xff"
    assert not any("yt_dlp" in json.dumps(m) for m in msgs if m["tipo"] != "resultado")


def test_sin_miniatura_no_es_error(directorio_falso):
    p, msgs = ejecutar(directorio_falso, "https://www.youtube.com/watch?v=bbbbbbbbbbb")
    assert p.returncode == 0, p.stderr
    datos = msgs[-1]["datos"]
    assert "miniatura_jpeg_base64" not in datos
    assert datos["metadatos"] == {
        "titulo": "Tema de prueba",
        "artista": "Grupo Ficticio",
        "album": "Disco inventado",
    }
    assert datos["duracion_s"] == 187.5


def test_miniatura_corrupta_se_omite_con_aviso(directorio_falso):
    (directorio_falso / "bbbbbbbbbbb.jpg").write_bytes(b"basura")
    p, msgs = ejecutar(directorio_falso, "https://www.youtube.com/watch?v=bbbbbbbbbbb")
    assert p.returncode == 0, p.stderr
    assert "miniatura_jpeg_base64" not in msgs[-1]["datos"]
    assert any(m["tipo"] == "log" and m["nivel"] == "warning" for m in msgs)


@pytest.mark.parametrize(
    "url,codigo,reintentable",
    [
        ("https://www.youtube.com/watch?v=ccccccccccc", "VIDEO_NO_DISPONIBLE", False),
        ("https://www.youtube.com/watch?v=ddddddddddd", "URL_NO_SOPORTADA", False),
        ("https://www.youtube.com/watch?v=eeeeeeeeeee", "URL_NO_SOPORTADA", False),
        ("https://www.youtube.com/watch?v=fffffffffff", "YOUTUBE_BLOQUEADO", True),
        ("https://www.youtube.com/watch?v=ggggggggggg", "SIN_CONEXION", True),
        ("https://www.youtube.com/watch?v=hhhhhhhhhhh", "URL_NO_SOPORTADA", False),
        ("https://www.youtube.com/watch?v=zzzzzzzzzzz", "VIDEO_NO_DISPONIBLE", False),
        ("https://vimeo.com/76979871", "URL_NO_VALIDA", False),
        ("https://www.youtube.com/playlist?list=PLabc", "URL_NO_SOPORTADA", False),
    ],
)
def test_errores_diferenciados(directorio_falso, url, codigo, reintentable):
    p, msgs = ejecutar(directorio_falso, url)
    assert p.returncode != 0
    assert msgs[-1]["tipo"] == "error"
    assert (msgs[-1]["codigo"], msgs[-1]["reintentable"]) == (codigo, reintentable)


def test_url_ausente_es_argumento_no_valido(directorio_falso):
    entorno = {**os.environ, youtube.VARIABLE_DOBLE: str(directorio_falso)}
    p = subprocess.run(
        [sys.executable, "-m", "shinobi_worker", "info-youtube", "--args", "{}"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env=entorno,
        timeout=60,
    )
    assert json.loads(p.stdout.splitlines()[-1])["codigo"] == "ARGUMENTOS_NO_VALIDOS"


def test_descarga_del_doble_genera_audio(directorio_falso, tmp_path):
    fuente = youtube.FuenteYoutubeFalsa(directorio_falso)
    avances = []
    ruta = fuente.descargar(
        "https://youtu.be/bbbbbbbbbbb", tmp_path / "d", lambda b, t: avances.append((b, t))
    )
    assert ruta.is_file() and avances


def test_el_doble_solo_con_la_variable():
    assert isinstance(youtube.fuente_desde_entorno({}), youtube.FuenteYoutubeReal)
    assert isinstance(
        youtube.fuente_desde_entorno({youtube.VARIABLE_DOBLE: "/x"}), youtube.FuenteYoutubeFalsa
    )


@pytest.mark.red
def test_real_con_video_de_dominio_publico():
    """Big Buck Bunny (Blender Foundation, CC BY 3.0). Solo pide metadatos. Requiere Internet."""
    fuente = youtube.FuenteYoutubeReal()
    info = fuente.info(youtube.url_canonica(VIDEO_PUBLICO))
    assert info["id"] == VIDEO_PUBLICO
    assert info["duration"] > 0
    assert miniatura_ok(fuente, info)


VIDEO_PUBLICO = "aqz-KE-bpKQ"


def miniatura_ok(fuente, info) -> bool:
    return youtube.miniatura_jpeg_base64(fuente, info) is not None
