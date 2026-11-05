# 0028 — Worker: dependencias de la Fase 2, marcadores de pruebas y audio de prueba generado
- Estado: Hecha
- Paso del pipeline: 1 (y 0)
- Depende de: 0003, 0024
- ADRs: 0001, 0003, 0007, 0009
- Spec UX: —

## Objetivo
Preparar el worker para los comandos reales de la Fase 2: dependencias base fijadas, *extra* `separacion` (no se instala en la CI normal), separación clara entre pruebas que necesitan red/descargas y las que no, y utilidades para generar audio de prueba sin versionar audio de terceros.

## Criterios de aceptación
- [x] `worker/pyproject.toml`: dependencias `av`, `soundfile`, `numpy`, `pyloudnorm`, `yt-dlp[default]`, `deno` con versiones fijadas (`==`) en el lock; *extra* `separacion` = `audio-separator[cpu]==0.48.0`, `torch`, `onnxruntime`, `audioread` (ADR 0009 §1). `uv sync --locked` (sin extra) sigue funcionando en los 3 SO y no instala torch.
- [x] Marcadores de pytest registrados en `pyproject.toml`: `red` (necesita Internet) y `pesado` (necesita el extra `separacion` o descargas > 50 MB). `addopts = -m "not red and not pesado"` por defecto; `SHINOBI_TESTS_RED=1 uv run pytest -m red` los ejecuta. Un test de ejemplo de cada tipo que se omite por defecto (comprobado con `pytest --collect-only`).
- [x] `worker/tests/audio_prueba.py` (o `conftest.py` con *fixtures*): genera en `tmp_path` audio sintético con numpy + PyAV/soundfile: tono estéreo 30 s, mono 30 s, 5 s (corto), 11 min de silencio con un tono (largo, generado rápido), WAV 16/24/float32, FLAC, MP3, M4A/AAC, OGG/Opus, WebM/Opus, MP4 y MKV con vídeo negro + audio, un MP4 **sin pista de audio**, un archivo truncado/corrupto, un archivo de texto con extensión `.mp3`, y uno con etiquetas `title`/`artist`/`album` (incluidas tildes y CJK). Cada *fixture* tarda < 2 s.
- [x] `ruff` y `pytest` pasan; la CI del worker (`.github/workflows/ci.yml`) ejecuta `uv sync --locked` + `pytest` sin red adicional a PyPI y sin el extra.
- [x] `THIRD_PARTY_NOTICES.md`, sección "Worker Python": PyAV (BSD-3) y FFmpeg incluido en sus wheels (LGPL-2.1+; anotar la licencia exacta del build), soundfile (BSD-3) y libsndfile (LGPL-2.1+), numpy (BSD-3), pyloudnorm (MIT), yt-dlp (Unlicense), yt-dlp-ejs (licencia según su repositorio), Deno (MIT). Comprobar cada licencia en su fuente y citarla.
- [x] `worker/README.md`: cómo ejecutar las pruebas normales, las `red` y las `pesado`.

## Notas de implementación
- Hecho: dependencias base y *extra* `separacion` en `worker/pyproject.toml` (versiones exactas en `worker/uv.lock`, regenerado con uv 0.13.7; `uv sync --locked` sin extra no instala torch, comprobado); marcadores `red`/`pesado` con `addopts`; `tests/conftest.py` omite `red` salvo `SHINOBI_TESTS_RED=1`; `tests/audio_prueba.py` (generadores) + `tests/conftest.py` (fixtures) + `tests/test_audio_prueba.py` (los verifica y comprueba que son rápidos); `THIRD_PARTY_NOTICES.md` y `worker/README.md`.
- Probar: `cd worker && uv sync --locked && uv run ruff check && uv run ruff format --check && uv run pytest` (32 pasan, 2 deseleccionados); `uv run pytest --collect-only -m "red or pesado"`.
- Hallazgos: la rueda de PyAV 19 de macOS no trae `libvorbis` (por eso solo OGG/Opus, como pide la tarea) y su FFmpeg se declara LGPL-3.0+ aunque enlaza x264/x265; verificar en Windows/Linux (0040). `uv lock` resuelve el extra para todas las plataformas, por lo que el lock crece (torch y nvidia-*), pero no se instala sin el extra. El lock y la CI no se han podido ejecutar en Windows/Linux aqui.
- Deuda: la CI no cambia (ya hacia `uv sync --locked` + `pytest`); los *fixtures* no incluyen Vorbis.

### Mantenimiento (2026-11-04)
En el runner de Windows de la CI, `test_generadores_son_rapidos` tardó 3,1 s (MP3 + WAV de 11 min) y superó el límite de 2 s; en un M1 tarda ~0,44 s. El objetivo de diseño sigue siendo < 2 s por generador, pero el test mide ahora cada generador por separado con un límite de 10 s (`LIMITE_GENERADOR_S`), suficiente para detectar regresiones graves sin depender de la velocidad del runner.
