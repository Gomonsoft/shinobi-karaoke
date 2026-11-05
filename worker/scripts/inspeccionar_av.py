#!/usr/bin/env python3
"""Revisa la licencia del FFmpeg incluido en las ruedas de PyAV (ADR 0002, revisión 2026-11-04).

Para cada plataforma lee la versión de ``av`` fijada en
``worker/requisitos/<plataforma>-<perfil>.txt``,
**descarga la rueda sin instalarla** (``pip download --only-binary=:all: --no-deps``), comprueba su
sha256 contra los hashes del archivo de requisitos y abre el zip para extraer, de libavutil:

- la cadena de configuración de FFmpeg (``--enable-…``) y la licencia declarada;
- las bibliotecas incluidas (``av/.dylibs``, ``av.libs``, DLL/``.so`` junto a ``av/``).

Falla (código 1) si aparece ``--enable-nonfree``, ``libfdk``, ``libnpp``, ``cuda-nvcc``,
``decklink`` u otra biblioteca no libre. Informa, sin fallar, de los componentes GPL
(``--enable-gpl``, libx264, libx265).

    uv run python scripts/inspeccionar_av.py                       # las 5 plataformas + darwin-x64
    uv run python scripts/inspeccionar_av.py --json salida.json    # además guarda el resultado
    uv run python scripts/inspeccionar_av.py --plataforma linux-x64

Solo usa la biblioteca estándar y ``python -m pip`` (``pip`` debe estar disponible). Hay que
repetirlo al cambiar la versión de ``av``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
REQUISITOS = RAIZ / "requisitos"


@dataclass(frozen=True)
class Objetivo:
    """Una plataforma: archivo de requisitos del que sale la versión y etiquetas de pip."""

    nombre: str
    requisitos: str  # archivo de worker/requisitos/ (darwin-x64 reutiliza el de darwin-arm64)
    etiquetas: tuple[str, ...]


OBJETIVOS = (
    Objetivo(
        "darwin-arm64-mps", "darwin-arm64-mps.txt", ("macosx_14_0_arm64", "macosx_11_0_arm64")
    ),
    # Sin archivo propio (preguntas/0015) ni runner: se revisa con la versión de darwin-arm64.
    Objetivo("darwin-x64", "darwin-arm64-mps.txt", ("macosx_11_0_x86_64", "macosx_10_15_x86_64")),
    Objetivo("win32-x64-cpu", "win32-x64-cpu.txt", ("win_amd64",)),
    Objetivo("win32-x64-cuda", "win32-x64-cuda.txt", ("win_amd64",)),
    Objetivo(
        "linux-x64-cpu", "linux-x64-cpu.txt", ("manylinux_2_28_x86_64", "manylinux_2_17_x86_64")
    ),
    Objetivo(
        "linux-x64-cuda", "linux-x64-cuda.txt", ("manylinux_2_28_x86_64", "manylinux_2_17_x86_64")
    ),
)

# Cadenas que, en la configuración o en el nombre de una biblioteca, impiden redistribuir la rueda.
NO_LIBRES = (
    "--enable-nonfree",
    "libfdk",
    "libnpp",
    "cuda-nvcc",
    "decklink",
    "libnvenc",
    "--enable-cuda-nvcc",
)
# Informativas (GPL): no hacen fallar.
GPL = ("--enable-gpl", "libx264", "libx265", "libxvid")

RE_LIBRERIA = re.compile(r"\.(dylib|so(\.\d+)*|dll)$", re.IGNORECASE)
RE_AVUTIL = re.compile(r"(^|/)(lib)?avutil[-.]", re.IGNORECASE)
# Tira imprimible que contiene la cadena de configuración de FFmpeg.
RE_CONFIG = re.compile(rb"[ -~]*--(?:enable|disable|prefix|arch|extra)[ -~]*")
RE_LICENCIA = re.compile(
    rb"(?:L?GPL version [23](?:\.\d)? or later|nonfree and unredistributable|unknown license!)"
)


class ErrorInspeccion(Exception):
    pass


def version_y_hashes(archivo: Path, paquete: str = "av") -> tuple[str, set[str]]:
    """Versión fijada de ``paquete`` y sus hashes sha256 en un archivo de requisitos de pip."""
    texto = archivo.read_text(encoding="utf-8").replace("\\\n", " ")
    for linea in texto.splitlines():
        m = re.match(rf"\s*{re.escape(paquete)}==([^\s;]+)", linea)
        if m:
            return m.group(1), set(re.findall(r"--hash=sha256:([0-9a-f]{64})", linea))
    raise ErrorInspeccion(f"{archivo.name}: no fija {paquete}")


def descargar_rueda(version: str, etiquetas: tuple[str, ...], destino: Path) -> Path:
    """``pip download`` de la rueda de ``av`` para esas etiquetas, sin instalar nada."""
    cmd = [
        sys.executable, "-m", "pip", "download", "--only-binary=:all:", "--no-deps",
        "--disable-pip-version-check", "--no-cache-dir", "-q",
        "--python-version", "3.12", "--implementation", "cp", "--abi", "cp312", "--abi", "abi3",
    ]  # fmt: skip
    for e in etiquetas:
        cmd += ["--platform", e]
    cmd += ["-d", str(destino), f"av=={version}"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    ruedas = sorted(destino.glob("av-*.whl"))
    if r.returncode != 0 or not ruedas:
        raise ErrorInspeccion(
            f"pip download falló ({', '.join(etiquetas)}): {(r.stderr or r.stdout).strip()[-400:]}"
        )
    return ruedas[0]


def sha256(ruta: Path) -> str:
    h = hashlib.sha256()
    with ruta.open("rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def inspeccionar_rueda(rueda: Path) -> dict:
    """Extrae del zip la configuración de FFmpeg, la licencia declarada y las bibliotecas."""
    bibliotecas: list[str] = []
    configuraciones: set[str] = set()
    licencias: set[str] = set()
    with zipfile.ZipFile(rueda) as z:
        for info in z.infolist():
            nombre = info.filename
            if info.is_dir() or not RE_LIBRERIA.search(nombre):
                continue
            base = nombre.rsplit("/", 1)[-1]
            # Solo las bibliotecas empaquetadas (no las extensiones de PyAV: av/*.abi3.so).
            if nombre.startswith("av/") and ".dylibs/" not in nombre and base.endswith(".abi3.so"):
                continue
            bibliotecas.append(nombre)
            if RE_AVUTIL.search(nombre):
                datos = z.read(info)
                for m in RE_CONFIG.finditer(datos):
                    cadena = m.group(0).decode("ascii").strip()
                    if "--enable-" in cadena or "--prefix" in cadena:
                        configuraciones.add(cadena)
                for m in RE_LICENCIA.finditer(datos):
                    licencias.add(m.group(0).decode("ascii"))
        metadatos = next((n for n in z.namelist() if n.endswith(".dist-info/METADATA")), None)
        licencia_paquete = None
        if metadatos:
            for linea in z.read(metadatos).decode("utf-8", "replace").splitlines():
                if linea.startswith(("License-Expression:", "License:")):
                    licencia_paquete = linea.split(":", 1)[1].strip()
                    break
    if not configuraciones:
        raise ErrorInspeccion(
            f"{rueda.name}: no se encontró la configuración de FFmpeg en libavutil"
        )
    config = max(configuraciones, key=len)  # la cadena completa, no un fragmento
    nombres = sorted(bibliotecas)
    opciones = sorted(set(re.findall(r"--enable-([\w\-]+)", config)))
    # Solo cuentan las opciones activadas (``--disable-libfdk-aac`` no molesta) y las bibliotecas.
    texto_busqueda = (
        " ".join(f"--enable-{o}" for o in opciones) + "\n" + "\n".join(nombres)
    ).lower()
    no_libres = sorted({c for c in NO_LIBRES if c in texto_busqueda})
    gpl = sorted({c for c in GPL if c in texto_busqueda})
    return {
        "rueda": rueda.name,
        "licencia_declarada_ffmpeg": sorted(licencias),
        "licencia_paquete_av": licencia_paquete,
        "configuracion": config,
        "opciones_enable": opciones,
        "bibliotecas": nombres,
        "componentes_gpl": gpl,
        "no_libres": no_libres,
        "ok": not no_libres,
    }


def revisar(objetivo: Objetivo, carpeta: Path) -> dict:
    version, hashes = version_y_hashes(REQUISITOS / objetivo.requisitos)
    resultado: dict = {"plataforma": objetivo.nombre, "version_av": version}
    try:
        rueda = descargar_rueda(version, objetivo.etiquetas, carpeta / objetivo.nombre)
        digest = sha256(rueda)
        resultado["sha256"] = digest
        # darwin-x64 no tiene archivo propio: no hay hashes con los que comparar.
        resultado["sha256_en_requisitos"] = (
            digest in hashes if objetivo.nombre != "darwin-x64" else None
        )
        resultado.update(inspeccionar_rueda(rueda))
        if resultado["sha256_en_requisitos"] is False:
            resultado["ok"] = False
            resultado["error"] = "el sha256 de la rueda no está en el archivo de requisitos"
    except ErrorInspeccion as e:
        resultado.update({"ok": False, "error": str(e)})
    return resultado


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument(
        "--plataforma",
        action="append",
        choices=[o.nombre for o in OBJETIVOS],
        help="limita la revisión",
    )
    ap.add_argument("--json", type=Path, help="guarda el resultado en este archivo")
    args = ap.parse_args()
    objetivos = [o for o in OBJETIVOS if not args.plataforma or o.nombre in args.plataforma]
    with tempfile.TemporaryDirectory(prefix="shinobi-av-") as tmp:
        resultados = [revisar(o, Path(tmp)) for o in objetivos]
    for r in resultados:
        estado = "OK " if r["ok"] else "FALLO"
        print(f"[{estado}] {r['plataforma']} av=={r['version_av']}")
        if r.get("error"):
            print(f"        error: {r['error']}")
            continue
        declarada = ", ".join(r["licencia_declarada_ffmpeg"]) or "(no encontrada)"
        print(f"        licencia declarada: {declarada}")
        print(
            f"        componentes GPL (informativo): {', '.join(r['componentes_gpl']) or 'ninguno'}"
        )
        print(f"        no libres: {', '.join(r['no_libres']) or 'ninguno'}")
        print(f"        bibliotecas: {len(r['bibliotecas'])}")
    salida = {"ok": all(r["ok"] for r in resultados), "plataformas": resultados}
    if args.json:
        args.json.write_text(
            json.dumps(salida, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
    return 0 if salida["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
