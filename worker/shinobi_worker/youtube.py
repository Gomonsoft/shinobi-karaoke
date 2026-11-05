"""Fuente YouTube: validación de URL, adaptador `FuenteYoutube`, errores y `info-youtube`.

Las reglas de URL replican `app/src/shared/youtube.ts`; ambos lados se prueban con la
misma tabla (`app/src/shared/__fixtures__/youtube-urls.json`). Los dobles de prueba se
activan solo con `SHINOBI_YTDLP_FALSO=<dir>` (ADR 0009 §8).
"""

from __future__ import annotations

import base64
import json
import os
import re
import socket
import time
import urllib.error
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import parse_qsl, urlsplit

from . import metadatos_youtube, miniatura, protocolo
from .errores import ArgumentosNoValidos, ErrorWorker
from .importar_archivo import _es_sin_espacio, normalizar

MAX_LONGITUD_URL = 2048
PLAZO_MINIATURA_S = 10
VARIABLE_DOBLE = "SHINOBI_YTDLP_FALSO"

_ID_VIDEO = re.compile(r"^[A-Za-z0-9_-]{11}$")
_HOSTS_YOUTUBE = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"}
_HOSTS_CORTOS = {"youtu.be", "www.youtu.be"}

AlProgreso = Callable[[int, int | None], None]


# --- Validación de URL -------------------------------------------------------------


def analizar_url(texto: object) -> tuple[str | None, str | None]:
    """Devuelve `(id_video, None)` o `(None, codigo)` con URL_NO_VALIDA / URL_NO_SOPORTADA."""
    t = texto.strip() if isinstance(texto, str) else ""
    if t == "" or len(t) > MAX_LONGITUD_URL or re.search(r"\s", t):
        return None, "URL_NO_VALIDA"
    candidata = t
    if not re.match(r"^https?://", t, re.IGNORECASE):
        if re.match(r"^[a-z][a-z0-9+.-]*:(?!\d+(/|$))", t, re.IGNORECASE) or t.startswith("//"):
            return None, "URL_NO_VALIDA"
        candidata = f"https://{t}"
    try:
        url = urlsplit(candidata)
        url.port  # noqa: B018  (lanza ValueError si el puerto no es válido)
    except ValueError:
        return None, "URL_NO_VALIDA"
    autoridad = re.split(r"[/?#]", re.sub(r"^https?://", "", candidata, flags=re.IGNORECASE))[0]
    if re.search(r"[@:]", autoridad):
        return None, "URL_NO_VALIDA"

    host = (url.hostname or "").lower()
    partes = [s for s in url.path.split("/") if s != ""]
    if host in _HOSTS_CORTOS:
        return _de_id(partes[0]) if len(partes) == 1 else (None, "URL_NO_VALIDA")
    if host not in _HOSTS_YOUTUBE:
        return None, "URL_NO_VALIDA"

    primero = partes[0] if partes else None
    if primero == "playlist":
        return None, "URL_NO_SOPORTADA"
    if primero == "live":
        return (None, "URL_NO_SOPORTADA") if len(partes) == 2 else (None, "URL_NO_VALIDA")
    if primero == "shorts":
        return _de_id(partes[1]) if len(partes) == 2 else (None, "URL_NO_VALIDA")
    if primero == "watch" and len(partes) == 1:
        consulta = parse_qsl(url.query, keep_blank_values=True)
        v = next((valor for clave, valor in consulta if clave == "v"), None)
        if not v:
            hay_lista = any(clave == "list" for clave, _ in consulta)
            return None, "URL_NO_SOPORTADA" if hay_lista else "URL_NO_VALIDA"
        return _de_id(v)
    return None, "URL_NO_VALIDA"


def _de_id(id_video: str) -> tuple[str | None, str | None]:
    if _ID_VIDEO.match(id_video):
        return id_video, None
    return None, "URL_NO_VALIDA"


def url_canonica(id_video: str) -> str:
    return f"https://www.youtube.com/watch?v={id_video}"


def validar_url(texto: object) -> str:
    """Devuelve el id del vídeo o lanza `ErrorWorker` con el código que corresponda."""
    id_video, codigo = analizar_url(texto)
    if id_video is None:
        mensajes = {
            "URL_NO_SOPORTADA": "Solo se admiten vídeos sueltos (no listas ni directos)",
            "URL_NO_VALIDA": "No parece un enlace de vídeo de YouTube",
        }
        raise ErrorWorker(codigo or "URL_NO_VALIDA", mensajes[codigo or "URL_NO_VALIDA"])
    return id_video


# --- Clasificación de errores de yt-dlp -------------------------------------------

_NO_DISPONIBLE = re.compile(
    r"private video|video unavailable|this video is (?:not available|unavailable|no longer"
    r" available|private|not available)|has been removed|removed by|been terminated"
    r"|account associated.*terminated|confirm your age|age[- ]restricted|inappropriate for some"
    r"|not available in your country|in your country|blocked it|geo[- ]?restrict"
    r"|members[- ]only|join this channel|copyright claim|does not exist|deleted",
    re.IGNORECASE,
)
_BLOQUEADO = re.compile(
    r"not a bot|http error 40[39]|http error 429|too many requests|forbidden"
    r"|unable to extract|nsig|signature extraction|signature function|challenge"
    r"|player response|sabr|please sign in|requires? (?:a )?(?:js|javascript)",
    re.IGNORECASE,
)
_RED = re.compile(
    r"urlopen error|name resolution|getaddrinfo|nodename nor servname|connection (?:refused|reset"
    r"|aborted)|timed? ?out|network is unreachable|no route to host|temporary failure"
    r"|unable to connect|remote end closed|\bssl\b|errno (?:8|11001|110|111|101)|transporterror"
    r"|name or service not known|offline|no address associated",
    re.IGNORECASE,
)
_PREFIJO_ANSI = re.compile(r"\x1b\[[0-9;]*m")


def _origen(exc: BaseException) -> BaseException:
    """Excepción original que yt-dlp envuelve en `DownloadError` (`exc_info`)."""
    info = getattr(exc, "exc_info", None)
    if info and len(info) > 1 and isinstance(info[1], BaseException):
        return info[1]
    return exc.__cause__ or exc


def clasificar_error(mensaje: str, origen: BaseException | None = None) -> ErrorWorker:
    """Traduce el texto (y la excepción, si se conoce) de un fallo de yt-dlp a `ErrorWorker`."""
    texto = _PREFIJO_ANSI.sub("", mensaje or "")
    if isinstance(origen, urllib.error.HTTPError) or getattr(origen, "status", None):
        codigo_http = getattr(origen, "code", None) or getattr(origen, "status", None)
        if codigo_http in (403, 429):
            return _bloqueado(texto)
    if _NO_DISPONIBLE.search(texto) and not re.search(r"not a bot", texto, re.IGNORECASE):
        return ErrorWorker("VIDEO_NO_DISPONIBLE", "El vídeo no está disponible")
    if _BLOQUEADO.search(texto):
        return _bloqueado(texto)
    es_red = isinstance(
        origen, urllib.error.URLError | socket.timeout | ConnectionError | TimeoutError
    )
    if es_red or _RED.search(texto):
        return ErrorWorker("SIN_CONEXION", "No hay conexión con YouTube", True)
    return ErrorWorker("ERROR_INTERNO", texto.strip()[:300] or "Error desconocido de yt-dlp")


def _sin_espacio_o(exc: BaseException, origen: BaseException) -> ErrorWorker:
    if _es_sin_espacio(origen) or _es_sin_espacio(exc):
        return ErrorWorker("SIN_ESPACIO", "No queda espacio en disco para la descarga")
    return clasificar_error(str(exc), origen)


def _bloqueado(texto: str) -> ErrorWorker:
    return ErrorWorker("YOUTUBE_BLOQUEADO", "YouTube ha bloqueado la petición", True)


# --- Adaptador ------------------------------------------------------------------------


class FuenteYoutube(Protocol):
    def info(self, url: str) -> dict[str, Any]:
        """Metadatos del vídeo sin descargar el audio (forma de `extract_info`)."""

    def descargar(self, url: str, destino: Path, al_progreso: AlProgreso) -> Path:
        """Descarga el mejor audio en la carpeta `destino` y devuelve la ruta del archivo."""

    def obtener_miniatura(self, info: Mapping[str, Any]) -> bytes | None:
        """Bytes de la miniatura elegida (sin convertir) o None."""


class _LoggerYtdlp:
    """Reenvía los mensajes de yt-dlp a `log` del protocolo (nada a stdout)."""

    def debug(self, msg: str) -> None:
        if not msg.startswith("[debug]"):
            protocolo.log("debug", msg)

    def info(self, msg: str) -> None:
        protocolo.log("info", msg)

    def warning(self, msg: str) -> None:
        # Sin ffmpeg no se postprocesa nada (la normalización la hace PyAV): aviso inocuo.
        if "ffmpeg not found" in msg.lower() or "ffprobe" in msg.lower():
            return
        protocolo.log("warning", msg)

    def error(self, msg: str) -> None:
        protocolo.log("error", msg)


def _ruta_deno() -> str | None:
    try:
        from deno import find_deno_bin

        return str(find_deno_bin())
    except Exception as e:
        protocolo.log("warning", f"No se encontró Deno del paquete PyPI: {e}")
        return None


class FuenteYoutubeReal:
    """Implementación con la API Python de yt-dlp (sin cookies ni postprocesadores)."""

    def _opciones(self, **extra: Any) -> dict[str, Any]:
        deno = _ruta_deno()
        opciones: dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            "logger": _LoggerYtdlp(),
            "noplaylist": True,
            "postprocessors": [],
            "socket_timeout": 15,
            "js_runtimes": {"deno": {"path": deno} if deno else {}},
        }
        opciones.update(extra)
        return opciones

    def info(self, url: str) -> dict[str, Any]:
        from yt_dlp import YoutubeDL
        from yt_dlp.utils import DownloadError, ExtractorError

        try:
            with YoutubeDL(self._opciones(skip_download=True)) as ydl:
                datos = ydl.extract_info(url, download=False)
                if datos is None:
                    raise ErrorWorker("VIDEO_NO_DISPONIBLE", "El vídeo no está disponible")
                return dict(ydl.sanitize_info(datos))
        except (DownloadError, ExtractorError) as e:
            raise clasificar_error(str(e), _origen(e)) from e
        except OSError as e:
            raise clasificar_error(str(e), e) from e

    def descargar(self, url: str, destino: Path, al_progreso: AlProgreso) -> Path:
        from yt_dlp import YoutubeDL
        from yt_dlp.utils import DownloadError, ExtractorError

        def gancho(d: Mapping[str, Any]) -> None:
            if d.get("status") == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate")
                al_progreso(int(d.get("downloaded_bytes") or 0), int(total) if total else None)

        destino.mkdir(parents=True, exist_ok=True)
        opciones = self._opciones(
            format="bestaudio/best",
            outtmpl=str(destino / "descarga.%(ext)s"),
            progress_hooks=[gancho],
            noprogress=True,
            overwrites=True,
            continuedl=False,
        )
        try:
            with YoutubeDL(opciones) as ydl:
                datos = ydl.extract_info(url, download=True)
                ruta = Path(ydl.prepare_filename(datos))
        except (DownloadError, ExtractorError) as e:
            raise _sin_espacio_o(e, _origen(e)) from e
        except OSError as e:
            raise _sin_espacio_o(e, e) from e
        if not ruta.is_file():
            raise ErrorWorker("ERROR_INTERNO", "yt-dlp no dejó el archivo descargado")
        return ruta

    def obtener_miniatura(self, info: Mapping[str, Any]) -> bytes | None:
        url = miniatura.elegir_url(info)
        if not url:
            return None
        from yt_dlp import YoutubeDL
        from yt_dlp.networking import Request

        with YoutubeDL(self._opciones()) as ydl:
            respuesta = ydl.urlopen(Request(url, extensions={"timeout": PLAZO_MINIATURA_S}))
            try:
                return respuesta.read(miniatura.MAX_BYTES_ORIGEN)
            finally:
                respuesta.close()


class FuenteYoutubeFalsa:
    """Doble de prueba: lee `<dir>/<id>.json` (forma de `extract_info`) o `{"error": "..."}`."""

    def __init__(self, directorio: Path) -> None:
        self.directorio = directorio

    def _id(self, url: str) -> str:
        id_video, _ = analizar_url(url)
        if id_video is None:
            raise ErrorWorker("URL_NO_VALIDA", "No parece un enlace de vídeo de YouTube")
        return id_video

    def info(self, url: str) -> dict[str, Any]:
        id_video = self._id(url)
        ruta = self.directorio / f"{id_video}.json"
        if not ruta.is_file():
            raise clasificar_error("ERROR: [youtube] Video unavailable")
        datos = json.loads(ruta.read_text(encoding="utf-8"))
        if isinstance(datos, dict) and "error" in datos:
            raise clasificar_error(str(datos["error"]))
        datos.setdefault("id", id_video)
        return datos

    def descargar(self, url: str, destino: Path, al_progreso: AlProgreso) -> Path:
        """Genera un audio de `duration` s (máx. 60). Claves opcionales de la fixture:
        `error_descarga` (falla al descargar), `error_descarga_una_vez` (falla solo el primer
        intento; lo recuerda con un marcador `<id>.intentado` junto a la fixture),
        `bytes_por_segundo` (total simulado) y `ritmo` (segundos que dura la descarga simulada,
        con progreso ~10/s)."""
        import numpy as np
        import soundfile as sf

        info = self.info(url)
        if info.get("error_descarga"):
            raise clasificar_error(str(info["error_descarga"]))
        if info.get("error_descarga_una_vez"):
            marcador = self.directorio / f"{info.get('id')}.intentado"
            if not marcador.exists():
                marcador.write_text("1", encoding="utf-8")
                raise clasificar_error(str(info["error_descarga_una_vez"]))
        segundos = min(float(info.get("duration") or 3), 60.0)
        destino.mkdir(parents=True, exist_ok=True)
        ruta = destino / "descarga.wav"
        t = np.arange(int(segundos * 44100), dtype=np.float32) / 44100
        sf.write(ruta, (0.3 * np.sin(2 * np.pi * 440 * t)).astype(np.float32), 44100)
        bps = info.get("bytes_por_segundo")
        total = (
            int(segundos * bps) if isinstance(bps, int | float) and bps > 0 else ruta.stat().st_size
        )
        ritmo = float(info.get("ritmo") or 0)
        pasos = max(1, round(ritmo * 10)) if ritmo > 0 else 1
        for i in range(1, pasos + 1):
            if ritmo > 0:
                time.sleep(ritmo / pasos)
            al_progreso(total * i // pasos, total)
        return ruta

    def obtener_miniatura(self, info: Mapping[str, Any]) -> bytes | None:
        for extension in ("webp", "jpg"):
            ruta = self.directorio / f"{info.get('id')}.{extension}"
            if ruta.is_file():
                return ruta.read_bytes()
        return None


def fuente_desde_entorno(entorno: Mapping[str, str] | None = None) -> FuenteYoutube:
    directorio = (os.environ if entorno is None else entorno).get(VARIABLE_DOBLE)
    if directorio:
        return FuenteYoutubeFalsa(Path(directorio))
    return FuenteYoutubeReal()


# --- Comando info-youtube -----------------------------------------------------------


def comprobar_soportado(info: Mapping[str, Any]) -> None:
    """Rechaza listas y directos (también los programados)."""
    en_directo = {"is_live", "is_upcoming", "post_live"}
    if (
        info.get("_type") == "playlist"
        or info.get("is_live")
        or info.get("is_upcoming")
        or info.get("live_status") in en_directo
    ):
        raise ErrorWorker(
            "URL_NO_SOPORTADA", "Solo se admiten vídeos sueltos (no listas ni directos)"
        )


def miniatura_jpeg_base64(fuente: FuenteYoutube, info: Mapping[str, Any]) -> str | None:
    """Miniatura en JPEG base64; cualquier fallo se registra y devuelve None (no es un error)."""
    try:
        crudo = fuente.obtener_miniatura(info)
        if not crudo:
            return None
        return base64.b64encode(miniatura.a_jpeg(crudo)).decode("ascii")
    except Exception as e:
        protocolo.log("warning", f"Sin miniatura: {type(e).__name__}: {e}")
        return None


def resumen_info(fuente: FuenteYoutube, id_video: str, info: Mapping[str, Any]) -> dict[str, Any]:
    comprobar_soportado(info)
    canal = info.get("channel") or info.get("uploader") or ""
    duracion = info.get("duration")
    datos: dict[str, Any] = {
        "id_video": id_video,
        "titulo_original": str(info.get("title") or ""),
        "canal": str(canal),
        "duracion_s": float(duracion) if isinstance(duracion, int | float) else 0.0,
        "metadatos": metadatos_youtube.sugerir(info),
    }
    jpeg = miniatura_jpeg_base64(fuente, info)
    if jpeg:
        datos["miniatura_jpeg_base64"] = jpeg
    return datos


def info_youtube(args: dict[str, Any], fuente: FuenteYoutube | None = None) -> None:
    url = args.get("url")
    if not isinstance(url, str):
        raise ArgumentosNoValidos("'url' debe ser una cadena")
    id_video = validar_url(url)
    fuente = fuente or fuente_desde_entorno()
    info = fuente.info(url_canonica(id_video))
    protocolo.resultado(resumen_info(fuente, id_video, info))


# --- Comando descargar-youtube --------------------------------------------------------

INTERVALO_PROGRESO_S = 0.25


def _borrar_restos(salida: Path) -> None:
    fuente = salida / "fuente"
    for resto in fuente.glob("descarga.*"):
        resto.unlink(missing_ok=True)
    (fuente / "mezcla.flac.tmp").unlink(missing_ok=True)


def descargar_youtube(args: dict[str, Any], fuente: FuenteYoutube | None = None) -> None:
    """Descarga el mejor audio y lo normaliza a `fuente/mezcla.flac` en el mismo trabajo."""
    url = args.get("url")
    salida_txt = args.get("salida")
    if not isinstance(url, str):
        raise ArgumentosNoValidos("'url' debe ser una cadena")
    if not isinstance(salida_txt, str) or not salida_txt:
        raise ArgumentosNoValidos("'salida' debe ser una ruta (cadena no vacia)")
    id_video = validar_url(url)
    salida = Path(salida_txt)
    fuente = fuente or fuente_desde_entorno()

    ultimo = -INTERVALO_PROGRESO_S
    bytes_descargados = 0

    def al_progreso(descargados: int, total: int | None) -> None:
        nonlocal ultimo, bytes_descargados
        bytes_descargados = descargados
        ahora = time.monotonic()
        final = total is not None and descargados >= total
        if not final and ahora - ultimo < INTERVALO_PROGRESO_S:
            return
        ultimo = ahora
        valor = descargados / total if total else None
        protocolo.progreso("descargando", valor, {"bytes": descargados, "total": total})

    try:
        protocolo.progreso("descargando", None)
        try:
            ruta = fuente.descargar(url_canonica(id_video), salida / "fuente", al_progreso)
        except OSError as e:
            raise _sin_espacio_o(e, e) from e
        protocolo.progreso("preparando", None)
        datos = normalizar(ruta, salida, borrar_entrada=True)
    except BaseException:
        _borrar_restos(salida)
        raise
    _borrar_restos(salida)
    protocolo.resultado({**datos, "bytes_descargados": bytes_descargados, "id_video": id_video})
