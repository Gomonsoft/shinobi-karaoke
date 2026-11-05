"""Fixtures de audio de prueba (se generan en tmp_path; cada uno tarda < 2 s)."""

import os
from pathlib import Path

import audio_prueba as ap
import pytest


@pytest.fixture
def tono_estereo_30s(tmp_path: Path) -> Path:
    return ap.wav(tmp_path / "estereo_30s.wav", ap.tono(30))


@pytest.fixture
def tono_mono_30s(tmp_path: Path) -> Path:
    return ap.wav(tmp_path / "mono_30s.wav", ap.tono(30, canales=1))


@pytest.fixture
def audio_corto_5s(tmp_path: Path) -> Path:
    return ap.wav(tmp_path / "corto_5s.wav", ap.tono(5))


@pytest.fixture
def audio_largo_11min(tmp_path: Path) -> Path:
    return ap.largo_11_min(tmp_path / "largo_11min.wav")


@pytest.fixture(params=["PCM_16", "PCM_24", "FLOAT"])
def wav_por_profundidad(request, tmp_path: Path) -> Path:
    return ap.wav(tmp_path / f"{request.param}.wav", ap.tono(3), subtipo=request.param)


@pytest.fixture
def audio_flac(tmp_path: Path) -> Path:
    return ap.flac(tmp_path / "prueba.flac", ap.tono(3))


@pytest.fixture
def audio_mp3(tmp_path: Path) -> Path:
    return ap.mp3(tmp_path / "prueba.mp3", ap.tono(3))


@pytest.fixture
def audio_m4a(tmp_path: Path) -> Path:
    return ap.m4a(tmp_path / "prueba.m4a", ap.tono(3))


@pytest.fixture
def audio_ogg_opus(tmp_path: Path) -> Path:
    return ap.ogg_opus(tmp_path / "prueba.ogg", ap.tono(3, fs=48000))


@pytest.fixture
def audio_webm_opus(tmp_path: Path) -> Path:
    return ap.webm_opus(tmp_path / "prueba.webm", ap.tono(3, fs=48000))


@pytest.fixture
def video_mp4(tmp_path: Path) -> Path:
    return ap.mp4_con_video(tmp_path / "video.mp4", ap.tono(3))


@pytest.fixture
def video_mkv(tmp_path: Path) -> Path:
    return ap.mkv_con_video(tmp_path / "video.mkv", ap.tono(3))


@pytest.fixture
def mp4_sin_audio(tmp_path: Path) -> Path:
    return ap.mp4_sin_audio(tmp_path / "sin_audio.mp4")


@pytest.fixture
def audio_truncado(tmp_path: Path) -> Path:
    origen = ap.flac(tmp_path / "origen.flac", ap.tono(5))
    return ap.truncado(tmp_path / "truncado.flac", origen)


@pytest.fixture
def texto_con_extension_mp3(tmp_path: Path) -> Path:
    return ap.texto_como_mp3(tmp_path / "falso.mp3")


@pytest.fixture
def mp3_con_etiquetas(tmp_path: Path) -> Path:
    return ap.mp3(tmp_path / "etiquetas.mp3", ap.tono(3), etiquetas=ap.ETIQUETAS)


def pytest_collection_modifyitems(config, items):
    """Los tests `red` solo corren con SHINOBI_TESTS_RED=1 (ADR 0009 §8)."""
    if os.environ.get("SHINOBI_TESTS_RED") == "1":
        return
    omitir = pytest.mark.skip(reason="necesita Internet: SHINOBI_TESTS_RED=1")
    for item in items:
        if "red" in item.keywords:
            item.add_marker(omitir)
