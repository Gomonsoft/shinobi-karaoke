import json
import subprocess
import sys


def ejecutar(*argv):
    p = subprocess.run(
        [sys.executable, "-m", "shinobi_worker", *argv],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
    )
    lineas = [json.loads(linea) for linea in p.stdout.splitlines()]
    return p, lineas


def test_version():
    p, msgs = ejecutar("version")
    assert p.returncode == 0
    assert msgs[-1]["tipo"] == "resultado"
    assert msgs[-1]["datos"]["python"].startswith("3.12")


def test_comando_desconocido():
    p, msgs = ejecutar("nada")
    assert p.returncode != 0
    assert msgs[-1]["codigo"] == "ARGUMENTOS_NO_VALIDOS"


def test_json_invalido():
    p, msgs = ejecutar("demo", "--args", "{no")
    assert p.returncode != 0
    assert msgs[-1]["codigo"] == "ARGUMENTOS_NO_VALIDOS"


def test_args_no_objeto_y_valores_invalidos():
    for texto in ("[1]", '{"segundos": -1}', '{"fallar_en": 2}'):
        p, msgs = ejecutar("demo", "--args", texto)
        assert p.returncode != 0
        assert msgs[-1]["codigo"] == "ARGUMENTOS_NO_VALIDOS"


def test_demo_completo(tmp_path):
    parcial = tmp_path / "x.parcial"
    args = {
        "segundos": 0.5,
        "fallar_en": None,
        "indeterminado_s": 0.2,
        "ruta_parcial": str(parcial),
    }
    p, msgs = ejecutar("demo", "--args", json.dumps(args))
    assert p.returncode == 0
    assert msgs[0] == {"tipo": "progreso", "fase": "cargando", "valor": None}
    prog = [m for m in msgs if m["tipo"] == "progreso" and m["fase"] == "procesando"]
    assert len(prog) == 6 and prog[-1]["valor"] == 1.0
    assert msgs[-1]["tipo"] == "resultado"
    assert not parcial.exists()


def test_demo_fallo():
    p, msgs = ejecutar("demo", "--args", '{"segundos": 1, "fallar_en": 0.5}')
    assert p.returncode != 0
    assert msgs[-1] == {
        "tipo": "error",
        "codigo": "DEMO_FALLO",
        "mensaje": "Fallo simulado en 50%",
        "reintentable": True,
    }


def test_print_ajeno_no_contamina_stdout(tmp_path):
    codigo = (
        "from shinobi_worker import __main__ as m, comandos\n"
        "def f(a):\n    print('ruido')\n    comandos.protocolo.resultado({})\n"
        "comandos.COMANDOS['f'] = f\n"
        "raise SystemExit(m.main(['f']))\n"
    )
    p = subprocess.run([sys.executable, "-c", codigo], capture_output=True, text=True)
    assert p.stdout.strip() == '{"tipo":"resultado","datos":{}}'
    assert "ruido" in p.stderr


def test_error_interno():
    codigo = (
        "from shinobi_worker import __main__ as m, comandos\n"
        "comandos.COMANDOS['f'] = lambda a: 1/0\n"
        "raise SystemExit(m.main(['f']))\n"
    )
    p = subprocess.run([sys.executable, "-c", codigo], capture_output=True, text=True)
    assert p.returncode != 0
    assert json.loads(p.stdout)["codigo"] == "ERROR_INTERNO"
    assert "ZeroDivisionError" in p.stderr
