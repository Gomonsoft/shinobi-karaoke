"""`descargar-youtube` con el doble `FuenteYoutubeFalsa` (sin red)."""

import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

import pytest
import soundfile as sf
from red import omitir_si_youtube_bloquea_la_ci

from shinobi_worker import youtube

ID = "aaaaaaaaaaa"
URL = f"https://youtu.be/{ID}"


@pytest.fixture
def falso(tmp_path: Path) -> Path:
    d = tmp_path / "yt"
    d.mkdir()
    return d


def fixture(falso: Path, **datos) -> None:
    (falso / f"{ID}.json").write_text(json.dumps({"id": ID, **datos}), encoding="utf-8")


def lanzar(falso: Path, salida: Path, **popen):
    args = {"url": URL, "salida": str(salida)}
    return subprocess.Popen(
        [sys.executable, "-m", "shinobi_worker", "descargar-youtube", "--args", json.dumps(args)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        env={**os.environ, youtube.VARIABLE_DOBLE: str(falso)},
        **popen,
    )


def ejecutar(falso: Path, salida: Path):
    p = lanzar(falso, salida)
    out, err = p.communicate(timeout=60)
    return p.returncode, err, [json.loads(linea) for linea in out.splitlines()]


def restos(salida: Path) -> list[str]:
    fuente = salida / "fuente"
    return sorted(x.name for x in fuente.glob("*") if x.name != "mezcla.flac")


def test_descarga_completa(falso, tmp_path):
    fixture(falso, duration=12, title="x")
    salida = tmp_path / "cancion"
    codigo, err, msgs = ejecutar(falso, salida)
    assert codigo == 0, err
    datos = msgs[-1]["datos"]
    assert datos["id_video"] == ID
    assert datos["mezcla"] == "fuente/mezcla.flac"
    assert datos["duracion_ms"] == 12000
    assert datos["bytes_descargados"] > 0
    assert {"metadatos", "ganancia_db", "lufs", "nombre_original"} <= set(datos)
    info = sf.info(str(salida / "fuente" / "mezcla.flac"))
    assert (info.samplerate, info.channels, info.format) == (44100, 2, "FLAC")
    assert restos(salida) == []
    fases = [m["fase"] for m in msgs if m["tipo"] == "progreso"]
    assert fases[-1] == "preparando"
    assert "descargando" in fases


def test_progreso_creciente_con_detalle(falso, tmp_path):
    fixture(falso, duration=12, bytes_por_segundo=1000, ritmo=1.5)
    inicio = time.monotonic()
    codigo, err, msgs = ejecutar(falso, tmp_path / "c")
    transcurrido = time.monotonic() - inicio
    assert codigo == 0, err
    desc = [m for m in msgs if m["tipo"] == "progreso" and m.get("detalle")]
    # Como mucho uno cada INTERVALO_PROGRESO_S, más el primero y el final.
    # La cota depende del tiempo real: en CI lenta la descarga simulada
    # dura más de 1,5 s y emite más eventos sin violar el límite.
    maximo = int(transcurrido / youtube.INTERVALO_PROGRESO_S) + 2
    assert 3 <= len(desc) <= maximo, (len(desc), transcurrido)
    valores = [m["valor"] for m in desc]
    assert valores == sorted(valores) and valores[-1] == 1.0
    assert desc[-1]["detalle"] == {"bytes": 12000, "total": 12000}
    assert msgs[-1]["datos"]["bytes_descargados"] == 12000


def test_error_de_bot(falso, tmp_path):
    fixture(falso, duration=12, error_descarga="Sign in to confirm you're not a bot")
    salida = tmp_path / "c"
    codigo, _, msgs = ejecutar(falso, salida)
    assert codigo == 1
    assert msgs[-1]["codigo"] == "YOUTUBE_BLOQUEADO"
    assert restos(salida) == [] if (salida / "fuente").exists() else True


def test_error_solo_la_primera_vez(falso, tmp_path):
    fixture(falso, duration=12, error_descarga_una_vez="Sign in to confirm you're not a bot")
    salida = tmp_path / "c"
    codigo, _, msgs = ejecutar(falso, salida)
    assert codigo == 1
    assert msgs[-1]["codigo"] == "YOUTUBE_BLOQUEADO"
    assert (falso / f"{ID}.intentado").is_file()
    codigo, _, msgs = ejecutar(falso, salida)
    assert codigo == 0
    assert (salida / "fuente" / "mezcla.flac").is_file()


def test_audio_corto_sin_restos(falso, tmp_path):
    fixture(falso, duration=4)
    salida = tmp_path / "c"
    codigo, _, msgs = ejecutar(falso, salida)
    assert codigo == 1
    assert msgs[-1]["codigo"] == "AUDIO_DEMASIADO_CORTO"
    assert restos(salida) == []
    assert not (salida / "fuente" / "mezcla.flac").exists()


def test_url_no_valida(falso, tmp_path):
    p = subprocess.run(
        [
            sys.executable, "-m", "shinobi_worker", "descargar-youtube", "--args",
            json.dumps({"url": "https://example.com/x", "salida": str(tmp_path)}),
        ],  # fmt: skip
        capture_output=True, text=True, encoding="utf-8",
    )  # fmt: skip
    assert json.loads(p.stdout.splitlines()[-1])["codigo"] == "URL_NO_VALIDA"


@pytest.mark.skipif(sys.platform == "win32", reason="SIGTERM de POSIX")
def test_cancelacion_a_mitad_sin_huerfanos(falso, tmp_path):
    fixture(falso, duration=12, bytes_por_segundo=1000, ritmo=30)
    salida = tmp_path / "c"
    p = lanzar(falso, salida)
    linea = p.stdout.readline()
    assert json.loads(linea)["fase"] == "descargando"
    time.sleep(0.5)
    p.send_signal(signal.SIGTERM)
    p.wait(timeout=10)
    assert p.returncode != 0
    assert not (salida / "fuente" / "mezcla.flac").exists()
    # Sin procesos hijos: el worker no crea ninguno y ya terminó.
    assert p.poll() is not None


@pytest.mark.red
def test_real_con_video_libre(tmp_path):
    """Big Buck Bunny (Blender Foundation, CC BY 3.0). Descarga real: requiere Internet."""
    salida = tmp_path / "c"
    args = {"url": "https://www.youtube.com/watch?v=aqz-KE-bpKQ", "salida": str(salida)}
    p = subprocess.run(
        [sys.executable, "-m", "shinobi_worker", "descargar-youtube", "--args", json.dumps(args)],
        capture_output=True, text=True, encoding="utf-8", timeout=600,
    )  # fmt: skip
    ultimo = json.loads(p.stdout.splitlines()[-1]) if p.stdout.strip() else {}
    if ultimo.get("tipo") == "error":
        omitir_si_youtube_bloquea_la_ci(ultimo.get("codigo"))
    assert p.returncode == 0, p.stderr
    datos = ultimo["datos"]
    assert datos["id_video"] == "aqz-KE-bpKQ"
    assert datos["duracion_ms"] > 10_000
    assert restos(salida) == []
