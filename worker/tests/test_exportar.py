"""Pruebas del comando `exportar` (tarea 0231) con fotogramas y audio sintéticos.

Corren en la CI de los 3 SO: son la verificación de los codificadores en Windows y Linux.
"""

import io
import json

import audio_prueba as ap
import av
import numpy as np
import pytest

from shinobi_worker import exportar as ex
from shinobi_worker import protocolo
from shinobi_worker.errores import ErrorWorker

ANCHO, ALTO, FPS, SEGUNDOS = 320, 240, 24, 2

PARAMETROS = {
    "mkv_av1": {"preset": 10, "crf": 35},
    "webm_vp9": {"cpu_used": 8, "crf": 33},
}


@pytest.fixture
def mensajes(monkeypatch):
    emitidos = []
    monkeypatch.setattr(protocolo, "_emitir", emitidos.append)
    return emitidos


def _fotogramas(total: int) -> bytes:
    rng = np.random.default_rng(1)
    base = rng.integers(0, 255, (ALTO, ANCHO, 4), dtype=np.uint8)
    return b"".join(np.roll(base, n, axis=1).tobytes() for n in range(total))


def _args(tmp_path, formato, voz=False):
    instrumental = ap.flac(tmp_path / "inst.flac", ap.tono(SEGUNDOS, fs=44100))
    pista_voz = ap.flac(tmp_path / "voz.flac", ap.tono(SEGUNDOS, hz=330)) if voz else None
    return {
        "temporal": str(tmp_path / "salida.tmp"),
        "formato": formato,
        "ancho": ANCHO,
        "alto": ALTO,
        "fps": FPS,
        "total_fotogramas": FPS * SEGUNDOS,
        "duracion_ms": SEGUNDOS * 1000,
        "audio": {
            "instrumental": str(instrumental),
            "voz": str(pista_voz) if pista_voz else None,
            "ganancia_db": 0,
        },
        "parametros": PARAMETROS[formato],
        "hilos": 2,
    }


@pytest.mark.parametrize(
    ("formato", "contenedor", "codec"),
    [("mkv_av1", "matroska", "av1"), ("webm_vp9", "webm", "vp9")],
)
def test_exporta_el_formato_pedido(tmp_path, mensajes, formato, contenedor, codec):
    args = _args(tmp_path, formato, voz=True)
    ex.exportar(args, io.BytesIO(_fotogramas(FPS * SEGUNDOS)))

    resultado = mensajes[-1]
    assert resultado["tipo"] == "resultado"
    assert resultado["datos"]["fotogramas"] == 48
    fases = [m["fase"] for m in mensajes if m["tipo"] == "progreso"]
    assert fases[0] == "preparando"
    assert fases[-1] == "finalizando"
    assert "codificando" in fases

    with av.open(args["temporal"]) as f:
        assert contenedor in f.format.name
        sv, sa = f.streams.video[0], f.streams.audio[0]
        assert sv.codec_context.codec.canonical_name == codec
        assert (sv.width, sv.height) == (ANCHO, ALTO)
        assert float(sv.average_rate) == FPS
        assert (sa.codec_context.name, sa.rate, sa.layout.name) == ("opus", 48000, "stereo")
        fin = max(
            float((p.pts + p.duration) * sv.time_base) for p in f.demux(sv) if p.pts is not None
        )
        assert abs(fin - SEGUNDOS) <= 1 / FPS
    json.dumps(resultado)


def test_mezcla_suma_las_pistas_y_normaliza_el_pico():
    inst = np.full((2, 100), 0.4, dtype=np.float32)
    voz = np.full((2, 100), 0.3, dtype=np.float32)
    suma = ex.mezclar(inst, voz, 0)
    assert np.allclose(suma, 0.7)  # pico < 0,999: sin cambios

    fuerte = ex.mezclar(inst * 2, voz * 2, 0)  # 1,4 -> 0,999 sin recortar
    assert np.isclose(np.abs(fuerte).max(), 0.999)
    assert np.allclose(fuerte, 0.999)

    sin_voz = ex.mezclar(inst, None, 6.0206)  # +6 dB = x2
    assert np.allclose(sin_voz, 0.8, atol=1e-4)
    assert np.allclose(inst, 0.4)  # no modifica la entrada


def test_stdin_cortado_da_entrada_incompleta_y_borra_el_temporal(tmp_path, mensajes):
    args = _args(tmp_path, "webm_vp9")
    with pytest.raises(ErrorWorker) as e:
        ex.exportar(args, io.BytesIO(_fotogramas(FPS)))  # la mitad
    assert e.value.codigo == "ENTRADA_INCOMPLETA"
    assert e.value.detalle == {"fotograma": FPS}
    assert not (tmp_path / "salida.tmp").exists()


def test_formato_sin_codificador(tmp_path, mensajes, monkeypatch):
    monkeypatch.setattr(ex, "codificador_disponible", lambda nombre: nombre != "libsvtav1")
    args = _args(tmp_path, "mkv_av1")
    with pytest.raises(ErrorWorker) as e:
        ex.exportar(args, io.BytesIO(b""))
    assert e.value.codigo == "SIN_CODIFICADOR"
    assert not (tmp_path / "salida.tmp").exists()


def test_pista_inexistente_es_cancion_no_disponible(tmp_path, mensajes):
    args = _args(tmp_path, "webm_vp9")
    args["audio"]["instrumental"] = str(tmp_path / "no_existe.flac")
    with pytest.raises(ErrorWorker) as e:
        ex.exportar(args, io.BytesIO(b""))
    assert e.value.codigo == "CANCION_NO_DISPONIBLE"
