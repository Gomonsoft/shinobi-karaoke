"""Metadatos sugeridos a partir de la información de YouTube (ADR 0003, heurística)."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

_RUIDO = (
    r"official\s+(?:music\s+)?(?:video|audio|lyric\s+video|visuali[sz]er)",
    r"official",
    r"lyric\s+video",
    r"lyrics?",
    r"audio",
    r"video\s+oficial",
    r"audio\s+oficial",
    r"letra",
    r"hd",
    r"hq",
    r"4k",
)
_GRUPO = "(?:" + "|".join(_RUIDO) + ")"
# `(Official Video)`, `[Lyrics]`, `(Official Video) [HD]`... al final; admite varios tokens.
_SUFIJO_ENTRE_SIGNOS = re.compile(
    rf"\s*[\(\[]\s*{_GRUPO}(?:\s*[|,/&+-]?\s*{_GRUPO})*\s*[\)\]]\s*$", re.IGNORECASE
)
_SUFIJO_SUELTO = re.compile(r"\s+(?:hd|4k)\s*$", re.IGNORECASE)
_FEAT_ENTRE_SIGNOS = re.compile(r"\s*[\(\[]\s*(?:ft|feat)\b\.?\s+[^\)\]]*[\)\]]\s*$", re.IGNORECASE)
_FEAT_FINAL = re.compile(r"\s+(?:ft|feat)\b\.?\s+(?:(?!\s[-–—]\s).)+$", re.IGNORECASE)
_SEPARADOR = re.compile(r"\s+[-–—]\s+")
_RUIDO_CANAL = (
    re.compile(r"\s*-\s*topic\s*$", re.IGNORECASE),
    re.compile(r"\s*vevo\s*$", re.IGNORECASE),
    re.compile(r"\s*official\s*$", re.IGNORECASE),
    re.compile(r"^\s*official\s+", re.IGNORECASE),
)


def _espacios(texto: str) -> str:
    return re.sub(r"\s+", " ", texto).strip()


def limpiar_titulo(titulo: str) -> str:
    """Quita sufijos habituales ("(Official Video)", "[Lyrics]", "HD", "ft. X") del final."""
    actual = _espacios(titulo)
    while True:
        previo = actual
        for patron in (_SUFIJO_ENTRE_SIGNOS, _FEAT_ENTRE_SIGNOS, _SUFIJO_SUELTO, _FEAT_FINAL):
            actual = patron.sub("", actual).strip()
        if actual == previo:
            return actual or _espacios(titulo)


def limpiar_canal(canal: str) -> str:
    actual = _espacios(canal)
    cambiado = True
    while cambiado:
        cambiado = False
        for patron in _RUIDO_CANAL:
            nuevo = patron.sub("", actual).strip()
            if nuevo and nuevo != actual:
                actual, cambiado = nuevo, True
    return actual


def _texto(info: Mapping[str, Any], clave: str) -> str:
    valor = info.get(clave)
    return _espacios(valor) if isinstance(valor, str) else ""


def sugerir(info: Mapping[str, Any]) -> dict[str, str]:
    """`{"titulo", "artista", "album"}` (cadenas, vacías si no se sabe)."""
    pista, artista, album = _texto(info, "track"), _texto(info, "artist"), _texto(info, "album")
    if pista:
        return {"titulo": pista, "artista": artista or _canal(info), "album": album}

    titulo = limpiar_titulo(_texto(info, "title"))
    partes = _SEPARADOR.split(titulo, maxsplit=1)
    if len(partes) == 2 and partes[0].strip() and partes[1].strip():
        izquierda, derecha = partes[0].strip(), partes[1].strip()
        return {"titulo": derecha, "artista": artista or izquierda, "album": album}
    return {"titulo": titulo, "artista": artista or _canal(info), "album": album}


def _canal(info: Mapping[str, Any]) -> str:
    return limpiar_canal(_texto(info, "channel") or _texto(info, "uploader"))
