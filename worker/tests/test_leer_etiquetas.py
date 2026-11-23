"""`leer-etiquetas` (tarea 0313): cabeceras sin decodificar, con archivos generados."""

import json
import subprocess
import sys
import time
from pathlib import Path

import audio_prueba as ap

from shinobi_worker.leer_etiquetas import leer_uno

ETIQUETAS = {
    "title": "Canción inventada",
    "artist": "Artista inventado",
    "album": "Álbum inventado",
    "album_artist": "Artista del álbum",
    "track": "3/12",
    "date": "2020",
}


def ejecutar(rutas: list[Path]):
    args = {"rutas": [str(r) for r in rutas]}
    p = subprocess.run(
        [sys.executable, "-m", "shinobi_worker", "leer-etiquetas", "--args", json.dumps(args)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=60,
    )
    return p, [json.loads(linea) for linea in p.stdout.splitlines()]


def test_flac_mp3_y_m4a_con_etiquetas_y_duracion(tmp_path: Path):
    flac = ap.flac(tmp_path / "a.flac", ap.tono(12))
    mp3 = ap.mp3(tmp_path / "b.mp3", ap.tono(12), etiquetas=ETIQUETAS)
    m4a = ap.m4a(tmp_path / "c.m4a", ap.tono(12))
    for ruta in (flac, mp3, m4a):
        r = leer_uno(ruta)
        assert r["ok"] is True
        assert abs(r["duracion_ms"] - 12000) < 150
    leido = leer_uno(mp3)["etiquetas"]
    assert leido["title"] == "Canción inventada"
    assert leido["album_artist"] == "Artista del álbum"
    assert leido["track"] == "3"
    assert leido["date"].startswith("2020")
    assert set(leer_uno(flac)["etiquetas"].values()) == {""}


def test_archivo_danado_no_hace_fallar_al_resto(tmp_path: Path):
    bueno = ap.mp3(tmp_path / "bueno.mp3", ap.tono(12), etiquetas=ETIQUETAS)
    malo = ap.texto_como_mp3(tmp_path / "malo.mp3")
    sin_audio = ap.mp4_sin_audio(tmp_path / "mudo.mp4")
    inexistente = tmp_path / "no_esta.wav"
    p, msgs = ejecutar([malo, bueno, sin_audio, inexistente])
    assert p.returncode == 0, p.stderr
    archivos = msgs[-1]["datos"]["archivos"]
    assert [a["ok"] for a in archivos] == [False, True, False, False]
    assert {a["codigo"] for a in archivos if not a["ok"]} == {"FORMATO_NO_SOPORTADO"}
    assert [Path(a["ruta"]).name for a in archivos][1] == "bueno.mp3"


def test_rapido_sin_decodificar(tmp_path: Path):
    ruta = ap.flac(tmp_path / "largo.flac", ap.tono(90))
    leer_uno(ruta)  # calienta las importaciones
    t0 = time.perf_counter()
    for _ in range(10):
        leer_uno(ruta)
    por_archivo_ms = (time.perf_counter() - t0) * 100
    assert por_archivo_ms < 100, f"{por_archivo_ms:.1f} ms por archivo"


def test_argumentos_no_validos():
    p, msgs = ejecutar([])
    assert p.returncode == 2
    assert msgs[-1]["codigo"] == "ARGUMENTOS_NO_VALIDOS"
