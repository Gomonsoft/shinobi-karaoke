# 0004 — Integración continua en Windows, macOS y Linux
- Estado: Pendiente
- Paso del pipeline: 0
- Depende de: 0002, 0003
- ADRs: 0001, 0007
- Spec UX: —

## Objetivo
Que cada *push* y *pull request* verifique lint, tipos y tests de la app y del worker en los tres sistemas operativos.

## Criterios de aceptación
- [ ] Workflow de GitHub Actions con matriz `windows-latest`, `macos-latest` (arm64), `ubuntu-latest`.
- [ ] Trabajo `app`: `npm ci`, `lint`, `typecheck`, `test` (Vitest). La prueba E2E de Playwright se ejecuta al menos en Linux (con `xvfb-run`).
- [ ] Trabajo `worker`: instala uv con la acción oficial, `uv sync`, `uv run ruff check`, `uv run ruff format --check`, `uv run pytest`.
- [ ] Caché de `~/.npm` y de uv.
- [ ] El workflow pasa en verde sobre el estado del repositorio tras 0002 y 0003.
- [ ] Insignia del estado de CI en el `README.md` raíz.

## Notas de implementación
(las rellena el programador al terminar)
