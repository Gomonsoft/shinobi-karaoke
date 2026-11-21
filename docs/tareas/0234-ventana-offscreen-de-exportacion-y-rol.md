# 0234 — Ventana offscreen de exportación, rol `exportacion` y captura

- Estado: Hecha
- Paso del pipeline: 6
- Depende de: [0230](0230-contratos-compartidos-de-la-exportacion.md)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §2 y §10, [0008](../adr/0008-seguridad-de-electron-y-protocolos-propios.md#revisión-para-020--fase-6), [0013](../adr/0013-workflow-de-empaquetado-y-prueba-de-la-app-empaquetada.md#revisión-para-020--fase-6)
- Spec UX: —

## Objetivo

Crear y gobernar la ventana offscreen que pinta los fotogramas, con su rol, su documento y su captura.

## Contrato

- Build: tercera entrada `renderer/exportacion.html` (misma CSP y `referrer`) y `preload/exportacion` en `electron.vite.config.ts`. `appProtocolo` la sirve sin cambios. Un anfitrión provisional en `renderer/src/exportacion/main.tsx` que pinta un fondo y el número `n` (lo sustituye 0235).
- `main/exportacion/ventana.ts`: `crearVentanaExportacion({ ancho, alto, trabajoId })` con `show: false`, `offscreen: { useSharedTexture: false, deviceScaleFactor: 1 }`, `sandbox`, `contextIsolation`, `backgroundThrottling: false`, `enableLargerThanScreen: true`, `setAudioMuted(true)`, zoom fijo en 1, navegación bloqueada, `setFrameRate(240)`, prioridad baja del proceso del renderer (`getOSProcessId` + `os.setPriority`). Registro del rol `exportacion` en `RegistroVentanas` y paso del remitente por ruta `/exportacion.html` y `trabajoId` vigente.
- `pintar(n)`: envía `exportacion:fotograma` y espera `exportacion.listo({ n })` (tiempo máximo 10 s → `ERROR_INTERNO`). `capturar()`: `capturePage()` → `toBitmap()`, con comprobación de tamaño. `destruir()`.
- Caída del renderer offscreen (`render-process-gone`) → error `ERROR_INTERNO` del trabajo.
- Verificación del paquete (`verificar-paquete`): `exportacion.html` presente en el asar.

## Criterios de aceptación

- [x] La ventana no se muestra, no suena y `capturePage()` devuelve exactamente `ancho × alto` a 640 × 480 y a 3840 × 2160 (DPR 1 aunque la pantalla sea Retina).
- [x] La ventana de exportación no puede llamar a canales de la principal ni la principal a `exportacion.listo`; un `trabajoId` ajeno se rechaza.
- [x] El formato de píxel es BGRA (rojo puro → bytes `00 00 FF FF`).

## Pruebas de feedback

- Unitarias: remitente y rol (`seguridad.test.ts`, `registro.test.ts`), `ventana.test.ts` con un doble de `BrowserWindow`.
- E2E: añadir a `e2e/seguridad.spec.ts` el aislamiento de la ventana de exportación (sin `window.shinobi`). La captura real (tamaño y BGRA) se prueba en Electron con una spec mínima `e2e/exportacion-captura.spec.ts` (≤ 2 pruebas, 640 × 480 y 3840 × 2160).
- Críticos: sí (toca `main/`, `preload/`).
- Manual: nada.

## Notas de implementación

Qué se hizo:
- Tercera entrada de build (`renderer/exportacion.html`, `preload/exportacion`) en `electron.vite.config.ts`; `out/preload/exportacion.js` solo requiere `electron`. Anfitrión provisional `renderer/src/exportacion/main.tsx` (fondo rojo y `n`) con su `env.d.ts` (`window.shinobiExportacion`).
- `main/exportacion/ventana.ts`: `crearVentanaExportacion(opciones, deps)` con las dependencias de Electron inyectadas (probable con dobles). Opciones del contrato; `pintar(n)` (plazo 10 s, `ERROR_INTERNO`), `capturar()` (tamaño exacto, si no `PERFIL_NO_SOPORTADO`), `confirmarListo` (rechaza `trabajoId` ajeno), `destruir()`, `alCaer` ante `render-process-gone`. `inicial()` devuelve los datos que pase el servicio (0237) y `lista` se cumple cuando el documento ya lo pidió (ya escucha fotogramas).
- `main/index.ts`: `crearExportacion` real (rol `exportacion` en `RegistroVentanas`, `os.setPriority(pid, 10)`). `handlers.ts`: `exportacion:inicial` y `exportacion:listo` responden por `deps.ventanaExportacion()`; el resto sigue provisional hasta 0237. El remitente ya validaba ruta `/exportacion.html` y rol (0230).
- `verificar-paquete.mjs` exige `out/renderer/exportacion.html` y `out/preload/exportacion.js` en el asar.

Decisiones: `setZoomFactor`/`setVisualZoomLevelLimits` se llaman tras cargar (antes lanzan «Render frame was disposed»); `zoomFactor: 1` ya va en `webPreferences`. `publicar(ventana)` se invoca antes de `loadURL` porque el documento llama a `inicial()` durante la carga. Ganchos de prueba: con `SHINOBI_PRUEBA_EXPORTACION=1` y sin empaquetar, main expone `globalThis.__shinobiExportacion.crear` (solo para E2E).

Archivos clave: `app/src/main/exportacion/ventana.ts`, `app/src/main/index.ts`, `app/src/main/ipc/handlers.ts`, `app/scripts/verificar-paquete.mjs`, `app/e2e/exportacion-captura.spec.ts`, `app/e2e/seguridad.spec.ts`.

Cómo probarlo: `npx vitest run src/main/exportacion` y `npx playwright test e2e/exportacion-captura.spec.ts` (tras `npm run build`). Comprobado: 640 × 480 y 3840 × 2160 dan `ancho × alto × 4` bytes y el primer píxel rojo es `00 00 FF FF`.

Deuda / observaciones: `e2e/seguridad.spec.ts › la secundaria…` falla por tiempo en este entorno (macOS) también sobre la base `97ec2b2`; no es de esta tarea. La captura se probó sin Retina real (DPR 1 forzado por `deviceScaleFactor`).

