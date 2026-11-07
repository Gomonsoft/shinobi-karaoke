#!/usr/bin/env python3
"""Inventario de licencias de los requisitos Python bloqueados (tarea 0133).

La consulta a PyPI es explícita: este script no se ejecuta en pytest ni en la CI normal.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Protocol

RAIZ = Path(__file__).resolve().parent.parent
REQUISITOS = RAIZ / "requisitos"
AVISOS = RAIZ.parent / "THIRD_PARTY_NOTICES.md"
PYPI = "https://pypi.org/pypi"
MARCADOR_INICIO = "<!-- inicio:dependencias-python -->"
MARCADOR_FIN = "<!-- fin:dependencias-python -->"

# Cualquier excepción requiere nombre, licencia verificada y motivo revisado por el arquitecto.
REVISIONES_MANUALES: dict[str, dict[str, str]] = {
    "cuda-toolkit==12.8.1": {
        "licencia": "Licencia de NVIDIA (no redistribuida)",
        "motivo": (
            "PyPI no declara licencia; los metadatos identifican al NVIDIA Kitmaker Team "
            "el paquete como meta-package sin software que instala componentes nvidia-*"
        ),
    }
}

CLASIFICADORES = {
    "MIT License": "MIT",
    "Apache Software License": "Apache-2.0",
    "BSD License": "BSD (PyPI classifier)",
    "ISC License (ISCL)": "ISC",
    "Mozilla Public License 2.0 (MPL 2.0)": "MPL-2.0",
    "Python Software Foundation License": "PSF-2.0",
    "GNU General Public License v3 (GPLv3)": "GPL-3.0-only",
    "GNU General Public License v3 or later (GPLv3+)": "GPL-3.0-or-later",
    "GNU General Public License v2 or later (GPLv2+)": "GPL-2.0-or-later",
    "GNU Lesser General Public License v3 (LGPLv3)": "LGPL-3.0-only",
    "GNU Lesser General Public License v3 or later (LGPLv3+)": "LGPL-3.0-or-later",
    "Historical Permission Notice and Disclaimer (HPND)": "HPND",
    "Other/Proprietary License": "Proprietary",
}

NO_COMERCIAL = re.compile(
    r"non[ -]?commercial|noncommercial|research[ -]?only|for research use only|"
    r"academic[ -]?research only|CC-BY-NC(?:-|\b)",
    re.IGNORECASE,
)
INCOMPATIBLES = re.compile(
    r"(?:^|[ (])(?:GPL-2\.0-only|GPL-1\.0|AGPL-|Proprietary|LicenseRef-)", re.I
)
IDENTIFICADORES_SPDX = re.compile(
    r"^[A-Za-z0-9.+-]+(?:\s+(?:AND|OR|WITH)\s+[A-Za-z0-9.+-]+)*(?:\s*\(.*\))?$"
)


class ErrorLicencia(Exception):
    """Error accionable del inventario de licencias."""


class ClientePyPI(Protocol):
    def metadata(self, nombre: str, version: str) -> dict | None: ...


class RedPyPI:
    """Cliente mínimo para el API JSON de PyPI; se puede reemplazar en tests."""

    def __init__(self, reintentos: int = 3, timeout: int = 30) -> None:
        self.reintentos = reintentos
        self.timeout = timeout
        self.cache: dict[tuple[str, str], dict | None] = {}

    def metadata(self, nombre: str, version: str) -> dict | None:
        clave = (nombre.lower().replace("_", "-"), version)
        if clave in self.cache:
            return self.cache[clave]
        nombre_url = urllib.parse.quote(nombre, safe="-")
        version_url = urllib.parse.quote(version, safe=".+-")
        urls = [f"{PYPI}/{nombre_url}/{version_url}/json"]
        # Las ruedas del índice CUDA de PyTorch usan versión local (+cu128) y PyPI
        # publica los metadatos de la misma versión base sin la etiqueta del índice.
        if "+" in version:
            base = version.split("+", 1)[0]
            urls.append(f"{PYPI}/{nombre_url}/{urllib.parse.quote(base, safe='.-')}/json")
        ultimo_error: Exception | None = None
        for url in urls:
            for _ in range(self.reintentos):
                try:
                    solicitud = urllib.request.Request(
                        url, headers={"User-Agent": "shinobi-karaoke"}
                    )
                    with urllib.request.urlopen(solicitud, timeout=self.timeout) as respuesta:
                        datos = json.loads(respuesta.read().decode("utf-8"))
                    self.cache[clave] = datos.get("info", {})
                    return self.cache[clave]
                except urllib.error.HTTPError as error:
                    if error.code == 404:
                        break
                    ultimo_error = error
                except (OSError, json.JSONDecodeError) as error:
                    ultimo_error = error
        if ultimo_error:
            raise ErrorLicencia(
                f"No se pudo consultar PyPI para {nombre}=={version}: {ultimo_error}"
            )
        self.cache[clave] = None
        return None


def canonicalizar(nombre: str) -> str:
    return re.sub(r"[-_.]+", "-", nombre).lower()


def leer_requisitos(carpeta: Path = REQUISITOS) -> dict[tuple[str, str], set[str]]:
    """Devuelve cada nombre/versión y los perfiles donde aparece."""
    perfiles: dict[tuple[str, str], set[str]] = {}
    archivos = sorted(p for p in carpeta.glob("*.txt") if p.name != "exclusiones.txt")
    if len(archivos) != 5:
        raise ErrorLicencia(
            f"Se esperaban 5 archivos de requisitos en {carpeta}; hay {len(archivos)}"
        )
    for archivo in archivos:
        texto = archivo.read_text(encoding="utf-8").replace("\\\n", " ")
        for linea in texto.splitlines():
            linea = linea.strip()
            coincidencia = re.match(r"^([A-Za-z0-9_.-]+)==([^\s;\\]+)", linea)
            if not coincidencia:
                continue
            nombre, version = coincidencia.groups()
            clave = (canonicalizar(nombre), version)
            perfiles.setdefault(clave, set()).add(archivo.stem)
    if not perfiles:
        raise ErrorLicencia(f"No se encontraron requisitos fijados en {carpeta}")
    return perfiles


def _texto_licencia(info: dict) -> str:
    licencia = info.get("license")
    if isinstance(licencia, dict):
        licencia = licencia.get("text")
    return str(licencia or "").strip()


def clasificar_licencia(
    nombre: str,
    version: str,
    info: dict | None,
    revisiones: dict[str, dict[str, str]] | None = None,
) -> str:
    """Clasifica con metadatos PyPI; falla ante ambigüedad, no comercial o incompatibilidad."""
    canonico = canonicalizar(nombre)
    if canonico.startswith("nvidia-"):
        return "Licencia de NVIDIA (no redistribuida)"

    clave = f"{canonico}=={version}"
    revision = (revisiones or REVISIONES_MANUALES).get(clave)
    if revision:
        motivo = revision.get("motivo", "").strip()
        licencia = revision.get("licencia", "").strip()
        if not motivo or not licencia:
            raise ErrorLicencia(
                f"Revisión manual incompleta para {clave}: hace falta motivo y licencia"
            )
        if NO_COMERCIAL.search(licencia) or INCOMPATIBLES.search(licencia):
            raise ErrorLicencia(
                f"La revisión manual conserva una licencia incompatible para {clave}: {licencia}"
            )
        return f"{licencia} (revisión manual: {motivo})"

    if not info:
        raise ErrorLicencia(f"No hay metadatos de PyPI para {clave}")
    expresion = str(info.get("license_expression") or "").strip()
    texto = _texto_licencia(info)
    clasificadores = [
        elemento.removeprefix("License :: OSI Approved :: ").removeprefix("License ::")
        for elemento in info.get("classifiers", [])
        if elemento.startswith("License ::")
    ]
    declaracion_corta = texto if len(texto) <= 500 else ""
    declaracion = " ".join((expresion, declaracion_corta, *clasificadores))
    if NO_COMERCIAL.search(declaracion):
        restriccion = NO_COMERCIAL.search(declaracion)
        raise ErrorLicencia(
            f"Licencia con restricción no comercial o de investigación para {clave}: "
            f"{restriccion.group(0) if restriccion else 'declaración restringida'}"
        )
    if INCOMPATIBLES.search(expresion or declaracion_corta):
        raise ErrorLicencia(
            f"Posible licencia incompatible para {clave}: {expresion or declaracion_corta}; "
            "consultar al arquitecto"
        )

    if expresion and IDENTIFICADORES_SPDX.fullmatch(expresion):
        return expresion
    if texto:
        normalizado = re.sub(r"\s+", " ", texto)
        for nombre_clasificador, identificador in CLASIFICADORES.items():
            if nombre_clasificador.lower() in normalizado.lower():
                return identificador
        # PyPI suele publicar el identificador SPDX directamente en el campo `license`.
        if IDENTIFICADORES_SPDX.fullmatch(texto):
            return texto
    for clasificador in clasificadores:
        if clasificador in CLASIFICADORES:
            return CLASIFICADORES[clasificador]
        for nombre_clasificador, identificador in CLASIFICADORES.items():
            if nombre_clasificador.lower() in clasificador.lower():
                return identificador
    raise ErrorLicencia(
        f"No se pudo clasificar la licencia de {clave}; revisar los metadatos de PyPI"
    )


def generar_bloque(
    perfiles: dict[tuple[str, str], set[str]], metadatos: dict[tuple[str, str], dict | None]
) -> str:
    lineas = [MARCADOR_INICIO, "### Inventario completo de requisitos Python", ""]
    errores: list[str] = []
    for (nombre, version), nombres_perfiles in sorted(perfiles.items()):
        try:
            licencia = clasificar_licencia(nombre, version, metadatos.get((nombre, version)))
        except ErrorLicencia as error:
            errores.append(str(error))
            continue
        lineas.append(
            f"- **{nombre}** {version} — {licencia}; perfiles: "
            f"{', '.join(sorted(nombres_perfiles))}."
        )
    if errores:
        raise ErrorLicencia("\n".join(errores))
    lineas.extend(["", MARCADOR_FIN])
    return "\n".join(lineas)


def reemplazar_bloque(contenido: str, bloque: str) -> str:
    inicio = contenido.find(MARCADOR_INICIO)
    fin = contenido.find(MARCADOR_FIN)
    if (
        inicio < 0
        or fin < inicio
        or contenido.find(MARCADOR_INICIO, inicio + 1) >= 0
        or contenido.find(MARCADOR_FIN, fin + 1) >= 0
    ):
        raise ErrorLicencia(
            "THIRD_PARTY_NOTICES.md debe tener exactamente un par de marcadores "
            "dependencias-python en orden"
        )
    return contenido[:inicio] + bloque + contenido[fin + len(MARCADOR_FIN) :]


def generar_inventario(carpeta: Path = REQUISITOS, red: ClientePyPI | None = None) -> str:
    perfiles = leer_requisitos(carpeta)
    cliente = red or RedPyPI()
    datos: dict[tuple[str, str], dict | None] = {}
    errores: list[Exception] = []
    with ThreadPoolExecutor(max_workers=10) as grupo:
        futuros = {
            grupo.submit(cliente.metadata, nombre, version): (nombre, version)
            for nombre, version in perfiles
            if not nombre.startswith("nvidia-")
        }
        for futuro in as_completed(futuros):
            clave = futuros[futuro]
            try:
                datos[clave] = futuro.result()
            except Exception as error:  # informar todos los fallos de red sin perder el resto
                errores.append(error)
    if errores:
        raise ErrorLicencia("\n".join(str(error) for error in errores))
    for clave in perfiles:
        if clave[0].startswith("nvidia-"):
            datos[clave] = None
    return generar_bloque(perfiles, datos)


def actualizar_archivo(bloque: str, comprobar: bool) -> None:
    contenido = AVISOS.read_text(encoding="utf-8")
    nuevo = reemplazar_bloque(contenido, bloque)
    if comprobar:
        if contenido != nuevo:
            raise ErrorLicencia(
                "THIRD_PARTY_NOTICES.md difiere del inventario; ejecute licencias_requisitos.py"
            )
    else:
        AVISOS.write_text(nuevo, encoding="utf-8")


def main(argv: list[str] | None = None, red: ClientePyPI | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--comprobar", action="store_true", help="regenera en memoria y compara el archivo"
    )
    args = parser.parse_args(argv)
    try:
        bloque = generar_inventario(red=red)
        actualizar_archivo(bloque, args.comprobar)
    except (ErrorLicencia, OSError, json.JSONDecodeError) as error:
        print(f"No se pudo actualizar el inventario de licencias: {error}", file=sys.stderr)
        return 1
    print(
        "Inventario de requisitos Python comprobado."
        if args.comprobar
        else "Inventario de requisitos Python actualizado."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
