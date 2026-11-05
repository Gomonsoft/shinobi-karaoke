"""Separador falso (tarea 0060): sigue un escenario JSON, sin PyTorch ni modelos.

Esquema del escenario en `app/src/shared/separacion.ts` (`escenarioSeparadorSchema`).
Genera `voz.flac` e `instrumental.flac` (FLAC PCM 16, 44,1 kHz, estereo) con la duracion de la
entrada: instrumental = mezcla a -6 dB; voz = diferencia de canales (L-R)/2 en ambos canales.
"""

from __future__ import annotations

import json
import os
import signal
import sys
import time
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import numpy as np
import soundfile as sf

from .errores import ArgumentosNoValidos, ErrorWorker
from .separacion import INSTRUMENTAL, VOZ, AlProgreso

CODIGOS = (
    "MEMORIA_INSUFICIENTE",
    "MODELO_NO_DISPONIBLE",
    "SIN_ESPACIO",
    "FORMATO_NO_SOPORTADO",
    "ARGUMENTOS_NO_VALIDOS",
    "ERROR_INTERNO",
)


def _cargar_escenario(ruta: Path) -> dict[str, Any]:
    try:
        e = json.loads(ruta.read_text("utf-8"))
    except (OSError, ValueError) as err:
        raise ArgumentosNoValidos(f"Escenario del separador falso no legible: {err}") from err
    if not isinstance(e, dict):
        raise ArgumentosNoValidos("El escenario debe ser un objeto JSON")
    segundos, pasos = e.get("segundos"), e.get("pasos")
    if isinstance(segundos, bool) or not isinstance(segundos, int | float) or segundos < 0:
        raise ArgumentosNoValidos("Escenario: 'segundos' debe ser un numero >= 0")
    if isinstance(pasos, bool) or not isinstance(pasos, int) or pasos < 1:
        raise ArgumentosNoValidos("Escenario: 'pasos' debe ser un entero >= 1")
    for f in e.get("fallos", []):
        if not isinstance(f, dict) or f.get("codigo") not in CODIGOS:
            raise ArgumentosNoValidos("Escenario: fallo con 'codigo' no valido")
        if not isinstance(f.get("cuando"), dict) or not isinstance(f.get("reintentable"), bool):
            raise ArgumentosNoValidos("Escenario: fallo con 'cuando' o 'reintentable' no validos")
    return e


class SeparadorFalso:
    version_audio_separator = "falso"

    def __init__(self, escenario: Path, intento: int | None = None) -> None:
        self._ruta = escenario
        self._intento = intento

    def _fallo(self, e: dict[str, Any], dispositivo: str, bloques: str) -> dict[str, Any] | None:
        actual = {"dispositivo": dispositivo, "bloques": bloques, "intento": self._intento}
        for f in e.get("fallos", []):
            if all(actual.get(k) == v for k, v in f["cuando"].items()):
                return f
        return None

    def separar(
        self,
        entrada: Path,
        salida_dir: Path,
        modelo: Mapping[str, str],
        dispositivo: str,
        bloques: str,
        al_progreso: AlProgreso,
    ) -> None:
        escenario = _cargar_escenario(self._ruta)
        al_progreso("cargando_modelo", None, None)
        fallo = self._fallo(escenario, dispositivo, bloques)
        if fallo is not None:
            raise ErrorWorker(
                fallo["codigo"], f"Fallo simulado: {fallo['codigo']}", fallo["reintentable"]
            )
        pasos = escenario["pasos"]
        espera = escenario["segundos"] / pasos
        for paso in range(pasos + 1):
            al_progreso("separando", paso / pasos, {"paso": paso, "total": pasos})
            if escenario.get("morir_con_sigkill") and paso >= pasos // 2:
                _morir()
            if paso < pasos and espera > 0:
                time.sleep(espera)
        al_progreso("guardando", None, None)
        datos, fs = sf.read(str(entrada), dtype="float32", always_2d=True)
        instrumental = datos * np.float32(0.5)
        diferencia = (datos[:, :1] - datos[:, 1:2]) * np.float32(0.5)
        voz = np.repeat(diferencia, 2, axis=1)
        for nombre, pista in ((VOZ, voz), (INSTRUMENTAL, instrumental)):
            sf.write(str(salida_dir / nombre), pista, fs, subtype="PCM_16", format="FLAC")


def _morir() -> None:
    sys.stdout.flush()
    sys.stderr.flush()
    if sys.platform == "win32":
        os._exit(137)
    os.kill(os.getpid(), signal.SIGKILL)
