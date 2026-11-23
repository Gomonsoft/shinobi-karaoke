"""`info-lista-youtube` con el doble `FuenteYoutubeFalsa` (sin red; datos de lista inventados)."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from shinobi_worker import youtube
from shinobi_worker.listas_youtube import (
    MAX_ENTRADAS,
    analizar_url_lista,
    clasificar_error_lista,
)

ALBUM = "OLAK5uy_inventado01"
LISTA = "PLinventada0000001"


@pytest.fixture
def falso(tmp_path: Path) -> Path:
    d = tmp_path / "yt"
    d.mkdir()
    return d


def lista(falso: Path, id_lista: str, **datos) -> None:
    (falso / f"lista-{id_lista}.json").write_text(
        json.dumps({"_type": "playlist", **datos}), encoding="utf-8"
    )


def ejecutar(falso: Path, url: str):
    p = subprocess.run(
        [
            sys.executable,
            "-m",
            "shinobi_worker",
            "info-lista-youtube",
            "--args",
            json.dumps({"url": url}),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=60,
        env={**os.environ, youtube.VARIABLE_DOBLE: str(falso)},
    )
    return p, [json.loads(linea) for linea in p.stdout.splitlines()]


def entrada(i: int, **extra) -> dict:
    return {
        "id": f"Vid_{i:07d}",
        "title": f"Canción {i}",
        "channel": "Canal inventado",
        "duration": 100 + i,
        **extra,
    }


def test_album_con_una_entrada_privada(falso):
    lista(
        falso,
        ALBUM,
        title="Álbum - Inventado",
        entries=[
            entrada(1),
            entrada(2, title="[Private video]", duration=None, channel=None),
            entrada(3, availability="subscriber_only"),
            entrada(4, live_status="is_live", duration=None),
        ],
    )
    p, msgs = ejecutar(falso, f"https://music.youtube.com/playlist?list={ALBUM}")
    assert p.returncode == 0, p.stderr
    datos = msgs[-1]["datos"]
    assert (datos["titulo"], datos["tipo"], datos["recortada"]) == (
        "Álbum - Inventado",
        "album",
        False,
    )
    assert [e["disponible"] for e in datos["entradas"]] == [True, False, False, False]
    assert [e["problema"] for e in datos["entradas"]] == [
        None,
        "no_disponible",
        "no_disponible",
        "directo",
    ]
    assert datos["entradas"][0] == {
        "id": "Vid_0000001",
        "titulo": "Canción 1",
        "canal": "Canal inventado",
        "duracion_s": 101.0,
        "disponible": True,
        "problema": None,
    }
    assert datos["entradas"][1]["duracion_s"] is None


def test_lista_normal_desde_un_video_con_list(falso):
    lista(falso, LISTA, title="Mi lista", entries=[entrada(1)])
    p, msgs = ejecutar(falso, f"https://www.youtube.com/watch?v=aaaaaaaaaaa&list={LISTA}")
    assert p.returncode == 0, p.stderr
    assert msgs[-1]["datos"]["tipo"] == "lista"


def test_recorta_por_encima_del_tope(falso):
    lista(falso, LISTA, title="Larga", entries=[entrada(i) for i in range(MAX_ENTRADAS + 7)])
    p, msgs = ejecutar(falso, f"https://www.youtube.com/playlist?list={LISTA}")
    datos = msgs[-1]["datos"]
    assert len(datos["entradas"]) == MAX_ENTRADAS and datos["recortada"] is True


@pytest.mark.parametrize(
    "contenido",
    [
        {"entries": []},
        {"error": "ERROR: The playlist does not exist."},
        {"error": "This playlist is private"},
    ],
)
def test_lista_no_disponible(falso, contenido):
    lista(falso, LISTA, **contenido)
    p, msgs = ejecutar(falso, f"https://www.youtube.com/playlist?list={LISTA}")
    assert p.returncode == 1
    assert msgs[-1]["codigo"] == "LISTA_NO_DISPONIBLE"


def test_lista_inexistente_en_el_doble(falso):
    p, msgs = ejecutar(falso, f"https://www.youtube.com/playlist?list={LISTA}")
    assert msgs[-1]["codigo"] == "LISTA_NO_DISPONIBLE"


def test_bloqueo_y_red_se_distinguen(falso):
    lista(falso, LISTA, error="ERROR: Sign in to confirm you're not a bot")
    assert (
        ejecutar(falso, f"https://www.youtube.com/playlist?list={LISTA}")[1][-1]["codigo"]
        == "YOUTUBE_BLOQUEADO"
    )
    lista(falso, LISTA, error="ERROR: urlopen error [Errno 8] nodename nor servname provided")
    assert (
        ejecutar(falso, f"https://www.youtube.com/playlist?list={LISTA}")[1][-1]["codigo"]
        == "SIN_CONEXION"
    )


@pytest.mark.parametrize(
    "url,esperado",
    [
        (f"https://www.youtube.com/playlist?list={LISTA}", (LISTA, None)),
        (f"music.youtube.com/playlist?list={ALBUM}", (ALBUM, None)),
        (f"https://youtu.be/aaaaaaaaaaa?list={LISTA}", (LISTA, None)),
        ("https://www.youtube.com/playlist?list=RDCLAK5uy_inventadoxx", (None, "URL_NO_SOPORTADA")),
        (
            "https://www.youtube.com/watch?v=aaaaaaaaaaa&list=RDaaaaaaaaaaa",
            (None, "URL_NO_SOPORTADA"),
        ),
        ("https://www.youtube.com/@canalinventado", (None, "URL_NO_SOPORTADA")),
        ("https://www.youtube.com/channel/UCinventado0000000000000", (None, "URL_NO_SOPORTADA")),
        ("https://www.youtube.com/playlist", (None, "URL_NO_VALIDA")),
        ("https://www.youtube.com/playlist?list=corto", (None, "URL_NO_VALIDA")),
        ("https://www.youtube.com/watch?v=aaaaaaaaaaa", (None, "URL_NO_VALIDA")),
        ("https://example.com/playlist?list=" + LISTA, (None, "URL_NO_VALIDA")),
        ("no es un enlace", (None, "URL_NO_VALIDA")),
    ],
)
def test_analizar_url_lista(url, esperado):
    assert analizar_url_lista(url) == esperado


def test_clasificacion_de_errores_de_lista():
    assert clasificar_error_lista("ERROR: Private video").codigo == "LISTA_NO_DISPONIBLE"
    assert clasificar_error_lista("HTTP Error 429: Too Many Requests").codigo == "YOUTUBE_BLOQUEADO"
