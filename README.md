# 🥷🎤 Shinobi Karaoke

[![CI](https://github.com/Gomonsoft/shinobi-karaoke/actions/workflows/ci.yml/badge.svg)](https://github.com/Gomonsoft/shinobi-karaoke/actions/workflows/ci.yml)

Software **libre y gratuito** para convertir tus canciones en karaokes.

1. **Añade una canción** desde un archivo o YouTube.
2. **Separa** la voz del instrumental automáticamente.
3. **Obtén la letra** y sincronízala.
4. **Personaliza** fondo, color y fuente de la letra.
5. **Canta** a pantalla completa.

> Estado: en desarrollo temprano. Consulta la documentación en [`docs/`](docs/README.md).

## Licencia

GPL-3.0-or-later. Ver [`LICENSE`](LICENSE) y [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Desarrollo

Estructura: `app/` (Electron + TypeScript), `worker/` (Python), `spikes/` (pruebas de concepto), `.github/workflows/` (CI).

- **App**: Node 24 (`app/.nvmrc`). Desde `app/`: `npm install`, y después `npm run dev` (arranca con datos en `app/.datos-dev/`), `npm run build`, `npm run lint`, `npm run format`, `npm run typecheck`, `npm test` y `npm run test:e2e` (prueba de humo Playwright). Más detalle en `app/README.md`.
- **Worker**: desde `worker/`, `uv sync`, `uv run pytest`, `uv run ruff check` y `uv run ruff format --check`. Prueba manual: `uv run python -m shinobi_worker demo --args '{"segundos": 3}'` (ver `worker/README.md`).

Requisitos previstos: Node.js LTS, [uv](https://docs.astral.sh/uv/). Detalles en [`docs/arquitectura.md`](docs/arquitectura.md) y [`docs/adr/0007-herramientas-de-desarrollo-y-calidad.md`](docs/adr/0007-herramientas-de-desarrollo-y-calidad.md).
