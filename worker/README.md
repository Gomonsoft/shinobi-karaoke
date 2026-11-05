# worker

Worker Python de Shinobi Karaoke. Un proceso por trabajo:

```
uv run python -m shinobi_worker <comando> --args '<json>'
```

Habla JSON Lines por stdout (`docs/arquitectura.md` seccion 6); stderr es para registros y trazas. Codigos de salida: 0 ok, 1 error, 2 argumentos no validos.

Comandos: `version`, `demo` (`{"segundos": n, "fallar_en": 0..1|null, "indeterminado_s": n, "ruta_parcial": "ruta"}`).

`info-youtube` (`{"url": "..."}`): vista previa de un vídeo de YouTube sin descargar el audio. Con `SHINOBI_YTDLP_FALSO=<dir>` usa un doble que lee `<dir>/<id>.json` (solo pruebas). Las pruebas con red se marcan `red` (`SHINOBI_TESTS_RED=1 uv run pytest -m red`).

Desarrollo: `uv sync --locked`, `uv run pytest`, `uv run ruff check`, `uv run ruff format --check`.

Pruebas (marcadores en `pyproject.toml`, ADR 0009 §8):

- Normales (sin red ni descargas): `uv run pytest`. Es lo que ejecuta la CI. Excluye `red` y `pesado`.
- `red` (necesitan Internet): `SHINOBI_TESTS_RED=1 uv run pytest -m red`. Sin la variable se omiten.
- `pesado` (necesitan el *extra* `separacion` o descargas de mas de 50 MB): `uv sync --extra separacion` y `uv run pytest -m pesado`. El *extra* instala PyTorch y audio-separator; no se usa en la CI normal.

Audio de prueba: `tests/audio_prueba.py` genera audio sintetico (tonos, silencio, videos negros) en `tmp_path` mediante los *fixtures* de `tests/conftest.py`; no se versiona audio de terceros.

Requisitos bloqueados por perfil (ADR 0009 §1): `worker/requisitos/<plataforma>-<perfil>.txt`, con hashes, generados con `uv pip compile` (solo resuelve, no descarga ruedas):

- `uv run python scripts/compilar_requisitos.py` regenera los archivos (conserva las versiones ya fijadas); `--actualizar` las vuelve a resolver; `--perfil <nombre>` limita a un perfil.
- `uv run python scripts/compilar_requisitos.py --comprobar` falla si algún archivo no coincide (lo ejecuta la CI).
- Tras regenerar, subir `version` y actualizar `sha256_requisitos` en `app/resources/runtime-manifest.json` (un test de la app lo comprueba).
- `darwin-x64-cpu` no existe: PyTorch no publica ruedas para macOS Intel (`docs/preguntas/0015-macos-intel-sin-pytorch-y-macos-minimo.md`).
- Instalación: `uv pip install --require-hashes --index-strategy unsafe-best-match -r <archivo>` (los perfiles CPU/CUDA añaden el índice de PyTorch como `--extra-index-url`).

Convencion: el worker no crea procesos hijos; si un comando futuro los necesita, debe terminarlos al recibir SIGTERM (el gestor mata el arbol: SIGTERM, SIGKILL a los 3 s; `taskkill /T /F` en Windows).

## Licencia del FFmpeg de PyAV

`python scripts/inspeccionar_av.py [--json salida.json]` descarga (sin instalar) la rueda `av` fijada en cada archivo de `requisitos/` y la de macOS x64, comprueba su sha256 y revisa la configuración y las bibliotecas de FFmpeg: falla con `--enable-nonfree` o bibliotecas no libres e informa de los componentes GPL (x264, x265). Repetirlo al cambiar la versión de `av` (tarea 0040; también lo ejecuta `.github/workflows/runtime-real.yml`).
