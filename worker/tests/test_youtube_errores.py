# ruff: noqa: E501
import urllib.error

import pytest

from shinobi_worker.youtube import clasificar_error

# Textos tal como los produce yt-dlp (DownloadError / ExtractorError).
CASOS = [
    (
        "ERROR: [youtube] abc: Private video. Sign in if you've been granted access",
        "VIDEO_NO_DISPONIBLE",
        False,
    ),
    ("ERROR: [youtube] abc: Video unavailable", "VIDEO_NO_DISPONIBLE", False),
    (
        "ERROR: [youtube] abc: Video unavailable. This video has been removed by the uploader",
        "VIDEO_NO_DISPONIBLE",
        False,
    ),
    (
        "ERROR: [youtube] abc: This video is no longer available because the YouTube account associated with this video has been terminated.",
        "VIDEO_NO_DISPONIBLE",
        False,
    ),
    (
        "ERROR: [youtube] abc: Sign in to confirm your age. This video may be inappropriate for some users.",
        "VIDEO_NO_DISPONIBLE",
        False,
    ),
    (
        "ERROR: [youtube] abc: The uploader has not made this video available in your country",
        "VIDEO_NO_DISPONIBLE",
        False,
    ),
    (
        "ERROR: [youtube] abc: Join this channel to get access to members-only content like this video",
        "VIDEO_NO_DISPONIBLE",
        False,
    ),
    (
        "ERROR: [youtube] abc: Sign in to confirm you’re not a bot. Use --cookies-from-browser",
        "YOUTUBE_BLOQUEADO",
        True,
    ),
    ("ERROR: [youtube] abc: Sign in to confirm you're not a bot", "YOUTUBE_BLOQUEADO", True),
    ("ERROR: unable to download video data: HTTP Error 403: Forbidden", "YOUTUBE_BLOQUEADO", True),
    ("ERROR: [download] Got error: HTTP Error 429: Too Many Requests", "YOUTUBE_BLOQUEADO", True),
    (
        "ERROR: [youtube] abc: nsig extraction failed: Some formats may be missing",
        "YOUTUBE_BLOQUEADO",
        True,
    ),
    (
        "ERROR: [youtube] abc: Unable to extract initial player response; please report this issue",
        "YOUTUBE_BLOQUEADO",
        True,
    ),
    (
        "ERROR: [youtube] abc: Signature extraction failed: Some formats may be missing",
        "YOUTUBE_BLOQUEADO",
        True,
    ),
    (
        "ERROR: [youtube] abc: Unable to download webpage: <urlopen error [Errno 8] nodename nor servname provided, or not known>",
        "SIN_CONEXION",
        True,
    ),
    (
        "ERROR: [youtube] abc: Unable to download webpage: <urlopen error [Errno -3] Temporary failure in name resolution>",
        "SIN_CONEXION",
        True,
    ),
    (
        "ERROR: [youtube] abc: Unable to download API page: <urlopen error [Errno 111] Connection refused>",
        "SIN_CONEXION",
        True,
    ),
    (
        "ERROR: [youtube] abc: Unable to download webpage: The read operation timed out",
        "SIN_CONEXION",
        True,
    ),
    (
        "ERROR: [youtube] abc: Unable to download webpage: [WinError 10061] No se puede establecer una conexión; Connection refused",
        "SIN_CONEXION",
        True,
    ),
    ("ERROR: algo completamente inesperado", "ERROR_INTERNO", False),
    ("", "ERROR_INTERNO", False),
]


@pytest.mark.parametrize("mensaje,codigo,reintentable", CASOS)
def test_clasificar_por_texto(mensaje, codigo, reintentable):
    e = clasificar_error(mensaje)
    assert (e.codigo, e.reintentable) == (codigo, reintentable)


@pytest.mark.parametrize(
    "origen,codigo",
    [
        (urllib.error.URLError("x"), "SIN_CONEXION"),
        (TimeoutError("t"), "SIN_CONEXION"),
        (ConnectionResetError("r"), "SIN_CONEXION"),
        (urllib.error.HTTPError("u", 403, "Forbidden", None, None), "YOUTUBE_BLOQUEADO"),
        (urllib.error.HTTPError("u", 429, "Too Many", None, None), "YOUTUBE_BLOQUEADO"),
    ],
)
def test_clasificar_por_excepcion(origen, codigo):
    assert clasificar_error("ERROR: sin pistas en el texto", origen).codigo == codigo
