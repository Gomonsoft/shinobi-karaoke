"""`importar-archivo-cola` (tarea 0313): misma normalización, dentro de la carpeta de la canción."""

import json
import subprocess
import sys
from pathlib import Path

import audio_prueba as ap
import soundfile as sf


def test_normaliza_dentro_de_la_carpeta_y_no_borra_el_original(tmp_path: Path):
    entrada = ap.mp3(tmp_path / "original.mp3", ap.tono(12), etiquetas=ap.ETIQUETAS)
    cancion = tmp_path / "biblioteca" / "id-inventado"
    args = {"entrada": str(entrada), "salida": str(cancion), "borrar_entrada": False}
    p = subprocess.run(
        [
            sys.executable,
            "-m",
            "shinobi_worker",
            "importar-archivo-cola",
            "--args",
            json.dumps(args),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=60,
    )
    assert p.returncode == 0, p.stderr
    datos = [json.loads(linea) for linea in p.stdout.splitlines()][-1]["datos"]
    assert datos["mezcla"] == "fuente/mezcla.flac"
    assert datos["nombre_original"] == "original.mp3"
    assert sf.info(str(cancion / "fuente" / "mezcla.flac")).samplerate == 44100
    assert entrada.is_file()
    assert sorted(x.name for x in (cancion / "fuente").iterdir()) == ["mezcla.flac"]
