# 0002 — Esqueleto de la app Electron con tooling (lint, tipos, tests, E2E)
- Estado: Pendiente
- Paso del pipeline: 0
- Depende de: 0001
- ADRs: 0001, 0007
- Spec UX: docs/ux/sistema-visual.md §4 (tamaño mínimo de ventana)

## Objetivo
Una app Electron + React + TypeScript que arranca una ventana vacía segura, con todos los scripts de calidad funcionando, como base para el resto de tareas.

## Criterios de aceptación
- [ ] `app/` creado con electron-vite (main / preload / renderer) y la estructura de carpetas de `arquitectura.md` §5 (`src/shared`, `src/main/{ipc,biblioteca,trabajos,runtime,letras}`, `src/preload`, `src/renderer/src/{vistas,componentes,karaoke,estilos}`), TypeScript `strict`.
- [ ] Node fijado en `.nvmrc` y `engines`; `package-lock.json` versionado.
- [ ] Scripts: `npm run dev`, `build`, `lint`, `format`, `typecheck`, `test`, `test:e2e` funcionan sin errores en el estado inicial.
- [ ] Ventana: tamaño inicial 1280 × 800, mínimo 1024 × 640; `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`; CSP estricta en `index.html` (`default-src 'self'`; sin `unsafe-eval`; `media-src 'self' shinobi-media:`; `img-src 'self' shinobi-media: data:`); navegación externa y `window.open` bloqueados (los enlaces externos se abrirán con `shell.openExternal` desde main).
- [ ] Directorio de datos: función `rutaDatos()` en main que devuelve `process.env.SHINOBI_DATOS` si existe o la ruta por SO del ADR 0006; `npm run dev` define `SHINOBI_DATOS=app/.datos-dev`. Prueba unitaria de la resolución por SO.
- [ ] ESLint con typescript-eslint, react-hooks y jsx-a11y; Prettier; Vitest con un test de ejemplo en `shared/` (node) y otro de componente (jsdom + Testing Library).
- [ ] Prueba de humo E2E con Playwright `_electron`: la app arranca y la ventana muestra el título "Shinobi Karaoke".
- [ ] El `README.md` raíz documenta los comandos.

## Notas de implementación
(las rellena el programador al terminar)
