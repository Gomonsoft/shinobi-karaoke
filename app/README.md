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

## Cliente del worker (`src/main/trabajos/worker.ts`)

En desarrollo el worker se lanza con `uv run --project <repo>/worker python -m shinobi_worker`. `uv` se busca en este orden: opción `uv` de `resolverLanzador`, variable de entorno `SHINOBI_UV` (ruta al ejecutable) y `uv` del PATH. La versión de `uv` fijada es la **0.13.7** (única fuente: `UV_VERSION` en `.github/workflows/ci.yml`; es la que generó `worker/uv.lock`). Los tests de integración con el comando `demo` se omiten si no se encuentra `uv` (en CI nunca se omiten: el trabajo `app` instala `uv` y ejecuta `uv sync --locked` en `worker/`); con un `uv` fuera del PATH: `SHINOBI_UV=/ruta/a/uv npm test`.

## Gestor de trabajos (`src/main/trabajos/gestor.ts`)

Dos colas independientes (`pesada` y `ligera`, concurrencia 1 cada una) que lanzan comandos del worker, reflejan el estado en `pasos.<paso>` de la canción y avisan al renderer (`window.shinobi.trabajos`). Para verlo a mano: `npm run dev` y menú **Desarrollo → Lanzar demo** (varias veces para ver la cola). Al cerrar la app se cancelan todos los trabajos sin dejar procesos hijos.
