# 0260 — Sondeo de perfiles con una captura real (opcional)
- Estado: Pendiente (backlog, fuera de 0.2.0-alpha.2; se decide tras comprobar 0244)
- Paso del pipeline: 6 (exportación)
- Depende de: 0244, 0246
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §5 (perfiles) y «Revisión para 0.2.0 — alpha.2» (alternativa aplazada)
- Spec UX: [10](../ux/10-exportacion.md) (V5, perfiles no soportados y su motivo)

## Objetivo
QA vio que `perfiles()` (`app/src/main/exportacion/servicio.ts:278-301`) no marcaba como no soportado ninguno de los 48 perfiles, aunque 18 fallaban siempre al exportar ([QA](../Test-manuales/0.2.0/ejecucion-2026-11-21-windows.md) I-2): el sondeo prueba el codificador y la memoria, pero no la captura. Con 0244 desaparece la causa de esos 18 fallos, y si queda alguno salta en «Preparando» con un error claro. Esta tarea solo hace falta si, después de 0244, sigue habiendo algún sistema donde la captura de un tamaño falla siempre (por ejemplo, Linux sin GPU, 0242).

## Contrato (a decidir)
- La primera vez que se abre el diálogo, probar en segundo plano una ventana offscreen del mayor tamaño de cada proporción: crearla, fijar el tamaño y comprobar `getContentSize`, sin capturar fotogramas.
- Marcar los perfiles mayores que el tamaño conseguido con `soportado: false` y un motivo nuevo, `captura`, cuyo texto acuerda el diseñador.
- Que `PERFIL_NO_SOPORTADO` no ofrezca [Reintentar] es correcto y no cambia: repetir con los mismos datos no lo arregla.

## Criterios de aceptación
- [ ] Con un doble de ventana que no admite 2160 líneas, el diálogo muestra esos perfiles como no disponibles y con su motivo antes de que el usuario los elija.

## Pruebas de feedback
- Unitarias: `servicio.test.ts` con el doble.
- E2E: ninguna.
- Críticos: sí (`main/`).
- Manual: caso 10.1 de la guía de la fase 6.

## Notas de implementación
