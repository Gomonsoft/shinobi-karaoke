"""Ayudas para las pruebas marcadas `red` que hablan con YouTube de verdad."""

import os

import pytest

BLOQUEADO = "YOUTUBE_BLOQUEADO"


def omitir_si_youtube_bloquea_la_ci(codigo: str | None) -> None:
    """En CI (GitHub Actions), YouTube suele exigir inicio de sesión a las IPs de
    centro de datos ("Sign in to confirm you're not a bot"). Ese bloqueo no es un
    fallo del código —el worker lo clasifica bien como YOUTUBE_BLOQUEADO—, así
    que allí la prueba se omite con el motivo visible. Fuera de CI sigue fallando.
    """
    if codigo == BLOQUEADO and os.environ.get("CI") == "true":
        pytest.skip("YouTube bloquea las IPs del runner de CI (YOUTUBE_BLOQUEADO)")
