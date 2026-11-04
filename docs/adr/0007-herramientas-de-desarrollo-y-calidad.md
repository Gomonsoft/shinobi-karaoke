# 0007 — Herramientas de desarrollo y calidad: npm + Vitest + ESLint/Prettier + Zod (app) y uv + pytest + ruff (worker)

- Estado: Aceptado
- Fecha: 2026-11-03
- Paso del pipeline: 0 (transversal)

## Contexto
La Fase 1 crea el esqueleto del repositorio (`app/` Electron + `worker/` Python, ADR 0001). La regla del proyecto es no usar tecnologías fuera de los ADRs aceptados, así que el programador necesita una lista cerrada de herramientas de desarrollo, pruebas, validación de datos y UI base. Criterios: licencias libres compatibles con GPL-3.0 (ADR 0002), mínimo número de piezas, que funcionen igual en Windows, macOS y Linux, y que no añadan dependencias nativas que haya que recompilar para Electron.

## Alternativas consideradas
| Opción | Licencia | Pros | Contras |
|--------|----------|------|---------|
| **Gestor de paquetes JS: npm** | Artistic-2.0 | Viene con Node; cero instalación extra; lo soporta electron-builder sin ajustes. | Algo más lento que pnpm. |
| pnpm / Yarn | MIT / BSD-2 | Más rápidos, *workspaces*. | Pieza adicional; el enlazado de pnpm da problemas conocidos con electron-builder. Solo hay un paquete JS: los *workspaces* no aportan. |
| **Tests JS: Vitest** (+ Testing Library) | MIT | Integrado con Vite/electron-vite; misma configuración de TS. | — |
| Jest | MIT | Muy conocido. | Configuración extra para ESM/TS con Vite. |
| **E2E: Playwright (`_electron`)** | Apache-2.0 | Lanza la app Electron real y la controla; capturas. | Descarga de navegadores no necesaria para Electron, pero el paquete es grande (solo desarrollo). |
| Spectron / WebdriverIO | MIT | — | Spectron abandonado; WebdriverIO más pesado de configurar. |
| **Validación de esquemas: Zod** | MIT | Tipos TS inferidos del esquema (una sola fuente de verdad para `cancion.json`, `config.json`, contratos IPC y JSON Lines); mensajes de error legibles. | ~60 KB; no es JSON Schema estándar. |
| Ajv + JSON Schema | MIT | Estándar, rápido. | Tipos TS duplicados o generados; más ceremonia. |
| **Lint/formato JS: ESLint (typescript-eslint) + Prettier** | MIT | Estándar de facto. | Dos herramientas. |
| Biome | MIT | Una sola herramienta, rápida. | Reglas de React/hooks y accesibilidad menos completas que `eslint-plugin-react-hooks` + `eslint-plugin-jsx-a11y`. |
| **Python: uv + pytest + ruff** | Apache-2.0/MIT, MIT, MIT | uv ya es el gestor del runtime (ADR 0001); ruff hace lint y formato. | — |
| Poetry / black + flake8 | MIT | Conocidos. | Duplican lo que hace uv / ruff. |

## Decisión

### App (`app/`)
- **Node**: la versión LTS que coincida con la del Electron usado (fijada en `.nvmrc` / `engines`). **npm** con `package-lock.json`.
- **Build**: electron-vite + electron-builder (ADR 0001). TypeScript en modo `strict`.
- **UI**: React. **Sin librería de rutas ni de estado global** en el MVP: la navegación entre vistas es un estado propio (unión discriminada `{ vista: 'biblioteca' } | { vista: 'cancion', id, paso } | …`) y el estado remoto se suscribe a eventos IPC con `useSyncExternalStore`. Estilos con **CSS plano + variables CSS** (tokens de `docs/ux/sistema-visual.md`) y CSS Modules de Vite; sin framework CSS.
- **Iconos**: `lucide-react` (ISC), como pide el sistema visual.
- **Validación**: **Zod** en `app/src/shared/` para `cancion.json`, `config.json`, argumentos de IPC y mensajes JSON Lines del worker.
- **Pruebas**: Vitest (unitarias de `shared/` y `main/`, entorno `node`; componentes con `@testing-library/react` + `jsdom`), Playwright `_electron` para una prueba de humo E2E.
- **Calidad**: ESLint (typescript-eslint, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`) + Prettier. `tsc --noEmit` como comprobación de tipos.
- **Procesos**: para matar árboles de procesos se usa `taskkill /T /F` en Windows y señales al grupo de procesos (`detached` + `process.kill(-pid)`) en macOS/Linux, sin dependencia externa.

### Worker (`worker/`)
- **uv** con `pyproject.toml` + `uv.lock`, Python 3.12.
- **pytest** para pruebas; **ruff** para lint y formato.
- Dependencias de producción: las de ADR 0001/0003/0004 (`av`, `soundfile`, `pyloudnorm`, `yt-dlp[default]`, `deno`, `audio-separator`). En la Fase 1 el paquete solo necesita la biblioteca estándar; las dependencias pesadas se añaden en las fases 2–3.

### Repositorio
- Scripts de `app/package.json`: `dev`, `build`, `lint`, `format`, `typecheck`, `test`, `test:e2e`, `semilla` (crea una biblioteca de ejemplo en un directorio de datos de desarrollo).
- Directorio de datos de **desarrollo** separado del real: variable de entorno `SHINOBI_DATOS` (si existe, sustituye a la ruta por SO de ADR 0006); en `npm run dev` apunta por defecto a `app/.datos-dev/` (ignorado por git).
- **CI**: GitHub Actions con matriz Windows / macOS / Linux: `lint`, `typecheck`, `test` de la app y `ruff check` + `pytest` del worker.
- Cada dependencia nueva se añade a `THIRD_PARTY_NOTICES.md` si se distribuye con la app.

## Consecuencias
- Positivas: herramientas estándar, todas MIT/ISC/Apache; una sola fuente de verdad para los esquemas (Zod) compartida por main, preload y renderer; CI en los tres SO desde el principio.
- Negativas / riesgos: sin enrutador ni gestor de estado, habrá que mantener disciplina en la navegación propia (es pequeña: 8 vistas). Zod añade peso al renderer (irrelevante en Electron).
- Impacto en UX: ninguno directo.

## Fuentes
- Vitest: https://vitest.dev/ · Testing Library: https://testing-library.com/
- Playwright y Electron: https://playwright.dev/docs/api/class-electron
- Zod: https://zod.dev/
- typescript-eslint: https://typescript-eslint.io/ · eslint-plugin-jsx-a11y: https://github.com/jsx-eslint/eslint-plugin-jsx-a11y
- Lucide (ISC): https://lucide.dev/license
- uv: https://docs.astral.sh/uv/ · ruff: https://docs.astral.sh/ruff/ · pytest: https://docs.pytest.org/
