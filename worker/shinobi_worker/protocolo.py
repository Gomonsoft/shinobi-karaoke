"""Protocolo JSON Lines del worker (docs/arquitectura.md, seccion 6).

Una linea JSON UTF-8 por mensaje, con flush inmediato, por el stdout *original*
del proceso. Todo lo demas (prints de librerias, trazas) va a stderr.
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any, TextIO

_salida: TextIO | None = None


def iniciar() -> None:
    """Reserva el stdout original para el protocolo y redirige el resto a stderr."""
    global _salida
    if _salida is not None:
        return
    sys.stdout.flush()
    fd = os.dup(1)
    _salida = os.fdopen(fd, "w", encoding="utf-8", newline="\n")
    os.dup2(2, 1)  # escrituras al fd 1 (incluidas las de extensiones C) -> stderr
    sys.stdout = sys.stderr


def _emitir(mensaje: dict[str, Any]) -> None:
    flujo = _salida if _salida is not None else sys.stdout
    flujo.write(json.dumps(mensaje, ensure_ascii=False, separators=(",", ":")) + "\n")
    flujo.flush()


def progreso(fase: str, valor: float | None, detalle: dict[str, Any] | None = None) -> None:
    """`valor` en 0-1, o None para progreso indeterminado."""
    if valor is not None:
        valor = min(1.0, max(0.0, float(valor)))
    mensaje: dict[str, Any] = {"tipo": "progreso", "fase": fase, "valor": valor}
    if detalle is not None:
        mensaje["detalle"] = detalle
    _emitir(mensaje)


def log(nivel: str, mensaje: str) -> None:
    _emitir({"tipo": "log", "nivel": nivel, "mensaje": mensaje})


def resultado(datos: dict[str, Any]) -> None:
    _emitir({"tipo": "resultado", "datos": datos})


def error(codigo: str, mensaje: str, reintentable: bool = False) -> None:
    _emitir({"tipo": "error", "codigo": codigo, "mensaje": mensaje, "reintentable": reintentable})
