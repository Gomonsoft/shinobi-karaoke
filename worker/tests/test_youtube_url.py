"""La misma tabla de casos que `app/src/shared/youtube.test.ts` (fixture JSON compartido)."""

import json
from pathlib import Path

import pytest

from shinobi_worker.errores import ErrorWorker
from shinobi_worker.youtube import analizar_url, validar_url

TABLA = Path(__file__).resolve().parents[2] / "app/src/shared/__fixtures__/youtube-urls.json"
CASOS = json.loads(TABLA.read_text(encoding="utf-8"))


@pytest.mark.parametrize("caso", CASOS, ids=[repr(c["entrada"])[:60] for c in CASOS])
def test_tabla_compartida(caso):
    id_video, codigo = analizar_url(caso["entrada"])
    if "id" in caso:
        assert (id_video, codigo) == (caso["id"], None)
    else:
        assert (id_video, codigo) == (None, caso["codigo"])


def test_tabla_no_vacia():
    assert len(CASOS) >= 40


def test_validar_url_lanza_con_el_codigo():
    assert validar_url("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    with pytest.raises(ErrorWorker) as e:
        validar_url("https://www.youtube.com/playlist?list=PLabc")
    assert e.value.codigo == "URL_NO_SOPORTADA"
    with pytest.raises(ErrorWorker) as e:
        validar_url(None)
    assert e.value.codigo == "URL_NO_VALIDA"
