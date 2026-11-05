# 0058 — `runtime-real`: bytes reales de descarga, pico de disco y Calidad en CPU
- Estado: En curso (código y suma de ruedas hechos; falta la primera ejecución en GitHub)
- Paso del pipeline: 0
- Depende de: 0040 (Hecha), 0055, 0056
- ADRs: 0009 (Revisiones 2026-11-05, puntos 3–6)
- Spec UX: —
- Cuándo: **durante la Fase 3**, en paralelo (no la bloquea). Es necesaria **antes de la Fase 7** (`medido: true` y cifras de descarga publicadas)

## Objetivo
Medir lo que `preguntas/0018` dejó abierto:
- los **bytes que se transfieren por red** al instalar (la caché de uv está descomprimida y no sirve);
- el **pico de disco real** de la instalación con Calidad en CPU (¿comparten bloques la caché de uv y el venv?).
Después, validar o corregir `bytes_descarga` y `medido` del manifiesto.

## Criterios de aceptación
- [ ] `worker/scripts/medir_descarga.py` (sin instalar nada; reutiliza la lectura de requisitos de `inspeccionar_av.py`):
  - **Selección de ruedas**: para cada archivo de `worker/requisitos/` y cada paquete fijado, elige entre sus `--hash` la rueda compatible con la plataforma (etiquetas de `packaging.tags` para el triple del archivo; en `darwin-arm64-mps`, macOS 14 arm64 y Python 3.12).
  - **Tamaño de cada rueda**: campo `size` de la API JSON de PyPI (`/pypi/<paquete>/<versión>/json`, emparejando por `sha256`), o `Content-Length` de una petición HEAD para los índices sin API JSON (`download.pytorch.org`).
  - **Salida**: total de bytes por archivo, los 10 paquetes más grandes y los paquetes sin tamaño (si los hay, la salida no es válida). Con `--json` escribe el resultado.
  - **Tests sin red**: respuestas de índice simuladas y una línea con varios hashes.
- [ ] `.github/workflows/runtime-real.yml`: el trabajo de licencias (Ubuntu) ejecuta también `medir_descarga.py` para las 5 combinaciones y sube su JSON en el artefacto.
- [ ] `app/scripts/instalar-runtime.mjs`:
  - **Tráfico de red de la instalación** (`red_mb`, aproximado): diferencia de los contadores de recepción de la interfaz antes y después de las fases motor y componentes, leídos de `/proc/net/dev` (Linux), `netstat -ib` (macOS) o `Get-NetAdapterStatistics` en PowerShell (Windows). Si no se puede leer, vale `null` sin fallar.
  - **Pico de disco**: muestrea el espacio libre del volumen de `SHINOBI_DATOS` cada 1 s durante toda la instalación. El JSON añade `espacio_libre_mb.minimo` y `pico_mb` = libre al inicio − mínimo.
  - **Caché de uv**: renombra `mb_descargados.cache_uv` a `cache_uv_descomprimida`.
  - **Modelo**: instala **Calidad** en todos los perfiles (0056). La opción `--modelo rapido` prueba la vía con consentimiento de 0057 (el script escribe `rapido_aceptado` como haría la interfaz).
  - **Comprobación**: falla si `pico_mb + 500 > espacio_requerido` del perfil, con el mensaje "abrir pregunta para el arquitecto".
- [ ] **Primera ejecución en GitHub**:
  - se copian a las notas de esta tarea, por SO: `red_mb`, la suma de ruedas, `pico_mb` y el disco final con Calidad;
  - el programador actualiza `bytes_descarga` de los 5 perfiles con la suma de ruedas;
  - `medido: true` en Windows y Linux CPU solo si `red_mb` coincide con la suma de ruedas ± 10 % (los perfiles `cuda` se miden sin instalar, pero siguen con `medido: false` hasta tener un equipo NVIDIA);
  - si alguna cifra difiere > 20 % del manifiesto, o el pico no cumple el criterio, se abre una pregunta `Para: arquitecto`.
- [ ] ~~Cuando exista el comando `separar` (Fase 3), opcional en el mismo workflow: separar 60 s de audio generado con Calidad en Windows y Linux CPU para obtener un primer factor x86 (medición pendiente de 0040).~~ → **Pasa a la tarea 0062** (desglose de la Fase 3, 2026-11-05). Las dos tareas editan `runtime-real.yml` e `instalar-runtime.mjs`: coordinarse.

## Notas de implementación
**Qué se hizo**
- `worker/scripts/medir_descarga.py` (+ `worker/tests/test_medir_descarga.py`, 6 pruebas sin red): lee cada archivo de `worker/requisitos/` (versión, marcador de entorno y todos los `--hash` de la línea), descarta los paquetes cuyo marcador no aplica a la plataforma, localiza los archivos por sha256 en la API JSON de PyPI (`size`) o, para `+cpu`/`+cu128`, en el índice simple de `download.pytorch.org` (tamaño por HEAD), elige la rueda con mejor etiqueta (`packaging.tags`: cp312/abi3/py3 y manylinux 2.5–2.39, `win_amd64`, macOS 14 arm64) y suma. Salida: total, 10 más grandes y paquetes sin tamaño (código 1 si hay alguno). `--json` y `--requisitos`.
- `.github/workflows/runtime-real.yml`: el trabajo `licencia-ffmpeg-av` instala `packaging`, ejecuta `medir_descarga.py` (5 combinaciones) y sube `descarga-ruedas`. Nueva entrada `modelo` (calidad por defecto / rapido) que pasa `--modelo` al script.
- `app/scripts/instalar-runtime.mjs`: `red_mb` (recepción de la interfaz, leída antes de `instalar()` y justo antes de `uv cache clean`, es decir, motor + componentes; `/proc/net/dev`, `netstat -ib`, `Get-NetAdapterStatistics`; `null` si falla); muestreo del espacio libre cada 1 s (`espacio_libre_mb.minimo`, `pico_mb`); `cache_uv` pasa a `cache_uv_descomprimida`; el modelo es Calidad en todos los perfiles y `--modelo rapido` escribe `rapido_aceptado` y `modo: rapido`; bloque `manifiesto` con `red_vs_ruedas_pct` (con y sin el Python de uv) para el criterio de ±10 %; error "abrir pregunta para el arquitecto" si `pico_mb + 500 > espacio_requerido`.
- `app/resources/runtime-manifest.json`: `bytes_descarga` actualizado con la suma de ruedas (`medido` sin cambios; ver abajo).

**Suma de ruedas (ejecutada en local con red, 2026-11-05, sin instalar nada)** frente al manifiesto anterior:

| Archivo | Suma de ruedas | Manifiesto anterior | Diferencia |
|---|---|---|---|
| darwin-arm64-mps | 345 477 613 | 296 000 000 | +16,7 % |
| win32-x64-cpu | 363 144 055 | 311 000 000 | +16,8 % |
| win32-x64-cuda | 2 998 097 525 | 3 100 000 000 | -3,3 % |
| linux-x64-cpu | 489 199 411 | 434 000 000 | +12,7 % |
| linux-x64-cuda | 4 230 069 811 | 4 400 000 000 | -3,9 % |

Ninguna difiere más de un 20 %: no hace falta pregunta. Los 10 mayores: torch (138,6 / 126,6 / 209,5 MB en mps / win-cpu / linux-cpu; 2753 MB win-cuda; 820 MB linux-cuda, que suma además ~3,4 GB de `nvidia-*` y triton), llvmlite, deno, scipy, av y onnxruntime. Los tamaños no incluyen el Python de uv (24 / 22 / 35 MB, campo aparte). Sin paquetes sin tamaño.

**Cómo probarlo**
- Suma de ruedas: `python -m pip install packaging && python worker/scripts/medir_descarga.py --json /tmp/d.json` (en macOS con Python de python.org puede hacer falta `SSL_CERT_FILE=/etc/ssl/cert.pem`); tests: `cd worker && uv run pytest tests/test_medir_descarga.py`.
- Instalación: Actions > "Runtime real (manual)" (entradas `perfil`, `modelo`), o en local `cd app && SHINOBI_DATOS=/tmp/datos node --experimental-transform-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/instalar-runtime.mjs [--modelo rapido]`.
- Validado en local: YAML parseado y Prettier del workflow; Prettier/ESLint del script; ruff y pytest (12 pruebas con las del inspector de av); el script de instalación con un `uv` falso que falla (JSON con `red_mb`, `pico_mb` y `manifiesto` a `null`, código 1); `netstat -ib` en macOS (la fórmula de suma por filas `<Link#n>` se comprobó con awk); `vitest run src/shared` (manifiesto) en verde. **No** se instaló el runtime ni se ejecutó el workflow en GitHub.

**Pendiente (primera ejecución en GitHub, la hace quien lance el workflow)**
- Copiar a esta nota, por SO: `red_mb`, suma de ruedas (arriba), `pico_mb` y `datos_total` con Calidad; poner `medido: true` en Windows y Linux CPU solo si `red_vs_ruedas_pct` queda en ±10 % (a falta de Python, mirar `red_sin_python_vs_ruedas_pct`); si el pico no cumple, abrir pregunta `Para: arquitecto`.
- `medido: true` no se ha tocado porque aún no hay `red_mb`.
- Los contadores de red del runner incluyen otro tráfico (el propio checkout, `npm ci`, etc. ocurre antes del inicio de la medición, pero no hay garantía); `red_mb` es aproximado.
- El factor x86 de separación pasó a la tarea 0062 (no se ha tocado).
