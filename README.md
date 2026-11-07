# 🥷🎤 Shinobi Karaoke

[![CI](https://github.com/Gomonsoft/shinobi-karaoke/actions/workflows/ci.yml/badge.svg)](https://github.com/Gomonsoft/shinobi-karaoke/actions/workflows/ci.yml)

Software **libre y gratuito** para convertir tus canciones en karaokes.

1. **Añade una canción** desde un archivo o YouTube.
2. **Separa** la voz del instrumental automáticamente.
3. **Obtén la letra** y sincronízala.
4. **Personaliza** fondo, color y fuente de la letra.
5. **Canta** a pantalla completa.

> Estado: en desarrollo temprano. Consulta la documentación en [`docs/`](docs/README.md).

## Descargar

**Todavía no hay ninguna versión publicada.** Shinobi Karaoke sigue en desarrollo y aún no tiene instaladores. Cuando publiquemos la primera versión, los enlaces de descarga aparecerán aquí.

**Requisitos:** Windows 10/11 de 64 bits, Mac con chip Apple y macOS 14 o posterior, o Linux de 64 bits · 8 GB de RAM · entre 4 y 10 GB libres según tu equipo (más unos 100 MB por canción) · conexión a internet la primera vez

Los Mac con procesador Intel no son compatibles por ahora. Tampoco los equipos con procesador ARM que usan Windows o Linux.

Si quieres saber cómo será la instalación, lee la [guía de instalación](INSTALAR.md).

## Requisitos del equipo

| | Mínimo | Recomendado |
|---|---|---|
| **Sistema** | Windows 10/11 (x64) · macOS 14 Sonoma o posterior con chip Apple (M1 o superior) · Linux x64 (glibc) | El mismo, actualizado |
| **Procesador / gráfica** | Cualquier CPU x64 o chip Apple | Chip Apple, o tarjeta **NVIDIA con ≥ 4 GB de VRAM** (acelera la separación) |
| **Memoria (RAM)** | 8 GB | 16 GB |
| **Espacio libre** | **4 GB** para el motor de separación + ~100 MB por canción | 10 GB (necesario con NVIDIA) |
| **Conexión** | Solo en el primer arranque (descarga entre 1 y 6 GB según tu equipo) y para YouTube/letras | — |

- **No compatibles**: Mac con procesador Intel y Windows en ARM.
- **Modelo de separación**: se usa siempre el modelo de **Calidad**. Si no se puede descargar o usar en tu equipo, la app te ofrece el modelo **Rápido** (más ligero), bajo tu responsabilidad: su licencia aún no está declarada por sus autores.
- **Tiempo de separación** con el modelo de Calidad en CPU: ~1,1–1,3 min por minuto de canción (medido en un MacBook Air M1 de 8 GB; una canción de 4 min ≈ 5 min). En otros equipos sin tarjeta gráfica aún no está medido; con NVIDIA será bastante menor.
- El pico de memoria medido al separar con Calidad es de ~3,2 GB.

## Licencia

GPL-3.0-or-later. Ver [`LICENSE`](LICENSE) y [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Desarrollo

Estructura: `app/` (Electron + TypeScript), `worker/` (Python), `spikes/` (pruebas de concepto), `.github/workflows/` (CI).

- **App**: Node 24 (`app/.nvmrc`). Desde `app/`: `npm install`, y después `npm run dev` (arranca con datos en `app/.datos-dev/`), `npm run build`, `npm run lint`, `npm run format`, `npm run typecheck`, `npm test` y `npm run test:e2e` (prueba de humo Playwright). Más detalle en `app/README.md`.
- **Worker**: desde `worker/`, `uv sync`, `uv run pytest`, `uv run ruff check` y `uv run ruff format --check`. Prueba manual: `uv run python -m shinobi_worker demo --args '{"segundos": 3}'` (ver `worker/README.md`).

Requisitos previstos: Node.js LTS, [uv](https://docs.astral.sh/uv/). Detalles en [`docs/arquitectura.md`](docs/arquitectura.md) y [`docs/adr/0007-herramientas-de-desarrollo-y-calidad.md`](docs/adr/0007-herramientas-de-desarrollo-y-calidad.md).
