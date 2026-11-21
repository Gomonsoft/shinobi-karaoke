"""Pruebas del comando `capacidades-exportacion` (tarea 0232)."""

import pytest

from shinobi_worker import capacidades_exportacion as ce
from shinobi_worker import protocolo


@pytest.fixture
def mensajes(monkeypatch):
    emitidos = []
    monkeypatch.setattr(protocolo, "_emitir", emitidos.append)
    return emitidos


def test_con_pyav_real_los_dos_formatos_abren_las_resoluciones_maximas(mensajes):
    ce.capacidades_exportacion({})
    datos = mensajes[-1]["datos"]
    assert datos["version_av"]
    for formato in ("mkv_av1", "webm_vp9"):
        assert datos["formatos"][formato] == {
            "disponible": True,
            "max_16_9": True,
            "max_4_3": True,
            "motivo": None,
        }


def test_sin_libsvtav1_mkv_av1_no_esta_disponible(mensajes, monkeypatch):
    monkeypatch.setattr(ce, "codificador_disponible", lambda nombre: nombre != "libsvtav1")
    ce.capacidades_exportacion({})
    formatos = mensajes[-1]["datos"]["formatos"]
    assert formatos["mkv_av1"]["disponible"] is False
    assert formatos["mkv_av1"]["motivo"] == "codificador"
    assert formatos["webm_vp9"]["disponible"] is True


def test_sin_libopus_ningun_formato_esta_disponible(mensajes, monkeypatch):
    monkeypatch.setattr(ce, "codificador_disponible", lambda nombre: nombre != "libopus")
    ce.capacidades_exportacion({})
    formatos = mensajes[-1]["datos"]["formatos"]
    assert not any(f["disponible"] for f in formatos.values())
