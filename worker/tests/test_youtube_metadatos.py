import pytest

from shinobi_worker.metadatos_youtube import limpiar_canal, limpiar_titulo, sugerir

# (info de yt-dlp, (titulo, artista, album) esperado)
CASOS = [
    ({"track": "T", "artist": "A", "album": "Al", "title": "x"}, ("T", "A", "Al")),
    ({"track": "T", "artist": "A", "title": "x"}, ("T", "A", "")),
    ({"track": "T", "channel": "Canal - Topic"}, ("T", "Canal", "")),
    ({"title": "Artista - Canción"}, ("Canción", "Artista", "")),
    ({"title": "Artista – Canción"}, ("Canción", "Artista", "")),
    ({"title": "Artista — Canción"}, ("Canción", "Artista", "")),
    ({"title": "Artista - Canción (Official Video)"}, ("Canción", "Artista", "")),
    ({"title": "Artista - Canción (Official Music Video)"}, ("Canción", "Artista", "")),
    ({"title": "Artista - Canción [Official Audio]"}, ("Canción", "Artista", "")),
    ({"title": "Artista - Canción (Lyrics)"}, ("Canción", "Artista", "")),
    ({"title": "Artista - Canción [Lyric Video]"}, ("Canción", "Artista", "")),
    ({"title": "Artista - Canción (Audio)"}, ("Canción", "Artista", "")),
    ({"title": "Artista - Canción (Video oficial)"}, ("Canción", "Artista", "")),
    ({"title": "Artista - Canción (Letra)"}, ("Canción", "Artista", "")),
    ({"title": "Artista - Canción HD"}, ("Canción", "Artista", "")),
    ({"title": "Artista - Canción 4K"}, ("Canción", "Artista", "")),
    ({"title": "Artista - Canción (OFFICIAL VIDEO)"}, ("Canción", "Artista", "")),
    ({"title": "Artista - Canción ft. Invitado"}, ("Canción", "Artista", "")),
    ({"title": "Artista - Canción (feat. Invitado)"}, ("Canción", "Artista", "")),
    ({"title": "Artista - Canción (Official Video) [HD]"}, ("Canción", "Artista", "")),
    ({"title": "Artista - Canción (Lyrics) ft. Otro"}, ("Canción", "Artista", "")),
    ({"title": "Artista ft. Invitado - Canción"}, ("Canción", "Artista ft. Invitado", "")),
    ({"title": "Canción (Official Video)", "channel": "ArtistaVEVO"}, ("Canción", "Artista", "")),
    ({"title": "Canción", "uploader": "Artista Official"}, ("Canción", "Artista", "")),
    ({"title": "Canción", "channel": "Artista - Topic"}, ("Canción", "Artista", "")),
    ({"title": "Canción", "channel": "Canal", "uploader": "Otro"}, ("Canción", "Canal", "")),
    ({"title": "Canción", "uploader": "Subidor"}, ("Canción", "Subidor", "")),
    ({"title": "Canción", "artist": "Artista"}, ("Canción", "Artista", "")),
    ({"title": "Artista - Canción", "artist": "Otro"}, ("Canción", "Otro", "")),
    ({"title": "Una - Dos - Tres"}, ("Dos - Tres", "Una", "")),
    ({"title": "Ni-guion-con-espacios"}, ("Ni-guion-con-espacios", "", "")),
    ({"title": "(Official Video)"}, ("(Official Video)", "", "")),
    ({"title": "  Doble   espacio  -  Título  "}, ("Título", "Doble espacio", "")),
    ({}, ("", "", "")),
]


@pytest.mark.parametrize("info,esperado", CASOS, ids=[str(i) for i in range(len(CASOS))])
def test_sugerir(info, esperado):
    r = sugerir(info)
    assert (r["titulo"], r["artista"], r["album"]) == esperado


def test_hay_al_menos_veinte_casos():
    assert len(CASOS) >= 20


@pytest.mark.parametrize(
    "entrada,esperado",
    [
        ("Canal VEVO", "Canal"),
        ("CanalVEVO", "Canal"),
        ("Canal - Topic", "Canal"),
        ("Canal Official", "Canal"),
        ("Official Canal", "Canal"),
        ("Topic", "Topic"),
        ("", ""),
    ],
)
def test_limpiar_canal(entrada, esperado):
    assert limpiar_canal(entrada) == esperado


def test_limpiar_titulo_es_insensible_a_mayusculas():
    assert limpiar_titulo("Algo [oFFicial AUDIO]") == "Algo"
