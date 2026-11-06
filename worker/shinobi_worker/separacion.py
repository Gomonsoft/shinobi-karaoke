"""Comando `separar` e interfaz `Separador` (tarea 0060; ADR 0004 y revisiones, ADR 0009 §8).

El comando valida la entrada, delega la separacion en un `Separador` y deja en `salida_dir`
exactamente `voz.flac` e `instrumental.flac`. Fases (`FASES_SEPARACION`): `preparando` (la emite
el comando), y `cargando_modelo`, `separando` (0-1, `detalle {paso,total}`) y `guardando`, que
emite el `Separador` a traves de `al_progreso`. Con `SHINOBI_SEPARADOR_FALSO` se usa el doble
(`separacion_falso.py`); si no, el adaptador real (tarea 0061, importacion perezosa).

Este modulo no importa `audio_separator`, `torch` ni `onnxruntime`.
"""

from __future__ import annotations

import errno
import shutil
import time
import traceback
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any, Protocol

import soundfile as sf

from . import protocolo
from .argumentos_separar import ArgsSeparar, validar_args_separar
from .errores import ArgumentosNoValidos, ErrorWorker

ENV_SEPARADOR_FALSO = "SHINOBI_SEPARADOR_FALSO"
ENV_INTENTO = "SHINOBI_INTENTO"

VOZ = "voz.flac"
INSTRUMENTAL = "instrumental.flac"
FS = 44100
CANALES = 2

AlProgreso = Callable[[str, float | None, dict[str, Any] | None], None]


class Separador(Protocol):
    """Separa `entrada` y deja en `salida_dir` exactamente `voz.flac` e `instrumental.flac`.

    Emite `cargando_modelo`, `separando` y `guardando` con `al_progreso(fase, valor, detalle)`.
    """

    version_audio_separator: str

    def separar(
        self,
        entrada: Path,
        salida_dir: Path,
        modelo: Mapping[str, str],
        dispositivo: str,
        bloques: str,
        al_progreso: AlProgreso,
    ) -> None: ...


def al_progreso_protocolo(
    fase: str, valor: float | None, detalle: dict[str, Any] | None = None
) -> None:
    protocolo.progreso(fase, valor, detalle)


def crear_separador(entorno: Mapping[str, str]) -> Separador:
    """Doble si llega `SHINOBI_SEPARADOR_FALSO`; si no, el adaptador real (0061), importado aqui."""
    escenario = entorno.get(ENV_SEPARADOR_FALSO)
    if escenario:
        from .separacion_falso import SeparadorFalso

        intento = _intento(entorno.get(ENV_INTENTO))
        return SeparadorFalso(Path(escenario), intento)
    try:
        from .separacion_real import SeparadorReal  # tarea 0061

        return SeparadorReal()
    except ImportError as e:
        raise ErrorWorker(
            "RUNTIME_NO_DISPONIBLE", f"Falta un componente del motor de audio: {e.name or e}"
        ) from e


def _intento(texto: str | None) -> int | None:
    if texto is None or texto == "":
        return None
    try:
        return int(texto)
    except ValueError as e:
        raise ArgumentosNoValidos(f"{ENV_INTENTO} debe ser un entero") from e


def _comprobar_entrada(entrada: Path) -> None:
    if not entrada.is_file():
        raise ArgumentosNoValidos("El archivo de entrada no existe")
    try:
        info = sf.info(str(entrada))
    except (sf.LibsndfileError, RuntimeError) as e:
        raise ErrorWorker("FORMATO_NO_SOPORTADO", "La entrada no es un audio legible") from e
    if (
        info.format != "FLAC"
        or info.subtype != "PCM_16"
        or info.samplerate != FS
        or info.channels != CANALES
    ):
        raise ErrorWorker(
            "FORMATO_NO_SOPORTADO",
            "La entrada debe ser FLAC PCM 16, 44,1 kHz, estereo "
            f"(es {info.format} {info.subtype} {info.samplerate} Hz, {info.channels} canales)",
        )


def _comprobar_modelo(a: ArgsSeparar) -> None:
    dir_ = Path(a.modelo_dir)
    faltan = [a.modelo_archivo]
    if a.modelo_id == "calidad":
        faltan.append(Path(a.modelo_archivo).with_suffix(".yaml").name)
    ausentes = [n for n in faltan if not (dir_ / n).is_file()]
    if ausentes:
        raise ErrorWorker("MODELO_NO_DISPONIBLE", f"Falta en {a.modelo_dir}: {', '.join(ausentes)}")


def _vaciar(salida: Path) -> None:
    """Borra lo que haya dentro de `salida_dir` (no la carpeta ni nada fuera de ella)."""
    if not salida.is_dir():
        return
    for hijo in salida.iterdir():
        try:
            if hijo.is_dir() and not hijo.is_symlink():
                shutil.rmtree(hijo, ignore_errors=True)
            else:
                hijo.unlink(missing_ok=True)
        except OSError:
            pass


def _traducir(e: BaseException) -> ErrorWorker:
    if isinstance(e, ErrorWorker):
        return e
    if isinstance(e, OSError) and e.errno == errno.ENOSPC:
        return ErrorWorker("SIN_ESPACIO", "No queda espacio en disco para las pistas")
    if isinstance(e, MemoryError):
        return ErrorWorker("MEMORIA_INSUFICIENTE", "No hay memoria suficiente", True)
    protocolo.log("error", "".join(traceback.format_exception(e)))
    return ErrorWorker("ERROR_INTERNO", f"{type(e).__name__}: {e}")


def separar(args: dict[str, Any], entorno: Mapping[str, str] | None = None) -> None:
    import os

    entorno = os.environ if entorno is None else entorno
    inicio = time.monotonic()
    a = validar_args_separar(args)
    salida = Path(a.salida_dir)
    tiempos: dict[str, float] = {}

    def al_progreso(fase: str, valor: float | None, detalle: dict[str, Any] | None = None) -> None:
        ahora = time.monotonic()
        if fase == "separando":
            tiempos.setdefault("separando_ini", ahora)
        elif fase == "guardando":
            tiempos.setdefault("separando_fin", ahora)
        protocolo.progreso(fase, valor, detalle)

    try:
        protocolo.progreso("preparando", None)
        _comprobar_entrada(Path(a.entrada))
        _comprobar_modelo(a)
        separador = crear_separador(entorno)
        salida.mkdir(parents=True, exist_ok=True)
        separador.separar(
            Path(a.entrada),
            salida,
            {"id": a.modelo_id, "archivo": a.modelo_archivo, "dir": a.modelo_dir},
            a.dispositivo,
            a.bloques,
            al_progreso,
        )
        if {p.name for p in salida.iterdir()} != {VOZ, INSTRUMENTAL}:
            raise ErrorWorker(
                "ERROR_INTERNO", "El separador no dejo exactamente voz e instrumental"
            )
    except BaseException as e:
        if isinstance(e, Exception):
            _vaciar(salida)
            traducido = _traducir(e)
            if traducido is e:
                raise
            raise traducido from e
        raise
    fin = time.monotonic()
    ini = tiempos.get("separando_ini", fin)
    sep_fin = tiempos.get("separando_fin", fin)
    protocolo.resultado(
        {
            "voz": VOZ,
            "instrumental": INSTRUMENTAL,
            "modelo": {
                "id": a.modelo_id,
                "archivo": a.modelo_archivo,
                "version_audio_separator": separador.version_audio_separator,
            },
            "dispositivo": a.dispositivo,
            "segundos_separando": round(max(0.0, sep_fin - ini), 1),
            "segundos_total": round(fin - inicio, 1),
        }
    )
