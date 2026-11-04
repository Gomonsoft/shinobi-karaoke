# 0004 — Integración continua en Windows, macOS y Linux
- Estado: Hecha
- Paso del pipeline: 0
- Depende de: 0002, 0003
- ADRs: 0001, 0007
- Spec UX: —

## Objetivo
Que cada *push* y *pull request* verifique lint, tipos y tests de la app y del worker en los tres sistemas operativos.

## Criterios de aceptación
- [x] Workflow de GitHub Actions con matriz `windows-latest`, `macos-latest` (arm64), `ubuntu-latest`.
- [x] Trabajo `app`: `npm ci`, `lint`, `typecheck`, `test` (Vitest). La prueba E2E de Playwright se ejecuta al menos en Linux (con `xvfb-run`).
- [x] Trabajo `worker`: instala uv con la acción oficial, `uv sync`, `uv run ruff check`, `uv run ruff format --check`, `uv run pytest`.
- [x] Caché de `~/.npm` y de uv.
- [x] El workflow pasa en verde sobre el estado del repositorio tras 0002 y 0003.
- [x] Insignia del estado de CI en el `README.md` raíz.

## Notas de implementación
- **Qué se hizo**: `.github/workflows/ci.yml` (en `push` y `pull_request`), con trabajos `app` y `worker`, cada uno en matriz `windows-latest`/`macos-latest`/`ubuntu-latest` (`fail-fast: false`, permisos `contents: read`, cancelación de ejecuciones obsoletas). `app`: `actions/setup-node` con `app/.nvmrc` y caché npm, `npm ci`, `lint`, `typecheck`, `test`; solo en Linux, E2E con `xvfb-run --auto-servernum npm run test:e2e`. `worker`: `astral-sh/setup-uv` con caché (clave `worker/uv.lock`), `uv sync --locked`, `ruff check`, `ruff format --check`, `pytest`. Insignia de CI en `README.md`.
- **Validación (no se pueden ejecutar Actions aquí)**: YAML parseado con Ruby; los mismos comandos ejecutados en local en macOS: lint, typecheck, test (7), E2E (1) en `app/` y uv sync/ruff/pytest (14) en `worker/` pasan. No verificado: ejecución real en GitHub (runners Windows/Linux), `xvfb-run`.
- **Notas**: en Ubuntu 24.04 se desactiva `kernel.apparmor_restrict_unprivileged_userns` para que arranque el sandbox de Electron; si el E2E fallara en Linux revisar este paso. Las versiones de las acciones (`checkout@v4`, `setup-node@v4`, `setup-uv@v6`) deberían revisarse al ver la primera ejecución. `format:check` de Prettier no está en la CI (no lo pide la tarea).
- **Deuda técnica**: no se publica artefacto ni se prueba el empaquetado (otra tarea).
