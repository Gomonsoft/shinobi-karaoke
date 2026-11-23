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


def _rms_db(x) -> float:
    return 20 * np.log10(float(np.sqrt(np.mean(np.square(x)))) + 1e-12)


def test_mezcla_con_envolvente_pone_la_voz_al_nivel_dentro_de_los_coros():
    fs = ex.FRECUENCIA
    t = np.arange(4 * fs) / fs
    voz = np.tile((0.4 * np.sin(2 * np.pi * 330 * t)).astype(np.float32), (2, 1))
    inst = np.zeros_like(voz)
    envolvente = [[1000, 0], [1150, 0.5], [2850, 0.5], [3000, 0]]
    mezcla = ex.mezclar(inst, voz, 0, envolvente)
    dentro = slice(int(1.5 * fs), int(2.5 * fs))
    # Al 50 % (-6 dB) +- 1 dB respecto de la voz entera.
    assert abs(_rms_db(mezcla[:, dentro]) - (_rms_db(voz[:, dentro]) - 6.0206)) < 1
    # A más de 450 ms de los tramos, silencio (la rampa dura 150 ms).
    assert np.abs(mezcla[:, : int(0.5 * fs)]).max() == 0
    assert np.abs(mezcla[:, int(3.45 * fs) :]).max() == 0
    # A media rampa, la mitad del nivel.
    medio = int(1.075 * fs)
    assert abs(float(np.abs(mezcla[:, medio - 240 : medio + 240]).max()) - 0.4 * 0.25) < 0.02
    assert mezcla.shape == voz.shape


def test_mezcla_aplica_la_envolvente_antes_de_normalizar_el_pico():
    inst = np.full((2, 48000), 0.9, dtype=np.float32)
    voz = np.full((2, 48000), 0.9, dtype=np.float32)
    mezcla = ex.mezclar(inst, voz, 0, [[0, 1], [1000, 1]])  # 1,8 -> 0,999
    assert np.isclose(np.abs(mezcla).max(), 0.999)


@pytest.mark.parametrize("envolvente", [None, []])
def test_mezcla_sin_envolvente_es_la_de_0_2_2(envolvente):
    rng = np.random.default_rng(3)
    inst = rng.uniform(-0.3, 0.3, (2, 5000)).astype(np.float32)
    voz = rng.uniform(-0.3, 0.3, (2, 4000)).astype(np.float32)
    assert np.array_equal(ex.mezclar(inst, voz, 3.0, envolvente), ex.mezclar(inst, voz, 3.0))
    esperado = inst * 10 ** (3.0 / 20)
    esperado[:, :4000] += voz * 10 ** (3.0 / 20)
    assert np.array_equal(ex.mezclar(inst, voz, 3.0), esperado)


def test_validar_acepta_una_envolvente_bien_formada(tmp_path):
    args = _args(tmp_path, "webm_vp9", voz=True)
    args["audio"]["voz_envolvente"] = [[0, 0], [150, 0.5], [900, 0.5], [1000, 0]]
    assert ex._validar(args)["audio"]["voz_envolvente"][1] == [150, 0.5]


@pytest.mark.parametrize(
    "puntos",
    [
        [],
        "no",
        [[0]],
        [[0, 0, 0]],
        [[0, "a"]],
        [[True, 0]],
        [[10, 0], [10, 0.5]],  # ms no crecientes
        [[10, 0], [5, 0.5]],
        [[-1, 0]],
        [[0, 1.5]],
        [[0, -0.1]],
        [[0, float("nan")]],
        [[0, 0]] * 2,
        [[i, 0.5] for i in range(10_001)],
    ],
)
def test_validar_rechaza_envolventes_mal_formadas(tmp_path, puntos):
    args = _args(tmp_path, "webm_vp9", voz=True)
    args["audio"]["voz_envolvente"] = puntos
    with pytest.raises(ex.ArgumentosNoValidos):
        ex._validar(args)


def test_validar_exige_la_pista_de_voz_con_envolvente(tmp_path):
    args = _args(tmp_path, "webm_vp9", voz=False)
    args["audio"]["voz_envolvente"] = [[0, 0], [100, 0.5]]
    with pytest.raises(ex.ArgumentosNoValidos):
        ex._validar(args)


def test_exporta_con_envolvente_de_extremo_a_extremo(tmp_path, mensajes):
    args = _args(tmp_path, "webm_vp9", voz=True)
    args["audio"]["voz_envolvente"] = [[200, 0], [350, 0.5], [1500, 0.5], [1650, 0]]
    ex.exportar(args, io.BytesIO(_fotogramas(FPS * SEGUNDOS)))
    assert (tmp_path / "salida.tmp").exists()
