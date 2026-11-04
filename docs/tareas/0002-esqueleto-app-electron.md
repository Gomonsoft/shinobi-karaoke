# 0002 — Esqueleto de la app Electron con tooling (lint, tipos, tests, E2E)
- Estado: Hecha
- Paso del pipeline: 0
- Depende de: 0001
- ADRs: 0001, 0007
- Spec UX: docs/ux/sistema-visual.md §4 (tamaño mínimo de ventana)

## Objetivo
Una app Electron + React + TypeScript que arranca una ventana vacía segura, con todos los scripts de calidad funcionando, como base para el resto de tareas.

## Criterios de aceptación
- [x] `app/` creado con electron-vite (main / preload / renderer) y la estructura de carpetas de `arquitectura.md` §5 (`src/shared`, `src/main/{ipc,biblioteca,trabajos,runtime,letras}`, `src/preload`, `src/renderer/src/{vistas,componentes,karaoke,estilos}`), TypeScript `strict`.
- [x] Node fijado en `.nvmrc` y `engines`; `package-lock.json` versionado.
- [x] Scripts: `npm run dev`, `build`, `lint`, `format`, `typecheck`, `test`, `test:e2e` funcionan sin errores en el estado inicial.
- [x] Ventana: tamaño inicial 1280 × 800, mínimo 1024 × 640; `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`; CSP estricta en `index.html` (`default-src 'self'`; sin `unsafe-eval`; `media-src 'self' shinobi-media:`; `img-src 'self' shinobi-media: data:`); navegación externa y `window.open` bloqueados (los enlaces externos se abrirán con `shell.openExternal` desde main).
- [x] Directorio de datos: función `rutaDatos()` en main que devuelve `process.env.SHINOBI_DATOS` si existe o la ruta por SO del ADR 0006; `npm run dev` define `SHINOBI_DATOS=app/.datos-dev`. Prueba unitaria de la resolución por SO.
- [x] ESLint con typescript-eslint, react-hooks y jsx-a11y; Prettier; Vitest con un test de ejemplo en `shared/` (node) y otro de componente (jsdom + Testing Library).
- [x] Prueba de humo E2E con Playwright `_electron`: la app arranca y la ventana muestra el título "Shinobi Karaoke".
- [x] El `README.md` raíz documenta los comandos.

## Notas de implementación
- **Qué se hizo**: `app/` con electron-vite 6 (Vite 8), Electron 45 (Node 24 embebido, igual que `.nvmrc`/`engines`), React 19, TypeScript 6 `strict` (+ `noUncheckedIndexedAccess`), estructura de carpetas de `arquitectura.md` §5. Ventana 1280×800 (mín. 1024×640) con `sandbox`, `contextIsolation`, sin `nodeIntegration`, `setWindowOpenHandler` y `will-navigate` bloqueados (http/https van a `shell.openExternal`). CSP en `index.html` según la tarea (más `script-src 'self'`, `object-src 'none'`, etc.; `style-src` admite `'unsafe-inline'` porque Vite/React inyectan estilos en línea, sin `unsafe-eval`).
- **Archivos clave**: `app/package.json`, `app/electron.vite.config.ts`, `app/tsconfig.{node,web}.json`, `app/eslint.config.mjs`, `app/vitest.config.mts` (proyectos node + jsdom), `app/src/main/index.ts`, `app/src/main/rutas.ts` (`resolverRutaDatos` pura + `rutaDatos()`; también fija `userData`), `app/e2e/humo.spec.ts`.
- **Cómo probarlo** (desde `app/`): `npm install`, `npm run lint`, `typecheck`, `test`, `build`, `test:e2e` (todos pasan; 7 tests unitarios y 1 E2E). `npm run dev` usa `SHINOBI_DATOS=.datos-dev` (relativo a `app/`) mediante cross-env.
- **Decisiones menores**: ESLint fijado en 9 porque `eslint-plugin-jsx-a11y` aún no soporta 10; `@types/node` 24; `package.json` sin `"type": "module"` para que el preload sandboxed salga en CJS. Se añadió `cross-env` (MIT) para definir la variable en los 3 SO. `app/.gitignore` propio (node_modules, out, test-results).
- **Deuda técnica**: `npm run dev` no se pudo comprobar de forma interactiva en este entorno (el E2E sí lanza la app compilada); `electron-builder.yml` y el protocolo `shinobi-media://` quedan para otras tareas; `npm audit` reporta avisos moderados en dependencias de desarrollo; CI no tocada.
