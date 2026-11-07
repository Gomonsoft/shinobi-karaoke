# worker

Worker Python de Shinobi Karaoke. Un proceso por trabajo:

```
uv run python -m shinobi_worker <comando> --args '<json>'
```

Habla JSON Lines por stdout (`docs/arquitectura.md` seccion 6); stderr es para registros y trazas. Codigos de salida: 0 ok, 1 error, 2 argumentos no validos.

Comandos: `version`, `demo` (`{"segundos": n, "fallar_en": 0..1|null, "indeterminado_s": n, "ruta_parcial": "ruta"}`).

`generar-picos` (`{"entrada": "voz.flac", "salida": "picos.tmp"}`) decodifica la voz por tramas y crea el temporal SKPV v1 del ADR 0015. Emite `{"frecuencia_hz": n, "muestras": n, "bloques_base": n}` como resultado JSON Lines. El proceso principal autoriza las rutas y se encarga de publicar la caché o limpiar el temporal si termina el proceso.

`info-youtube` (`{"url": "..."}`): vista previa de un vídeo de YouTube sin descargar el audio. Con `SHINOBI_YTDLP_FALSO=<dir>` usa un doble que lee `<dir>/<id>.json` (solo pruebas). Las pruebas con red se marcan `red` (`SHINOBI_TESTS_RED=1 uv run pytest -m red`).

`separar` (Fase 3, tarea 0060; contratos en `app/src/shared/protocolo.ts`): `{"entrada", "salida_dir", "modelo": {"id", "archivo", "dir"}, "dispositivo": "cpu"|"cuda", "bloques": "normal"|"pequenos"}`, validados por `shinobi_worker/argumentos_separar.py`. `entrada` debe ser FLAC PCM 16, 44,1 kHz, estéreo (si no, `FORMATO_NO_SOPORTADO`); deja en `salida_dir` solo `voz.flac` e `instrumental.flac` (si falla, la vacía). Comprueba que existen `modelo.dir/modelo.archivo` (y el `.yaml` con el mismo nombre en Calidad) o responde `MODELO_NO_DISPONIBLE`. Fases: `preparando`, `cargando_modelo`, `separando` (`detalle: {paso, total}`) y `guardando`; el resultado trae las rutas relativas, el modelo y dispositivo usados y los tiempos. La separación va detrás de la interfaz `Separador` (`shinobi_worker/separacion.py`; el adaptador real es la tarea 0061). Con `SHINOBI_SEPARADOR_FALSO=<escenario.json>` se usa el doble `separacion_falso.py`, que sigue el escenario (esquema y ejemplo en `app/src/shared/separacion.ts`: `segundos`, `pasos`, `fallos`, `morir_con_sigkill`) y no importa PyTorch ni `audio_separator` (solo pruebas: el main la pasa únicamente sin empaquetar, igual que `SHINOBI_YTDLP_FALSO`); `SHINOBI_INTENTO=<n>` (1–3) indica el intento para que el escenario falle en uno concreto.

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
- Instalación: `uv pip install --require-hashes --index-strategy unsafe-best-match --excludes requisitos/exclusiones.txt -r <archivo>` (los perfiles CPU/CUDA añaden el índice de PyTorch como `--extra-index-url`).

El ADR 0014 excluye DiffQ y DiffQ-fixed. El compilador comprueba que `requisitos/exclusiones.txt` coincide con `[tool.uv].exclude-dependencies`, que se usa para `uv lock/sync/run`. El adaptador real solo acepta los pares de identificador y archivo del catálogo Calidad y Rápido.

Separación sin ffmpeg (tarea 0062; ADR 0004, `preguntas/0009`): audio-separator exige `ffmpeg` al arrancar y el adaptador anula esa comprobación. `python scripts/sin_ffmpeg.py <comando...>` ejecuta un comando con el PATH sin carpetas que contengan `ffmpeg`/`ffprobe` y falla si siguen visibles (los runners de GitHub los traen). La CI normal (3 SO) ejecuta `uv run python scripts/sin_ffmpeg.py uv run pytest tests/test_separacion_contrato.py tests/test_separar*.py` y comprueba que `torch` no está instalado. `runtime-real` ejecuta los `pesado` (`test_separacion_real.py`, con `SHINOBI_MODELOS_DIR` apuntando al modelo Calidad instalado por el gestor) con el mismo filtro, y `app/scripts/instalar-runtime.mjs` separa 60 s de audio generado y añade `separacion` (segundos, factor, pico de RAM) al JSON.

**Actualizar audio-separator, torch u onnxruntime exige ejecutar `runtime-real` antes de fusionar** (un `pesado` comprueba que la versión instalada es la de `pyproject.toml`, 0.48.0). Si el parche deja de funcionar, se aplica el plan B de `docs/preguntas/0009` (imageio-ffmpeg), previa pregunta al arquitecto.

Convencion: el worker no crea procesos hijos; si un comando futuro los necesita, debe terminarlos al recibir SIGTERM (el gestor mata el arbol: SIGTERM, SIGKILL a los 3 s; `taskkill /T /F` en Windows).

## Licencia del FFmpeg de PyAV

`python scripts/inspeccionar_av.py [--json salida.json]` descarga (sin instalar) la rueda `av` fijada en cada archivo de `requisitos/` y la de macOS x64, comprueba su sha256 y revisa la configuración y las bibliotecas de FFmpeg: falla con `--enable-nonfree` o bibliotecas no libres e informa de los componentes GPL (x264, x265). Repetirlo al cambiar la versión de `av` (tarea 0040; también lo ejecuta `.github/workflows/runtime-real.yml`).

`python scripts/medir_descarga.py [--requisitos linux-x64-cpu] [--json salida.json]` suma, sin instalar nada, el tamaño de la rueda compatible de cada paquete fijado en `requisitos/` (tamaño de la API JSON de PyPI o `Content-Length` en `download.pytorch.org`): es el valor de `bytes_descarga` del manifiesto. Necesita `packaging`; falla si algún paquete queda sin tamaño (tarea 0058; lo ejecuta también `runtime-real.yml`).
