# 0281 — Verificación, capturas e informe de la fase 7 de 0.2.1

- Estado: Pendiente
- Paso del pipeline: 6 (exportación)
- Fase: 7 de 0.2.1 · Lote A (exportación), última del lote
- Depende de: 0257, 0258, 0260
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md#revisión-para-021--fase-7-correcciones-pendientes-de-alpha1)
- Spec UX: [10 · Fase 7](../ux/10-exportacion.md#fase-7-de-021--perfiles-capturables-reintentar-y-errores-tempranos), criterio **V38** (capturas)
- Tamaño: S

## Objetivo

Cerrar la fase 7 con las pruebas de integración imprescindibles, las capturas de revisión del diseñador y el informe de fase.

## Archivos (solo estos)

- `app/e2e/exportacion-capturas.spec.ts` (*opt-in* `SHINOBI_CAPTURAS_6=1`; añadir los casos de 0.2.1 o un `SHINOBI_CAPTURAS_7=1`)
- `docs/ux/revision-0.2.1-fase-7/` (solo las capturas que genera la spec)
- `docs/versiones/0.2.1/informe-fase-7.md` (nuevo)

## Criterios de aceptación

- [ ] Capturas a 1280 × 800 al 100 %: `perfil-captura`, `fallo-captura`, `fallo-captura-pasajera`, `destino-sin-permiso`, `cancion-exportandose` (V38), con dobles de main, sin exportar de verdad.
- [ ] Informe con: tareas y su estado, resultado de `npm run test:e2e:criticos`, de `exportacion-captura.spec.ts` y `exportacion.spec.ts` en local, enlace a la ejecución del CI del PR y lo que queda a la guía manual. Si `qa` ya escribió la guía de 0.2.1 (`docs/Test-manuales/0.2.1/`), enlazarla; si no, listar sus casos en el informe para `qa`.
- [ ] Casos para la guía manual (los escribe `qa`): exportar 1440p, 4K y 2880 × 2160 en Windows con un monitor menor (ninguno marcado `captura`); estimación frente a tamaño real en 1080p, 1440p y 2160p; carpeta con `icacls /deny`; dos exportaciones de la misma canción en carrera; Linux real con GPU a 4K (8.10).

## Pruebas de feedback

- Unitarias: ninguna nueva.
- E2E: la spec de capturas solo con su variable; `npm run test:e2e:criticos` una vez.
- Críticos: sí.
- Manual: la lista de arriba.

## Notas de implementación
