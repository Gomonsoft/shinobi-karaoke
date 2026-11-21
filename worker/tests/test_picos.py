import json
import struct
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf
from test_cli import ejecutar

from shinobi_worker import picos

FIXTURE = Path(__file__).parent / "fixtures" / "picos-v1.bin"


def _generar(entrada, salida):
    return ejecutar(
        "generar-picos", "--args", json.dumps({"entrada": str(entrada), "salida": str(salida)})
    )


def test_picos_estereo_con_limites_fraccionarios_y_ultimo_bloque_parcial(tmp_path):
    entrada = tmp_path / "voz.flac"
    salida = tmp_path / "picos.tmp"
    # 11025 Hz: los tres bloques empiezan en 0, 110 y 220 muestras.
    pcm = np.zeros((221, 2), dtype=np.int16)
    pcm[109] = [-32768, 100]
    pcm[110] = [220, 32767]
    pcm[220] = [-16, 42]
    sf.write(entrada, pcm, 11025, subtype="PCM_16")

    proceso, mensajes = _generar(entrada, salida)

    assert proceso.returncode == 0, proceso.stderr
    assert mensajes == [
        {
            "tipo": "resultado",
            "datos": {"frecuencia_hz": 11025, "muestras": 221, "bloques_base": 3},
        }
    ]
    assert salida.read_bytes() == FIXTURE.read_bytes()
    assert entrada.is_file()


def test_picos_mono_largos_con_tamano_acotado(tmp_path):
    entrada = tmp_path / "voz.flac"
    salida = tmp_path / "picos.tmp"
    pcm = np.zeros(8000 * 60, dtype=np.int16)
    # Valores a ambos lados del límite de lectura de lotes de niveles.
    pcm[4095 * 80] = -12345
    pcm[4096 * 80] = 23456
    sf.write(entrada, pcm, 8000, subtype="PCM_16")

    proceso, mensajes = _generar(entrada, salida)

    assert proceso.returncode == 0, proceso.stderr
    assert mensajes[-1]["datos"]["bloques_base"] == 6000
    datos = salida.read_bytes()
    assert 48000 <= len(datos) <= 48100
    assert struct.unpack_from("<hh", datos, 24) == (0, 0)
    assert struct.unpack_from("<hh", datos, len(datos) - 4) == (-12345, 23456)


@pytest.mark.parametrize("vacio", [True, False])
def test_picos_invalidos_o_sin_muestras_no_dejan_temporal(tmp_path, vacio):
    entrada = tmp_path / "voz.flac"
    salida = tmp_path / "picos.tmp"
    if vacio:
        sf.write(entrada, np.array([], dtype=np.int16), 8000, subtype="PCM_16")
    else:
        entrada.write_bytes(b"no es audio")

    proceso, mensajes = _generar(entrada, salida)

    assert proceso.returncode == 1
    assert mensajes[-1]["codigo"] == "FORMATO_NO_SOPORTADO"
    assert not salida.exists()


def test_picos_rechazan_argumentos_y_no_sobrescriben_una_salida_existente(tmp_path):
    proceso, mensajes = ejecutar("generar-picos", "--args", '{"entrada": 5}')
    assert proceso.returncode == 2
    assert mensajes[-1]["codigo"] == "ARGUMENTOS_NO_VALIDOS"

    entrada = tmp_path / "voz.flac"
    salida = tmp_path / "picos.tmp"
    salida.write_bytes(b"otra generacion")
    proceso, mensajes = _generar(entrada, salida)
    assert proceso.returncode == 1
    assert mensajes[-1]["codigo"] == "ERROR_INTERNO"
    assert salida.read_bytes() == b"otra generacion"


def test_picos_limpian_temporal_si_se_interrumpe_la_generacion(tmp_path, monkeypatch):
    entrada = tmp_path / "voz.flac"
    salida = tmp_path / "picos.tmp"
    sf.write(entrada, np.zeros(160, dtype=np.int16), 8000, subtype="PCM_16")

    def interrumpir(_destino, _bloques):
        raise KeyboardInterrupt

    monkeypatch.setattr(picos, "_escribir_niveles", interrumpir)
    with pytest.raises(KeyboardInterrupt):
        picos.generar_picos({"entrada": str(entrada), "salida": str(salida)})
    assert not salida.exists()
