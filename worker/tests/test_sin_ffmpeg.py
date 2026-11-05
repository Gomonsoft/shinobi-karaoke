"""El filtro de PATH de `scripts/sin_ffmpeg.py` (tarea 0062)."""

import importlib.util
import os
import stat
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("sin_ffmpeg", RAIZ / "scripts" / "sin_ffmpeg.py")
sin_ffmpeg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sin_ffmpeg)


def _falso(d: Path, nombre: str) -> None:
    d.mkdir(exist_ok=True)
    p = d / nombre
    p.write_text("")
    p.chmod(p.stat().st_mode | stat.S_IEXEC)


def test_quita_carpetas_con_ffmpeg_o_ffprobe(tmp_path):
    a, b, c = tmp_path / "a", tmp_path / "b", tmp_path / "c"
    _falso(a, "ffmpeg")
    _falso(b, "ffprobe")
    _falso(c, "uv")
    nuevo, quitadas = sin_ffmpeg.filtrar_path(os.pathsep.join(map(str, (a, b, c))), windows=False)
    assert nuevo == str(c) and quitadas == [str(a), str(b)]


def test_windows_reconoce_exe(tmp_path):
    a = tmp_path / "a"
    _falso(a, "ffmpeg.exe")
    nuevo, quitadas = sin_ffmpeg.filtrar_path(str(a), windows=True)
    assert nuevo == "" and quitadas == [str(a)]


def test_ejecuta_el_comando_con_el_path_filtrado(tmp_path, monkeypatch):
    a = tmp_path / "a"
    _falso(a, "ffmpeg.exe" if os.name == "nt" else "ffmpeg")
    monkeypatch.setenv("PATH", os.pathsep.join([str(a), str(Path(sys.executable).parent)]))
    codigo = (
        "import os,shutil,sys; "
        "ok = shutil.which('ffmpeg') is None and os.environ.get('SHINOBI_SIN_FFMPEG'); "
        "sys.exit(0 if ok else 1)"
    )
    assert sin_ffmpeg.main([sys.executable, "-c", codigo]) == 0


def test_path_externo_sin_ffmpeg(monkeypatch):
    """Con el PATH heredado de `sin_ffmpeg.py` no hay ffmpeg (la CI lo exige)."""
    import shutil

    if not os.environ.get("SHINOBI_SIN_FFMPEG"):
        return
    assert shutil.which("ffmpeg") is None and shutil.which("ffprobe") is None
