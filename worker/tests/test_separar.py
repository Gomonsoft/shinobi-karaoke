import json
import os
import subprocess
import sys
from pathlib import Path

import audio_prueba as ap
import pytest
import soundfile as sf

from shinobi_worker import protocolo
from shinobi_worker.__main__ import main
from shinobi_worker.protocolo import FASES_SEPARACION

FIXTURES = json.loads(
    (Path(__file__).parents[2] / "app/src/shared/__fixtures__/separacion.json").read_text("utf-8")
)


def ejecutar(args, escenario=None, intento=None):
    env = {k: v for k, v in os.environ.items() if not k.startswith("SHINOBI_")}
    if escenario is not None:
        env["SHINOBI_SEPARADOR_FALSO"] = str(escenario)
    if intento is not None:
        env["SHINOBI_INTENTO"] = str(intento)
    p = subprocess.run(
        [sys.executable, "-m", "shinobi_worker", "separar", "--args", json.dumps(args)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=60,
        env=env,
    )
    return p, [json.loads(linea) for linea in p.stdout.splitlines()]


@pytest.fixture
def caso(tmp_path):
    modelos = tmp_path / "modelos"
    modelos.mkdir()
    (modelos / "m.ckpt").write_bytes(b"x")
    (modelos / "m.yaml").write_bytes(b"x")
    (tmp_path / "fuente").mkdir()
    entrada = ap.flac(tmp_path / "fuente" / "mezcla.flac", ap.tono(3))
    salida = tmp_path / "pistas.tmp"
    salida.mkdir()
    args = {
        "entrada": str(entrada),
        "salida_dir": str(salida),
        "modelo": {"id": "calidad", "archivo": "m.ckpt", "dir": str(modelos)},
        "dispositivo": "cpu",
        "bloques": "normal",
    }
    return args, tmp_path


def escenario(tmp_path, **datos):
    ruta = tmp_path / "escenario.json"
    ruta.write_text(json.dumps({"segundos": 0.2, "pasos": 10, **datos}), "utf-8")
    return ruta


def test_separacion_falsa_salidas_y_fases(caso):
    args, tmp = caso
    p, msgs = ejecutar(args, escenario(tmp))
    assert p.returncode == 0, p.stderr
    salida = Path(args["salida_dir"])
    assert sorted(f.name for f in salida.iterdir()) == ["instrumental.flac", "voz.flac"]
    for nombre in ("voz.flac", "instrumental.flac"):
        info = sf.info(str(salida / nombre))
        assert (info.format, info.subtype, info.samplerate, info.channels) == (
            "FLAC",
            "PCM_16",
            44100,
            2,
        )
        assert info.frames == 3 * 44100
    progresos = [m for m in msgs if m["tipo"] == "progreso"]
    fases = [m["fase"] for m in progresos]
    orden = [f for i, f in enumerate(fases) if i == 0 or f != fases[i - 1]]
    assert orden == list(FASES_SEPARACION)
    sep = [m for m in progresos if m["fase"] == "separando"]
    valores = [m["valor"] for m in sep]
    assert valores == sorted(valores) and valores[0] == 0 and valores[-1] == 1
    assert len(sep) == 11
    assert all(m["detalle"]["total"] == 10 for m in sep)
    assert [m["detalle"]["paso"] for m in sep] == list(range(11))
    assert [m["valor"] for m in progresos if m["fase"] != "separando"] == [None] * 3
    res = msgs[-1]
    assert res["tipo"] == "resultado"
    d = res["datos"]
    assert d["voz"] == "voz.flac" and d["instrumental"] == "instrumental.flac"
    assert d["modelo"]["id"] == "calidad" and d["dispositivo"] == "cpu"
    assert 0 <= d["segundos_separando"] <= d["segundos_total"]


def test_fixture_de_escenario_es_valido(caso):
    args, tmp = caso
    ruta = tmp / "e.json"
    ruta.write_text(json.dumps(FIXTURES["escenario"]), "utf-8")
    # El fallo de la fixture solo aplica con cuda en el intento 1.
    p, msgs = ejecutar({**args, "dispositivo": "cuda"}, ruta, intento=1)
    assert p.returncode == 1
    assert msgs[-1]["codigo"] == "MEMORIA_INSUFICIENTE" and msgs[-1]["reintentable"] is True
    p, msgs = ejecutar({**args, "dispositivo": "cuda"}, ruta, intento=2)
    assert p.returncode == 0, p.stderr


def test_motor_incompleto_al_importar_separador(caso, monkeypatch, capsys):
    args, _ = caso
    monkeypatch.delenv("SHINOBI_SEPARADOR_FALSO", raising=False)
    monkeypatch.setitem(sys.modules, "audio_separator", None)
    monkeypatch.delitem(sys.modules, "shinobi_worker.separacion_real", raising=False)
    monkeypatch.setattr(protocolo, "iniciar", lambda: None)

    assert main(["separar", "--args", json.dumps(args)]) == 1
    error = json.loads(capsys.readouterr().out.splitlines()[-1])
    assert error == {
        "tipo": "error",
        "codigo": "RUNTIME_NO_DISPONIBLE",
        "mensaje": "Falta un componente del motor de audio: audio_separator",
        "reintentable": False,
    }


def test_separador_falso_puede_simular_motor_incompleto(caso):
    args, tmp = caso
    esc = escenario(
        tmp,
        fallos=[{"cuando": {}, "codigo": "RUNTIME_NO_DISPONIBLE", "reintentable": False}],
    )

    p, msgs = ejecutar(args, esc)
    assert p.returncode == 1
    assert msgs[-1]["codigo"] == "RUNTIME_NO_DISPONIBLE"
    assert msgs[-1]["reintentable"] is False


def test_entrada_wav_float_no_soportada(caso):
    args, tmp = caso
    wav = ap.wav(tmp / "f.wav", ap.tono(3), subtipo="FLOAT")
    p, msgs = ejecutar({**args, "entrada": str(wav)}, escenario(tmp))
    assert p.returncode == 1
    assert msgs[-1]["codigo"] == "FORMATO_NO_SOPORTADO"


def test_entrada_flac_mono_o_otra_frecuencia(caso):
    args, tmp = caso
    for nombre, senal, fs in (
        ("mono.flac", ap.tono(3, canales=1), 44100),
        ("48k.flac", ap.tono(3, fs=48000), 48000),
    ):
        flac = ap.flac(tmp / nombre, senal, fs=fs)
        p, msgs = ejecutar({**args, "entrada": str(flac)}, escenario(tmp))
        assert msgs[-1]["codigo"] == "FORMATO_NO_SOPORTADO", nombre


def test_entrada_inexistente(caso):
    args, tmp = caso
    p, msgs = ejecutar({**args, "entrada": str(tmp / "no.flac")}, escenario(tmp))
    assert p.returncode == 2
    assert msgs[-1]["codigo"] == "ARGUMENTOS_NO_VALIDOS"


@pytest.mark.parametrize("ausente", ["m.ckpt", "m.yaml"])
def test_modelo_ausente(caso, ausente):
    args, tmp = caso
    (Path(args["modelo"]["dir"]) / ausente).unlink()
    p, msgs = ejecutar(args, escenario(tmp))
    assert p.returncode == 1
    assert msgs[-1]["codigo"] == "MODELO_NO_DISPONIBLE"
    assert list(Path(args["salida_dir"]).iterdir()) == []


def test_modelo_rapido_no_exige_yaml(caso):
    args, tmp = caso
    (Path(args["modelo"]["dir"]) / "m.yaml").unlink()
    args["modelo"]["id"] = "rapido"
    p, _ = ejecutar(args, escenario(tmp))
    assert p.returncode == 0, p.stderr


def test_fallo_por_bloques_y_salida_vacia(caso):
    args, tmp = caso
    esc = escenario(
        tmp,
        fallos=[
            {"cuando": {"bloques": "pequenos"}, "codigo": "SIN_ESPACIO", "reintentable": False}
        ],
    )
    (Path(args["salida_dir"]) / "basura.bin").write_bytes(b"x")
    p, msgs = ejecutar({**args, "bloques": "pequenos"}, esc)
    assert p.returncode == 1
    assert msgs[-1]["codigo"] == "SIN_ESPACIO" and msgs[-1]["reintentable"] is False
    assert list(Path(args["salida_dir"]).iterdir()) == []
    p, _ = ejecutar(args, esc)  # con bloques normales no falla
    assert p.returncode == 0


def test_morir_con_sigkill(caso):
    args, tmp = caso
    p, msgs = ejecutar(args, escenario(tmp, morir_con_sigkill=True))
    assert p.returncode in (-9, 137)
    assert all(m["tipo"] != "error" and m["tipo"] != "resultado" for m in msgs)
    assert any(m["fase"] == "separando" for m in msgs)


def test_argumentos_invalidos(caso):
    args, tmp = caso
    p, msgs = ejecutar({**args, "bloques": "grandes"}, escenario(tmp))
    assert p.returncode == 2
    assert msgs[-1]["codigo"] == "ARGUMENTOS_NO_VALIDOS"
    p, msgs = ejecutar({"entrada": "x"})
    assert msgs[-1]["codigo"] == "ARGUMENTOS_NO_VALIDOS"


def test_error_inesperado_es_error_interno_con_log(caso, monkeypatch, capsys):
    from shinobi_worker import separacion

    args, tmp = caso

    class Roto:
        version_audio_separator = "x"

        def separar(self, *a):
            (Path(args["salida_dir"]) / "voz.flac").write_bytes(b"x")
            raise RuntimeError("boom")

    monkeypatch.setattr(separacion, "crear_separador", lambda entorno: Roto())
    with pytest.raises(Exception) as e:
        separacion.separar(args, {})
    assert e.value.codigo == "ERROR_INTERNO" and "boom" in e.value.mensaje
    assert '"tipo":"log"' in capsys.readouterr().out
    assert list(Path(args["salida_dir"]).iterdir()) == []


@pytest.mark.parametrize(
    ("excepcion", "codigo", "reintentable"),
    [
        (OSError(28, "No space left on device"), "SIN_ESPACIO", False),
        (MemoryError(), "MEMORIA_INSUFICIENTE", True),
    ],
)
def test_traduccion_de_excepciones(caso, monkeypatch, excepcion, codigo, reintentable):
    from shinobi_worker import separacion

    args, _ = caso

    class Roto:
        version_audio_separator = "x"

        def separar(self, *a):
            raise excepcion

    monkeypatch.setattr(separacion, "crear_separador", lambda entorno: Roto())
    with pytest.raises(Exception) as e:
        separacion.separar(args, {})
    assert (e.value.codigo, e.value.reintentable) == (codigo, reintentable)


def test_separar_con_el_doble_no_importa_librerias_pesadas(caso):
    args, tmp = caso
    esc = escenario(tmp)
    codigo = (
        "import json,sys\n"
        "from shinobi_worker import separacion\n"
        f"separacion.separar(json.loads({json.dumps(json.dumps(args))}),"
        f" {{'SHINOBI_SEPARADOR_FALSO': {str(esc)!r}}})\n"
        "pesados=[m for m in ('audio_separator','torch','onnxruntime') if m in sys.modules]\n"
        "sys.stderr.write('PESADOS=' + ','.join(pesados))\n"
    )
    p = subprocess.run([sys.executable, "-c", codigo], capture_output=True, text=True, timeout=60)
    assert p.returncode == 0, p.stderr
    assert p.stderr.strip().endswith("PESADOS=")
