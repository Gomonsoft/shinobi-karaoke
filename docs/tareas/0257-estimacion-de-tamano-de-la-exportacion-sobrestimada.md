# 0257 — La estimación de tamaño de la exportación sobrestima de 2,2 a 2,7 veces
- Estado: Pendiente (backlog, fuera de 0.2.0-alpha.2)
- Paso del pipeline: 6 (exportación)
- Depende de: —
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §11 «Estimación y espacio»
- Spec UX: [10](../ux/10-exportacion.md) (estimación del formulario)

## Objetivo
Con una canción de 226 s en Windows, QA midió que el diálogo anuncia entre 2,2 y 2,7 veces el tamaño real ([QA](../Test-manuales/0.2.0/ejecucion-2026-11-21-windows.md) I-4):

| Estimado | Real |
|---|---|
| 22 MB | 9,6 MB |
| 26 MB | 10,7 MB |
| 32 MB | 12,1 MB |
| 17 MB | 8,6 MB |

Los tiempos sí quedan dentro de ±50 %. La fórmula (`estimarBytes`, `app/src/shared/exportacion.ts:205-212`) usa valores conservadores de la prueba técnica en macOS y un margen de ×1,3. No entra en alpha.2 porque es una mejora: no rompe nada, solo pide más espacio del necesario.

## Contrato (a decidir al abordarla)
- Hay dos opciones; cualquiera de ellas exige revisar el ADR 0019 §11:
  - recalibrar `video_MB_min` por resolución con más mediciones (Windows y Linux, fondo fijo y en movimiento, AV1 y VP9);
  - aprender un factor de tamaño, como ya se hace con el tiempo (`factor_corrector`).
- La comprobación de espacio libre tiene que seguir siendo conservadora: quedarse corto es peor que pasarse.

## Criterios de aceptación
- [ ] En los perfiles medidos, la estimación se desvía como mucho un ±50 % del tamaño real.
- [ ] La comprobación de espacio sigue sin dejar empezar una exportación que no cabe.

## Pruebas de feedback
- Unitarias: tests de `estimarBytes` con los valores nuevos.
- E2E: ninguna.
- Críticos: sí (`shared/`).
- Manual: en la guía de la fase 6, comparar la estimación con el tamaño real.

## Notas de implementación
