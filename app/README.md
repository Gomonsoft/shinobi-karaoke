# app

Aplicación Electron + React + TypeScript (electron-vite). Ver `docs/arquitectura.md` §5 y ADR 0001/0007.

Requisitos: Node 24 (`.nvmrc`) y npm. Desde esta carpeta: `npm install`.

| Comando                  | Qué hace                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`            | Arranca la app con recarga en caliente; usa `SHINOBI_DATOS=.datos-dev` (ignorado por git)                                                                                      |
| `npm run semilla`        | Crea en `.datos-dev/` una biblioteca de ejemplo (fixtures: listas, borradores, error, dañadas) y `config.json` con instalación completa; idempotente, `-- --limpiar` la recrea |
| `npm run build`          | Compila main / preload / renderer en `out/`                                                                                                                                    |
| `npm run lint`           | ESLint (typescript-eslint, react-hooks, jsx-a11y)                                                                                                                              |
| `npm run format`         | Prettier (`format:check` solo comprueba)                                                                                                                                       |
| `npm run typecheck`      | `tsc --noEmit` (main/preload/shared y renderer)                                                                                                                                |
| `npm test`               | Vitest (node para `shared`/`main`, jsdom para el renderer)                                                                                                                     |
| `npm run test:cobertura` | Vitest con cobertura de `src/shared` (objetivo ≥ 90 %)                                                                                                                         |
| `npm run test:e2e`       | Compila y ejecuta la prueba de humo Playwright `_electron`                                                                                                                     |

`SHINOBI_DATOS` sustituye al directorio de datos por SO (ADR 0006). Al arrancar, la app crea ahí `biblioteca/`, `modelos/`, `registros/`, `runtime/` y `config.json` (registro de la app en `registros/app.log`).

`SHINOBI_PAPELERA_PRUEBAS` (solo pruebas E2E; se ignora en la app empaquetada): con una ruta de directorio, «Eliminar» mueve la carpeta de la canción a `<ruta>/<nombre>-<marca de tiempo>` en lugar de a la papelera del sistema; con el valor `fallar`, la papelera rechaza (para probar el toast de error). Los E2E de acciones la usan siempre.

`SHINOBI_DIALOGO_PRUEBAS` (solo pruebas E2E; se ignora en la app empaquetada): sustituye el selector nativo de «Elegir archivo…». Su valor es la ruta que «elige» el usuario, o `cancelar` para simular que cancela. Lo usa `e2e/importar-archivo.spec.ts` (necesita `uv` con el worker sincronizado; el audio se genera en el propio test).

`SHINOBI_RUNTIME_FALSO=<escenario.json>` (solo pruebas E2E; se ignora empaquetada, ADR 0009 §8): sustituye uv, el diagnóstico, la descarga de modelos, el espacio libre y la detección de GPU del gestor de runtime por dobles que siguen el escenario (plataforma y GPU simuladas, espacio libre, duración de cada fase, fallo con un código una vez o siempre, rebaja de perfil, modelos reales —archivos dispersos— o diminutos). El esquema (Zod) y un ejemplo están documentados en `src/main/runtime/falso/escenario.ts`; los dobles anotan cada llamada en `llamadas.jsonl` junto al escenario. Se combina con `SHINOBI_LANZADOR=produccion`, que activa la comprobación del runtime al arrancar. Lo usa `e2e/primer-arranque.spec.ts` (sin red ni descargas).

`SHINOBI_YTDLP_FALSO=<dir>` (solo pruebas; se ignora empaquetada): el worker usa un doble de yt-dlp que lee `<dir>/<id>.json` (y la miniatura `<id>.jpg`) y genera el audio "descargado". `SHINOBI_YTDLP_ACTUALIZAR_MS=<ms>` alarga la actualización simulada de yt-dlp. Los usa `e2e/importar-youtube.spec.ts` con una copia temporal de `e2e/fixtures/youtube/` (sin red). La prueba con red `e2e/youtube-red.spec.ts` solo se ejecuta con `SHINOBI_TESTS_RED=1` (descarga un vídeo CC BY real).

Prueba opcional con LRCLIB real (0089), solo con `SHINOBI_TESTS_RED=1` y nunca en push/PR: `SHINOBI_TESTS_RED=1 npx vitest run lrclib.red` (contrato del cliente: `get`, `search` y 404; 3 peticiones en serie con el `User-Agent` del proyecto y 250 ms entre ellas) y `npm run build && SHINOBI_TESTS_RED=1 npx playwright test letras-red` (búsqueda automática real y «Usar esta letra» → `origen: lrclib`; sin `SHINOBI_LRCLIB_URL`). Solo se comprueba la estructura: las letras recibidas no se guardan. Se ejecutan también como pasos opcionales (`continue-on-error`) del workflow manual `runtime-real`.

`SHINOBI_SEPARADOR_FALSO=<escenario.json>` (solo pruebas; se ignora empaquetada): el comando `separar` del worker usa un doble que sigue el escenario (duración, pasos, fallos por dispositivo/bloques/intento, muerte por SIGKILL). El main pasa además `SHINOBI_INTENTO=<n>`. Esquema Zod y ejemplo en `src/shared/separacion.ts`; lo implementa la tarea 0060.

`SHINOBI_LRCLIB_URL=<url>` (solo pruebas; se ignora empaquetada y el main la borra del entorno): sustituye la URL base de LRCLIB (`https://lrclib.net`). Solo admite `http://127.0.0.1:<puerto>` (servidor falso local) y `http://lrclib.invalid` (para probar `SIN_CONEXION`); cualquier otro valor se descarta. Constante y función en `src/shared/letrasBusqueda.ts`; la usa el cliente de LRCLIB (0081) y los E2E (0088). Los fixtures con letras inventadas están en `src/shared/__fixtures__/letras/`.

## Cliente del worker (`src/main/trabajos/worker.ts`)

En desarrollo el worker se lanza con `uv run --project <repo>/worker python -m shinobi_worker`. `uv` se busca en este orden: opción `uv` de `resolverLanzador`, variable de entorno `SHINOBI_UV` (ruta al ejecutable) y `uv` del PATH. La versión de `uv` fijada es la **0.13.7** (única fuente: `UV_VERSION` en `.github/workflows/ci.yml`; es la que generó `worker/uv.lock`). Los tests de integración con el comando `demo` se omiten si no se encuentra `uv` (en CI nunca se omiten: el trabajo `app` instala `uv` y ejecuta `uv sync --locked` en `worker/`); con un `uv` fuera del PATH: `SHINOBI_UV=/ruta/a/uv npm test`.

## Gestor de trabajos (`src/main/trabajos/gestor.ts`)

Dos colas independientes (`pesada` y `ligera`, concurrencia 1 cada una) que lanzan comandos del worker, reflejan el estado en `pasos.<paso>` de la canción y avisan al renderer (`window.shinobi.trabajos`). Para verlo a mano: `npm run dev` y menú **Desarrollo → Lanzar demo** (varias veces para ver la cola). Al cerrar la app se cancelan todos los trabajos sin dejar procesos hijos.

## Instalación real del runtime (manual, con red)

El workflow `.github/workflows/runtime-real.yml` (solo `workflow_dispatch`) instala el runtime real en Windows, macOS y Linux con `scripts/instalar-runtime.mjs` y publica un JSON con tamaños, duraciones y versiones. Para probarlo en local (descarga PyTorch y el modelo): `SHINOBI_DATOS=/tmp/datos-real node --experimental-transform-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/instalar-runtime.mjs --salida runtime-real.json`.
