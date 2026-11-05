import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import audio_prueba as ap
import numpy as np
import pytest
import soundfile as sf

from shinobi_worker.errores import ErrorWorker
from shinobi_worker.importar_archivo import (
    limpiar_texto,
    metadatos_desde_nombre,
    normalizar,
)


def ejecutar(entrada: Path, salida: Path, env=None, **extra):
    args = {"entrada": str(entrada), "salida": str(salida), "borrar_entrada": False, **extra}
    p = subprocess.run(
        [sys.executable, "-m", "shinobi_worker", "importar-archivo", "--args", json.dumps(args)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=60,
        env=env,
    )
    return p, [json.loads(linea) for linea in p.stdout.splitlines()]


def comprobar_mezcla(salida: Path):
    info = sf.info(str(salida / "fuente" / "mezcla.flac"))
    assert (info.samplerate, info.channels, info.subtype) == (44100, 2, "PCM_16")
    assert info.format == "FLAC"
    return info


@pytest.fixture
def salida(tmp_path: Path) -> Path:
    return tmp_path / "cancion"


def test_cli_ok_con_progreso_y_esquema(tono_estereo_30s, salida):
    p, msgs = ejecutar(tono_estereo_30s, salida)
    assert p.returncode == 0, p.stderr
    assert msgs[0] == {"tipo": "progreso", "fase": "preparando", "valor": None}
    datos = msgs[-1]["datos"]
    assert set(datos) == {
        "duracion_ms", "metadatos", "ganancia_db", "lufs", "nombre_original", "mezcla"
    }  # fmt: skip
    assert datos["mezcla"] == "fuente/mezcla.flac"
    assert datos["nombre_original"] == "estereo_30s.wav"
    assert datos["duracion_ms"] == 30000
    assert datos["metadatos"] == {"titulo": "estereo 30s", "artista": "", "album": ""}
    assert comprobar_mezcla(salida).frames == 30 * 44100
    assert not (salida / "fuente" / "mezcla.flac.tmp").exists()


@pytest.mark.parametrize(
    "fixture",
    ["audio_mp3", "audio_m4a", "audio_flac", "audio_ogg_opus", "audio_webm_opus",
     "video_mp4", "video_mkv"],
)  # fmt: skip
def test_formatos(fixture, request, salida):
    entrada = request.getfixturevalue(fixture)
    # Los fixtures duran 3 s: se comprueba la conversion con el minimo desactivado
    # mediante un audio de 12 s del mismo tipo.
    largo = entrada.with_name("largo" + entrada.suffix)
    gen = {
        "audio_mp3": lambda: ap.mp3(largo, ap.tono(12)),
        "audio_m4a": lambda: ap.m4a(largo, ap.tono(12)),
        "audio_flac": lambda: ap.flac(largo, ap.tono(12)),
        "audio_ogg_opus": lambda: ap.ogg_opus(largo, ap.tono(12, fs=48000)),
        "audio_webm_opus": lambda: ap.webm_opus(largo, ap.tono(12, fs=48000)),
        "video_mp4": lambda: ap.mp4_con_video(largo, ap.tono(12), segundos=12),
        "video_mkv": lambda: ap.mkv_con_video(largo, ap.tono(12), segundos=12),
    }[fixture]()
    datos = normalizar(gen, salida, alprogreso=lambda v: None)
    info = comprobar_mezcla(salida)
    assert abs(datos["duracion_ms"] - 12000) < 200
    assert abs(info.frames - datos["duracion_ms"] * 44.1) < 50


@pytest.mark.parametrize("subtipo", ["PCM_16", "PCM_24", "FLOAT"])
def test_wav_profundidades(subtipo, tmp_path, salida):
    entrada = ap.wav(tmp_path / "a.wav", ap.tono(11), subtipo=subtipo)
    datos = normalizar(entrada, salida)
    comprobar_mezcla(salida)
    assert datos["duracion_ms"] == 11000


def test_mono_se_duplica(tono_mono_30s, salida):
    normalizar(tono_mono_30s, salida)
    comprobar_mezcla(salida)
    datos, _ = sf.read(str(salida / "fuente" / "mezcla.flac"))
    assert np.allclose(datos[:, 0], datos[:, 1], atol=1e-3)
    assert np.abs(datos).max() > 0.1


def test_multicanal_downmix(tmp_path, salida):
    senal = ap.tono(12, canales=6)
    entrada = tmp_path / "multi.wav"
    sf.write(str(entrada), senal, 44100, subtype="PCM_16", format="WAV")
    normalizar(entrada, salida)
    comprobar_mezcla(salida)


def test_remuestrea_desde_48k(tmp_path, salida):
    entrada = ap.wav(tmp_path / "a48.wav", ap.tono(12, fs=48000), fs=48000)
    datos = normalizar(entrada, salida)
    assert abs(datos["duracion_ms"] - 12000) <= 2
    comprobar_mezcla(salida)


def test_etiquetas_con_tildes_y_cjk(tmp_path, salida):
    entrada = ap.mp3(tmp_path / "x.mp3", ap.tono(12), etiquetas=ap.ETIQUETAS)
    datos = normalizar(entrada, salida)
    assert datos["metadatos"] == {
        "titulo": ap.ETIQUETAS["title"],
        "artista": ap.ETIQUETAS["artist"],
        "album": ap.ETIQUETAS["album"],
    }


def test_etiquetas_largas_y_espacios(tmp_path, salida):
    entrada = ap.mp3(tmp_path / "x.mp3", ap.tono(12), etiquetas={"TITLE": "  " + "a" * 300 + " "})
    assert normalizar(entrada, salida)["metadatos"]["titulo"] == "a" * 200


@pytest.mark.parametrize(
    ("nombre", "titulo", "artista"),
    [
        ("Queen - Bohemian Rhapsody.mp3", "Bohemian Rhapsody", "Queen"),
        ("01 - Queen - Bohemian Rhapsody.flac", "Bohemian Rhapsody", "Queen"),
        ("01. Bohemian_Rhapsody.mp3", "Bohemian Rhapsody", ""),
        ("07 Mi canción.m4a", "Mi canción", ""),
        ("  Soda Stereo  -  De música ligera .wav", "De música ligera", "Soda Stereo"),
        ("sin separador.ogg", "sin separador", ""),
        ("1999.mp3", "1999", ""),
        ("A-B.mp3", "A-B", ""),
        ("歌手 - 歌.mp3", "歌", "歌手"),
    ],
)
def test_heuristica_nombre(nombre, titulo, artista):
    assert metadatos_desde_nombre(nombre) == {"titulo": titulo, "artista": artista, "album": ""}


def test_limpiar_texto():
    assert limpiar_texto("  hola\x00 ") == "hola"
    assert limpiar_texto(None) == ""
    assert len(limpiar_texto("x" * 500)) == 200


def test_heuristica_se_usa_si_falta_titulo(tmp_path, salida):
    entrada = ap.mp3(tmp_path / "Queen - Radio Ga Ga.mp3", ap.tono(12))
    datos = normalizar(entrada, salida)
    assert datos["metadatos"]["titulo"] == "Radio Ga Ga"
    assert datos["metadatos"]["artista"] == "Queen"


def test_ganancia_tono_menos_20_lufs(tmp_path, salida):
    # Un tono de 1 kHz a -20 LUFS integrados (K-weighting ~ +0,7 dB a 1 kHz, estereo igual).
    fs = 44100
    t = np.arange(20 * fs) / fs
    base = np.sin(2 * np.pi * 1000 * t)
    import pyloudnorm

    medido = pyloudnorm.Meter(fs).integrated_loudness(np.stack([base, base], 1))
    amp = 10 ** ((-20 - medido) / 20)
    senal = (base * amp).astype(np.float32)
    entrada = ap.wav(tmp_path / "t.wav", np.stack([senal, senal], 1), subtipo="FLOAT")
    datos = normalizar(entrada, salida)
    assert datos["lufs"] == pytest.approx(-20, abs=0.1)
    assert datos["ganancia_db"] == pytest.approx(4.0, abs=0.2)


def test_silencio_ganancia_cero(tmp_path, salida):
    entrada = ap.wav(tmp_path / "s.wav", np.zeros((12 * 44100, 2), dtype=np.float32))
    datos = normalizar(entrada, salida)
    assert datos["lufs"] is None
    assert datos["ganancia_db"] == 0


def test_ganancia_limitada(tmp_path, salida):
    senal = ap.tono(12) * 0.01  # ~ -50 LUFS (el silencio absoluto es < -70)
    entrada = ap.wav(tmp_path / "b.wav", senal, subtipo="FLOAT")
    assert normalizar(entrada, salida)["ganancia_db"] == 20


def test_corto(audio_corto_5s, salida):
    p, msgs = ejecutar(audio_corto_5s, salida)
    assert p.returncode == 1
    assert msgs[-1]["codigo"] == "AUDIO_DEMASIADO_CORTO"
    assert not (salida / "fuente" / "mezcla.flac").exists()
    assert not (salida / "fuente" / "mezcla.flac.tmp").exists()


def test_largo_11_min_rapido_y_sin_error(audio_largo_11min, salida):
    t0 = time.monotonic()
    p, msgs = ejecutar(audio_largo_11min, salida)
    assert time.monotonic() - t0 < 10
    assert p.returncode == 0, p.stderr
    datos = msgs[-1]["datos"]
    assert datos["duracion_ms"] == 660000
    assert any(m["tipo"] == "progreso" and m["valor"] not in (None, 0) for m in msgs)
    comprobar_mezcla(salida)


@pytest.mark.parametrize("fixture", ["mp4_sin_audio", "texto_con_extension_mp3"])
def test_formato_no_soportado(fixture, request, salida):
    p, msgs = ejecutar(request.getfixturevalue(fixture), salida)
    assert p.returncode == 1
    assert msgs[-1]["codigo"] == "FORMATO_NO_SOPORTADO"
    assert not (salida / "fuente" / "mezcla.flac").exists()
    assert not (salida / "fuente" / "mezcla.flac.tmp").exists()


def test_corrupto_sin_muestras(tmp_path, salida):
    f = tmp_path / "corrupto.flac"
    f.write_bytes(b"fLaC" + os.urandom(2000))
    p, msgs = ejecutar(f, salida)
    assert p.returncode == 1
    assert msgs[-1]["codigo"] == "FORMATO_NO_SOPORTADO"
    assert not (salida / "fuente" / "mezcla.flac.tmp").exists()


def test_truncado_sin_muestras(tmp_path, salida):
    f = tmp_path / "t.wav"
    f.write_bytes(ap.wav(tmp_path / "o.wav", ap.tono(1)).read_bytes()[:44])
    p, msgs = ejecutar(f, salida)
    assert p.returncode == 1
    assert msgs[-1]["codigo"] == "FORMATO_NO_SOPORTADO"


def test_truncado_con_muestras_se_acepta(tmp_path, salida):
    origen = ap.flac(tmp_path / "o.flac", ap.tono(30))
    t = ap.truncado(tmp_path / "t.flac", origen)
    datos = normalizar(t, salida)
    assert 0 < datos["duracion_ms"] < 30000


def test_mensajes_sin_ruta_del_usuario(texto_con_extension_mp3, salida):
    _, msgs = ejecutar(texto_con_extension_mp3, salida)
    assert str(texto_con_extension_mp3.parent) not in msgs[-1]["mensaje"]


def test_entrada_inexistente(tmp_path, salida):
    p, msgs = ejecutar(tmp_path / "no_existe.mp3", salida)
    assert p.returncode == 2
    assert msgs[-1]["codigo"] == "ARGUMENTOS_NO_VALIDOS"


def test_argumentos_invalidos(tmp_path, salida):
    for args in ({}, {"entrada": 1, "salida": "x"}, {"entrada": "a", "salida": ""}):
        cmd = ["-m", "shinobi_worker", "importar-archivo", "--args", json.dumps(args)]
        p = subprocess.run(
            [sys.executable, *cmd],
            capture_output=True, text=True, encoding="utf-8", timeout=30,
        )  # fmt: skip
        assert p.returncode == 2
        assert json.loads(p.stdout.splitlines()[-1])["codigo"] == "ARGUMENTOS_NO_VALIDOS"
    p, msgs = ejecutar(tmp_path, salida)  # un directorio no es un archivo
    assert msgs[-1]["codigo"] == "ARGUMENTOS_NO_VALIDOS"
    p, msgs = ejecutar(tmp_path / "x", salida, borrar_entrada="si")
    assert msgs[-1]["codigo"] == "ARGUMENTOS_NO_VALIDOS"


def test_entrada_intacta(audio_mp3, tmp_path, salida):
    entrada = ap.mp3(tmp_path / "i.mp3", ap.tono(12))
    antes = (hashlib.sha256(entrada.read_bytes()).hexdigest(), entrada.stat().st_mtime_ns)
    p, _ = ejecutar(entrada, salida)
    assert p.returncode == 0
    assert (hashlib.sha256(entrada.read_bytes()).hexdigest(), entrada.stat().st_mtime_ns) == antes


def test_borrar_entrada(tmp_path, salida):
    entrada = ap.flac(tmp_path / "b.flac", ap.tono(12))
    p, _ = ejecutar(entrada, salida, borrar_entrada=True)
    assert p.returncode == 0
    assert not entrada.exists()
    assert (salida / "fuente" / "mezcla.flac").exists()


def test_borrar_entrada_no_borra_si_falla(audio_corto_5s, salida):
    p, _ = ejecutar(audio_corto_5s, salida, borrar_entrada=True)
    assert p.returncode == 1
    assert audio_corto_5s.exists()


def test_sin_espacio(tmp_path, salida, monkeypatch):
    import shinobi_worker.importar_archivo as m

    def lleno(*a, **k):
        raise OSError(28, "No space left on device")

    monkeypatch.setattr(m, "_medir", lleno)
    entrada = ap.flac(tmp_path / "e.flac", ap.tono(12))
    with pytest.raises(ErrorWorker) as exc:
        normalizar(entrada, salida)
    assert exc.value.codigo == "SIN_ESPACIO"
    assert not (salida / "fuente" / "mezcla.flac.tmp").exists()
    assert not (salida / "fuente" / "mezcla.flac").exists()


def test_no_deja_mezcla_parcial_si_se_interrumpe(tmp_path, salida, monkeypatch):
    import shinobi_worker.importar_archivo as m

    def interrumpe(*a, **k):
        raise KeyboardInterrupt

    monkeypatch.setattr(m, "_medir", interrumpe)
    entrada = ap.flac(tmp_path / "e.flac", ap.tono(12))
    with pytest.raises(KeyboardInterrupt):
        normalizar(entrada, salida)
    assert not (salida / "fuente" / "mezcla.flac.tmp").exists()
    assert not (salida / "fuente" / "mezcla.flac").exists()


def test_sin_ffmpeg_en_path(tmp_path, salida):
    """PyAV lleva sus propias librerias: con un PATH vacio sigue funcionando."""
    entrada = ap.mp3(tmp_path / "p.mp3", ap.tono(12))
    env = {k: v for k, v in os.environ.items() if k.upper() != "PATH"}
    env["PATH"] = str(tmp_path / "vacio")
    p, msgs = ejecutar(entrada, salida, env=env)
    assert p.returncode == 0, p.stderr
    assert msgs[-1]["tipo"] == "resultado"
