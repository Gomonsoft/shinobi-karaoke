"""Uso: python -m shinobi_worker <comando> --args '<json>'

Convencion de procesos: el worker no crea procesos hijos. Si algun comando futuro
los necesitara, debe poder terminarlos al recibir SIGTERM (el gestor mata el arbol
con SIGTERM -> SIGKILL, o `taskkill /T /F` en Windows).
"""

from __future__ import annotations

import json
import sys
import traceback
from typing import Any

from . import protocolo
from .comandos import COMANDOS
from .errores import ArgumentosNoValidos, ErrorWorker

SALIDA_OK = 0
SALIDA_ERROR = 1
SALIDA_ARGUMENTOS = 2


def _parsear(argv: list[str]) -> tuple[str, dict[str, Any]]:
    if not argv:
        raise ArgumentosNoValidos("Falta el comando")
    comando, resto = argv[0], argv[1:]
    if comando not in COMANDOS:
        raise ArgumentosNoValidos(f"Comando desconocido: {comando}")
    texto = "{}"
    if resto:
        if resto[0] != "--args" or len(resto) != 2:
            raise ArgumentosNoValidos("Uso: <comando> --args '<json>'")
        texto = resto[1]
    try:
        args = json.loads(texto)
    except json.JSONDecodeError as e:
        raise ArgumentosNoValidos(f"--args no es JSON valido: {e}") from e
    if not isinstance(args, dict):
        raise ArgumentosNoValidos("--args debe ser un objeto JSON")
    return comando, args


def main(argv: list[str] | None = None) -> int:
    protocolo.iniciar()
    try:
        comando, args = _parsear(sys.argv[1:] if argv is None else argv)
        COMANDOS[comando](args)
    except ArgumentosNoValidos as e:
        protocolo.error(e.codigo, e.mensaje, e.reintentable)
        return SALIDA_ARGUMENTOS
    except ErrorWorker as e:
        protocolo.error(e.codigo, e.mensaje, e.reintentable)
        return SALIDA_ERROR
    except Exception as e:
        traceback.print_exc()
        protocolo.error("ERROR_INTERNO", f"{type(e).__name__}: {e}")
        return SALIDA_ERROR
    return SALIDA_OK


if __name__ == "__main__":
    sys.exit(main())
