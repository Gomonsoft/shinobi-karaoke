"""Pruebas del script de requisitos bloqueados (sin ejecutar uv ni usar la red)."""

import importlib.util
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "compilar_requisitos", RAIZ / "scripts" / "compilar_requisitos.py"
)
assert _spec and _spec.loader
cr = importlib.util.module_from_spec(_spec)
sys.modules["compilar_requisitos"] = cr
_spec.loader.exec_module(cr)


def test_separar_quita_solo_la_cabecera():
    texto = "# a\n# b\n\n--index-url x\n\npaquete==1 \\\n    # via y\n"
    assert cr._separar(texto) == "--index-url x\n\npaquete==1 \\\n    # via y\n"


def test_cabecera_termina_en_linea_en_blanco_y_se_puede_separar():
    for perfil in cr.PERFILES:
        if perfil.no_soportado:
            continue
        cabecera = cr._cabecera(perfil, "0.0.0")
        assert "uv pip compile" in cabecera
        assert perfil.torch in cabecera
        assert cr._separar(cabecera + "--index-url x\n") == "--index-url x\n"


def test_perfiles_cubren_las_seis_combinaciones_y_torch_es_exacto():
    assert {p.nombre for p in cr.PERFILES} == {
        "darwin-arm64-mps",
        "darwin-x64-cpu",
        "win32-x64-cpu",
        "win32-x64-cuda",
        "linux-x64-cpu",
        "linux-x64-cuda",
    }
    for p in cr.PERFILES:
        assert p.no_soportado or p.torch.startswith("torch==")


def test_los_archivos_versionados_llevan_la_cabecera_del_script():
    for p in cr.PERFILES:
        archivo = cr.DESTINO / f"{p.nombre}.txt"
        if p.no_soportado:
            assert not archivo.exists()
            continue
        primeras = archivo.read_text(encoding="utf-8").splitlines()[:4]
        assert primeras[0].startswith("# Archivo generado por")
        assert "uv pip compile" in primeras[2]


def test_compilacion_copia_exclusiones_y_conserva_entorno_macos(monkeypatch):
    import subprocess
    import tomllib

    def ejecutar(orden, *, cwd, capture_output, text):
        ruta = orden[orden.index("--excludes") + 1]
        exclusiones = (cwd / ruta).read_text(encoding="utf-8").splitlines()
        config = tomllib.loads((cwd / "pyproject.toml").read_text(encoding="utf-8"))["tool"]["uv"]
        assert exclusiones == config["exclude-dependencies"] == ["diffq", "diffq-fixed"]
        assert config["environments"] == [cr.ENTORNO_MACOS_ARM64]
        (cwd / "salida.txt").write_text("paquete==1\n", encoding="utf-8")
        return subprocess.CompletedProcess(orden, 0)

    monkeypatch.setattr(cr.subprocess, "run", ejecutar)
    monkeypatch.setattr(cr, "_version_uv", lambda uv: "0.13.7")
    macos = next(p for p in cr.PERFILES if p.nombre == "darwin-arm64-mps")
    assert cr._separar(cr._generar(macos, "uv", None, False)) == "paquete==1\n"
