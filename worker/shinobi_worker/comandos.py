"""Comandos del worker. Cada uno recibe el dict de `--args` y emite por `protocolo`."""

from __future__ import annotations

import platform
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

from . import __version__, protocolo
from .errores import ArgumentosNoValidos, ErrorWorker

PASOS_POR_SEGUNDO = 10


def version(args: dict[str, Any]) -> None:
    protocolo.resultado({"version": __version__, "python": platform.python_version()})


def _numero(args: dict[str, Any], clave: str, defecto: float) -> float:
    valor = args.get(clave, defecto)
    if isinstance(valor, bool) or not isinstance(valor, int | float) or valor < 0:
        raise ArgumentosNoValidos(f"'{clave}' debe ser un numero >= 0")
    return float(valor)


def demo(args: dict[str, Any]) -> None:
    """Simula un trabajo: fase indeterminada, progreso ~10/s y resultado o fallo."""
    segundos = _numero(args, "segundos", 5)
    indeterminado_s = _numero(args, "indeterminado_s", 0)
    fallar_en = args.get("fallar_en")
    if fallar_en is not None and (
        isinstance(fallar_en, bool)
        or not isinstance(fallar_en, int | float)
        or not 0 <= fallar_en <= 1
    ):
        raise ArgumentosNoValidos("'fallar_en' debe ser null o un numero entre 0 y 1")
    ruta = args.get("ruta_parcial")
    if ruta is not None and not isinstance(ruta, str):
        raise ArgumentosNoValidos("'ruta_parcial' debe ser una cadena")
    parcial = Path(ruta) if ruta else None

    if parcial is not None:
        parcial.parent.mkdir(parents=True, exist_ok=True)
        parcial.write_text("parcial\n", encoding="utf-8")

    try:
        if indeterminado_s > 0:
            protocolo.progreso("cargando", None)
            time.sleep(indeterminado_s)

        pasos = max(1, round(segundos * PASOS_POR_SEGUNDO))
        for i in range(pasos + 1):
            valor = i / pasos
            if fallar_en is not None and valor >= fallar_en:
                raise ErrorWorker("DEMO_FALLO", f"Fallo simulado en {valor:.0%}", True)
            protocolo.progreso("procesando", valor)
            if i < pasos:
                time.sleep(1 / PASOS_POR_SEGUNDO)
    except ErrorWorker:
        if parcial is not None:
            parcial.unlink(missing_ok=True)
        raise
    if parcial is not None:
        parcial.unlink(missing_ok=True)
    protocolo.resultado({"segundos": segundos})


# Importacion perezosa: `version` y `demo` no deben cargar av/numpy/yt-dlp.
def importar_archivo(args: dict[str, Any]) -> None:
    from .importar_archivo import importar_archivo as comando

    comando(args)


def diagnostico(args: dict[str, Any]) -> None:
    from .diagnostico import diagnostico as comando

    comando(args)


def info_youtube(args: dict[str, Any]) -> None:
    from .youtube import info_youtube as comando

    comando(args)


def descargar_youtube(args: dict[str, Any]) -> None:
    from .youtube import descargar_youtube as comando

    comando(args)


COMANDOS: dict[str, Callable[[dict[str, Any]], None]] = {
    "version": version,
    "demo": demo,
    "importar-archivo": importar_archivo,
    "diagnostico": diagnostico,
    "info-youtube": info_youtube,
    "descargar-youtube": descargar_youtube,
}
