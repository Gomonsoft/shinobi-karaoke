# 0257 — La estimación de tamaño de la exportación sobrestima de 2,2 a 2,7 veces

- Estado: Pendiente
- Paso del pipeline: 6 (exportación)
- Fase: 7 de 0.2.1 · Lote A (exportación)
- Depende de: —
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md#revisión-para-021--fase-7-correcciones-pendientes-de-alpha1) §3 de la revisión para 0.2.1 (sustituye a §11 «Tamaño»)
- Spec UX: [10 · Fase 7](../ux/10-exportacion.md#fase-7-de-021--perfiles-capturables-reintentar-y-errores-tempranos) (la 0257 no cambia la interfaz: `exp.estimacion` y `exp.aviso.espacio` usan la cifra corregida)
- Tamaño: S

## Objetivo

Con una canción de 226 s en Windows, QA midió que el diálogo anuncia entre 2,2 y 2,7 veces el tamaño real ([QA](../Test-manuales/0.2.0/ejecucion-2026-11-21-windows.md) §4.2, I-4): 22/9,6 MB (MKV 1080p30), 26/10,7 (WebM 1080p30), 32/12,1 (WebM 1080p60) y 17/8,6 (MKV 720p30 con voz). Se recalibra la tabla.

## Archivos (solo estos)

- `app/src/shared/exportacion.ts` (`estimarBytes`, `videoMbPorMinuto`, `MARGEN_TAMANO`) y `exportacion.test.ts`

## Contrato

`bytes ≈ (video_MB_min × k_fps × k_fondo × k_formato + 1,44) × minutos × 1,15`, con `video_MB_min` = 1,0 (≤ 768 líneas), 1,3 (1080–1200), 2,0 (1440), 4,0 (2160). `k_fps` = 1,3 a 60 FPS; `k_fondo` = 1,5 con movimiento; `k_formato` = 1,3 en VP9; Opus 1,44 MB/min. La estimación de tiempo no cambia.

## Criterios de aceptación

- [ ] Con las cuatro medidas de QA (226,03 s, fondo sin movimiento), la estimación queda entre +0 % y +50 % del tamaño real (prueba con esos cuatro casos: debe dar ≈ 11,9 / 13,6 / 15,8 / 10,6 MB).
- [ ] Ninguna estimación de las 48 combinaciones baja de la anterior dividida entre 3 (control de que no se rompe la escala).
- [ ] El aviso de espacio (`exp.aviso.espacio`) sigue comparando contra esta cifra y avisando sin bloquear.

## Pruebas de feedback

- Unitarias: `exportacion.test.ts` con los cuatro casos medidos y un caso de 2160 líneas con movimiento.
- E2E: ninguna.
- Críticos: sí (`shared/`).
- Manual: guía de la fase 7 — exportar Final Ruin a 1080p30 MKV y a 1440p30 y 2160p30 WebM y anotar estimado y real (las resoluciones altas no se han medido).

## Notas de implementación
