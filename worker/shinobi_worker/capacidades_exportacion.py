"""Comando `capacidades-exportacion`: qué formatos puede codificar este equipo (ADR 0019 §4).

Para cada formato comprueba que existan el codificador de video y `libopus` y que el contexto del
codificador abra con la resolución máxima de cada proporción. No codifica nada.
"""

from __future__ import annotations

from fractions import Fraction
from typing import Any

from . import protocolo
from .errores import ErrorWorker
from .exportar import FORMATOS, codificador_disponible

MAXIMAS = {"max_16_9": (3840, 2160), "max_4_3": (2880, 2160)}


def _abre(codec: str, ancho: int, alto: int) -> bool:
    import av

    try:
        ctx = av.CodecContext.create(codec, "w")
        ctx.width, ctx.height = ancho, alto
        ctx.pix_fmt = "yuv420p"
        ctx.time_base = Fraction(1, 60)
        ctx.framerate = Fraction(60)
        ctx.open()
    except Exception:
        return False
    return True


def _formato(codec: str) -> dict[str, Any]:
    if not codificador_disponible(codec) or not codificador_disponible("libopus"):
        return {"disponible": False, "max_16_9": False, "max_4_3": False, "motivo": "codificador"}
    maximas = {clave: _abre(codec, *medida) for clave, medida in MAXIMAS.items()}
    disponible = any(maximas.values())
    return {"disponible": disponible, **maximas, "motivo": None if disponible else "codificador"}


def capacidades_exportacion(args: dict[str, Any]) -> None:
    try:
        import av
    except ImportError as e:
        raise ErrorWorker("RUNTIME_NO_DISPONIBLE", "El motor de audio no está instalado") from e
    formatos = {nombre: _formato(codec) for nombre, (_, codec) in FORMATOS.items()}
    protocolo.resultado({"formatos": formatos, "version_av": av.__version__})
