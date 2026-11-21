#!/usr/bin/env python3
"""Ejecuta codificar.py sobre la matriz de perfiles candidatos y guarda JSON Lines.

    cd worker && uv run python ../docs/poc/0019-exportacion/matriz.py --segundos 20 --salida /tmp/m.jsonl
"""
import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

RESOLUCIONES = [(640, 480), (1280, 720), (1920, 1080), (2880, 2160), (3840, 2160)]
FPS = [24, 30, 60]
PERFILES = ["av1", "av1-p8", "vp9", "vp9-good"]

ap = argparse.ArgumentParser()
ap.add_argument("--segundos", type=float, default=20)
ap.add_argument("--salida", type=Path, required=True)
ap.add_argument("--fps", type=int, nargs="*", default=FPS)
ap.add_argument("--perfiles", nargs="*", default=PERFILES)
ap.add_argument("--fondo-movil", action="store_true")
a = ap.parse_args()
script = Path(__file__).with_name("codificar.py")
with tempfile.TemporaryDirectory() as tmp, a.salida.open("a") as out:
    for ancho, alto in RESOLUCIONES:
        for fps in a.fps:
            for p in a.perfiles:
                cmd = [sys.executable, str(script), "--perfil", p, "--ancho", str(ancho),
                       "--alto", str(alto), "--fps", str(fps), "--segundos", str(a.segundos),
                       "--salida", str(Path(tmp) / f"x.{p}")]
                if a.fondo_movil:
                    cmd.append("--fondo-movil")
                r = subprocess.run(cmd, capture_output=True, text=True)
                linea = r.stdout.strip().splitlines()[-1] if r.returncode == 0 else \
                    f'{{"fallo": "{p} {ancho}x{alto} {fps}"}}'
                out.write(linea + "\n")
                out.flush()
                print(linea[:160], flush=True)
