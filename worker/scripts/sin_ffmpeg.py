"""Ejecuta un comando con el PATH sin ffmpeg ni ffprobe (tarea 0062; ADR 0004, preguntas/0009).

    python scripts/sin_ffmpeg.py <comando> [args...]

Quita del PATH toda carpeta que contenga `ffmpeg`/`ffprobe` (con `.exe`, `.cmd`, `.bat` en Windows),
resuelve el ejecutable del comando con el PATH original (para que `uv` siga encontrándose) y falla
(código 3) si tras el filtro `shutil.which` aún localiza ffmpeg o ffprobe. Los runners de GitHub
traen ffmpeg instalado: si el filtro no lo quita, el paso debe fallar. Define
`SHINOBI_SIN_FFMPEG=1` para que los tests comprueben el PATH heredado.
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

BINARIOS = ("ffmpeg", "ffprobe")


def _nombres(windows: bool) -> list[str]:
    sufijos = ["", ".exe", ".cmd", ".bat"] if windows else [""]
    return [b + s for b in BINARIOS for s in sufijos]


def filtrar_path(ruta: str, windows: bool = os.name == "nt") -> tuple[str, list[str]]:
    """Devuelve (PATH sin carpetas con ffmpeg, carpetas quitadas)."""
    nombres = _nombres(windows)
    quitadas, conservadas = [], []
    for d in ruta.split(os.pathsep):
        if d and any((Path(d) / n).is_file() for n in nombres):
            quitadas.append(d)
        else:
            conservadas.append(d)
    return os.pathsep.join(conservadas), quitadas


def main(argv: list[str]) -> int:
    if not argv:
        print("uso: sin_ffmpeg.py <comando> [args...]", file=sys.stderr)
        return 2
    clave = next((k for k in os.environ if k.upper() == "PATH"), "PATH")
    original = os.environ.get(clave, "")
    nuevo, quitadas = filtrar_path(original)
    print(f"sin_ffmpeg: carpetas quitadas del PATH: {quitadas or '(ninguna)'}", flush=True)
    exe = shutil.which(argv[0], path=original)
    if exe is None:
        print(f"sin_ffmpeg: no se encuentra {argv[0]}", file=sys.stderr)
        return 2
    for b in BINARIOS:
        if shutil.which(b, path=nuevo) is not None:
            print(f"sin_ffmpeg: {b} sigue en el PATH tras el filtro", file=sys.stderr)
            return 3
    env = {**os.environ, clave: nuevo, "SHINOBI_SIN_FFMPEG": "1"}
    return subprocess.call([exe, *argv[1:]], env=env)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
