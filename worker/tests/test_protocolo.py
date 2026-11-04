import io
import json

from shinobi_worker import protocolo


def _capturar(monkeypatch, funcion, *a, **k):
    buf = io.StringIO()
    monkeypatch.setattr(protocolo, "_salida", buf)
    funcion(*a, **k)
    salida = buf.getvalue()
    assert salida.endswith("\n") and salida.count("\n") == 1
    return json.loads(salida)


def test_progreso(monkeypatch):
    m = _capturar(monkeypatch, protocolo.progreso, "descargando", 0.37, {"bytes": 1})
    assert m == {"tipo": "progreso", "fase": "descargando", "valor": 0.37, "detalle": {"bytes": 1}}


def test_progreso_indeterminado_sin_detalle(monkeypatch):
    m = _capturar(monkeypatch, protocolo.progreso, "cargando", None)
    assert m == {"tipo": "progreso", "fase": "cargando", "valor": None}


def test_progreso_se_acota(monkeypatch):
    assert _capturar(monkeypatch, protocolo.progreso, "x", 1.5)["valor"] == 1.0


def test_log(monkeypatch):
    m = _capturar(monkeypatch, protocolo.log, "info", "hola ñ")
    assert m == {"tipo": "log", "nivel": "info", "mensaje": "hola ñ"}


def test_resultado(monkeypatch):
    m = _capturar(monkeypatch, protocolo.resultado, {"a": 1})
    assert m == {"tipo": "resultado", "datos": {"a": 1}}


def test_error(monkeypatch):
    m = _capturar(monkeypatch, protocolo.error, "X", "msg", True)
    assert m == {"tipo": "error", "codigo": "X", "mensaje": "msg", "reintentable": True}
