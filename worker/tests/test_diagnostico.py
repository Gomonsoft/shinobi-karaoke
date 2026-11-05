import json
import subprocess
import sys
from types import SimpleNamespace

import pytest

from shinobi_worker import diagnostico as d


def torch_falso(*, cuda=True, vram_mb=8192, opera=True, nombre="RTX Falsa", version="2.9.0"):
    class Tensor:
        def __add__(self, otro):
            return self

        def sum(self):
            return SimpleNamespace(item=lambda: 16.0)

    def ones_(*a, **k):
        if not opera:
            raise RuntimeError("CUDA error: fallo")
        return Tensor()

    cuda_ns = SimpleNamespace(
        is_available=lambda: cuda,
        get_device_properties=lambda i: SimpleNamespace(
            name=nombre, total_memory=vram_mb * 1024 * 1024
        ),
        synchronize=lambda: None,
    )
    return SimpleNamespace(__version__=version, cuda=cuda_ns, ones=ones_)


def con(torch):
    def importar(nombre):
        assert nombre == "torch"
        return torch

    return importar


def sin_torch(nombre):
    raise ImportError("No module named 'torch'")


def test_cuda_confirmado():
    r = d.diagnosticar("cuda", con(torch_falso(vram_mb=8192)))
    assert (r["perfil"], r["dispositivo"], r["motivo_rebaja"]) == ("cuda", "cuda", None)
    assert r["gpu"] == "RTX Falsa" and r["vram_mb"] == 8192 and r["torch"] == "2.9.0"


def test_cuda_justo_4gb():
    assert d.diagnosticar("cuda", con(torch_falso(vram_mb=4096)))["perfil"] == "cuda"


def test_cuda_poca_vram_rebaja_por_memoria():
    r = d.diagnosticar("cuda", con(torch_falso(vram_mb=2048)))
    assert (r["perfil"], r["dispositivo"], r["motivo_rebaja"]) == ("cpu", "cpu", "memoria")
    assert r["vram_mb"] == 2048


def test_cuda_que_falla_al_operar():
    r = d.diagnosticar("cuda", con(torch_falso(opera=False)))
    assert (r["perfil"], r["dispositivo"], r["motivo_rebaja"]) == ("cpu", "cpu", "generico")


def test_sin_cuda():
    r = d.diagnosticar("cuda", con(torch_falso(cuda=False)))
    assert (r["perfil"], r["motivo_rebaja"], r["gpu"]) == ("cpu", "generico", None)


def test_mps_se_confirma_en_cpu():
    r = d.diagnosticar("mps", con(torch_falso(cuda=False)))
    assert (r["perfil"], r["dispositivo"], r["motivo_rebaja"]) == ("mps", "cpu", None)


def test_cpu_sin_rebaja_aunque_haya_cuda():
    r = d.diagnosticar("cpu", con(torch_falso()))
    assert (r["perfil"], r["dispositivo"], r["motivo_rebaja"]) == ("cpu", "cpu", None)


@pytest.mark.parametrize("previsto", ["cuda", "mps"])
def test_sin_torch_rebaja_a_generico(previsto, capsys):
    r = d.diagnosticar(previsto, sin_torch)
    assert (r["perfil"], r["dispositivo"], r["motivo_rebaja"], r["torch"]) == (
        "cpu",
        "cpu",
        "generico",
        None,
    )


def test_cpu_sin_torch_no_es_rebaja():
    r = d.diagnosticar("cpu", sin_torch)
    assert (r["perfil"], r["motivo_rebaja"]) == ("cpu", None)


def ejecutar(*argv):
    p = subprocess.run(
        [sys.executable, "-m", "shinobi_worker", *argv],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=60,
    )
    return p, [json.loads(x) for x in p.stdout.splitlines()]


def test_cli_progreso_y_resultado():
    p, msgs = ejecutar("diagnostico", "--args", json.dumps({"perfil_previsto": "cpu"}))
    assert p.returncode == 0
    assert msgs[0] == {"tipo": "progreso", "fase": "diagnostico", "valor": None}
    assert msgs[-1]["tipo"] == "resultado"
    assert set(msgs[-1]["datos"]) == {
        "perfil",
        "dispositivo",
        "gpu",
        "vram_mb",
        "motivo_rebaja",
        "torch",
        "onnxruntime",
    }


@pytest.mark.parametrize("texto", ["{}", '{"perfil_previsto": "tpu"}', '{"perfil_previsto": 1}'])
def test_cli_argumentos_no_validos(texto):
    p, msgs = ejecutar("diagnostico", "--args", texto)
    assert p.returncode != 0
    assert msgs[-1]["codigo"] == "ARGUMENTOS_NO_VALIDOS"


@pytest.mark.pesado
def test_con_torch_real():
    pytest.importorskip("torch")
    for previsto in ("cpu", "mps", "cuda"):
        r = d.diagnosticar(previsto)
        assert r["torch"] and r["perfil"] in ("cpu", "cuda", "mps")
    assert d.diagnosticar("cpu")["onnxruntime"] is not None
