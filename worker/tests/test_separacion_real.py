"""Prueba con el audio-separator REAL y el modelo Calidad (tarea 0061). Marcada `pesado`.

Necesita `uv sync --extra separacion` y el modelo Calidad en `SHINOBI_MODELOS_DIR`
(`vocals_mel_band_roformer.ckpt` y `.yaml`); si no, se salta. Nunca descarga nada.
Ejecutar: `SHINOBI_MODELOS_DIR=<dir> uv run pytest -m pesado tests/test_separacion_real.py`.
"""

import importlib.util
import os
import shutil
import time
import tomllib
from pathlib import Path

import audio_prueba as ap
import pytest
import soundfile as sf

pytestmark = pytest.mark.pesado

MODELO = "vocals_mel_band_roformer.ckpt"
SEGUNDOS = 20


def test_version_de_audio_separator_es_la_de_pyproject():
    """Actualizar audio-separator exige ejecutar `runtime-real` (ADR 0004, preguntas/0009)."""
    if importlib.util.find_spec("audio_separator") is None:
        pytest.skip("falta el extra `separacion` (uv sync --extra separacion)")
    from importlib.metadata import version

    raiz = Path(__file__).resolve().parent.parent
    deps = tomllib.loads((raiz / "pyproject.toml").read_text(encoding="utf-8"))["project"][
        "optional-dependencies"
    ]["separacion"]
    fijada = next(d.split("==")[1] for d in deps if d.startswith("audio-separator"))
    assert fijada == "0.48.0"
    assert version("audio-separator") == fijada


@pytest.fixture
def modelos_dir() -> Path:
    if importlib.util.find_spec("audio_separator") is None:
        pytest.skip("falta el extra `separacion` (uv sync --extra separacion)")
    dir_ = os.environ.get("SHINOBI_MODELOS_DIR")
    if not dir_:
        pytest.skip("define SHINOBI_MODELOS_DIR con el modelo Calidad")
    d = Path(dir_)
    for nombre in (MODELO, Path(MODELO).with_suffix(".yaml").name):
        if not (d / nombre).is_file():
            pytest.skip(f"falta {nombre} en SHINOBI_MODELOS_DIR")
    return d


def test_calidad_en_cpu_sin_ffmpeg(modelos_dir, tmp_path, monkeypatch, record_property):
    # Aisla el PATH: sin ffmpeg ni ffprobe (el Python actual se invoca por ruta absoluta).
    monkeypatch.setenv("PATH", str(tmp_path / "vacio"))
    assert shutil.which("ffmpeg") is None and shutil.which("ffprobe") is None

    from shinobi_worker.separacion_real import SeparadorReal

    entrada = ap.flac(tmp_path / "mezcla.flac", ap.tono(SEGUNDOS))
    salida = tmp_path / "pistas"
    salida.mkdir()
    eventos = []
    inicio = time.monotonic()
    SeparadorReal().separar(
        entrada,
        salida,
        {"id": "calidad", "archivo": MODELO, "dir": str(modelos_dir)},
        "cpu",
        "normal",
        lambda f, v, d: eventos.append((f, v, d)),
    )
    segundos = time.monotonic() - inicio

    assert sorted(p.name for p in salida.iterdir()) == ["instrumental.flac", "voz.flac"]
    for nombre in ("voz.flac", "instrumental.flac"):
        info = sf.info(str(salida / nombre))
        assert (info.format, info.subtype) == ("FLAC", "PCM_16")
        assert (info.samplerate, info.channels) == (44100, 2)
        assert abs(info.duration - SEGUNDOS) <= 0.05
    fases = [f for f, _, _ in eventos]
    assert fases.count("separando") >= 1
    assert not any("descarg" in f for f in fases)
    record_property("segundos", round(segundos, 1))
    record_property("factor", round(segundos / SEGUNDOS, 2))
