# 0244 — Tamaño exacto de la ventana offscreen de exportación
- Estado: Hecha
- Paso del pipeline: 6 (exportación)
- Depende de: —
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §2 «Tamaño» y «Revisión para 0.2.0 — alpha.2»
- Spec UX: [10](../ux/10-exportacion.md) (texto de `PERFIL_NO_SOPORTADO`, sin cambios)
- Versión: 0.2.0-alpha.2 · Bloque B1 (correcciones de alpha.1)

## Objetivo
En Windows, toda exportación con un perfil más ancho o más alto que el área de trabajo de la pantalla falla con `PERFIL_NO_SOPORTADO`. Windows recorta la ventana offscreen al crearla: con un monitor de 3440 × 1440, 2560 × 1440 queda en 2560 × 1392 y 3840 × 2160 en 3440 × 1392 ([feedback](../versiones/0.2.0/feedback-alpha-1.md) §1.1; [QA](../Test-manuales/0.2.0/ejecucion-2026-11-21-windows.md) I-1, 18 de 48 combinaciones). Hay que fijar el tamaño después de crear la ventana y fallar pronto si aun así no coincide. **Nunca escalar.**

## Contrato
- `app/src/main/exportacion/ventana.ts` (comprobado: la creación está en las líneas 123–138 y `capturarUna` comprueba el tamaño en 153–166):
  1. Inmediatamente después de `deps.crear({...})` y **antes** de `deps.registrarRol`, de los oyentes y de `loadURL`, llamar a `ventana.setContentSize(ancho, alto)` y leer `ventana.getContentSize()`.
  2. Si no es `[ancho, alto]`: `deps.registrar?.('error', …)` con el tamaño pedido y el obtenido, `ventana.destroy()`, y rechazar con `errorConCodigo('PERFIL_NO_SOPORTADO', 'La ventana de captura es de W×H y se esperaba A×B.')`. No debe quedar ninguna ventana viva ni ningún rol registrado.
  3. Las opciones de creación no cambian (`width`, `height`, `useContentSize: true` y `enableLargerThanScreen: true`, que sigue haciendo falta en macOS). La comprobación de cada captura en `capturarUna` se mantiene.
- Ampliar la interfaz `BrowserWindowOffscreen` con `setContentSize(ancho: number, alto: number): void` y `getContentSize(): number[]`. `BrowserWindow` ya los tiene: el adaptador de `app/src/main/index.ts:384` (`crear: (o) => new BrowserWindow(o) as never`) no cambia.
- `ServicioExportacion` no cambia: un rechazo de `crearVentana` ya hace fallar el trabajo, mata el worker y limpia el temporal (comprobado en `servicio.ts`, `flujo` en torno a la línea 836).

## Criterios de aceptación
- [x] Con un doble que **recorta en el constructor** (devuelve un `getContentSize` menor hasta que se llama a `setContentSize`), la ventana queda del tamaño pedido y la captura es exacta.
- [x] Con un doble cuyo `setContentSize` no surte efecto, `crearVentanaExportacion` rechaza con `PERFIL_NO_SOPORTADO`, llama a `destroy()`, no llama a `registrarRol` ni a `loadURL` y escribe una línea de error.
- [x] Orden comprobado: `setContentSize` va antes de `loadURL`.
- [ ] Manual (guía): en el equipo de 3440 × 1440, se exportan 2560 × 1440, 3840 × 2160 y 2880 × 2160 en MKV y WebM, con la resolución exacta según `ffprobe`.

## Pruebas de feedback
- Unitarias: `app/src/main/exportacion/ventana.test.ts`. Ampliar el doble de `montar()` con `setContentSize`/`getContentSize` y un modo «recorta» y otro «no se deja fijar». Los tests actuales deben seguir pasando con un doble que respeta el tamaño.
- E2E: ninguna nueva aquí. La de captura en Windows y Linux es la tarea 0246.
- Críticos: sí (toca `main/`).
- Manual: casos de exportación 1440p, 4K y 2880 × 2160 en Windows de la guía de la fase 6 (`qa`), en un equipo con un monitor menor que el perfil.

## Notas de implementación
- `crearVentanaExportacion` (`ventana.ts`) llama a `ventana.setContentSize(ancho, alto)` justo tras `deps.crear` y lee `getContentSize()`; si no coincide, escribe un `error`, hace `destroy()` y rechaza con `PERFIL_NO_SOPORTADO` antes de `registrarRol`, oyentes y `loadURL`. La interfaz `BrowserWindowOffscreen` incorpora `setContentSize` y `getContentSize`. Las opciones de creación y la comprobación de cada captura no cambian.
- Archivos: `app/src/main/exportacion/ventana.ts` y `ventana.test.ts` (el doble de `montar()` tiene tres modos: respeta, recorta y rebelde).
- Probar: `npm run test:cambios`; `SHINOBI_UV=<app>/resources/bin/uv.exe npx playwright test e2e/exportacion-captura.spec.ts e2e/exportacion.spec.ts` tras `npm run build`. En Windows con un monitor de 3440 × 1440: exportación real de 2560 × 1440 (MKV AV1) y 3840 × 2160 (WebM VP9), 24 fps, 40 s, ambas completadas; `ffprobe` da 2560×1440 y 3840×2160 con 960 fotogramas.
- Manual: queda en la guía de la fase 6 la matriz 2560 × 1440, 3840 × 2160 y 2880 × 2160 en MKV y WebM.
- Deuda: ninguna.
