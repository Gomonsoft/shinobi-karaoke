"""Adaptador real de `Separador` sobre `audio-separator` (tarea 0061; ADR 0004 y revisiones).

Es el UNICO modulo que toca internos de audio-separator, torch o tqdm. Solo lo importa la
fabrica `crear_separador` (importacion perezosa), asi que la CI normal no necesita el extra
`separacion`. Todo lo que midio el spike 0005 esta aqui:

- Sin ffmpeg (preguntas/0009): `Separator.check_ffmpeg_installed` se anula en `_aplicar_parche`
  y se usa `use_soundfile=True`, `output_format="FLAC"` y `model_file_dir` siempre.
- CPU forzada (preguntas/0010): con `dispositivo == "cpu"` se oculta CUDA/MPS a PyTorch durante
  la separacion; sin ellos audio-separator elige `CPUExecutionProvider` en ONNX Runtime.
- Progreso: se envuelve `tqdm.std.tqdm.update` mientras dura la separacion (0005 §7).
"""

from __future__ import annotations

import errno
import importlib.metadata
import logging
import re
from collections.abc import Callable, Iterator, Mapping
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import audio_separator as _audio_separator
from audio_separator.separator import Separator
from tqdm import std as _tqdm_std

from . import protocolo
from .errores import ErrorWorker
from .separacion import INSTRUMENTAL, VOZ, AlProgreso

VERSION_FIJADA = "0.48.0"
# Reparto del progreso de Rapido (0005 §7): barra principal ~97 % del tiempo, luego postproceso.
CORTE_RAPIDO = 0.97
# Bloques pequenos: mitad del `segment_size` por defecto (256) y `batch_size = 1`.
SEGMENT_SIZE_NORMAL = 256
SEGMENT_SIZE_PEQUENO = SEGMENT_SIZE_NORMAL // 2
_PATRON_STEM = re.compile(r"\((vocals|other|instrumental)\)", re.IGNORECASE)
_MENSAJES_MEMORIA = ("out of memory", "can't allocate memory", "defaultcpuallocator")


def _version_instalada() -> str:
    # 0.48.0 no expone `__version__`: se cae a los metadatos del paquete instalado.
    version = getattr(_audio_separator, "__version__", None)
    return str(version or importlib.metadata.version("audio-separator"))


VERSION_AUDIO_SEPARATOR = _version_instalada()
if VERSION_AUDIO_SEPARATOR != VERSION_FIJADA:
    # No falla: lo detecta el test de 0062. Solo deja rastro en el log.
    protocolo.log(
        "warning",
        f"audio-separator {VERSION_AUDIO_SEPARATOR} instalado; el adaptador esta probado "
        f"con {VERSION_FIJADA}",
    )


def _aplicar_parche() -> None:
    """UNICO punto que toca internos de audio-separator (preguntas/0009).

    `Separator.__init__` llama a `check_ffmpeg_installed()`, que lanza `FileNotFoundError` si no
    hay `ffmpeg` en el PATH. No lo necesitamos: la entrada es FLAC PCM 16 y la salida se escribe
    con soundfile (`use_soundfile=True`). Si una version futura lo rompe, el plan B es
    `imageio-ffmpeg` (ADR 0001, revision 2026-11-04 bis).
    """
    Separator.check_ffmpeg_installed = lambda self: None  # type: ignore[method-assign]


def _cadena(e: BaseException) -> Iterator[BaseException]:
    visto: set[int] = set()
    actual: BaseException | None = e
    while actual is not None and id(actual) not in visto:
        visto.add(id(actual))
        yield actual
        actual = actual.__cause__ or actual.__context__


def _es_memoria(e: BaseException) -> bool:
    if isinstance(e, MemoryError) or any(c.__name__ == "OutOfMemoryError" for c in type(e).__mro__):
        return True
    if isinstance(e, RuntimeError):
        texto = str(e).lower()
        return any(m in texto for m in _MENSAJES_MEMORIA)
    return False


def traducir_error(e: BaseException, *, cargando_modelo: bool) -> ErrorWorker:
    """Mapea un fallo de audio-separator/torch a un `ErrorWorker` con codigo estable."""
    if isinstance(e, ErrorWorker):
        return e
    for c in _cadena(e):
        if _es_memoria(c):
            return ErrorWorker("MEMORIA_INSUFICIENTE", "No hay memoria suficiente", True)
        if isinstance(c, OSError) and c.errno == errno.ENOSPC:
            return ErrorWorker("SIN_ESPACIO", "No queda espacio en disco para las pistas")
    if cargando_modelo:
        protocolo.log("error", f"Fallo al cargar el modelo: {type(e).__name__}: {e}")
        return ErrorWorker(
            "MODELO_NO_DISPONIBLE", "No se pudo cargar el modelo (archivo truncado o corrupto)"
        )
    return ErrorWorker("ERROR_INTERNO", f"{type(e).__name__}: {e}")


@contextmanager
def _cpu_forzada(activa: bool) -> Iterator[None]:
    """Oculta CUDA y MPS a PyTorch (equivale al `--cpu` del spike); restaura al salir."""
    if not activa:
        yield
        return
    try:
        import torch
    except ImportError:  # sin PyTorch no hay GPU que ocultar
        yield
        return

    def _no() -> bool:
        return False

    _no.__wrapped__ = _no  # type: ignore[attr-defined]  # torch._dynamo espera __wrapped__
    originales = [(torch.cuda, torch.cuda.is_available)]
    mps = getattr(torch.backends, "mps", None)
    if mps is not None:
        originales.append((mps, mps.is_available))
    for objeto, _ in originales:
        objeto.is_available = _no
    try:
        yield
    finally:
        for objeto, original in originales:
            objeto.is_available = original


class _Progreso:
    """Traduce los `update` de las barras `tqdm` de audio-separator a `separando`/`guardando`."""

    def __init__(self, rapido: bool, al_progreso: AlProgreso) -> None:
        self.rapido = rapido
        self.al_progreso = al_progreso
        self.barras: list[int] = []  # id() de las barras en orden de aparicion
        self.ultimo = 0.0
        self.guardando = False

    def emitir_guardando(self) -> None:
        if not self.guardando:
            self.guardando = True
            self.al_progreso("guardando", None, None)

    def actualizar(self, barra: Any) -> None:
        total, n = getattr(barra, "total", None), getattr(barra, "n", 0)
        if getattr(barra, "unit", None) == "iB" or not total or self.guardando:
            return  # descargas (se filtran) o ya estamos guardando
        if id(barra) not in self.barras:
            self.barras.append(id(barra))
        indice = self.barras.index(id(barra))
        fraccion = min(1.0, n / total)
        if not self.rapido:
            if indice != 0:
                return
            valor, detalle = fraccion, {"paso": int(n), "total": int(total)}
        elif indice == 0:
            valor, detalle = fraccion * CORTE_RAPIDO, {"paso": int(n), "total": int(total)}
        elif indice == 1:
            valor, detalle = CORTE_RAPIDO + (1 - CORTE_RAPIDO) * fraccion, None
        else:
            return
        valor = max(valor, self.ultimo)  # nunca retrocede
        self.ultimo = valor
        self.al_progreso("separando", valor, detalle)
        # La escritura de las pistas empieza al completarse la ultima barra.
        if fraccion >= 1.0 and indice == (1 if self.rapido else 0):
            self.emitir_guardando()


@contextmanager
def _interceptar_tqdm(progreso: _Progreso) -> Iterator[None]:
    original: Callable[..., Any] = _tqdm_std.tqdm.update

    def update(self: Any, n: float = 1) -> Any:
        resultado = original(self, n)
        progreso.actualizar(self)
        return resultado

    _tqdm_std.tqdm.update = update  # type: ignore[method-assign]
    try:
        yield
    finally:
        _tqdm_std.tqdm.update = original  # type: ignore[method-assign]


def _parametros(modelo_id: str, bloques: str) -> dict[str, dict[str, Any]]:
    """`normal` = valores por defecto de audio-separator; `pequenos` = mitad de segment_size."""
    if bloques == "normal":
        return {}
    if modelo_id == "calidad":  # MDXC (RoFormer); override para que se respete segment_size
        return {
            "mdxc_params": {
                "segment_size": SEGMENT_SIZE_PEQUENO,
                "override_model_segment_size": True,
                "batch_size": 1,
                "overlap": None,
                "pitch_shift": 0,
            }
        }
    return {  # MDX (Rapido); el resto, los valores por defecto de audio-separator
        "mdx_params": {
            "hop_length": 1024,
            "segment_size": SEGMENT_SIZE_PEQUENO,
            "overlap": 0.25,
            "batch_size": 1,
            "enable_denoise": False,
        }
    }


def _renombrar_stems(salida_dir: Path) -> None:
    """`(vocals)`/`(Vocals)` -> voz.flac; `(other)`/`(Instrumental)` -> instrumental.flac."""
    destinos = {"vocals": VOZ, "other": INSTRUMENTAL, "instrumental": INSTRUMENTAL}
    encontrados: dict[str, Path] = {}
    generados = sorted(p.name for p in salida_dir.iterdir())
    for archivo in sorted(salida_dir.iterdir()):
        m = _PATRON_STEM.search(archivo.name)
        if m and archivo.suffix.lower() == ".flac":
            encontrados.setdefault(destinos[m.group(1).lower()], archivo)
    if set(encontrados) != {VOZ, INSTRUMENTAL}:
        protocolo.log("error", f"Stems generados: {generados}")
        raise ErrorWorker("ERROR_INTERNO", "audio-separator no genero voz e instrumental")
    for archivo in list(salida_dir.iterdir()):
        if archivo not in encontrados.values():
            archivo.unlink(missing_ok=True)
    for nombre, archivo in encontrados.items():
        archivo.replace(salida_dir / nombre)


class SeparadorReal:
    version_audio_separator = VERSION_AUDIO_SEPARATOR

    def separar(
        self,
        entrada: Path,
        salida_dir: Path,
        modelo: Mapping[str, str],
        dispositivo: str,
        bloques: str,
        al_progreso: AlProgreso,
    ) -> None:
        archivo = modelo["archivo"]
        if not (Path(modelo["dir"]) / archivo).is_file():  # nunca descarga (0060 ya lo comprueba)
            raise ErrorWorker("MODELO_NO_DISPONIBLE", f"Falta el modelo {archivo}")
        _aplicar_parche()
        progreso = _Progreso(modelo["id"] != "calidad", al_progreso)
        cargando = True
        al_progreso("cargando_modelo", None, None)
        try:
            with _cpu_forzada(dispositivo == "cpu"), _interceptar_tqdm(progreso):
                separador = Separator(
                    output_dir=str(salida_dir),
                    model_file_dir=modelo["dir"],
                    output_format="FLAC",
                    use_soundfile=True,
                    log_level=logging.WARNING,
                    **_parametros(modelo["id"], bloques),
                )
                separador.load_model(archivo)
                cargando = False
                al_progreso("separando", 0.0, None)
                separador.separate(str(entrada))
                progreso.emitir_guardando()
                _renombrar_stems(salida_dir)
        except Exception as e:
            raise traducir_error(e, cargando_modelo=cargando) from e
