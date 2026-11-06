# 0113 — Main: modo reproductor de la ventana (pantalla completa, estado previo, zoom) y pantalla encendida
- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: 0112
- ADRs: 0011 (§1, §2), 0008 (punto 5 y Revisión 2026-11-06)
- Spec UX: docs/ux/07-reproductor.md (§"Salida", criterios 3–5, 17, 26)
- Archivos:
  - crea `app/src/main/ventana/modoReproductor.ts` y `modoReproductor.test.ts`;
  - **compartidos**: `app/src/main/index.ts` (crear el control, vincularlo en `crearVentana()`, pasarlo como `ventana` a los handlers), `app/src/main/menu.ts` (+ test: ids de los elementos de zoom), `app/src/main/seguridad.ts` (+ `seguridad.test.ts`; retirar `fullscreen`).
- Paralelizable con: 0114–0122 (las vistas usan la API falsa). Toca `main/index.ts` en un bloque propio: si 0124 está en curso, coordinad el *merge* (bloques distintos).

## Contexto para quien implementa
- Hay una sola ventana (`crearVentana()` en `main/index.ts`); en macOS se puede volver a crear con `activate`. Los handlers IPC se registran antes de crear la ventana, así que el control es un objeto único que se **vincula** a la ventana cuando existe.
- En macOS las transiciones de pantalla completa son asíncronas: `isFullScreen()` solo es fiable tras `enter-full-screen`/`leave-full-screen`, y una petición durante la transición se puede perder (docs de `BrowserWindow`).
- El menú "Ver" (`main/menu.ts`) ya tiene `{ role: 'togglefullscreen', label: 'Pantalla completa' }` y los elementos de zoom (dos `zoomIn`, `zoomOut`, `resetZoom`) **sin id**.
- `SHINOBI_*` de pruebas solo se aplican sin empaquetar (`!app.isPackaged`), como `SHINOBI_SILENCIAR_AUDIO`.

## Objetivo
Que el reproductor ponga la ventana a pantalla completa y la devuelva a su estado previo, que conozca cualquier cambio de pantalla completa, que el zoom no funcione mientras está abierto y que la pantalla no se apague mientras suena.

## Criterios de aceptación
- [ ] **`ControlModoReproductor`**:
  ```ts
  interface VentanaModo {
    isFullScreen(): boolean; setFullScreen(v: boolean): void
    isMaximized(): boolean; maximize(): void
    on(evento: 'enter-full-screen' | 'leave-full-screen' | 'closed', cb: () => void): void
    removeListener(evento: string, cb: () => void): void
  }
  interface Bloqueador { start(tipo: 'prevent-display-sleep'): number; stop(id: number): void; isStarted(id: number): boolean }
  new ControlModoReproductor({ bloqueador: Bloqueador, fijarZoomActivo(activo: boolean): void })
  vincular(ventana: VentanaModo | null): void   // desvincula la anterior
  modoReproductor(activo: boolean): void
  fijarPantallaCompleta(activa: boolean): void
  estaEnPantallaCompleta(): boolean
  evitarReposo(activo: boolean): void
  reiniciar(): void                             // renderer recargado o caído
  suscribir(cb: (activa: boolean) => void): () => void
  ```
  - `modoReproductor(true)`: si ya estaba activo, no hace nada. Recuerda `previo = 'pantalla_completa' | 'maximizada' | 'normal'`, pide pantalla completa y llama a `fijarZoomActivo(false)`.
  - `modoReproductor(false)`: restaura `previo`. Pantalla completa → deja la ventana así. Maximizada → sale de la pantalla completa y, al recibir `leave-full-screen`, llama a `maximize()` si `isMaximized()` es `false`. Normal → sale. Además `evitarReposo(false)` y `fijarZoomActivo(true)`.
  - **Estado deseado**: cada petición fija `deseado`. Si llega mientras hay una transición en curso (pedida y aún sin evento), se aplica al recibir el evento si `isFullScreen() !== deseado`. Test con una ventana falsa asíncrona: `true` → `false` antes del evento → acaba en `false`.
  - Cada `enter-full-screen`/`leave-full-screen` notifica a los suscriptores con el valor real, venga de una petición o del menú, F11 o el botón verde.
  - `evitarReposo(true)` inicia `prevent-display-sleep` si no hay uno activo; `false` lo detiene. Nunca hay dos bloqueos a la vez.
  - `closed` de la ventana y `reiniciar()` detienen el bloqueo, olvidan el modo y reactivan el zoom (sin tocar la pantalla completa de una ventana que ya no existe).
- [ ] **Doble para pruebas**: con `SHINOBI_PANTALLA_COMPLETA_SIMULADA=1` y sin empaquetar, `vincular` recibe un adaptador que guarda un booleano, no llama a `setFullScreen` real y emite el evento en el siguiente *tick*. El resto del control no cambia.
- [ ] **Cableado** (`main/index.ts`):
  - `bloqueador` = `powerSaveBlocker`;
  - `fijarZoomActivo` activa o desactiva los elementos del menú con id `zoom-mas`, `zoom-mas-oculto`, `zoom-menos`, `zoom-restablecer` (`Menu.getApplicationMenu()?.getMenuItemById(id)`);
  - `crearVentana()` llama a `vincular(ventana)`;
  - `webContents.on('render-process-gone')` y `did-start-navigation` de la página principal llaman a `reiniciar()`;
  - el control se pasa como `ventana` a `registrarHandlers` (0112).
- [ ] **Menú**: los cuatro elementos de zoom llevan esos `id` (test de `plantillaMenu`). El elemento "Pantalla completa" se queda como está.
- [ ] **Seguridad**: `PERMISOS_PERMITIDOS = ['clipboard-sanitized-write']`. Actualiza los tests de `seguridad.test.ts` y, si comprueba el permiso, `e2e/seguridad.spec.ts` (`fullscreen` pasa a denegado). Ninguna parte del renderer debe llamar a `requestFullscreen` (compruébalo con `grep`).
- [ ] Tests unitarios del control para todo lo anterior, con temporizadores y ventana falsos.

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check && npm test
npm run build && export SHINOBI_UV="$(which uv)" && npx playwright test
```
La comprobación con la ventana real (`isFullScreen()` en macOS y Windows) es del E2E 0123.

## Notas de implementación
(las rellena el programador al terminar)
