# Shinobi Karaoke — guía para agentes de código (Codex y otros)

Software **libre (GPL-3.0-or-later) y gratuito** para crear karaokes en el escritorio:
fuente (archivo local / YouTube) → separación voz/instrumental → letra (LRCLIB o manual) → **editor** (sincronía + estilo) → borrador/lista → reproductor a pantalla completa.

Idioma del proyecto: **español** (código de dominio, textos de interfaz, documentación, mensajes de commit).

## Estructura del repositorio
| Carpeta | Qué contiene |
|---|---|
| `app/` | App de escritorio **Electron + React + TypeScript** (electron-vite). |
| `app/src/main/` | Proceso principal: servicios (biblioteca, runtime, trabajos, fuente, separación, letras, avisos), IPC (`ipc/handlers.ts`), `index.ts` (cableado). |
| `app/src/preload/` | Puente `window.shinobi` (contextBridge). |
| `app/src/renderer/src/` | Interfaz React: `vistas/` (biblioteca, añadir, progreso, letra, ajustes, primer-arranque, cancion…), `componentes/`, `navegacion/`, `estilos/` (tokens). |
| `app/src/shared/` | Esquemas Zod, contratos IPC (`ipc.ts`, `canales.ts`), errores, reglas de dominio puras (`letra.ts`, `letras/`, `estilo.ts`…). Lo usan main y renderer. |
| `app/e2e/` | Pruebas Playwright con Electron (`_electron`) y sus *fixtures*. |
| `worker/` | Worker **Python 3.12** gestionado con **uv**: comandos `importar-archivo`, `info-youtube`, `descargar-youtube`, `diagnostico`, `separar`, `demo`. Protocolo JSON Lines por stdout. |
| `docs/` | Toda la documentación (ver abajo). |
| `.github/workflows/` | `ci.yml` (app y worker en Windows/macOS/Linux) y `runtime-real.yml` (manual, con red e instalación real). |

## Documentación: la fuente de verdad
- `docs/plan.md` — qué se hace en cada fase y su estado. **Empieza por aquí.**
- `docs/backlog.md` — tabla de tareas por fase, dependencias y orden.
- `docs/tareas/NNNN-*.md` — **una tarea = una unidad de trabajo**, autocontenida: contexto, archivos, contratos, criterios de aceptación y comandos de verificación.
- `docs/adr/` — decisiones técnicas aceptadas (ADR). `docs/arquitectura.md` — visión global.
- `docs/ux/` — specs de cada vista (wireframes, estados, textos exactos, criterios). `docs/ux/sistema-visual.md` — tokens y componentes.
- `docs/preguntas/` — dudas entre roles; formato en `docs/02-flujo-de-agentes.md`.

## Roles
Hay tres roles con sus instrucciones en `.codex/agents/` (y su equivalente para Claude en `.claude/agents/`): **arquitecto** (ADR, arquitectura, tareas, preguntas técnicas), **disenador-ux** (specs en `docs/ux/`, preguntas de interfaz) y **programador** (implementa tareas). Si no se indica otro, actúa como **programador**.

## Cómo trabajar una tarea
1. Lee la tarea completa, los ADR y specs que enlaza, y las "Notas de implementación" de las tareas de las que depende.
2. Comprueba que sus dependencias están `Hecha`. Cambia su estado a `En curso`.
3. Implementa **solo** lo que pide la tarea. Respeta los textos de la spec al pie de la letra.
4. Escribe tests (Vitest para lógica y componentes; Playwright para E2E; pytest para el worker).
5. Verifica (comandos abajo). Todo debe quedar en verde.
6. Marca la tarea `Hecha` y rellena **"Notas de implementación"** (qué se hizo, archivos clave, decisiones, deuda). Actualiza su fila en `docs/backlog.md`.

## Reglas
- **No introduzcas librerías, servicios ni patrones fuera de los ADR.** Si hace falta algo nuevo, no lo añadas: crea una pregunta.
- **Ante una duda, no supongas.** Crea `docs/preguntas/NNNN-titulo.md` (siguiente número libre) con `Para: arquitecto` (técnica), `Para: disenador-ux` (interfaz) o `Para: usuario` (producto). Si bloquea, marca la tarea `Bloqueada` y para; si no, toma la opción más conservadora, anótala en la pregunta y sigue.
- **Archivos compartidos** (`app/src/shared/ipc.ts`, `canales.ts`, `app/src/preload/index.ts`, `app/src/main/index.ts`, `app/src/main/ipc/handlers.ts`, `app/src/renderer/src/App.tsx`): cambios mínimos y aditivos; respeta el orden indicado en `docs/backlog.md` si varias tareas los tocan.
- Seguridad de Electron (ADR 0008): todo lo que llega por IPC se valida con Zod en main; el renderer nunca recibe rutas absolutas (usa `shinobi-media://`); las variables `SHINOBI_*` de pruebas se ignoran con la app empaquetada.
- Los tests normales **no usan red ni descargan modelos**. Lo que necesite red va marcado (`red`/`pesado` en pytest, `SHINOBI_TESTS_RED=1` en Vitest/Playwright) y se omite por defecto.
- Fixtures: **solo audio generado y letras inventadas**. Nunca contenido con copyright.
- **No formatees globalmente** (`prettier --write .` / `ruff format .`): formatea solo tus archivos.
- **No hagas commits ni push** salvo que te lo pidan.

## Comandos
```bash
# App
cd app
npm install
npm run lint && npm run typecheck && npm run format:check
npm test                                  # Vitest
export SHINOBI_UV="$(which uv)"           # imprescindible: sin él el worker no arranca y fallan los E2E de importar/separar
npm run build && npx playwright test      # E2E
npm run semilla && npm run dev            # app con 15 canciones de ejemplo en app/.datos-dev

# Worker
cd worker
uv sync
uv run ruff check . && uv run ruff format --check .
uv run pytest
```
Requisitos: Node 24 (`app/.nvmrc`), uv 0.13.7, Python 3.12 (lo instala uv).
