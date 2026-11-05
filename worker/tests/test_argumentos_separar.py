import json
from pathlib import Path

import pytest

from shinobi_worker.argumentos_separar import validar_args_separar
from shinobi_worker.errores import ArgumentosNoValidos

FIXTURES = json.loads(
    (Path(__file__).parents[2] / "app/src/shared/__fixtures__/separacion.json").read_text("utf-8")
)


def test_args_validos():
    a = validar_args_separar(FIXTURES["argsValidos"])
    assert a.modelo_id == "calidad"
    assert a.dispositivo == "cpu"
    assert a.bloques == "normal"
    assert a.modelo_dir == "/datos/modelos"


def test_args_validos_windows():
    a = validar_args_separar(FIXTURES["argsValidosWindows"])
    assert a.modelo_id == "rapido"
    assert a.bloques == "pequenos"


@pytest.mark.parametrize("caso", list(FIXTURES["argsInvalidos"]))
def test_args_invalidos(caso):
    args = json.loads(json.dumps(FIXTURES["argsValidos"]))
    args.update(FIXTURES["argsInvalidos"][caso])
    with pytest.raises(ArgumentosNoValidos):
        validar_args_separar(args)


def test_falta_una_clave():
    args = dict(FIXTURES["argsValidos"])
    del args["bloques"]
    with pytest.raises(ArgumentosNoValidos):
        validar_args_separar(args)


def test_no_es_un_objeto():
    with pytest.raises(ArgumentosNoValidos):
        validar_args_separar([])
