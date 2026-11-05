"""Contrato de `separacion_real` con un `audio_separator` de prueba (sin PyTorch ni ffmpeg).

El modulo falso imita la API que usa el adaptador (0061): `Separator(...)`,
`check_ffmpeg_installed()` (falla si no hay ffmpeg en el PATH), `load_model()` y `separate()`,
que usa tqdm y escribe stems con los nombres reales de audio-separator 0.48.0.
"""

import errno
import importlib
import os
import shutil
import sys
import types
from pathlib import Path

import pytest
import soundfile as sf

from shinobi_worker.errores import ErrorWorker


class TqdmFalso:
    """Imita lo usado de `tqdm.std.tqdm` (la CI normal no instala tqdm): `update`, `n`, `total`."""

    def __init__(self, iterable=None, total=None, unit="it", **kw):
        self.total = total if total is not None else len(iterable) if iterable else None
        self.unit, self.n = unit, 0

    def update(self, n=1):
        self.n += n
        return True

    def close(self):
        pass


def _tqdm_falso():
    tq, tq_std = types.ModuleType("tqdm"), types.ModuleType("tqdm.std")
    tq_std.tqdm = TqdmFalso
    tq.std, tq.tqdm = tq_std, TqdmFalso
    return [("tqdm", tq), ("tqdm.std", tq_std)]


class Escenario:
    """Lo que el `Separator` falso hace; los tests lo ajustan antes de separar."""

    def __init__(self) -> None:
        self.kwargs: dict = {}
        self.cargado: str | None = None
        self.stems = ("(vocals)", "(other)")
        self.barras: list[tuple[int, str | None]] = [(4, None)]  # (pasos, unit)
        self.fallo_carga: BaseException | None = None
        self.fallo_separar: BaseException | None = None
        self.tqdm_dentro = None
        self.cuda_visto: bool | None = None


@pytest.fixture
def esc():
    return Escenario()


def test_path_heredado_sin_ffmpeg_si_lo_pide_la_ci():
    """Con `scripts/sin_ffmpeg.py` (SHINOBI_SIN_FFMPEG=1) el PATH heredado no trae ffmpeg."""
    if os.environ.get("SHINOBI_SIN_FFMPEG"):
        assert shutil.which("ffmpeg") is None and shutil.which("ffprobe") is None


@pytest.fixture
def sin_ffmpeg(monkeypatch):
    """PATH sin ffmpeg ni ffprobe (verificado aqui con shutil.which)."""
    monkeypatch.setenv("PATH", "")
    assert shutil.which("ffmpeg") is None
    assert shutil.which("ffprobe") is None


@pytest.fixture
def adaptador(esc, monkeypatch, sin_ffmpeg):
    fake = types.ModuleType("audio_separator")
    fake.__version__ = "0.48.0"
    sub = types.ModuleType("audio_separator.separator")

    class Separator:
        def __init__(self, **kwargs):
            self.check_ffmpeg_installed()  # como el real: dentro del constructor
            esc.kwargs = kwargs
            self.output_dir = kwargs["output_dir"]

        def check_ffmpeg_installed(self):
            if shutil.which("ffmpeg") is None:
                raise FileNotFoundError("ffmpeg")

        def load_model(self, nombre):
            if esc.fallo_carga:
                raise esc.fallo_carga
            esc.cargado = nombre

        def separate(self, ruta):
            import torch

            esc.cuda_visto = torch.cuda.is_available()
            if esc.fallo_separar:
                raise esc.fallo_separar
            from tqdm import tqdm

            for pasos, unit in esc.barras:
                barra = tqdm(total=pasos, unit=unit or "it")
                for _ in range(pasos):
                    barra.update(1)
                barra.close()
            salida = []
            for stem in esc.stems:
                p = Path(self.output_dir) / f"mezcla_{stem}_modelo.flac"
                sf.write(str(p), [[0.0, 0.0]] * 100, 44100, format="FLAC", subtype="PCM_16")
                salida.append(p.name)
            return salida

    sub.Separator = Separator
    fake.separator = sub
    torch = types.ModuleType("torch")
    torch.cuda = types.SimpleNamespace(is_available=lambda: True)
    torch.backends = types.SimpleNamespace(mps=types.SimpleNamespace(is_available=lambda: True))
    for nombre, mod in (
        ("audio_separator", fake),
        ("audio_separator.separator", sub),
        ("torch", torch),
        *_tqdm_falso(),
    ):
        monkeypatch.setitem(sys.modules, nombre, mod)
    monkeypatch.delitem(sys.modules, "shinobi_worker.separacion_real", raising=False)
    return importlib.import_module("shinobi_worker.separacion_real")


def correr(adaptador, tmp_path, *, modelo_id="calidad", dispositivo="cpu", bloques="normal"):
    modelos = tmp_path / "modelos"
    modelos.mkdir(exist_ok=True)
    (modelos / "m.ckpt").write_bytes(b"x")
    salida = tmp_path / "salida"
    salida.mkdir(exist_ok=True)
    eventos = []
    adaptador.SeparadorReal().separar(
        tmp_path / "mezcla.flac",
        salida,
        {"id": modelo_id, "archivo": "m.ckpt", "dir": str(modelos)},
        dispositivo,
        bloques,
        lambda f, v, d: eventos.append((f, v, d)),
    )
    return salida, eventos


def test_parche_sin_ffmpeg_y_parametros(adaptador, esc, tmp_path):
    salida, _ = correr(adaptador, tmp_path)
    assert esc.kwargs["use_soundfile"] is True
    assert esc.kwargs["output_format"] == "FLAC"
    assert esc.kwargs["model_file_dir"] == str(tmp_path / "modelos")
    assert esc.kwargs["output_dir"] == str(salida)
    assert "mdxc_params" not in esc.kwargs and "mdx_params" not in esc.kwargs
    assert esc.cargado == "m.ckpt"


def test_renombra_stems_de_calidad(adaptador, esc, tmp_path):
    salida, _ = correr(adaptador, tmp_path)
    assert sorted(p.name for p in salida.iterdir()) == ["instrumental.flac", "voz.flac"]


def test_renombra_stems_de_rapido(adaptador, esc, tmp_path):
    esc.stems = ("(Vocals)", "(Instrumental)")
    salida, _ = correr(adaptador, tmp_path, modelo_id="rapido")
    assert sorted(p.name for p in salida.iterdir()) == ["instrumental.flac", "voz.flac"]


def test_falta_un_stem_es_error_interno_con_lista_en_el_log(adaptador, esc, tmp_path, capsys):
    esc.stems = ("(vocals)",)
    with pytest.raises(ErrorWorker) as e:
        correr(adaptador, tmp_path)
    assert e.value.codigo == "ERROR_INTERNO"
    assert "mezcla_(vocals)_modelo.flac" in capsys.readouterr().out


def test_progreso_calidad_una_barra_y_fases(adaptador, esc, tmp_path):
    esc.barras = [(4, None)]
    _, ev = correr(adaptador, tmp_path)
    fases = [f for f, _, _ in ev]
    assert fases[0] == "cargando_modelo" and fases[-1] == "guardando"
    sep = [(v, d) for f, v, d in ev if f == "separando"]
    assert sep[0][0] == 0.0
    assert [v for v, _ in sep][1:] == [0.25, 0.5, 0.75, 1.0]
    assert sep[-1][1] == {"paso": 4, "total": 4}
    assert fases.count("guardando") == 1


def test_progreso_rapido_dos_barras_y_filtra_descargas(adaptador, esc, tmp_path):
    esc.stems = ("(Vocals)", "(Instrumental)")
    esc.barras = [(100, "iB"), (4, None), (2, None)]
    _, ev = correr(adaptador, tmp_path, modelo_id="rapido")
    valores = [v for f, v, _ in ev if f == "separando"]
    assert valores == sorted(valores)
    assert valores[1:5] == [0.2425, 0.485, 0.7275, 0.97]
    assert valores[-1] == 1.0
    assert all(d is None or d["total"] == 4 for f, _, d in ev if f == "separando")
    assert len(valores) == 1 + 4 + 2  # ninguna de la barra "iB"


def test_tqdm_se_restaura(adaptador, esc, tmp_path):
    std = sys.modules["tqdm.std"]
    original = std.tqdm.update
    correr(adaptador, tmp_path)
    assert std.tqdm.update is original


def test_cpu_oculta_cuda_y_se_restaura(adaptador, esc, tmp_path):
    import torch

    correr(adaptador, tmp_path, dispositivo="cpu")
    assert esc.cuda_visto is False
    assert torch.cuda.is_available() is True and torch.backends.mps.is_available() is True
    correr(adaptador, tmp_path, dispositivo="cuda")
    assert esc.cuda_visto is True


def test_bloques_pequenos(adaptador, esc, tmp_path):
    correr(adaptador, tmp_path, bloques="pequenos")
    assert esc.kwargs["mdxc_params"]["segment_size"] == 128
    assert esc.kwargs["mdxc_params"]["batch_size"] == 1
    assert esc.kwargs["mdxc_params"]["override_model_segment_size"] is True
    esc.stems = ("(Vocals)", "(Instrumental)")
    correr(adaptador, tmp_path, modelo_id="rapido", bloques="pequenos")
    assert esc.kwargs["mdx_params"]["segment_size"] == 128
    assert esc.kwargs["mdx_params"]["batch_size"] == 1


@pytest.mark.parametrize(
    "exc",
    [
        MemoryError(),
        RuntimeError("CUDA out of memory. Tried to allocate"),
        RuntimeError("[enforce fail] DefaultCPUAllocator: can't allocate memory"),
        type("OutOfMemoryError", (RuntimeError,), {})("boom"),
    ],
)
def test_memoria_es_reintentable(adaptador, esc, tmp_path, exc):
    esc.fallo_separar = exc
    with pytest.raises(ErrorWorker) as e:
        correr(adaptador, tmp_path)
    assert (e.value.codigo, e.value.reintentable) == ("MEMORIA_INSUFICIENTE", True)


def test_memoria_envuelta_en_otra_excepcion(adaptador, esc, tmp_path):
    try:
        raise MemoryError()
    except MemoryError as m:
        esc.fallo_separar = ValueError("envuelto")
        esc.fallo_separar.__cause__ = m
    with pytest.raises(ErrorWorker) as e:
        correr(adaptador, tmp_path)
    assert e.value.codigo == "MEMORIA_INSUFICIENTE"


def test_enospc(adaptador, esc, tmp_path):
    esc.fallo_separar = OSError(errno.ENOSPC, "No space left on device")
    with pytest.raises(ErrorWorker) as e:
        correr(adaptador, tmp_path)
    assert e.value.codigo == "SIN_ESPACIO"


def test_checkpoint_corrupto(adaptador, esc, tmp_path):
    esc.fallo_carga = RuntimeError("PytorchStreamReader failed reading zip archive")
    with pytest.raises(ErrorWorker) as e:
        correr(adaptador, tmp_path)
    assert e.value.codigo == "MODELO_NO_DISPONIBLE"


def test_error_al_separar_es_interno(adaptador, esc, tmp_path):
    esc.fallo_separar = ValueError("raro")
    with pytest.raises(ErrorWorker) as e:
        correr(adaptador, tmp_path)
    assert e.value.codigo == "ERROR_INTERNO"


def test_modelo_ausente_no_descarga(adaptador, esc, tmp_path):
    (tmp_path / "modelos").mkdir()
    with pytest.raises(ErrorWorker) as e:
        adaptador.SeparadorReal().separar(
            tmp_path / "x.flac",
            tmp_path,
            {"id": "calidad", "archivo": "no.ckpt", "dir": str(tmp_path / "modelos")},
            "cpu",
            "normal",
            lambda *a: None,
        )
    assert e.value.codigo == "MODELO_NO_DISPONIBLE"
    assert esc.cargado is None


def test_aviso_si_la_version_no_es_la_fijada(esc, monkeypatch, sin_ffmpeg, capsys):
    fake = types.ModuleType("audio_separator")
    fake.__version__ = "9.9.9"
    sub = types.ModuleType("audio_separator.separator")
    sub.Separator = type("Separator", (), {})
    monkeypatch.setitem(sys.modules, "audio_separator", fake)
    monkeypatch.setitem(sys.modules, "audio_separator.separator", sub)
    for nombre, mod in _tqdm_falso():
        monkeypatch.setitem(sys.modules, nombre, mod)
    monkeypatch.delitem(sys.modules, "shinobi_worker.separacion_real", raising=False)
    mod = importlib.import_module("shinobi_worker.separacion_real")
    assert mod.VERSION_AUDIO_SEPARATOR == "9.9.9"
    assert '"warning"' in capsys.readouterr().out
