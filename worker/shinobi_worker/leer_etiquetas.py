"""Comando `leer-etiquetas` (ADR 0026 §1, tarea 0313): duración y etiquetas de varios archivos.

Solo se leen las cabeceras del contenedor (PyAV, sin decodificar el audio): menos de 100 ms por
archivo. Un archivo ilegible no hace fallar el comando: sale con `ok: false` y su código.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import av
import av.error

from . import protocolo
from .errores import ArgumentosNoValidos
from .importar_archivo import _etiquetas, _etiquetas_crudas

MAX_RUTAS = 500


def _duracion_ms(contenedor: av.container.InputContainer, pista: Any) -> int | None:
    if contenedor.duration:
        return round(contenedor.duration * 1000 / av.time_base)
    if pista.duration and pista.time_base:
        return round(float(pista.duration * pista.time_base) * 1000)
    return None


def leer_uno(ruta: Path) -> dict[str, Any]:
    """`{ruta, ok, duracion_ms, etiquetas}` o `{ruta, ok: False, codigo}` si no se puede leer."""
    try:
        contenedor = av.open(str(ruta))
    except (av.error.FFmpegError, ValueError, UnicodeError, OSError):
        return {"ruta": str(ruta), "ok": False, "codigo": "FORMATO_NO_SOPORTADO"}
    with contenedor:
        pista = next((s for s in contenedor.streams if s.type == "audio"), None)
        if pista is None:
            return {"ruta": str(ruta), "ok": False, "codigo": "FORMATO_NO_SOPORTADO"}
        return {
            "ruta": str(ruta),
            "ok": True,
            "duracion_ms": _duracion_ms(contenedor, pista),
            "etiquetas": _etiquetas_crudas(_etiquetas(contenedor, pista)),
        }


def leer_etiquetas(args: dict[str, Any]) -> None:
    rutas = args.get("rutas")
    if (
        not isinstance(rutas, list)
        or not 1 <= len(rutas) <= MAX_RUTAS
        or not all(isinstance(r, str) and r for r in rutas)
    ):
        raise ArgumentosNoValidos(f"'rutas' debe ser una lista de 1 a {MAX_RUTAS} rutas")
    archivos = []
    for i, r in enumerate(rutas):
        protocolo.progreso("leyendo", i / len(rutas))
        archivos.append(leer_uno(Path(r)))
    protocolo.resultado({"archivos": archivos})
