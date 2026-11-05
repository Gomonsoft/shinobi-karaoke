# 0040 — CI manual: instalación real del runtime en los 3 SO y mediciones (pruebas con red)
- Estado: Hecha (mediciones de separación en x86 pendientes)
- Paso del pipeline: 0
- Depende de: 0030, 0035
- ADRs: 0001, 0002 (Revisiones: FFmpeg de PyAV), 0004, 0009
- Spec UX: —

## Objetivo
Comprobar con red real, fuera de la CI normal, que los requisitos bloqueados se instalan en Windows, macOS y Linux sin GPU, y aprovecharlo para rellenar parte de las **mediciones pendientes** de la Fase 1 (tamaños reales en Windows/Linux CPU, `where`/`which ffmpeg` vacío).

## Criterios de aceptación
- [ ] Workflow `.github/workflows/runtime-real.yml` solo con `workflow_dispatch` (entrada opcional: perfil, por defecto `cpu`/`mps` según el SO), matriz `windows-latest`, `macos-latest`, `ubuntu-latest`. **No** se ejecuta en `push` ni en PR.
- [ ] Ejecuta el gestor de runtime real (0034) mediante un script de Node sin interfaz (p. ej. `app/scripts/instalar-runtime.mjs`, que reutiliza el código de `main/runtime/` sin Electron, o un E2E marcado) con `SHINOBI_DATOS` temporal: motor + componentes + diagnóstico + modelo **Rápido**; después `demo` y `diagnostico` con `resolverLanzador` en modo producción.
- [ ] Publica como artefacto un JSON con: MB descargados (bytes de la caché de uv antes de `uv cache clean` + modelo), disco del venv y de `runtime/python`, duración por fase, versiones instaladas de torch/onnxruntime/audio-separator/yt-dlp/av, salida de `where ffmpeg`/`which ffmpeg` (debe estar vacía tras quitar ffmpeg del PATH del paso) y espacio libre antes/después.
- [ ] Ejecuta también `uv run pytest -m "red or pesado"` del worker con el extra `separacion` (incluye 0030 HEAD de URLs, 0032 diagnóstico real y los tests `red` de YouTube de 0053 si ya existen).
- [ ] **Licencia del FFmpeg de PyAV** (ADR 0002, revisión 2026-11-04):
  - `worker/scripts/inspeccionar_av.py` descarga **sin instalar** la rueda `av` fijada en cada uno de los 5 archivos de `worker/requisitos/` (sin `darwin-x64-cpu`, `preguntas/0015`) (p. ej. `uv pip download`/`pip download --only-binary=:all: --platform <etiqueta> --no-deps av==<versión>`; también `darwin-x64`, que no tiene runner).
  - Abre el zip y, de `libavutil`/`avutil-*.dll`, extrae la cadena de configuración de FFmpeg (`--enable-…`) y la licencia declarada.
  - Lista las bibliotecas incluidas (`av/.dylibs`, `av.libs/`, DLL junto a `av/`).
  - Falla si aparece `--enable-nonfree`, `libfdk`, `libnpp`, `cuda-nvcc`, `decklink` u otra biblioteca no libre.
  - Informa (sin fallar) de los componentes GPL (`libx264`, `libx265`, `--enable-gpl`).
  - El JSON del artefacto incluye el resultado por plataforma. El script también se puede ejecutar a mano al cambiar la versión de `av`.
- [ ] Con ese resultado, el programador actualiza la entrada de FFmpeg en `THIRD_PARTY_NOTICES.md`: licencia **efectiva** por plataforma (p. ej. "se declara LGPL-3.0+, incluye x264/x265 GPL-2.0-or-later, el conjunto se rige por GPL-3.0") y créditos de x264 y x265 si están. Si alguna rueda no es redistribuible, abre una pregunta `Para: arquitecto`.
- [ ] Tras la primera ejecución con éxito, el programador copia las cifras a las notas de esta tarea y, si difieren > 20 % del manifiesto, abre una pregunta `Para: arquitecto` para actualizarlo (los `medido: false` pasan a `true` solo con datos de esta ejecución).

## Notas de implementación
**Qué se hizo**
- `.github/workflows/runtime-real.yml`: solo `workflow_dispatch` (entrada `perfil`: `auto` por defecto, `cpu`, `cuda`, `mps`; el script falla si el equipo resuelve otro perfil). Trabajo `runtime` en la matriz `windows-latest`/`macos-latest`/`ubuntu-latest` (bash en los tres): `npm ci`, `scripts/instalar-runtime.mjs`, `uv sync --locked --extra separacion` y `uv run pytest -m "red or pesado"` con `SHINOBI_TESTS_RED=1`, y artefacto `runtime-real-<os>` con el JSON. Trabajo `licencia-ffmpeg-av` (Ubuntu, sin uv) que ejecuta `inspeccionar_av.py` y sube `licencia-ffmpeg-av`.
- `app/scripts/instalar-runtime.mjs`: reutiliza `src/main/runtime/` sin Electron (mismo mecanismo que `semilla.mjs`: `--experimental-transform-types` + `resolver-ts.mjs`) con `SHINOBI_DATOS` temporal. Quita del PATH las carpetas que contienen `ffmpeg`, instala con el gestor real (motor, componentes, diagnóstico, modelo), mide la caché de uv justo antes de `uv cache clean` (envolviendo el ejecutor de uv), ejecuta `demo` y `diagnostico` con `resolverLanzador` en modo producción, lee las versiones con `importlib.metadata` y comprueba que `where`/`which ffmpeg` sale vacío. JSON: MB descargados (caché de uv + modelos), disco (venv, `runtime/python`, modelos, total), duración por fase y total, versiones (torch, onnxruntime, audio-separator, yt-dlp, av), salida de `where/which ffmpeg` y espacio libre antes/después. Sale con código 1 si algo falla (el JSON se escribe igualmente).
- `worker/scripts/inspeccionar_av.py` (+ `worker/tests/test_inspeccionar_av.py`, sin red): lee la versión de `av` y sus hashes de cada archivo de `worker/requisitos/`, hace `python -m pip download --only-binary=:all: --no-deps --platform <etiqueta>` (sin instalar), comprueba el sha256 contra el archivo, y de `libavutil` extrae la cadena `--enable-…` y la licencia declarada; lista las bibliotecas; falla con `--enable-nonfree`, `libfdk`, `libnpp`, `cuda-nvcc`, `decklink`, `libnvenc`; informa de `--enable-gpl`/libx264/libx265. Solo cuentan opciones activadas (un `--disable-libfdk-aac` no falla). Incluye también `darwin-x64` (rueda de macOS x86_64 con la versión de darwin-arm64).

**Resultado de la revisión de licencias (ejecutada en local el 2026-11-04, `av` 19.0.2)**: las seis entradas pasan. Todas declaran `LGPL version 3 or later` (`--enable-version3`, sin `--enable-gpl`), todas incluyen libx264 y libx265 (GPL-2.0-or-later) y ninguna tiene `--enable-nonfree` ni bibliotecas no libres. Windows/Linux activan además `--enable-nvenc/nvdec/amf` (solo cargan los controladores del fabricante en tiempo de ejecución) y Windows `libvpl`. Los hashes de las ruedas de las cinco plataformas con archivo coinciden con los de `worker/requisitos/`. `THIRD_PARTY_NOTICES.md` actualizado (licencia efectiva por conjunto y créditos de x264 y x265). Ninguna rueda es no redistribuible: no hace falta pregunta.

**Cómo probarlo**
- Licencias (local): `python worker/scripts/inspeccionar_av.py [--plataforma linux-x64-cpu] [--json salida.json]`; tests: `cd worker && uv run pytest tests/test_inspeccionar_av.py`.
- Runtime real: Actions > "Runtime real (manual)" > Run workflow; o en local (descarga ~1 GB o más): `cd app && SHINOBI_DATOS=/tmp/datos-real node --experimental-transform-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/instalar-runtime.mjs --salida runtime-real.json`.
- Validado en local: YAML parseado, Prettier y ESLint del script, ruff y pytest del inspector; el script de instalación se ejercitó con un `uv` falso que falla (error de la fase `motor` recogido en el JSON, código de salida 1). No se instaló el runtime ni se descargaron modelos en este equipo.

**Deuda técnica / pendiente**
- La **primera ejecución en GitHub no se ha hecho**: tras ella hay que copiar las cifras aquí, compararlas con `app/resources/runtime-manifest.json` y, si difieren más de un 20 %, abrir una pregunta `Para: arquitecto`; los `medido: false` pasan a `true` solo con esos datos. Tampoco se ha comprobado `where ffmpeg` en Windows.
- El modelo se elige por perfil (`modeloDelPerfil`): en `cpu` es Rápido, pero en `mps`/`cuda` el gestor descarga Calidad (913 MB) aunque `separacion.modo` sea `rapido`. El JSON recoge `modelos_descargados`; en macOS (runner sin GPU real) el diagnóstico puede rebajar a `cpu`.
- `uv sync --extra separacion` en los tres SO instala PyTorch por segunda vez (la primera la hizo el gestor en `SHINOBI_DATOS`); aceptable en un workflow manual.
- Las acciones `upload-artifact@v7` y `setup-python@v7` son las últimas publicadas (comprobado con `gh api`); `ci.yml` usa `setup-uv@v10.3.3` y `UV_VERSION` duplicado aquí.

### Primera ejecución real (2026-11-05, run 41967889708)
Antes de pasar hubo que corregir dos cosas: la clave de Python de uv en Linux (`-gnu`, commit dd37826) y omitir en CI las pruebas `red` de YouTube cuando YouTube bloquea la IP del runner (commit eb307c1). Resultado: los 4 trabajos en verde.

| | macOS arm64 (mps) | Windows x64 (cpu) | Linux x64 (cpu) |
|---|---|---|---|
| Modelo descargado | Calidad | Rápido | Rápido |
| venv en disco | 1204,5 MB | 1165,0 MB | 1618,7 MB |
| Python (uv) | 70,3 MB | 64,6 MB | 103,5 MB |
| Modelo | 913,1 MB | 59,1 MB | 59,1 MB |
| Caché de uv antes de `uv cache clean` | 1204,2 MB | 1163,2 MB | 1624,5 MB |
| Datos tras limpiar la caché | 2188 MB | 1288,7 MB | 1781,3 MB |
| Duración (motor / componentes / modelo) | 1,8 / 16,1 / 4,8 s | 2,2 / 27,2 / 0,9 s | 0,9 / 26,4 / 0,9 s |
| `where`/`which ffmpeg` | vacío | vacío | vacío |

Versiones: torch 2.15.0 (`+cpu` en Windows/Linux), onnxruntime 1.31.1, audio-separator 0.48.0, yt-dlp 2026.10.26, av 19.0.2. Licencias PyAV/FFmpeg: OK en las 6 entradas.

**Observaciones para el arquitecto** (ver pregunta abierta):
1. El campo `mb_descargados.cache_uv` mide la caché descomprimida, no los bytes transferidos por red, así que no sirve para validar `bytes_descarga` del manifiesto.
2. `bytes_disco` de macOS (1280 MB) coincide con lo medido (1204,5 MB de venv, −6 %). Windows y Linux CPU tienen `bytes_disco: null` y ahora hay medida.
3. Pico de disco en Linux CPU: venv + caché + Python + modelo ≈ 3,4 GB, por encima del `espacio_requerido` de 3 GB, si la caché y el venv no comparten bloques (uv usa enlaces duros en Linux; el script los mide por separado).
4. Rendimiento de separación en x86 sin GPU: sigue sin medir (el workflow no separa audio).
