#!/usr/bin/env python3
"""Genera los requisitos bloqueados por plataforma y perfil (ADR 0009 §1).

Escribe ``worker/requisitos/<plataforma>-<perfil>.txt`` con ``uv pip compile``
(Python 3.12, hashes, extra ``separacion``). Solo resuelve: no descarga ruedas.

    uv run python scripts/compilar_requisitos.py              # regenera los archivos
    uv run python scripts/compilar_requisitos.py --comprobar  # falla si no coinciden
    uv run python scripts/compilar_requisitos.py --actualizar # ignora las versiones ya fijadas

Por defecto la resolución reutiliza como preferencia las versiones ya escritas en cada
archivo, de modo que ``--comprobar`` no falla cuando PyPI publica una versión nueva de
una dependencia transitiva; ``--actualizar`` las vuelve a resolver.

Tras regenerar hay que subir ``version`` y actualizar ``sha256_requisitos`` en
``app/resources/runtime-manifest.json`` (lo comprueba un test de la app).
El binario de uv se toma de la variable ``UV`` o del PATH.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import tempfile
import tomllib
from dataclasses import dataclass
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "requisitos"
EXCLUSIONES = Path("requisitos/exclusiones.txt")
PYTHON = "3.12"

# Fijados por override (0005 §"Deuda técnica"): la API de audio-separator cambia a menudo
# y onnx-weekly es una versión de desarrollo que entra como dependencia transitiva.
OVERRIDES_COMUNES = (
    "onnxruntime==1.31.1",
    "audioread==3.1.0",
    "onnx-weekly==1.24.0.dev20261102",
)

INDICE_TORCH = "https://download.pytorch.org/whl/"


@dataclass(frozen=True)
class Perfil:
    nombre: str
    # Triple de uv (--python-platform). None: macOS arm64, ver `_compilar_macos`.
    plataforma_uv: str | None = None
    # Backend de PyTorch (--torch-backend): "cpu", "cu128" o None (PyPI).
    backend: str | None = None
    # La última versión de torch que publica el índice del perfil y es compatible.
    torch: str = ""
    # Si no se puede resolver, motivo (se informa y se omite; ver tarea 0030).
    no_soportado: str | None = None


PERFILES: tuple[Perfil, ...] = (
    Perfil("darwin-arm64-mps", torch="torch==2.15.0"),
    Perfil(
        "darwin-x64-cpu",
        plataforma_uv="x86_64-apple-darwin",
        backend="cpu",
        no_soportado=(
            "PyTorch no publica ruedas para macOS Intel desde la 2.2.2 y audio-separator "
            "0.48.0 exige torch>=2.3 (uv: «no wheels with a matching platform tag»). "
            "Ver docs/preguntas/0015-macos-intel-sin-pytorch-y-macos-minimo.md."
        ),
    ),
    Perfil(
        "win32-x64-cpu",
        plataforma_uv="x86_64-pc-windows-msvc",
        backend="cpu",
        torch="torch==2.15.0+cpu",
    ),
    Perfil(
        "win32-x64-cuda",
        plataforma_uv="x86_64-pc-windows-msvc",
        backend="cu128",
        torch="torch==2.11.0+cu128",
    ),
    Perfil(
        "linux-x64-cpu",
        plataforma_uv="x86_64-unknown-linux-gnu",
        backend="cpu",
        torch="torch==2.15.0+cpu",
    ),
    Perfil(
        "linux-x64-cuda",
        plataforma_uv="x86_64-unknown-linux-gnu",
        backend="cu128",
        torch="torch==2.11.0+cu128",
    ),
)

# El límite de Python hace falta: en modo universal uv no aplica ``requires-python`` como tope
# y resolvería también las ramas de Python >= 3.13 (p. ej. ``audioop-lts``).
ENTORNO_MACOS_ARM64 = (
    "sys_platform == 'darwin' and platform_machine == 'arm64' "
    "and python_full_version >= '3.12' and python_full_version < '3.13'"
)


class ErrorCompilacion(Exception):
    pass


def _uv() -> str:
    ruta = os.environ.get("UV") or shutil.which("uv")
    if not ruta:
        raise ErrorCompilacion("No se encuentra uv: instálalo o define la variable UV.")
    return ruta


def _version_uv(uv: str) -> str:
    salida = subprocess.run([uv, "--version"], capture_output=True, text=True, check=True)
    return salida.stdout.split()[1]


def _overrides(perfil: Perfil) -> tuple[str, ...]:
    return (perfil.torch, *OVERRIDES_COMUNES)


def _argumentos(perfil: Perfil, salida: str, actualizar: bool) -> list[str]:
    """Argumentos de `uv pip compile` (sin el ejecutable)."""
    args = ["pip", "compile", "pyproject.toml", "--extra", "separacion"]
    if perfil.plataforma_uv is None:
        # uv da por hecho macOS 13 con --python-platform y torch >= 2.13 solo publica
        # macosx_14_0_arm64: se resuelve en modo universal restringido a macOS arm64
        # (``[tool.uv] environments`` en una copia temporal de pyproject.toml).
        args += ["--universal", "--python-version", PYTHON]
    else:
        args += ["--python-version", PYTHON, "--python-platform", perfil.plataforma_uv]
    if perfil.backend:
        args += ["--torch-backend", perfil.backend]
    args += ["--excludes", EXCLUSIONES.as_posix()]
    args += ["--overrides", "overrides.txt", "--generate-hashes", "--emit-index-url"]
    args += ["--no-header", "--output-file", salida]
    if actualizar:
        args.append("--upgrade")
    return args


def _cabecera(perfil: Perfil, uv_version: str) -> str:
    orden = "uv " + " ".join(_argumentos(perfil, f"{perfil.nombre}.txt", False))
    lineas = [
        "# Archivo generado por worker/scripts/compilar_requisitos.py: no se edita a mano.",
        f"# Perfil: {perfil.nombre} (ADR 0009 §1). Resuelto con uv {uv_version} desde worker/:",
        f"#   {orden}",
        f"# overrides.txt: {', '.join(_overrides(perfil))}",
    ]
    if perfil.plataforma_uv is None:
        lineas.append(f'# Modo universal con [tool.uv] environments = ["{ENTORNO_MACOS_ARM64}"].')
    lineas += [
        "# Instalación: uv pip install --require-hashes --index-strategy unsafe-best-match"
        f" --excludes {EXCLUSIONES.as_posix()} -r <este archivo>",
        "",
    ]
    return "\n".join(lineas) + "\n"


def _separar(texto: str) -> str:
    """Quita la cabecera (comentarios iniciales y la línea en blanco que los cierra)."""
    lineas = texto.split("\n")
    i = 0
    while i < len(lineas) and lineas[i].startswith("#"):
        i += 1
    if i < len(lineas) and lineas[i] == "":
        i += 1
    return "\n".join(lineas[i:])


def _generar(perfil: Perfil, uv: str, actual: str | None, actualizar: bool) -> str:
    """Devuelve el contenido completo del archivo de requisitos del perfil."""
    with tempfile.TemporaryDirectory(prefix="requisitos-") as tmp:
        t = Path(tmp)
        proyecto = (RAIZ / "pyproject.toml").read_text(encoding="utf-8")
        exclusiones = (RAIZ / EXCLUSIONES).read_text(encoding="utf-8")
        configuradas = tomllib.loads(proyecto)["tool"]["uv"].get("exclude-dependencies")
        if exclusiones.splitlines() != configuradas:
            raise ErrorCompilacion("Las exclusiones del archivo y de pyproject.toml difieren.")
        if perfil.plataforma_uv is None:
            proyecto = proyecto.replace(
                "[tool.uv]\n", f'[tool.uv]\nenvironments = ["{ENTORNO_MACOS_ARM64}"]\n', 1
            )
        (t / EXCLUSIONES.parent).mkdir()
        (t / EXCLUSIONES).write_text(exclusiones, encoding="utf-8")
        (t / "pyproject.toml").write_text(proyecto, encoding="utf-8")
        shutil.copy(RAIZ / "README.md", t / "README.md")
        (t / "overrides.txt").write_text("\n".join(_overrides(perfil)) + "\n", encoding="utf-8")
        salida = t / "salida.txt"
        if actual is not None and not actualizar:
            # uv reutiliza como preferencia lo que ya hay en el archivo de salida.
            salida.write_text(_separar(actual), encoding="utf-8")
        resultado = subprocess.run(
            [uv, *_argumentos(perfil, "salida.txt", actualizar)],
            cwd=t,
            capture_output=True,
            text=True,
        )
        if resultado.returncode != 0:
            raise ErrorCompilacion(
                f"No se pudo resolver {perfil.nombre}:\n{resultado.stderr.strip()}"
            )
        cuerpo = salida.read_text(encoding="utf-8")
    if perfil.backend:
        extra = f"--extra-index-url {INDICE_TORCH}{perfil.backend}"
        if extra not in cuerpo:
            # `--emit-index-url` no emite el índice de `--torch-backend`: sin esta línea
            # la instalación no encontraría torch==x+cpu / +cu128.
            lineas = cuerpo.split("\n")
            pos = next((i for i, ln in enumerate(lineas) if ln.startswith("--index-url")), -1)
            lineas.insert(pos + 1, extra)
            cuerpo = "\n".join(lineas)
    return _cabecera(perfil, _version_uv(uv)) + cuerpo


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--comprobar", action="store_true", help="no escribe: falla si hay diferencias")
    ap.add_argument("--actualizar", action="store_true", help="ignora las versiones ya fijadas")
    ap.add_argument("--perfil", action="append", help="solo este perfil (repetible)")
    opciones = ap.parse_args(argv)
    if opciones.comprobar and opciones.actualizar:
        ap.error("--comprobar y --actualizar son incompatibles")

    nombres = {p.nombre for p in PERFILES}
    desconocidos = set(opciones.perfil or []) - nombres
    if desconocidos:
        ap.error(f"perfil desconocido: {', '.join(sorted(desconocidos))}")

    try:
        uv = _uv()
    except ErrorCompilacion as e:
        print(e, file=sys.stderr)
        return 2

    fallos = 0
    for perfil in PERFILES:
        if opciones.perfil and perfil.nombre not in opciones.perfil:
            continue
        destino = DESTINO / f"{perfil.nombre}.txt"
        if perfil.no_soportado:
            print(f"- {perfil.nombre}: omitido, no soportado. {perfil.no_soportado}")
            if destino.exists():
                print(f"  ERROR: {destino} no debería existir.", file=sys.stderr)
                fallos += 1
            continue
        actual = destino.read_text(encoding="utf-8") if destino.exists() else None
        try:
            nuevo = _generar(perfil, uv, actual, opciones.actualizar)
        except ErrorCompilacion as e:
            print(f"- {perfil.nombre}: ERROR\n{e}", file=sys.stderr)
            fallos += 1
            continue
        if opciones.comprobar:
            if actual == nuevo:
                print(f"- {perfil.nombre}: al día")
            else:
                print(
                    f"- {perfil.nombre}: desactualizado; ejecuta scripts/compilar_requisitos.py",
                    file=sys.stderr,
                )
                fallos += 1
        else:
            DESTINO.mkdir(exist_ok=True)
            destino.write_text(nuevo, encoding="utf-8", newline="\n")
            huella = hashlib.sha256(nuevo.encode("utf-8")).hexdigest()
            print(f"- {perfil.nombre}: escrito (sha256 {huella})")
    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
