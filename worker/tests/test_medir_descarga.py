"""Pruebas de medir_descarga.py con índices simulados (sin red)."""

import importlib.util
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "medir_descarga", RAIZ / "scripts" / "medir_descarga.py"
)
assert _spec and _spec.loader
md = importlib.util.module_from_spec(_spec)
sys.modules["medir_descarga"] = md
_spec.loader.exec_module(md)

H = [f"{i:064x}" for i in range(1, 8)]


def _json_pypi(*archivos: tuple[str, str, int]) -> str:
    return json.dumps(
        {"urls": [{"filename": f, "digests": {"sha256": h}, "size": s, "url": f"https://x/{f}"}
                  for f, h, s in archivos]}
    )  # fmt: skip


class RedFalsa:
    def __init__(self, textos: dict[str, str], longitudes: dict[str, int] | None = None):
        self.textos = textos
        self.longitudes = longitudes or {}
        self.peticiones: list[str] = []

    def texto(self, url):
        self.peticiones.append(url)
        return self.textos.get(url)

    def content_length(self, url):
        self.peticiones.append("HEAD " + url)
        return self.longitudes.get(url)


def _requisitos(tmp_path: Path, cuerpo: str) -> Path:
    (tmp_path / "linux-x64-cpu.txt").write_text(
        "--index-url https://pypi.org/simple\n"
        "--extra-index-url https://download.pytorch.org/whl/cpu\n\n" + cuerpo,
        encoding="utf-8",
    )
    return tmp_path


def test_linea_con_varios_hashes_marcador_y_comentarios(tmp_path):
    d = _requisitos(
        tmp_path,
        f"numpy==2.0.0 ; sys_platform == 'linux' \\\n    --hash=sha256:{H[0]} \\\n"
        f"    --hash=sha256:{H[1]}\n    # via x\n"
        f"torch==2.15.0+cpu \\\n    --hash=sha256:{H[2]}\n",
    )
    reqs, indices = md.leer_requisitos(d / "linux-x64-cpu.txt")
    assert [(r.nombre, r.version) for r in reqs] == [("numpy", "2.0.0"), ("torch", "2.15.0+cpu")]
    assert reqs[0].hashes == {H[0], H[1]} and reqs[0].marcador == "sys_platform == 'linux'"
    assert reqs[1].marcador is None
    assert indices.extra == ["https://download.pytorch.org/whl/cpu"]


def test_elige_la_rueda_compatible_entre_varios_hashes():
    obj = md.OBJETIVOS["linux-x64-cpu"]
    candidatos = [
        md.Archivo("n-2-cp312-cp312-win_amd64.whl", H[0], None, 1),
        md.Archivo("n-2-cp312-cp312-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", H[1], None, 2),
        md.Archivo("n-2-cp311-cp311-manylinux_2_17_x86_64.whl", H[2], None, 3),
        md.Archivo("n-2-py3-none-any.whl", H[3], None, 4),
        md.Archivo("n-2.tar.gz", H[4], None, 5),
    ]
    assert md.elegir_rueda(candidatos, obj).size == 2
    assert md.elegir_rueda(candidatos[:1], obj) is None
    solo = [md.Archivo("p-1-py3-none-any.whl", H[0], None, 9), candidatos[2]]
    assert md.elegir_rueda(solo, obj).size == 9


def test_macos_arm64_y_abi3():
    obj = md.OBJETIVOS["darwin-arm64-mps"]
    c = [
        md.Archivo("a-1-cp312-abi3-macosx_11_0_arm64.whl", H[0], None, 1),
        md.Archivo("a-1-cp312-abi3-macosx_10_9_x86_64.whl", H[1], None, 2),
        md.Archivo("a-1-cp312-abi3-macosx_15_0_arm64.whl", H[2], None, 3),
    ]
    assert md.elegir_rueda(c, obj).size == 1


def test_mide_con_json_de_pypi_y_head_en_pytorch(tmp_path):
    d = _requisitos(
        tmp_path,
        f"numpy==2.0.0 \\\n    --hash=sha256:{H[0]} \\\n    --hash=sha256:{H[1]}\n"
        f"torch==2.15.0+cpu \\\n    --hash=sha256:{H[2]}\n"
        f"colorama==0.4 ; sys_platform == 'win32' \\\n    --hash=sha256:{H[3]}\n",
    )
    html = (
        '<a href="https://r2/torch-2.15.0%2Bcpu-cp312-cp312-manylinux_2_28_x86_64.whl'
        f'#sha256={H[2]}">torch-2.15.0+cpu-cp312-cp312-manylinux_2_28_x86_64.whl</a><br/>'
        f'<a href="https://r2/torch-2.15.0%2Bcpu-cp312-cp312-win_amd64.whl#sha256={H[5]}">'
        "torch-2.15.0+cpu-cp312-cp312-win_amd64.whl</a>"
    )
    red = RedFalsa(
        {
            "https://pypi.org/pypi/numpy/2.0.0/json": _json_pypi(
                ("numpy-2.0.0-cp312-cp312-win_amd64.whl", H[0], 100),
                ("numpy-2.0.0-cp312-cp312-manylinux_2_28_x86_64.whl", H[1], 700),
            ),
            "https://download.pytorch.org/whl/cpu/torch/": html,
        },
        {"https://r2/torch-2.15.0%2Bcpu-cp312-cp312-manylinux_2_28_x86_64.whl": 5000},
    )
    r = md.medir_archivo("linux-x64-cpu", red, requisitos_dir=d)
    assert r["ok"] and r["total_bytes"] == 5700 and r["sin_tamano"] == []
    assert r["paquetes_contados"] == 2 and r["paquetes_omitidos_por_marcador"] == 1
    assert [p["paquete"] for p in r["mas_grandes"]] == ["torch", "numpy"]
    assert "https://pypi.org/pypi/torch/2.15.0+cpu/json" in red.peticiones


def test_paquete_sin_tamano_invalida_la_salida(tmp_path):
    d = _requisitos(tmp_path, f"torch==1.0+cpu \\\n    --hash=sha256:{H[0]}\nfoo==1 \\\n"
                    f"    --hash=sha256:{H[1]}\n")  # fmt: skip
    html = f'<a href="f.whl#sha256={H[0]}">torch-1.0+cpu-cp312-cp312-manylinux_2_28_x86_64.whl</a>'
    red = RedFalsa({"https://download.pytorch.org/whl/cpu/torch/": html})  # sin Content-Length
    r = md.medir_archivo("linux-x64-cpu", red, requisitos_dir=d)
    assert not r["ok"] and sorted(r["sin_tamano"]) == ["foo", "torch"]
    errores = {p["paquete"]: p["error"] for p in r["paquetes"]}
    assert "hashes" in errores["foo"] and "Content-Length" in errores["torch"]


def test_requisitos_reales_se_leen():
    for nombre, obj in md.OBJETIVOS.items():
        reqs, indices = md.leer_requisitos(md.REQUISITOS / obj.archivo)
        assert len(reqs) > 50 and all(r.hashes for r in reqs), nombre
        assert indices.principal == "https://pypi.org/simple"
