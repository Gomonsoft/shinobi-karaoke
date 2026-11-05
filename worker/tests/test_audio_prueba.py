"""Comprueba que los generadores de audio de prueba producen lo que dicen (y rápido)."""

import time

import audio_prueba as ap
import av
import pytest
import soundfile as sf


def _abrir(ruta):
    return av.open(str(ruta))


def _duracion(ruta) -> float:
    with _abrir(ruta) as c:
        return float(c.duration) / av.time_base


def test_wav_estereo_mono_corto(tono_estereo_30s, tono_mono_30s, audio_corto_5s):
    assert sf.info(tono_estereo_30s).channels == 2
    assert sf.info(tono_estereo_30s).duration == pytest.approx(30, abs=0.01)
    assert sf.info(tono_mono_30s).channels == 1
    assert sf.info(audio_corto_5s).duration == pytest.approx(5, abs=0.01)


def test_largo_11_min(audio_largo_11min):
    assert sf.info(audio_largo_11min).duration == pytest.approx(660, abs=0.01)


def test_wav_profundidades(wav_por_profundidad):
    assert sf.info(wav_por_profundidad).subtype == wav_por_profundidad.stem


@pytest.mark.parametrize(
    "fixture, codec",
    [
        ("audio_flac", "flac"),
        ("audio_mp3", "mp3"),
        ("audio_m4a", "aac"),
        ("audio_ogg_opus", "opus"),
        ("audio_webm_opus", "opus"),
        ("video_mp4", "aac"),
        ("video_mkv", "aac"),
    ],
)
def test_formatos_con_audio(request, fixture, codec):
    ruta = request.getfixturevalue(fixture)
    with _abrir(ruta) as c:
        assert c.streams.audio[0].codec_context.name.startswith(codec)
        assert c.duration / av.time_base == pytest.approx(3, abs=0.3)


@pytest.mark.parametrize("fixture", ["video_mp4", "video_mkv"])
def test_contenedores_con_video(request, fixture):
    with _abrir(request.getfixturevalue(fixture)) as c:
        assert len(c.streams.video) == 1


def test_mp4_sin_pista_de_audio(mp4_sin_audio):
    with _abrir(mp4_sin_audio) as c:
        assert len(c.streams.audio) == 0
        assert len(c.streams.video) == 1


def test_truncado_y_falso(audio_truncado, texto_con_extension_mp3):
    with pytest.raises((av.error.FFmpegError, RuntimeError)):  # cabecera sí, datos no
        with _abrir(audio_truncado) as c:
            for _ in c.decode(audio=0):
                pass
        raise RuntimeError("el archivo truncado se decodificó entero")
    with pytest.raises(av.error.FFmpegError):
        _abrir(texto_con_extension_mp3)


def test_etiquetas_con_tildes_y_cjk(mp3_con_etiquetas):
    with _abrir(mp3_con_etiquetas) as c:
        meta = {k.lower(): v for k, v in c.metadata.items()}
    for clave, valor in ap.ETIQUETAS.items():
        assert meta[clave] == valor


# Objetivo de diseño (tarea 0028): < 2 s por generador en un equipo normal
# (en un M1: MP3 ~0,4 s, WAV de 11 min ~0,1 s). Los runners de CI, sobre todo
# Windows, son mucho más lentos y variables (3,1 s medidos), así que el test
# solo detecta regresiones graves: un generador que pase a tardar decenas de
# segundos. Cada generador se mide por separado.
LIMITE_GENERADOR_S = 10


@pytest.mark.parametrize(
    "generar",
    [
        pytest.param(lambda d: ap.mp3(d / "a.mp3", ap.tono(30)), id="mp3_30s"),
        pytest.param(lambda d: ap.largo_11_min(d / "b.wav"), id="wav_11min"),
    ],
)
def test_generadores_son_rapidos(tmp_path, generar):
    t0 = time.perf_counter()
    generar(tmp_path)
    transcurrido = time.perf_counter() - t0
    assert transcurrido < LIMITE_GENERADOR_S, transcurrido


@pytest.mark.red
def test_ejemplo_necesita_red():
    import urllib.request

    with urllib.request.urlopen("https://pypi.org/simple/", timeout=10) as r:
        assert r.status == 200


@pytest.mark.pesado
def test_ejemplo_necesita_extra_separacion():
    pytest.importorskip("audio_separator")
