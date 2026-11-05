"""Comando `importar-archivo` y normalizacion de audio (ADR 0003, tarea 0041).

API publica para reutilizar (p. ej. `descargar-youtube`, tarea 0048):

- `normalizar(entrada, salida, ...)`: decodifica con PyAV, escribe `fuente/mezcla.flac`
  (44,1 kHz, estereo, PCM 16) y devuelve el dict con el esquema `ResultadoImportarArchivo`.
- `metadatos_desde_nombre(nombre)`: heuristica `Artista - Titulo` sobre un nombre de archivo.
- `limpiar_texto(texto)`: recorte de espacios y maximo de 200 caracteres.

Memoria: la decodificacion y la escritura van por bloques; solo pyloudnorm necesita las
muestras completas (float32 acumulado; ~230 MB para 11 min estereo, pico de RAM del
proceso algo mayor porque pyloudnorm filtra en float64).
"""

from __future__ import annotations

import errno
import math
import os
import re
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

import av
import av.error
import numpy as np
import pyloudnorm
import soundfile as sf

from . import protocolo
from .errores import ArgumentosNoValidos, ErrorWorker

FS = 44100
CANALES = 2
DURACION_MINIMA_S = 10
OBJETIVO_LUFS = -16.0
GANANCIA_MAX_DB = 20.0
MAX_TEXTO = 200
MEZCLA_REL = "fuente/mezcla.flac"

_PISTA = re.compile(r"^\d{1,3}(?:\s*[.\-]\s*|\s+)(?=\S)")
_SEPARADOR = re.compile(r"\s+-\s+")


def limpiar_texto(texto: object) -> str:
    """Quita NUL y espacios de los extremos y limita a 200 caracteres."""
    if not isinstance(texto, str):
        return ""
    return texto.replace("\x00", "").strip()[:MAX_TEXTO].strip()


def metadatos_desde_nombre(nombre: str) -> dict[str, str]:
    """`01 - Artista - Titulo.mp3` -> artista/titulo. Sin separador, todo es el titulo."""
    base = Path(nombre).stem.replace("_", " ")
    base = " ".join(base.split())
    base = _PISTA.sub("", base, count=1)
    partes = _SEPARADOR.split(base, maxsplit=1)
    if len(partes) == 2 and partes[0].strip() and partes[1].strip():
        artista, titulo = partes
    else:
        artista, titulo = "", base
    return {"titulo": limpiar_texto(titulo), "artista": limpiar_texto(artista), "album": ""}


def _etiquetas(contenedor: av.container.InputContainer, pista: Any) -> dict[str, str]:
    """Etiquetas title/artist/album del contenedor y de la pista (sin distinguir mayusculas)."""
    encontradas: dict[str, str] = {}
    for fuente in (contenedor.metadata, pista.metadata):
        for clave, valor in dict(fuente).items():
            k = str(clave).lower()
            if k in ("title", "artist", "album") and k not in encontradas:
                texto = limpiar_texto(valor)
                if texto:
                    encontradas[k] = texto
    return encontradas


def _metadatos(etiquetas: dict[str, str], nombre: str) -> dict[str, str]:
    heuristica = metadatos_desde_nombre(nombre)
    if "title" in etiquetas:
        return {
            "titulo": etiquetas["title"],
            "artista": etiquetas.get("artist", ""),
            "album": etiquetas.get("album", ""),
        }
    return {
        "titulo": heuristica["titulo"],
        "artista": etiquetas.get("artist") or heuristica["artista"],
        "album": etiquetas.get("album", ""),
    }


def _ganancia(lufs: float | None) -> float:
    if lufs is None:
        return 0.0
    ganancia = round(OBJETIVO_LUFS - lufs, 1)
    return max(-GANANCIA_MAX_DB, min(GANANCIA_MAX_DB, ganancia))


def _medir(bloques: list[np.ndarray]) -> float | None:
    datos = np.concatenate(bloques, axis=0)
    with np.errstate(all="ignore"):
        lufs = float(pyloudnorm.Meter(FS).integrated_loudness(datos))
    return lufs if math.isfinite(lufs) else None


def _sin_ruta(texto: str, entrada: Path) -> str:
    return texto.replace(str(entrada), entrada.name)


def _es_sin_espacio(e: BaseException) -> bool:
    if isinstance(e, OSError) and e.errno == errno.ENOSPC:
        return True
    return "no space left" in str(e).lower() or "no hay espacio" in str(e).lower()


def _decodificar_y_escribir(
    entrada: Path,
    tmp: Path,
    alprogreso: Callable[[float | None], None],
) -> tuple[int, list[np.ndarray], dict[str, str]]:
    """Decodifica por bloques a `tmp` (FLAC PCM 16). Devuelve (muestras, bloques, etiquetas)."""
    try:
        contenedor = av.open(str(entrada))
    except (av.error.FFmpegError, ValueError, UnicodeError) as e:
        raise ErrorWorker(
            "FORMATO_NO_SOPORTADO", _sin_ruta(f"No se pudo abrir el archivo: {e}", entrada)
        ) from e
    with contenedor:
        pista = next((s for s in contenedor.streams if s.type == "audio"), None)
        if pista is None:
            raise ErrorWorker("FORMATO_NO_SOPORTADO", "El archivo no contiene una pista de audio")
        etiquetas = _etiquetas(contenedor, pista)
        total_s = contenedor.duration / av.time_base if contenedor.duration else None
        remuestreador = av.AudioResampler(format="fltp", layout="stereo", rate=FS)
        bloques: list[np.ndarray] = []
        muestras = 0
        ultimo = 0.0

        def convertir(tramas: list[av.AudioFrame]) -> None:
            nonlocal muestras, ultimo
            for t in tramas:
                bloque = np.ascontiguousarray(t.to_ndarray()[:CANALES].T, dtype=np.float32)
                if len(bloque) == 0:
                    continue
                destino.write(bloque)
                bloques.append(bloque)
                muestras += len(bloque)
            ahora = time.monotonic()
            if total_s and ahora - ultimo >= 0.1:
                ultimo = ahora
                alprogreso(muestras / FS / total_s)

        with sf.SoundFile(
            str(tmp), "w", samplerate=FS, channels=CANALES, subtype="PCM_16", format="FLAC"
        ) as destino:
            try:
                for paquete in contenedor.demux(pista):
                    for trama in paquete.decode():
                        convertir(remuestreador.resample(trama))
                convertir(remuestreador.resample(None))
            except (av.error.FFmpegError, ValueError) as e:
                # Archivo truncado o corrupto: se conserva lo decodificado hasta aqui.
                if muestras == 0:
                    raise ErrorWorker(
                        "FORMATO_NO_SOPORTADO",
                        _sin_ruta(f"No se pudo decodificar el audio: {e}", entrada),
                    ) from e
    return muestras, bloques, etiquetas


def normalizar(
    entrada: Path,
    salida: Path,
    *,
    borrar_entrada: bool = False,
    alprogreso: Callable[[float | None], None] | None = None,
) -> dict[str, Any]:
    """Escribe `<salida>/fuente/mezcla.flac` y devuelve el resultado de `importar-archivo`.

    Lanza `ErrorWorker` (catalogo de codigos). Nunca deja `mezcla.flac` parcial ni `.tmp`
    tras un error controlado. `alprogreso(valor 0-1)` se llama por bloques si la duracion
    del contenedor es conocida.
    """
    alprogreso = alprogreso or (lambda v: protocolo.progreso("preparando", v))
    destino = salida / MEZCLA_REL
    tmp = destino.with_name(destino.name + ".tmp")
    try:
        destino.parent.mkdir(parents=True, exist_ok=True)
        muestras, bloques, etiquetas = _decodificar_y_escribir(entrada, tmp, alprogreso)
        if muestras == 0:
            raise ErrorWorker("FORMATO_NO_SOPORTADO", "El archivo no contiene muestras de audio")
        if muestras < DURACION_MINIMA_S * FS:
            raise ErrorWorker(
                "AUDIO_DEMASIADO_CORTO",
                f"El audio dura {muestras / FS:.1f} s; el minimo es {DURACION_MINIMA_S} s",
            )
        lufs = _medir(bloques)
        del bloques
        os.replace(tmp, destino)
    except ErrorWorker:
        tmp.unlink(missing_ok=True)
        raise
    except (OSError, sf.LibsndfileError, RuntimeError) as e:
        tmp.unlink(missing_ok=True)
        if _es_sin_espacio(e):
            raise ErrorWorker("SIN_ESPACIO", "No queda espacio en disco para la mezcla") from e
        raise
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise
    if borrar_entrada:
        entrada.unlink(missing_ok=True)
    return {
        "duracion_ms": round(muestras * 1000 / FS),
        "metadatos": _metadatos(etiquetas, entrada.name),
        "ganancia_db": _ganancia(lufs),
        "lufs": None if lufs is None else round(lufs, 2),
        "nombre_original": entrada.name,
        "mezcla": MEZCLA_REL,
    }


def _ruta(args: dict[str, Any], clave: str) -> Path:
    valor = args.get(clave)
    if not isinstance(valor, str) or not valor:
        raise ArgumentosNoValidos(f"'{clave}' debe ser una ruta (cadena no vacia)")
    return Path(valor)


def importar_archivo(args: dict[str, Any]) -> None:
    entrada = _ruta(args, "entrada")
    salida = _ruta(args, "salida")
    borrar = args.get("borrar_entrada", False)
    if not isinstance(borrar, bool):
        raise ArgumentosNoValidos("'borrar_entrada' debe ser booleano")
    if not entrada.is_file():
        raise ArgumentosNoValidos("El archivo de entrada no existe")
    protocolo.progreso("preparando", None)
    protocolo.resultado(normalizar(entrada, salida, borrar_entrada=borrar))
