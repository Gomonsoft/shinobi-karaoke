# 0021 — Endurecimiento de Electron: navegación, permisos, instancia única y remitente IPC
- Estado: Hecha
- Paso del pipeline: 0 (transversal)
- Depende de: 0011, 0018
- ADRs: 0006, 0008
- Spec UX: —

## Objetivo
Aplicar los puntos 4–7 del ADR 0008 y dos ajustes de robustez detectados en la revisión de cierre de la Fase 1, sin cambios visibles para el usuario.

## Criterios de aceptación
- [x] **Navegación**: un único módulo de main (p. ej. `main/seguridad.ts`) instalado desde `app.on('web-contents-created')` para **todos** los `webContents`: `will-navigate`, `will-redirect` y `will-frame-navigate` se cancelan salvo navegación dentro del propio renderer; `setWindowOpenHandler` siempre `deny`; en ambos casos solo se llama a `shell.openExternal` si `enlacePermitido(url)` (lista blanca de `shared/ipc.ts`); lo demás se registra como aviso y se ignora. `will-attach-webview` → `preventDefault`.
- [x] **Permisos**: `setPermissionRequestHandler` y `setPermissionCheckHandler` de la sesión por defecto deniegan todo salvo `fullscreen` y `clipboard-sanitized-write`, y solo si el origen solicitante es el del renderer.
- [x] **Instancia única**: `app.requestSingleInstanceLock()`; sin el bloqueo, `app.quit()` inmediato (antes de abrir servicios); en `second-instance`, la ventana existente se restaura y se enfoca.
- [x] **Remitente IPC**: `remitenteValido` comprueba además que `event.senderFrame` existe, es el *frame* principal (`senderFrame === sender.mainFrame`) y su origen es el del renderer (desarrollo: origen de `ELECTRON_RENDERER_URL`; producción: el de la tarea 0022, o `file://` mientras 0022 no esté hecha). Función pura con tests.
- [x] **Cierre acotado**: `before-quit` espera a `cancelarTodos()` + `flushTodo()` como máximo 10 s; pasado el plazo, registra el error y sale igualmente.
- [x] **Perfil de Chromium separado**: `app.setPath('userData', join(rutaDatos(), 'electron'))` para que la carpeta de datos (que el usuario abrirá desde Ajustes) no mezcle cachés de Chromium con `biblioteca/`, `runtime/`, etc. (ADR 0006, revisión 2026-11-04). Los E2E siguen pasando.
- [x] `mostrarEnCarpeta`: el mensaje de error al renderer no incluye el texto devuelto por `openPath` (va solo al registro).
- [x] Tests unitarios (con dobles de `webContents`/`session`) de la política de navegación, permisos y remitente; E2E: `window.open('https://example.com')` y `location.href = 'https://example.com'` no abren nada ni navegan; un enlace permitido llega a `shell.openExternal` (sustituido por un doble en E2E).

## Notas de implementación
- Hecho: `app/src/main/seguridad.ts` (funciones puras/inyectables: navegación, permisos, remitente IPC, `conPlazo`) con tests en `seguridad.test.ts`; integrado en `app/src/main/index.ts` (`web-contents-created`, permisos de la sesión por defecto, `requestSingleInstanceLock` + `second-instance`, cierre acotado a 10 s, `userData` = `<datos>/electron`). `mostrarEnCarpeta` registra el texto de `openPath` y devuelve un mensaje genérico.
- E2E: `app/e2e/seguridad.spec.ts` (window.open/location.href bloqueados, enlace permitido llega a `shell.openExternal` sustituido, segunda instancia sale).
- Origen del renderer: dev = `ELECTRON_RENDERER_URL`; producción = `file://` hasta la tarea 0022 (`origenDelRenderer` acepta `origenProduccion`).
- Probar: `npm run lint && npm run typecheck && npm run format:check && npm test && npm run test:e2e` en `app/`.
- Deuda: el cambio de `userData` no migra perfiles previos de Chromium (solo desarrollo). Los fallos de vitest en `renderer/` pertenecían al trabajo en curso de la tarea 0027.
