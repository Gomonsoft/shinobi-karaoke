# 0009 — Gestor de runtime: requisitos bloqueados por perfil, manifiesto, reutilización y dobles de prueba

- Estado: Aceptado
- Fecha: 2026-11-04
- Paso del pipeline: 0 (instalación) y 1 (fuente)

## Contexto
Los ADR 0001 y 0004 deciden **qué** se instala en el primer arranque (Python 3.12 gestionado por uv, venv, dependencias con `--torch-backend=auto`, Deno, modelo del perfil) y el spike 0005 midió **cuánto** ocupa. Para desglosar la Fase 2 faltan decisiones de detalle que afectan a varias tareas:

1. El spike vio que los índices de PyTorch CPU y cu128 publican **versiones distintas** (2.15 frente a 2.11): un único `uv.lock` no basta para "versiones fijadas por perfil".
2. Cómo llega el **código del worker** al runtime en producción (deuda de 0013: `resolverLanzador` ya admite `rutaCodigoWorker`).
3. Quién descarga los **modelos** y cómo se reanuda una descarga cortada, sabiendo que audio-separator deja `<modelo>.<pid>.partial` al cancelar (0005 §8).
4. Cómo **reutilizar** un runtime válido si `config.json` se recreó (ADR 0006, revisión 2026-11-04) y cómo detectar uno **dañado**.
5. Cómo probar la instalación, YouTube y la importación **sin red ni descargas grandes en CI**.
6. Qué operaciones de la fuente pasan por las colas del gestor de trabajos (0014) y cuáles no.

## Alternativas consideradas
| Opción | Licencia | Pros | Contras |
|--------|----------|------|---------|
| **Requisitos: un archivo bloqueado por plataforma × perfil** generado con `uv pip compile` (con hashes) | — | Versiones exactas y reproducibles por perfil; se puede auditar el tamaño; `--require-hashes` | 6 archivos que regenerar al cambiar dependencias (con un script) |
| Requisitos: `uv.lock` único + `--torch-backend=auto` al instalar | — | Un solo archivo | No fija torch por perfil (cada índice publica otras versiones); instalación no reproducible |
| Requisitos: rangos sueltos (`audio-separator>=…`) | — | Trivial | Rompe el parche de audio-separator (0009) en cuanto salga una versión nueva |
| **Código del worker: carpeta empaquetada en `resources/worker` + `PYTHONPATH`** | — | Actualizar la app actualiza el worker sin reinstalar el venv; ya soportado por `resolverLanzador` | El venv debe tener las dependencias de esa versión (se comprueba con el marcador) |
| Código del worker instalado en el venv (`uv pip install ./worker`) | — | Imports estándar | Cada versión de la app obliga a reinstalar el paquete; dos copias del código |
| **Modelos: descarga en el proceso principal (Node `fetch` + `Range`)** | — | Progreso exacto en bytes, reanudable, SHA-256 en streaming, sin Python | Código propio de descarga (pequeño) |
| Modelos: que los descargue audio-separator la primera vez que separa | MIT | Nada que programar | Descarga a mitad de una separación; sin progreso fiable ni reanudación; deja `.partial`; no apto para el primer arranque |
| **Pruebas: puertos inyectables + escenario falso activado por variable de entorno solo sin empaquetar** | — | E2E deterministas y sin red; mismo patrón que `SHINOBI_PAPELERA_PRUEBAS` (0023) | Hay que mantener los dobles alineados con lo real (lo cubren pruebas opcionales con red) |
| Pruebas: instalar el runtime real en cada ejecución de CI | — | Prueba real | ≥ 300–450 MB por SO y ejecución, lento y frágil; dependiente de PyPI/YouTube |

## Decisión

### 1. Dependencias del worker y requisitos por perfil
- `worker/pyproject.toml`: dependencias base de la Fase 2 (`av`, `soundfile`, `numpy`, `pyloudnorm`, `yt-dlp[default]`, `deno`) y un *extra* `separacion` con `audio-separator[cpu]==0.48.0`, `torch`, `onnxruntime`, `audioread` (explícito, 0005). El entorno de desarrollo y la CI instalan solo la base (`uv sync`); el *extra* se instala bajo demanda (`uv sync --extra separacion`) en pruebas marcadas `pesado` y en la Fase 3.
- `worker/requisitos/<plataforma>-<perfil>.txt`, generados por `worker/scripts/compilar_requisitos.py` con `uv pip compile pyproject.toml --extra separacion --python-version 3.12 --python-platform <triple> --generate-hashes --emit-index-url` y el índice de PyTorch que corresponda (`--torch-backend cpu|cu128` o `--index-url` explícito). Combinaciones: `darwin-arm64-mps`, ~~`darwin-x64-cpu`~~ (retirada, ver Revisiones), `win32-x64-cpu`, `win32-x64-cuda`, `linux-x64-cpu`, `linux-x64-cuda`. Se versionan en git; la CI comprueba que están al día (el script en modo `--comprobar`).
- La instalación usa `uv pip install --python <venv> --require-hashes --index-strategy unsafe-best-match -r <requisitos>` (estrategia de índices: Revisiones; sin `--torch-backend=auto`: el perfil ya eligió el archivo). Se fijan también las dependencias transitivas problemáticas (`onnx-weekly`, 0005) mediante *overrides* en el script.

### 2. Manifiesto de runtime
`app/resources/runtime-manifest.json`, validado con Zod (`app/src/shared/manifiesto.ts`), mantenido a mano a partir de la tarea 0005 §9 y comprobado por un test:
- `version` (entero; sube con cualquier cambio de requisitos o modelos).
- `python`: versión exacta y bytes de descarga por plataforma.
- `runtime[plataforma][perfil]`: `requisitos` (ruta), `sha256_requisitos`, `bytes_descarga`, `bytes_disco`, `espacio_requerido` (~~CPU 3 GB~~ CPU 4 GB desde la revisión 2026-11-05, Apple Silicon 4 GB, NVIDIA 10 GB; sin detección 10 GB), `medido` (bool), `bytes_cache` (revisión 2026-11-05).
- `modelos[]`: `id` (`rapido` | `calidad`), `archivo`, `urls[]` (espejo de audio-separator primero, origen después), `bytes`, `sha256`, `extra[]` (yaml de Calidad), `licencia` (`"MIT"` | `"no declarada"`) y `provisional` (el Rápido, `preguntas/0012` opción C).
- `factores[perfil][modo]`: `[min, max]` o `null` (sin medir → estimación del ADR 0004 en `estimacion`).
- ~~Perfil → modelo inicial: `cuda`/`mps` → `calidad`, `cpu` → `rapido`.~~ Desde la revisión 2026-11-05: el modelo inicial es siempre `calidad`; `rapido` solo con consentimiento.

### 3. Directorio `runtime/` y aislamiento de uv
- `runtime/python/` (`UV_PYTHON_INSTALL_DIR`), `runtime/venv/`, `runtime/cache-uv/` (`UV_CACHE_DIR`, se vacía con `uv cache clean` al terminar), `runtime/instalado.json` (marcador). uv se ejecuta siempre con `--no-config`, `UV_PYTHON_PREFERENCE=only-managed`, `UV_NO_PROGRESS=1` y sin heredar `VIRTUAL_ENV`/`PYTHONPATH`/`UV_*` del usuario.
- Binario `uv`: empaquetado, `process.resourcesPath/bin/uv[.exe]` (lo coloca la tarea 0025); sin empaquetar, `SHINOBI_UV` o el PATH (como 0013).
- **Marcador** `runtime/instalado.json` = `{ manifiesto_version, plataforma (real, ver Revisiones), perfil, sha256_requisitos, python, fecha }`, escrito atómicamente (0007) al terminar la fase de componentes. Es la prueba de que el venv corresponde a esta versión de la app.

### 4. Modelos
- Descarga en main con `fetch` a `modelos/<archivo>.descarga` (reanudable con `Range` si el servidor responde 206; si no, desde cero), SHA-256 en streaming, `rename` al terminar. Tras un SHA incorrecto se borra y se reintenta **una vez** automáticamente; si vuelve a fallar → `VERIFICACION_FALLIDA`. Se prueban las `urls` en orden.
- `modelos/verificados.json`: `{ archivo: { bytes, sha256, mtimeMs } }` para no recalcular 913 MB en cada arranque; solo se recalcula si cambian tamaño o `mtime`, o al reutilizar tras recrear `config.json`.
- Limpieza: al arrancar y al cancelar se borran `modelos/*.partial` (restos de audio-separator). Los `*.descarga` propios **se conservan** (permiten "continuará donde lo dejó").

### 5. Código del worker en producción
`resolverLanzador` en modo `produccion` con `rutaCodigoWorker = process.resourcesPath/worker` (fuera del asar, tarea 0025) → `PYTHONPATH`. Además el lanzador antepone el directorio de scripts del venv al `PATH` del proceso hijo. El worker localiza Deno con el paquete PyPI y se lo pasa **explícitamente** a yt-dlp (`js_runtimes`), sin depender del PATH. Sin empaquetar se mantiene el modo desarrollo (`uv run --project worker`), también en E2E.

### 6. Estados de la instalación al arrancar
1. `config.instalacion.estado === "completa"` → **comprobación barata** (existe el intérprete del venv, el marcador coincide con el manifiesto actual, el modelo del perfil existe con su tamaño). Si falla → `dañada` (B5 "Hay que reparar…"); si el marcador es de otra versión del manifiesto → se repite solo la fase de componentes (mismo B5).
2. Estado distinto de `completa` **pero** marcador válido → **verificación completa** (diagnóstico + SHA-256 de los modelos presentes). Si pasa, se reconstruye `config.instalacion` y `separacion.modelos_descargados` y se marca `completa` sin reinstalar; si no, se instala desde la primera fase no válida.
3. Fases idempotentes: Python ya instalado, venv existente con el marcador correcto o modelo verificado se saltan.

### 7. Operaciones de la fuente y colas
- **Consultas interactivas** (sin canción todavía): `importar-archivo` en `.importando/<id>/` y `info-youtube`. Se ejecutan **fuera de las colas** con el cliente del worker (0013), cancelables, como máximo una de cada tipo a la vez (una nueva cancela la anterior). Motivo: la cola `ligera` puede estar ocupada por una descarga de 60 s y "Leyendo el audio…" no puede esperar detrás.
- **Descarga de YouTube**: un único trabajo `descargar-youtube` en la cola `ligera`, paso `fuente`, que descarga y después normaliza en el mismo proceso (fases `descargando` → `preparando`). Sustituye a la pareja `descargar-youtube` → `importar-archivo` de `arquitectura.md` §3 (un solo trabajo = una sola cancelación y un solo estado del paso).
- **Actualizar yt-dlp**: ~~trabajo interno de la cola `ligera` sin canción~~ → operación de `main/runtime/ytdlp.ts` protegida por un **cerrojo lectores/escritor** (revisión 2026-11-04 tras `preguntas/0014`; ver Revisiones). El gestor de 0014 no necesita trabajos sin `cancionId`.

### 8. Dobles de prueba y pruebas con red
- El gestor de runtime depende de **puertos**: `EjecutorUv`, `Diagnosticador`, `DescargadorModelos`, `EspacioLibre`, `DetectorGpu`. En E2E, `SHINOBI_RUNTIME_FALSO=<escenario.json>` sustituye los cinco por dobles que siguen el escenario (duración, bytes, fallo en una fase, perfil rebajado, espacio libre). Se ignora si `app.isPackaged`.
- El worker tiene un adaptador `FuenteYoutube` (real: yt-dlp). Con `SHINOBI_YTDLP_FALSO=<dir>` usa un doble que lee `info.json` y genera el audio "descargado" con PyAV; solo lo honra si lo recibe del main, y el main solo lo pasa sin empaquetar.
- `SHINOBI_MANIFIESTO` (ruta alternativa del manifiesto) y `SHINOBI_TESTS_RED=1` siguen la misma regla.
- **Marcadores de pytest**: `red` (necesita Internet) y `pesado` (necesita el *extra* `separacion` o descargas > 50 MB); por defecto `-m "not red and not pesado"`. En Vitest, `describe.skipIf(!process.env.SHINOBI_TESTS_RED)`. La CI normal no ejecuta ninguno de los dos; un workflow manual (`workflow_dispatch`) instala el runtime real en los 3 SO.
- **Audio de prueba**: generado en las propias pruebas (tonos, ruido, silencio con numpy/PyAV o un WAV escrito por Node) o de dominio público ya documentado (0005). No se versionan archivos de audio de terceros con copyright.

## Consecuencias
- Positivas: instalación reproducible por perfil; actualizaciones de la app sin reinstalar el venv salvo que cambien los requisitos; descarga de modelos reanudable y verificada; CI sin red ni GB de descargas; una instalación existente se reaprovecha.
- Negativas / riesgos: hay que regenerar los 6 archivos de requisitos al tocar dependencias (script + comprobación en CI); los dobles pueden divergir del comportamiento real (mitigación: pruebas `red` manuales y el workflow de instalación real); `uv pip compile` para plataformas cruzadas puede no resolver alguna wheel (p. ej. `diffq` sin wheel compila desde sdist, 0005): el script debe fallar con un mensaje claro.
- Impacto en UX: habilita B0–B6 de `ux/01`. La reutilización tras recrear `config.json` añade una comprobación de unos segundos (B0, `preguntas/0013` §3).

## Revisiones
- 2026-11-05 (respuesta a [`preguntas/0018`](../preguntas/0018-datos-reales-del-runtime-y-espacio-en-linux.md), datos de la primera ejecución de `runtime-real`, tarea 0040):
  1. **Modelo**: el gestor descarga siempre **Calidad**. `modeloDelPerfil` desaparece (constante `MODELO_POR_DEFECTO = 'calidad'`). Rápido solo se descarga mediante una petición explícita del renderer, con `config.separacion.rapido_aceptado` ya guardado; sin él, main responde con error y no descarga (ADR 0004, Revisiones). La comprobación barata de §6 exige el modelo **del modo vigente** (Calidad, o Rápido si el usuario lo eligió con consentimiento), no el del perfil.
  2. **Instalación completa con Rápido**: si la fase de modelo falla de forma definitiva con Calidad y el usuario acepta Rápido, la fase se completa con Rápido. `config.instalacion` queda `completa` y `separacion.modo = 'rapido'`. Desde Ajustes ("Volver a Calidad") se puede descargar Calidad de nuevo; Ajustes no permite elegir Rápido.
  3. **`espacio_requerido`**: `win32-x64.cpu` y `linux-x64.cpu` pasan a **4 GB**; Apple Silicon sigue en 4 GB y NVIDIA en 10 GB.
     - **Pico en el peor caso** (Linux CPU, caché y venv sin compartir bloques): 3,35 GB en la fase de componentes (Python 0,10 + venv 1,62 + caché 1,62). La fase de modelo empieza tras `uv cache clean` y llega a 2,64 GB.
     - **Pico real**: uv enlaza la caché con el venv mediante enlaces duros (Linux y Windows) o clonación (APFS). Ambos están dentro de `runtime/`, así que el pico real es menor.
     - **Modo de enlace de uv**: no se cambia.
     - **Medición pendiente** (tarea 0058): `runtime-real` mide el pico muestreando el espacio libre. Criterio: pico + 0,5 GB ≤ `espacio_requerido`.
  4. **`bytes_disco`** = tamaño del venv (sin Python ni modelos), medido: Windows CPU 1 165 000 000, Linux CPU 1 619 000 000, macOS 1 205 000 000. `medido: true` exige también `bytes_descarga` medido.
  5. **`bytes_descarga`** = suma del tamaño de las ruedas de cada archivo de requisitos. Se obtiene de los índices (API JSON de PyPI / HEAD en el índice de PyTorch) eligiendo la rueda de la plataforma entre los hashes. Se contrasta con el tráfico de red de `runtime-real`. La caché de uv (descomprimida) no sirve para este valor.
  6. **Nuevo campo `bytes_cache`** por plataforma y perfil (opcional; `null` → se usa `bytes_descarga`): tamaño de la caché de uv al terminar la instalación (medido: 1 204 / 1 163 / 1 625 MB en macOS / Windows / Linux CPU). Es el denominador del progreso de "Instalando componentes", que mide el crecimiento de la caché. Hoy ese progreso compara bytes descomprimidos con `bytes_descarga` y se queda en el 99 % durante la mayor parte de la fase. No se muestra al usuario.
  7. La `version` del manifiesto no sube con estos cambios (no cambian requisitos ni modelos).
- 2026-11-04 (respuesta a [`preguntas/0014`](../preguntas/0014-interrupcion-de-la-actualizacion-de-yt-dlp-y-plataformas-emuladas.md)):
  1. **yt-dlp y exclusión mutua**:
     - `actualizarYtDlp()` es la única forma de tocar yt-dlp/Deno en el venv (semanal, tras bloqueo, reparación). Las llamadas concurrentes reciben la misma promesa.
     - Un cerrojo lectores/escritor con prioridad al escritor serializa la actualización frente a `info-youtube` y `descargar-youtube`:
       - una actualización espera a los procesos de yt-dlp en marcha;
       - mientras está pendiente o en curso, no arranca ninguno nuevo;
       - la consulta que espera emite `actualizando`, y la descarga que espera sigue `en cola` con `motivo: 'mantenimiento'`.
     - Sustituye al trabajo interno sin canción de §7.
  2. **Interrupción de la actualización**:
     - Cancelar la operación que la provocó no la aborta. Tiene un límite de 5 min.
     - Al cerrar la app, el proceso principal espera ≤ 10 s y luego mata el árbol de procesos.
     - `runtime/ytdlp-actualizando.json` se escribe antes de lanzar uv y se borra solo si uv sale con código 0. Si existe al arrancar, se repara enseguida con `--reinstall-package yt-dlp --reinstall-package yt-dlp-ejs --reinstall-package deno`. yt-dlp nunca provoca `dañada`/B5.
  3. **Plataforma real**:
     - `process.platform` + `arm64` si `app.runningUnderARM64Translation`; si no, `process.arch`. Se usa para el manifiesto, el marcador y los textos.
     - Windows arm64 emulado → sin entrada en el manifiesto → B6.
     - Mac Apple Silicon con el build x64 (Rosetta) → perfil `darwin-arm64-mps` con Python aarch64 pedido explícitamente a uv. El worker se ejecuta nativo.
     - uv recibe siempre la arquitectura explícita (`cpython-<versión>-<so>-<arq>-none`).
  4. **Sustitución de la fuente** de una canción sin audio (`pendiente`/`error`/`interrumpido`, sin trabajo vivo, sin `mezcla.flac`): ver ADR 0006, Revisiones.
- 2026-11-04 (tarea 0030 y respuesta a [`preguntas/0015`](../preguntas/0015-macos-intel-sin-pytorch-y-macos-minimo.md)):
  1. **Combinaciones de §1: 5**, sin `darwin-x64-cpu` (no resuelve: torch ≥ 2.3 sin ruedas macOS x86_64). Sin entrada `darwin-x64` en el manifiesto → `PLATAFORMA_NO_SOPORTADA` → B6. Si el usuario eligiera soportar Intel solo en Rápido (`preguntas/0016`, opción B), se añadiría un perfil con requisitos propios sin torch en un ADR nuevo.
  2. `darwin-arm64-mps` se resuelve con `--universal` y `[tool.uv] environments` (macOS arm64, Python 3.12), porque `--python-platform aarch64-apple-darwin` supone macOS 13 y torch/onnxruntime/av solo publican `macosx_14_0_arm64`. Las líneas llevan marcadores de entorno que uv evalúa al instalar.
  3. `--emit-index-url` no emite el índice de `--torch-backend`: los archivos llevan `--extra-index-url https://download.pytorch.org/whl/<cpu|cu128>` y la instalación de §1 **debe** añadir `--index-strategy unsafe-best-match` (con el valor por defecto uv tomaría todos los paquetes del primer índice que los tenga). `--require-hashes` mitiga la confusión de dependencias.
  4. **macOS mínimo 14 en Apple Silicon**: la plataforma real `darwin-arm64` solo es soportada si `process.getSystemVersion()` ≥ 14; si no → B6 (textos en [`preguntas/0017`](../preguntas/0017-textos-de-requisitos-macos-14-y-mac-intel.md)). Bajo Rosetta solo se llega con un build x64, que no se publica (tarea 0025: solo DMG arm64); la regla de Rosetta de la revisión anterior se mantiene por defensa.
- 2026-11-06 (Fase 6, tareas 0124 y 0125; detectado en desarrollo el 2026-11-06): **motor incompleto descubierto al usarlo**. La comprobación barata de cada arranque (venv, marcador, modelo) no ve un entorno al que le falta un paquete (p. ej. `No module named 'audio_separator'`), y hasta ahora el worker lo devolvía como `ERROR_INTERNO` ("Algo salió mal").
  1. El worker traduce un `ImportError` al crear el separador real a `RUNTIME_NO_DISPONIBLE` (no reintentable), con el módulo que falta en el mensaje.
  2. El servicio de separación, al terminar un trabajo con ese código, llama a `runtime.marcarDanada('componentes')`: solo si la instalación está `completa`, pasa a `dañada` con `fases.componentes = 'pendiente'`, borra el marcador `runtime/instalado.json` y anota `instalacion.reinstalar_componentes = true` (campo nuevo, por defecto `false`).
  3. "Reparar" es el B5 existente. Con `reinstalar_componentes`, la fase de componentes añade `--reinstall` a `uv pip install` (sin él, uv da por instalado un paquete cuya metadata sigue en el venv). El campo vuelve a `false` cuando la fase termina bien. La reparación vuelve a descargar los componentes (≈ 2–3 GB): es un caso raro y el usuario la pide.
  4. La interfaz muestra el error con la acción "Reparar el motor de audio", que abre Primer arranque en B5. Textos: pregunta 0032 (diseñador UX).

## Fuentes
- Electron `app.runningUnderARM64Translation` (Rosetta y emulación x64 de Windows on ARM): https://www.electronjs.org/docs/latest/api/app#apprunningunderarm64translation-readonly-macos-windows
- Peticiones de Python con arquitectura en uv (`cpython-3.12-macos-aarch64-none`): https://docs.astral.sh/uv/concepts/python-versions/#requesting-a-version
- uv — `pip compile` (`--python-platform`, `--generate-hashes`, `--emit-index-url`), variables `UV_CACHE_DIR`, `UV_PYTHON_INSTALL_DIR`: https://docs.astral.sh/uv/reference/cli/#uv-pip-compile , https://docs.astral.sh/uv/reference/environment/
- uv y PyTorch (`--torch-backend`, índices por backend): https://docs.astral.sh/uv/guides/integration/pytorch/
- HTTP Range requests (MDN): https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests
- yt-dlp EJS y runtimes JS (`--js-runtimes`): https://github.com/yt-dlp/yt-dlp/wiki/EJS
- Deno en PyPI: https://pypi.org/project/deno/
- Datos medidos: [tarea 0005](../tareas/0005-spike-separacion-y-runtime.md) §1, §4, §8, §9.
