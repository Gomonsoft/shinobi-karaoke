#!/usr/bin/env python3
"""Mide los bytes de descarga de cada archivo de requisitos, sin instalar nada (tarea 0058).

Para cada paquete fijado en ``worker/requisitos/<plataforma>-<perfil>.txt`` elige, entre sus
``--hash``, la rueda compatible con la plataforma (macOS 14 arm64, Windows x64 o Linux x64 con
Python 3.12) y suma su tamaño. Las ruedas se sirven tal cual, así que la suma es lo que se
transfiere al instalar (sin contar Python gestionado por uv ni los modelos).

Tamaño de cada rueda: campo ``size`` de la API JSON de PyPI (emparejando por sha256) o, en los
índices sin esa API (``download.pytorch.org``), ``Content-Length`` de una petición HEAD.

    python worker/scripts/medir_descarga.py                              # los 5 archivos
    python worker/scripts/medir_descarga.py --json salida.json
    python worker/scripts/medir_descarga.py --requisitos linux-x64-cpu

Falla (código 1) si algún paquete se queda sin tamaño: en ese caso la suma no es válida.
Necesita ``packaging`` (``pip install packaging``).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path

try:
    from packaging.markers import Marker
    from packaging.tags import Tag, cpython_tags, mac_platforms
    from packaging.tags import compatible_tags as _compatible_tags
    from packaging.utils import canonicalize_name, parse_wheel_filename
except ImportError:  # pip trae una copia, no estable pero suficiente en último caso
    from pip._vendor.packaging.markers import Marker
    from pip._vendor.packaging.tags import Tag, cpython_tags, mac_platforms
    from pip._vendor.packaging.tags import compatible_tags as _compatible_tags
    from pip._vendor.packaging.utils import canonicalize_name, parse_wheel_filename

RAIZ = Path(__file__).resolve().parent.parent
REQUISITOS = RAIZ / "requisitos"
PYPI = "https://pypi.org"


class ErrorMedicion(Exception):
    pass


@dataclass(frozen=True)
class Objetivo:
    """Plataforma de un archivo de requisitos: etiquetas de wheel y entorno de los marcadores."""

    archivo: str
    plataformas: tuple[str, ...]
    entorno: dict[str, str]


def _linux() -> tuple[str, ...]:
    glibc = [f"manylinux_2_{m}_x86_64" for m in range(39, 4, -1)]
    return (*glibc, "manylinux2014_x86_64", "manylinux2010_x86_64", "manylinux1_x86_64",
            "linux_x86_64")  # fmt: skip


_BASE = {
    "python_version": "3.12",
    "python_full_version": "3.12.16",
    "implementation_name": "cpython",
    "platform_python_implementation": "CPython",
}

OBJETIVOS = {
    "darwin-arm64-mps": Objetivo(
        "darwin-arm64-mps.txt",
        tuple(mac_platforms((14, 0), "arm64")),
        {
            **_BASE,
            "sys_platform": "darwin",
            "platform_machine": "arm64",
            "os_name": "posix",
            "platform_system": "Darwin",
        },
    ),  # fmt: skip
    **{
        f"win32-x64-{p}": Objetivo(
            f"win32-x64-{p}.txt",
            ("win_amd64",),
            {
                **_BASE,
                "sys_platform": "win32",
                "platform_machine": "AMD64",
                "os_name": "nt",
                "platform_system": "Windows",
            },
        )  # fmt: skip
        for p in ("cpu", "cuda")
    },
    **{
        f"linux-x64-{p}": Objetivo(
            f"linux-x64-{p}.txt",
            _linux(),
            {
                **_BASE,
                "sys_platform": "linux",
                "platform_machine": "x86_64",
                "os_name": "posix",
                "platform_system": "Linux",
            },
        )  # fmt: skip
        for p in ("cpu", "cuda")
    },
}


@dataclass
class Requisito:
    nombre: str
    version: str
    hashes: set[str]
    marcador: str | None = None


@dataclass
class Indices:
    principal: str = "https://pypi.org/simple"
    extra: list[str] = field(default_factory=list)


def leer_requisitos(archivo: Path) -> tuple[list[Requisito], Indices]:
    """Paquetes fijados (``nombre==versión [; marcador] --hash=sha256:…``) e índices del archivo."""
    texto = archivo.read_text(encoding="utf-8").replace("\\\n", " ")
    indices = Indices()
    requisitos: list[Requisito] = []
    for linea in texto.splitlines():
        linea = linea.strip()
        if m := re.match(r"--index-url\s+(\S+)", linea):
            indices.principal = m.group(1)
        elif m := re.match(r"--extra-index-url\s+(\S+)", linea):
            indices.extra.append(m.group(1))
        elif m := re.match(r"([A-Za-z0-9_.\-]+)==([^\s;]+)\s*(?:;([^#]*?))?\s*(?:--hash|$)", linea):
            hashes = set(re.findall(r"--hash=sha256:([0-9a-f]{64})", linea))
            if not hashes:
                raise ErrorMedicion(f"{archivo.name}: {m.group(1)} sin --hash")
            marcador = (m.group(3) or "").strip() or None
            requisitos.append(Requisito(m.group(1), m.group(2), hashes, marcador))
    return requisitos, indices


@dataclass(frozen=True)
class Archivo:
    nombre: str
    sha256: str
    url: str | None
    size: int | None


class _EnlacesSimple(HTMLParser):
    """Enlaces ``<a href="…#sha256=…">fichero</a>`` de un índice simple (PEP 503)."""

    def __init__(self) -> None:
        super().__init__()
        self.enlaces: list[tuple[str, str]] = []
        self._href: str | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._href = dict(attrs).get("href")

    def handle_data(self, data):
        if self._href is not None and data.strip():
            self.enlaces.append((data.strip(), self._href))
            self._href = None


def archivos_de_indice_simple(html: str, base: str) -> list[Archivo]:
    p = _EnlacesSimple()
    p.feed(html)
    salida = []
    for nombre, href in p.enlaces:
        url = urllib.parse.urljoin(base, href)
        m = re.search(r"#sha256=([0-9a-f]{64})$", url)
        if m:
            salida.append(Archivo(nombre, m.group(1), url.split("#")[0], None))
    return salida


def archivos_de_json_pypi(datos: dict) -> list[Archivo]:
    return [
        Archivo(u["filename"], u["digests"]["sha256"], u.get("url"), u.get("size"))
        for u in datos.get("urls", [])
        if u.get("digests", {}).get("sha256")
    ]


class Red:
    """Acceso HTTP. Las pruebas lo sustituyen por una clase con los mismos métodos."""

    def __init__(self, reintentos: int = 3) -> None:
        self.reintentos = reintentos

    def _abrir(self, req: urllib.request.Request):
        ultimo: Exception | None = None
        for _ in range(self.reintentos):
            try:
                return urllib.request.urlopen(req, timeout=60)
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    raise
                ultimo = e
            except OSError as e:
                ultimo = e
        raise ErrorMedicion(f"{req.full_url}: {ultimo}")

    def texto(self, url: str) -> str | None:
        """Cuerpo de la respuesta, o ``None`` si es 404."""
        try:
            with self._abrir(urllib.request.Request(url, headers={"User-Agent": "shinobi"})) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError:
            return None

    def content_length(self, url: str) -> int | None:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "shinobi"})
        try:
            with self._abrir(req) as r:
                valor = r.headers.get("Content-Length")
        except urllib.error.HTTPError:
            return None
        return int(valor) if valor and valor.isdigit() else None


def archivos_del_paquete(req: Requisito, indices: Indices, red) -> list[Archivo]:
    """Archivos publicados de ``nombre==versión`` en PyPI (API JSON) y, si faltan, en los extra."""
    encontrados: list[Archivo] = []
    texto = red.texto(f"{PYPI}/pypi/{req.nombre}/{req.version}/json")
    if texto:
        encontrados += archivos_de_json_pypi(json.loads(texto))
    if not any(a.sha256 in req.hashes for a in encontrados):
        for extra in indices.extra:
            base = f"{extra.rstrip('/')}/{canonicalize_name(req.nombre)}/"
            html = red.texto(base)
            if html:
                encontrados += archivos_de_indice_simple(html, base)
    return encontrados


def _tags_objetivo(objetivo: Objetivo) -> list[Tag]:
    py = (3, 12)
    plat = list(objetivo.plataformas)
    return [
        *cpython_tags(py, ["cp312"], plat),
        *_compatible_tags(py, "cp312", plat),
    ]


def elegir_rueda(candidatos: list[Archivo], objetivo: Objetivo) -> Archivo | None:
    """La rueda más específica compatible con la plataforma; si no hay ruedas, un sdist."""
    prioridad = {t: i for i, t in enumerate(_tags_objetivo(objetivo))}
    mejor: tuple[int, Archivo] | None = None
    for a in candidatos:
        if not a.nombre.endswith(".whl"):
            continue
        try:
            _, _, _, tags = parse_wheel_filename(a.nombre)
        except ValueError:
            continue
        pesos = [prioridad[t] for t in tags if t in prioridad]
        if pesos and (mejor is None or min(pesos) < mejor[0]):
            mejor = (min(pesos), a)
    if mejor:
        return mejor[1]
    return next((a for a in candidatos if not a.nombre.endswith(".whl")), None)


def medir_requisito(req: Requisito, objetivo: Objetivo, indices: Indices, red) -> dict:
    resultado = {"paquete": req.nombre, "version": req.version, "archivo": None, "bytes": None}
    try:
        publicados = archivos_del_paquete(req, indices, red)
        candidatos = [a for a in publicados if a.sha256 in req.hashes]
        if not candidatos:
            resultado["error"] = "ninguno de sus hashes está en los índices"
            return resultado
        elegido = elegir_rueda(candidatos, objetivo)
        if elegido is None:
            resultado["error"] = "ninguna rueda compatible con la plataforma"
            return resultado
        resultado["archivo"] = elegido.nombre
        size = elegido.size
        if size is None and elegido.url:
            size = red.content_length(elegido.url)
        if size is None:
            resultado["error"] = "sin tamaño (ni size ni Content-Length)"
        resultado["bytes"] = size
    except ErrorMedicion as e:
        resultado["error"] = str(e)
    return resultado


def medir_archivo(nombre: str, red, hilos: int = 8, requisitos_dir: Path = REQUISITOS) -> dict:
    objetivo = OBJETIVOS[nombre]
    requisitos, indices = leer_requisitos(requisitos_dir / objetivo.archivo)
    aplicables = [
        r for r in requisitos if r.marcador is None or Marker(r.marcador).evaluate(objetivo.entorno)
    ]
    with ThreadPoolExecutor(hilos) as pool:
        paquetes = list(pool.map(lambda r: medir_requisito(r, objetivo, indices, red), aplicables))
    sin_tamano = [p["paquete"] for p in paquetes if p["bytes"] is None]
    total = sum(p["bytes"] or 0 for p in paquetes)
    return {
        "requisitos": nombre,
        "total_bytes": total,
        "paquetes_contados": len(paquetes),
        "paquetes_omitidos_por_marcador": len(requisitos) - len(aplicables),
        "mas_grandes": sorted(
            ({"paquete": p["paquete"], "bytes": p["bytes"]} for p in paquetes if p["bytes"]),
            key=lambda p: -p["bytes"],
        )[:10],
        "sin_tamano": sin_tamano,
        "ok": not sin_tamano,
        "paquetes": paquetes,
    }


def main(argv: list[str] | None = None, red=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--requisitos", action="append", choices=sorted(OBJETIVOS),
                    help="limita la medición")  # fmt: skip
    ap.add_argument("--json", type=Path, help="guarda el resultado en este archivo")
    args = ap.parse_args(argv)
    red = red or Red()
    nombres = args.requisitos or list(OBJETIVOS)
    resultados = [medir_archivo(n, red) for n in nombres]
    for r in resultados:
        estado = "OK   " if r["ok"] else "FALLO"
        print(f"[{estado}] {r['requisitos']}: {r['total_bytes']:,} bytes "
              f"({r['total_bytes'] / 1e6:.1f} MB, {r['paquetes_contados']} paquetes)")  # fmt: skip
        for p in r["mas_grandes"]:
            print(f"        {p['bytes'] / 1e6:9.1f} MB  {p['paquete']}")
        if r["sin_tamano"]:
            print(f"        SIN TAMAÑO (suma no válida): {', '.join(r['sin_tamano'])}")
    salida = {"ok": all(r["ok"] for r in resultados), "requisitos": resultados}
    if args.json:
        args.json.write_text(
            json.dumps(salida, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
    return 0 if salida["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
