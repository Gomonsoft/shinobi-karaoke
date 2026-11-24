"""Comando `info-lista-youtube` (ADR 0026 §1, tarea 0313): lista o álbum de YouTube en modo plano.

No descarga nada ni consulta vídeo a vídeo (`extract_flat: "in_playlist"`): títulos, canal y
duración de cada entrada. Los datos de música de cada vídeo los pide después main (`info-youtube`).
Los dobles de prueba se activan con `SHINOBI_YTDLP_FALSO` (`lista-<id de la lista>.json`).
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any
from urllib.parse import parse_qsl

from . import protocolo
from .errores import ArgumentosNoValidos, ErrorWorker
from .youtube import (
    _HOSTS_CORTOS,
    _HOSTS_YOUTUBE,
    FuenteYoutube,
    clasificar_error,
    descomponer_url,
    fuente_desde_entorno,
)

# Tope de entradas devueltas: el de elementos listados de una carpeta (ADR 0026 §1). El tope de
# 50 canciones por lote lo aplica `fuente.lote`; la tabla las muestra todas y marca las 50 primeras.
MAX_ENTRADAS = 500

_ID_LISTA = re.compile(r"^[A-Za-z0-9_-]{10,64}$")
_CANALES = {"channel", "c", "user"}
_TITULOS_NO_DISPONIBLES = {"[private video]", "[deleted video]", "[unavailable video]"}
_DISPONIBILIDAD_NO = {"private", "needs_auth", "premium_only", "subscriber_only"}
_LISTA_NO_DISPONIBLE = re.compile(
    r"playlist (?:does not exist|is private|is unavailable|is not available|is empty)"
    r"|private playlist|not viewable|this playlist (?:type )?is (?:unviewable|unavailable)"
    r"|does not exist|has been removed|\bprivate\b",
    re.IGNORECASE,
)


def tipo_de_lista(id_lista: str) -> str | None:
    """`album` (OLAK5uy_…), `lista` (PL…, UU…, …) o None si no se admite (mezcla `RD…`)."""
    if id_lista.startswith("RD"):
        return None
    return "album" if id_lista.startswith("OLAK5uy_") else "lista"


def analizar_url_lista(texto: object) -> tuple[str | None, str | None]:
    """`(id_lista, None)` o `(None, codigo)` con URL_NO_VALIDA / URL_NO_SOPORTADA.

    Se admiten `/playlist?list=`, `/watch?v=…&list=` y `youtu.be/<id>?list=`. Las mezclas
    automáticas (`RD…`) y los canales (`/@…`, `/channel/…`) son URL_NO_SOPORTADA.
    """
    url = descomponer_url(texto)
    if url is None:
        return None, "URL_NO_VALIDA"
    host = (url.hostname or "").lower()
    partes = [s for s in url.path.split("/") if s != ""]
    primero = partes[0] if partes else ""
    if host in _HOSTS_YOUTUBE and (primero.startswith("@") or primero in _CANALES):
        return None, "URL_NO_SOPORTADA"
    es_lista = (host in _HOSTS_YOUTUBE and primero in {"playlist", "watch"}) or (
        host in _HOSTS_CORTOS and len(partes) == 1
    )
    if not es_lista:
        return None, "URL_NO_VALIDA"
    consulta = parse_qsl(url.query, keep_blank_values=True)
    id_lista = next((v for k, v in consulta if k == "list"), "")
    if not _ID_LISTA.match(id_lista):
        return None, "URL_NO_VALIDA"
    if tipo_de_lista(id_lista) is None:
        return None, "URL_NO_SOPORTADA"
    return id_lista, None


def url_canonica_lista(id_lista: str) -> str:
    return f"https://www.youtube.com/playlist?list={id_lista}"


def clasificar_error_lista(mensaje: str, origen: BaseException | None = None) -> ErrorWorker:
    """Como `clasificar_error`, pero «no existe / privada» es `LISTA_NO_DISPONIBLE`."""
    error = clasificar_error(mensaje, origen)
    if error.codigo == "VIDEO_NO_DISPONIBLE" or (
        error.codigo == "ERROR_INTERNO" and _LISTA_NO_DISPONIBLE.search(mensaje or "")
    ):
        return ErrorWorker("LISTA_NO_DISPONIBLE", "La lista no está disponible")
    return error


def _entrada(e: Mapping[str, Any]) -> dict[str, Any] | None:
    id_video = e.get("id")
    if not isinstance(id_video, str) or not re.match(r"^[A-Za-z0-9_-]{11}$", id_video):
        return None
    titulo = str(e.get("title") or "")
    duracion = e.get("duration")
    en_directo = e.get("live_status") in {"is_live", "is_upcoming"} or bool(e.get("is_live"))
    no_disponible = (
        titulo.strip().lower() in _TITULOS_NO_DISPONIBLES
        or e.get("availability") in _DISPONIBILIDAD_NO
    )
    # Un directo que además es privado cuenta como no disponible.
    problema = "no_disponible" if no_disponible else "directo" if en_directo else None
    return {
        "id": id_video,
        "titulo": titulo,
        "canal": str(e.get("channel") or e.get("uploader") or ""),
        "duracion_s": float(duracion) if isinstance(duracion, int | float) else None,
        "disponible": problema is None,
        "problema": problema,
    }


def resumen_lista(info: Mapping[str, Any], id_lista: str) -> dict[str, Any]:
    crudas = [e for e in info.get("entries") or [] if isinstance(e, Mapping)]
    entradas = [x for x in (_entrada(e) for e in crudas) if x is not None]
    if not entradas:
        raise ErrorWorker("LISTA_NO_DISPONIBLE", "La lista está vacía o no está disponible")
    return {
        "titulo": str(info.get("title") or ""),
        "tipo": tipo_de_lista(id_lista),
        "entradas": entradas[:MAX_ENTRADAS],
        "recortada": len(entradas) > MAX_ENTRADAS,
    }


def info_lista_youtube(args: dict[str, Any], fuente: FuenteYoutube | None = None) -> None:
    url = args.get("url")
    if not isinstance(url, str):
        raise ArgumentosNoValidos("'url' debe ser una cadena")
    id_lista, codigo = analizar_url_lista(url)
    if id_lista is None:
        mensajes = {
            "URL_NO_SOPORTADA": "Los directos, los canales y las mezclas automáticas no se admiten",
            "URL_NO_VALIDA": "No parece un enlace de lista de YouTube",
        }
        raise ErrorWorker(codigo or "URL_NO_VALIDA", mensajes[codigo or "URL_NO_VALIDA"])
    fuente = fuente or fuente_desde_entorno()
    protocolo.progreso("consultando", None)
    info = fuente.info_lista(url_canonica_lista(id_lista), MAX_ENTRADAS)
    protocolo.resultado(resumen_lista(info, id_lista))
