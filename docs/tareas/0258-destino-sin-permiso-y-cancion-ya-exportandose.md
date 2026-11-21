# 0258 — Exportación: carpeta sin permiso detectada al empezar y código propio para «canción ya exportándose»
- Estado: Pendiente (backlog, fuera de 0.2.0-alpha.2; necesita al diseñador)
- Paso del pipeline: 6 (exportación)
- Depende de: —
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §6 y §8
- Spec UX: [10](../ux/10-exportacion.md) (errores de destino; casos 6.3, 6.8 y 17.3 de la guía)

## Objetivo
QA encontró dos discrepancias ([informe](../Test-manuales/0.2.0/ejecucion-2026-11-21-windows.md) I-6 e I-7):
1. Con una carpeta sin permiso de escritura, `DESTINO_NO_DISPONIBLE` llega **después** de arrancar el codificador (`posicionMs: 100`), no al iniciar. Además, el texto «No se puede guardar en esa carpeta.» no aparece junto a «Guardar como».
2. Una segunda exportación de la **misma** canción se rechaza con el código genérico `ARGUMENTOS_NO_VALIDOS` («La canción ya tiene una exportación en marcha.», `app/src/main/exportacion/servicio.ts:393-396`). La interfaz no sabe explicar ese código.

No entra en alpha.2: son fallos de comportamiento ante casos poco frecuentes, no se pierden datos y los dos necesitan decidir textos y estados.

## Contrato (a decidir)
- (1) En `iniciar`, antes de lanzar el worker, comprobar que se puede escribir en la carpeta de destino (crear y borrar un archivo temporal). Si no se puede, devolver `DESTINO_NO_DISPONIBLE` como error de campo del formulario.
- (2) Pregunta al diseñador: ¿un código propio (por ejemplo, `CANCION_EXPORTANDOSE`) con su texto, o reutilizar `DESTINO_OCUPADO`?

## Criterios de aceptación
- [ ] (1) Al pulsar «Exportar», una carpeta sin permiso se rechaza sin arrancar el worker, con el error junto a «Guardar como».
- [ ] (2) La segunda exportación de la misma canción muestra el texto que decida la spec 10.

## Pruebas de feedback
- Unitarias: `servicio.test.ts`, con dobles de un destino sin permiso y de dos `iniciar` de la misma canción.
- E2E: ninguna.
- Críticos: sí (`main/`).
- Manual: casos 6.3 y 6.8 de la guía de la fase 6.

## Notas de implementación
