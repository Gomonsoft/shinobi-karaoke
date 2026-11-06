"""Clasificación de licencias con metadatos PyPI fijos; no usa red."""

import importlib.util
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "licencias_requisitos", RAIZ / "scripts" / "licencias_requisitos.py"
)
assert _spec and _spec.loader
lr = importlib.util.module_from_spec(_spec)
sys.modules["licencias_requisitos"] = lr
_spec.loader.exec_module(lr)


def test_expression_spdx_y_clasificador_de_pypi():
    assert lr.clasificar_licencia("paquete", "1.0", {"license_expression": "MIT"}) == "MIT"
    assert (
        lr.clasificar_licencia(
            "otro", "2.0", {"classifiers": ["License :: OSI Approved :: Apache Software License"]}
        )
        == "Apache-2.0"
    )


def test_licencia_desconocida_falla_con_nombre_y_version():
    try:
        lr.clasificar_licencia("opaco", "3.1", {"license": "some custom terms"})
    except lr.ErrorLicencia as error:
        assert "opaco==3.1" in str(error)
    else:
        raise AssertionError("se esperaba que fallara una licencia no clasificable")


def test_restriccion_no_comercial_o_de_investigacion_falla():
    for licencia in ("CC-BY-NC-4.0", "research only", "non-commercial use only"):
        try:
            lr.clasificar_licencia("limitado", "1.0", {"license_expression": licencia})
        except lr.ErrorLicencia as error:
            assert "no comercial" in str(error)
        else:
            raise AssertionError(f"se esperaba rechazo para {licencia}")


def test_revision_manual_necesita_motivo_y_conserva_la_licencia_revisada():
    revisiones = {
        "paquete-especial==1.0": {"licencia": "MIT", "motivo": "el texto del proyecto confirma MIT"}
    }
    assert (
        lr.clasificar_licencia("paquete_especial", "1.0", None, revisiones)
        == "MIT (revisión manual: el texto del proyecto confirma MIT)"
    )
    try:
        lr.clasificar_licencia(
            "paquete-especial", "1.0", None, {"paquete-especial==1.0": {"licencia": "MIT"}}
        )
    except lr.ErrorLicencia as error:
        assert "motivo" in str(error)
    else:
        raise AssertionError("se esperaba motivo obligatorio para la revisión manual")


def test_nvidia_se_identifica_como_licencia_del_fabricante_no_redistribuida():
    assert (
        lr.clasificar_licencia("nvidia_cublas_cu12", "12.8.0", None)
        == "Licencia de NVIDIA (no redistribuida)"
    )


def test_requisitos_se_unen_por_paquete_version_y_perfil(tmp_path):
    for perfil in (
        "darwin-arm64-mps",
        "win32-x64-cpu",
        "win32-x64-cuda",
        "linux-x64-cpu",
        "linux-x64-cuda",
    ):
        (tmp_path / f"{perfil}.txt").write_text(
            "demo-pkg==1.2.3 \\\n+    --hash=sha256:" + "a" * 64 + "\n",
            encoding="utf-8",
        )
    (tmp_path / "exclusiones.txt").write_text("diffq\ndiffq-fixed\n", encoding="utf-8")
    perfiles = lr.leer_requisitos(tmp_path)
    assert perfiles[("demo-pkg", "1.2.3")] == {
        "darwin-arm64-mps",
        "win32-x64-cpu",
        "win32-x64-cuda",
        "linux-x64-cpu",
        "linux-x64-cuda",
    }


def test_salida_ordenada_y_estable_con_respuestas_fijas():
    perfiles = {("zeta", "2.0"): {"linux-x64-cuda"}, ("alfa", "1.0"): {"linux-x64-cpu"}}
    metadata = {
        ("zeta", "2.0"): {"license_expression": "Apache-2.0"},
        ("alfa", "1.0"): {"license": "MIT"},
    }
    salida = lr.generar_bloque(perfiles, metadata)
    assert salida == lr.generar_bloque(dict(reversed(list(perfiles.items()))), metadata)
    assert salida.index("**alfa**") < salida.index("**zeta**")
    assert "perfiles: linux-x64-cuda" in salida


def test_generar_inventario_usa_metadatos_falsos_y_no_hace_red(tmp_path):
    (tmp_path / "darwin-arm64-mps.txt").write_text(
        "demo==1.0 --hash=sha256:" + "b" * 64, encoding="utf-8"
    )
    for perfil in ("win32-x64-cpu", "win32-x64-cuda", "linux-x64-cpu", "linux-x64-cuda"):
        (tmp_path / f"{perfil}.txt").write_text("# sin paquetes\n", encoding="utf-8")

    class PyPIFalso:
        def metadata(self, nombre, version):
            assert (nombre, version) == ("demo", "1.0")
            return {"license_expression": "MIT"}

    assert "**demo** 1.0 — MIT" in lr.generar_inventario(tmp_path, PyPIFalso())
