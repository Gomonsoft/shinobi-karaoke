"""Validacion de los argumentos de `separar` (misma regla que `argsSepararSchema`, tarea 0059)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from .errores import ArgumentosNoValidos

MODELOS = ("calidad", "rapido")
DISPOSITIVOS = ("cpu", "cuda")
BLOQUES = ("normal", "pequenos")

# Ruta absoluta POSIX, de Windows (`C:\` o `C:/`) o UNC. Igual en cualquier SO del worker.
_RUTA_ABSOLUTA = re.compile(r"^(?:/|[A-Za-z]:[\\/]|\\\\)")


@dataclass(frozen=True)
class ArgsSeparar:
    entrada: str
    salida_dir: str
    modelo_id: str
    modelo_archivo: str
    modelo_dir: str
    dispositivo: str
    bloques: str


def _ruta(valor: Any, nombre: str) -> str:
    if not isinstance(valor, str) or not valor or len(valor) > 4096:
        raise ArgumentosNoValidos(f"'{nombre}' debe ser una ruta no vacia")
    if not _RUTA_ABSOLUTA.match(valor):
        raise ArgumentosNoValidos(f"'{nombre}' debe ser una ruta absoluta")
    return valor


def _opcion(valor: Any, nombre: str, validos: tuple[str, ...]) -> str:
    if not isinstance(valor, str) or valor not in validos:
        raise ArgumentosNoValidos(f"'{nombre}' debe ser uno de: {', '.join(validos)}")
    return valor


def _claves(objeto: Any, nombre: str, esperadas: set[str]) -> dict[str, Any]:
    if not isinstance(objeto, dict):
        raise ArgumentosNoValidos(f"'{nombre}' debe ser un objeto")
    if set(objeto) != esperadas:
        raise ArgumentosNoValidos(
            f"'{nombre}' debe tener exactamente las claves: {', '.join(sorted(esperadas))}"
        )
    return objeto


def validar_args_separar(args: Any) -> ArgsSeparar:
    """Devuelve los argumentos tipados o lanza `ArgumentosNoValidos`."""
    a = _claves(args, "args", {"entrada", "salida_dir", "modelo", "dispositivo", "bloques"})
    m = _claves(a["modelo"], "modelo", {"id", "archivo", "dir"})
    archivo = m["archivo"]
    if (
        not isinstance(archivo, str)
        or not archivo
        or len(archivo) > 255
        or re.search(r"[\\/]", archivo)
    ):
        raise ArgumentosNoValidos("'modelo.archivo' debe ser un nombre de archivo")
    return ArgsSeparar(
        entrada=_ruta(a["entrada"], "entrada"),
        salida_dir=_ruta(a["salida_dir"], "salida_dir"),
        modelo_id=_opcion(m["id"], "modelo.id", MODELOS),
        modelo_archivo=archivo,
        modelo_dir=_ruta(m["dir"], "modelo.dir"),
        dispositivo=_opcion(a["dispositivo"], "dispositivo", DISPOSITIVOS),
        bloques=_opcion(a["bloques"], "bloques", BLOQUES),
    )
