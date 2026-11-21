# 0234 — Ventana offscreen de exportación, rol `exportacion` y captura

- Estado: Pendiente
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
- [ ] La ventana no se muestra, no suena y `capturePage()` devuelve exactamente `ancho × alto` a 640 × 480 y a 3840 × 2160 (DPR 1 aunque la pantalla sea Retina).
- [ ] La ventana de exportación no puede llamar a canales de la principal ni la principal a `exportacion.listo`; un `trabajoId` ajeno se rechaza.
- [ ] El formato de píxel es BGRA (rojo puro → bytes `00 00 FF FF`).

## Pruebas de feedback
- Unitarias: remitente y rol (`seguridad.test.ts`, `registro.test.ts`), `ventana.test.ts` con un doble de `BrowserWindow`.
- E2E: añadir a `e2e/seguridad.spec.ts` el aislamiento de la ventana de exportación (sin `window.shinobi`). La captura real (tamaño y BGRA) se prueba en Electron con una spec mínima `e2e/exportacion-captura.spec.ts` (≤ 2 pruebas, 640 × 480 y 3840 × 2160).
- Críticos: sí (toca `main/`, `preload/`).
- Manual: nada.

## Notas de implementación
