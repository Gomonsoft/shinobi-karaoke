"""Comando `diagnostico`: confirma con PyTorch el perfil de hardware previsto (ADR 0004, paso 2).

Solo puede rebajar Calidad -> Rapido (`cuda`/`mps` -> `cpu`), nunca subir. Apple Silicon
(`mps`) conserva el perfil Calidad pero se ejecuta en CPU (docs/preguntas/0010).
`torch` se importa de forma perezosa para no penalizar los demas comandos.
"""

from __future__ import annotations

import importlib
import importlib.metadata
from collections.abc import Callable
from types import ModuleType
from typing import Any

from . import protocolo
from .errores import ArgumentosNoValidos

PERFILES = ("cpu", "cuda", "mps")
VRAM_MINIMA_MB = 4096

Importador = Callable[[str], ModuleType]


def _version_onnxruntime() -> str | None:
    try:
        return importlib.metadata.version("onnxruntime")
    except importlib.metadata.PackageNotFoundError:
        return None


def _resultado(
    perfil: str,
    dispositivo: str,
    *,
    gpu: str | None = None,
    vram_mb: int | None = None,
    motivo_rebaja: str | None = None,
    torch: str | None = None,
) -> dict[str, Any]:
    return {
        "perfil": perfil,
        "dispositivo": dispositivo,
        "gpu": gpu,
        "vram_mb": vram_mb,
        "motivo_rebaja": motivo_rebaja,
        "torch": torch,
        "onnxruntime": _version_onnxruntime(),
    }


def _sondear_cuda(torch: Any) -> tuple[str | None, int | None, bool]:
    """Devuelve (nombre, vram_mb, operacion_ok). Nunca lanza."""
    try:
        if not torch.cuda.is_available():
            return None, None, False
        props = torch.cuda.get_device_properties(0)
        nombre = str(props.name)
        vram = int(props.total_memory) // (1024 * 1024)
    except Exception:
        return None, None, False
    try:
        x = torch.ones(8, device="cuda")
        (x + x).sum().item()
        torch.cuda.synchronize()
    except Exception:
        return nombre, vram, False
    return nombre, vram, True


def diagnosticar(
    perfil_previsto: str, importar: Importador = importlib.import_module
) -> dict[str, Any]:
    """Logica pura del diagnostico; `importar` permite inyectar un `torch` falso."""
    try:
        torch = importar("torch")
    except Exception as e:  # ImportError, o fallo al cargar librerias nativas
        if perfil_previsto != "cpu":
            protocolo.log("warning", f"No se pudo importar torch ({type(e).__name__}: {e})")
            return _resultado("cpu", "cpu", motivo_rebaja="generico")
        return _resultado("cpu", "cpu")

    version = str(getattr(torch, "__version__", "")) or None

    if perfil_previsto == "cpu":
        return _resultado("cpu", "cpu", torch=version)
    if perfil_previsto == "mps":
        # Calidad en CPU: no se exige torch.backends.mps.is_available().
        return _resultado("mps", "cpu", torch=version)

    nombre, vram, operacion_ok = _sondear_cuda(torch)
    if not operacion_ok:
        return _resultado(
            "cpu", "cpu", gpu=nombre, vram_mb=vram, motivo_rebaja="generico", torch=version
        )
    if vram is not None and vram < VRAM_MINIMA_MB:
        return _resultado(
            "cpu", "cpu", gpu=nombre, vram_mb=vram, motivo_rebaja="memoria", torch=version
        )
    return _resultado("cuda", "cuda", gpu=nombre, vram_mb=vram, torch=version)


def diagnostico(args: dict[str, Any]) -> None:
    perfil = args.get("perfil_previsto")
    if perfil not in PERFILES:
        raise ArgumentosNoValidos("'perfil_previsto' debe ser 'cpu', 'cuda' o 'mps'")
    protocolo.progreso("diagnostico", None)
    protocolo.resultado(diagnosticar(perfil))
