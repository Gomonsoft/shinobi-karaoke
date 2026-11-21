# 0245 — Registrar en `app.log` los fallos de exportación
- Estado: Hecha
- Paso del pipeline: 6 (exportación)
- Depende de: —
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md), «Revisión para 0.2.0 — alpha.2», punto 3
- Spec UX: —
- Versión: 0.2.0-alpha.2 · Bloque B2 (correcciones de alpha.1)

## Objetivo
Ningún fallo de exportación llega a `registros/app.log`. QA lo midió: 0 líneas tras 18 fallos, una cancelación, un fallo de permisos y un cierre brusco ([QA](../Test-manuales/0.2.0/ejecucion-2026-11-21-windows.md) I-3). `cerrarTrabajo` (`app/src/main/exportacion/servicio.ts:898-933`, comprobado) termina con error los trabajos cuyo fallo llega como `salida.error`, y también el de la sustitución del destino (líneas 900–912), sin escribir nada. Solo la rama `catch` de `correr` (línea 686) registra, y lo hace sin perfil.

## Contrato
- **Una sola** línea de nivel `error` por trabajo que termina con `resultado: 'error'`, por cualquier camino: `cerrarTrabajo` (las dos ramas) y el `catch` de `correr`. Se recomienda centralizarla en `terminar()` cuando el resultado es `error` y quitar la línea suelta de la 686, para que no se duplique.
- Contenido: id del trabajo, código, mensaje, perfil (formato, ancho × alto, FPS y audio), fotogramas alcanzados sobre el total y `detalles` si los hay. Por ejemplo: `exportación <id> falló: PERFIL_NO_SOPORTADO: La captura es de 3440×1392 y se esperaba 3840×2160. · MKV 3840×2160 a 30 fps, solo instrumental · 0 de 6780 fotogramas`.
- Una cancelación escribe una línea `info` (`exportación <id> cancelada en el fotograma N de T`). Las completadas no cambian.
- Sin cambios de IPC ni de interfaz.

## Criterios de aceptación
- [ ] Un trabajo que falla por `salida.error` (doble del worker o de la ventana) deja exactamente una línea `error` con código, mensaje, perfil y fotogramas.
- [ ] Un fallo al sustituir el destino y una excepción en `ejecutarTrabajo` dejan también una sola línea cada uno.
- [ ] Una cancelación deja una línea `info` y ninguna `error`.

## Pruebas de feedback
- Unitarias: `app/src/main/exportacion/servicio.test.ts`, con `registrar` espiado: los tres caminos de error y la cancelación.
- E2E: ninguna.
- Críticos: sí (toca `main/`).
- Manual (guía): tras una exportación fallida, `registros/app.log` tiene la línea.

## Notas de implementación

- `ServicioExportacion.terminar()` llama a `registrarFin()`, que escribe una sola línea por trabajo: `error` si el resultado es `error` (por `salida.error`, fallo al sustituir el destino o excepción en `correr`) y `info` si es `cancelada` (`exportación <id> cancelada en el fotograma N de T`, también la de una exportación en cola, con N = 0). Se quitó la línea suelta del `catch` de `correr` para no duplicar. Las completadas no escriben.
- Formato del error: `exportación <id> falló: <CODIGO>: <mensaje> · MKV AV1 3840×2160 a 30 fps, audio instrumental · N de T fotogramas[ · detalles]`. El perfil usa el formato (`MKV AV1`/`WEBM VP9`) y el audio en su valor crudo (`instrumental`, `instrumental_voz`); los fotogramas salen de `posicionMs` del error.
- Archivos: `app/src/main/exportacion/servicio.ts` y `servicio.test.ts` (aserciones en los tests de fallo del worker, fallo de rename, caída de la ventana y cancelación).
- Probar: `npm run test:cambios`. Manual: tras una exportación fallida, `registros/app.log` tiene la línea.
- Deuda: la rama `catch` de `correr` (excepción inesperada fuera de `ejecutarTrabajo`) no tiene test propio, porque `ejecutarTrabajo` recoge todo internamente; pasa por el mismo `terminar`.
