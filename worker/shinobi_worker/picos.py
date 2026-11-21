"""Picos de voz en el formato binario SKPV (ADR 0015)."""

from __future__ import annotations

import errno
from pathlib import Path
from struct import Struct
from typing import Any, BinaryIO

import av
import numpy as np

from . import protocolo
from .errores import ArgumentosNoValidos, ErrorWorker

_CABECERA = Struct("<4sHHIQI")
_PAR = Struct("<hh")
_BLOQUES_POR_SEGUNDO = 100
_PARES_POR_LOTE = 4096


def _ruta(args: dict[str, Any], clave: str) -> Path:
    valor = args.get(clave)
    if not isinstance(valor, str) or not valor or "\0" in valor:
        raise ArgumentosNoValidos(f"'{clave}' debe ser una ruta no vacía")
    return Path(valor)


def _abrir_flac(fuente: BinaryIO) -> av.container.InputContainer:
    try:
        cabecera = fuente.read(4)
        fuente.seek(0)
        if cabecera == b"fLaC":
            return av.open(fuente, format="flac")
    except OSError as e:
        raise ErrorWorker("FORMATO_NO_SOPORTADO", "No se pudo abrir la pista de voz") from e
    raise ErrorWorker("FORMATO_NO_SOPORTADO", "La pista de voz no es FLAC")


def _escribir_base(entrada: Path, destino: BinaryIO) -> tuple[int, int, int]:
    # Abrir el archivo local explícitamente impide que FFmpeg interprete la ruta como URL.
    try:
        fuente = entrada.open("rb")
    except OSError as e:
        raise ErrorWorker("FORMATO_NO_SOPORTADO", "No se pudo abrir la pista de voz") from e

    with fuente, _abrir_flac(fuente) as contenedor:
        pista = next(iter(contenedor.streams.audio), None)
        if pista is None or not pista.sample_rate or pista.sample_rate < _BLOQUES_POR_SEGUNDO:
            raise ErrorWorker(
                "FORMATO_NO_SOPORTADO", "La pista de voz no tiene una frecuencia válida"
            )

        frecuencia = pista.sample_rate
        convertir = av.AudioResampler(format="s16", layout=pista.layout, rate=frecuencia)
        muestras = bloques = 0
        minimo, maximo = 32767, -32768

        def agregar(trama: av.AudioFrame) -> None:
            nonlocal muestras, bloques, minimo, maximo
            pcm = trama.to_ndarray().reshape(trama.samples, -1)
            inicio = 0
            while inicio < trama.samples:
                limite = (bloques + 1) * frecuencia // _BLOQUES_POR_SEGUNDO
                cantidad = min(limite - muestras, trama.samples - inicio)
                tramo = pcm[inicio : inicio + cantidad]
                minimo = min(minimo, int(tramo.min()))
                maximo = max(maximo, int(tramo.max()))
                inicio += cantidad
                muestras += cantidad
                if muestras == limite:
                    destino.write(_PAR.pack(minimo, maximo))
                    bloques += 1
                    minimo, maximo = 32767, -32768

        for trama in contenedor.decode(pista):
            for convertida in convertir.resample(trama):
                agregar(convertida)
        for convertida in convertir.resample(None):
            agregar(convertida)

        if muestras == 0:
            raise ErrorWorker("FORMATO_NO_SOPORTADO", "La pista de voz no contiene muestras")
        if minimo <= maximo:
            destino.write(_PAR.pack(minimo, maximo))
            bloques += 1
        return frecuencia, muestras, bloques


def _escribir_niveles(destino: BinaryIO, bloques: int) -> None:
    inicio = _CABECERA.size
    while bloques > 1:
        siguiente = inicio + bloques * _PAR.size
        escritura = siguiente
        # El lote es par para no partir parejas entre lecturas.
        for primero in range(0, bloques, _PARES_POR_LOTE):
            cantidad = min(bloques - primero, _PARES_POR_LOTE)
            destino.seek(inicio + primero * _PAR.size)
            pares = np.frombuffer(destino.read(cantidad * _PAR.size), dtype="<i2").reshape(-1, 2)
            agregados = pares[::2].copy()
            parejas = pares[1::2]
            # Cuando queda un bloque impar, su par se conserva tal cual.
            np.minimum(
                agregados[: len(parejas), 0], parejas[:, 0], out=agregados[: len(parejas), 0]
            )
            np.maximum(
                agregados[: len(parejas), 1], parejas[:, 1], out=agregados[: len(parejas), 1]
            )
            destino.seek(escritura)
            escritura += destino.write(agregados.tobytes())
        inicio = siguiente
        bloques = (bloques + 1) // 2


def generar_picos(args: dict[str, Any]) -> None:
    entrada, salida = _ruta(args, "entrada"), _ruta(args, "salida")
    creado = False
    try:
        with salida.open("x+b") as destino:
            creado = True
            destino.write(bytes(_CABECERA.size))
            frecuencia, muestras, bloques = _escribir_base(entrada, destino)
            _escribir_niveles(destino, bloques)
            destino.seek(0)
            destino.write(_CABECERA.pack(b"SKPV", 1, 0, frecuencia, muestras, bloques))
    except BaseException as e:
        if creado:
            salida.unlink(missing_ok=True)
        if isinstance(e, (av.error.FFmpegError, ValueError)):
            raise ErrorWorker(
                "FORMATO_NO_SOPORTADO", "No se pudo decodificar la pista de voz"
            ) from e
        if isinstance(e, OSError):
            if e.errno == errno.ENOSPC:
                raise ErrorWorker("SIN_ESPACIO", "No queda espacio para la forma de onda") from e
            raise ErrorWorker("ERROR_INTERNO", "No se pudo guardar la forma de onda", True) from e
        raise

    protocolo.resultado(
        {"frecuencia_hz": frecuencia, "muestras": muestras, "bloques_base": bloques}
    )
