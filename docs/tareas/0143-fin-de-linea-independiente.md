# 0143 — Fin de línea independiente

- Estado: Pendiente
- Paso del pipeline: 4 y 6
- Depende de: [0091](0091-main-guardar-tiempos-de-la-letra.md), [0092](0092-operaciones-puras-de-tiempos-del-editor.md)
- ADRs: [0005](../adr/0005-letras-y-formato-de-sincronia.md), [0006](../adr/0006-persistencia-y-modelo-de-datos.md), [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md)
- Specs: [Editor](../ux/06-editor.md), [Reproductor](../ux/07-reproductor.md)
- Plan: [Fase 1](../versiones/0.2.0/plan-2.md#fase-1--fin-y-barrido)

## Objetivo

Hacer visible cómo fijar un fin para dejar silencio antes de la siguiente línea y garantizar que la vista previa en reproducción y el reproductor respeten ese intervalo.

## Archivos y contrato

- `app/src/renderer/src/vistas/editor/PanelSincronia.tsx`, `textos.ts` y pruebas. Reutilizar acciones de `estado.ts` y la entrada por teclado del editor.
- `app/src/shared/letra.ts` y `app/src/shared/letras/tiempos.ts` conservan `finEfectivo`, `fijarFin` y el contrato de validación. `fin_ms: null` sigue indicando automático. No subir la versión de persistencia.
- `app/src/renderer/src/karaoke/render.ts` y sus pruebas. El intervalo activo es [inicio, fin). Al llegar al fin queda la siguiente en espera con progreso cero. Conservar título, puntos y vista estática de selección.
- Registrar en los ADR 0005 y 0010 la decisión 0.2.0 sobre conservación de fin automático, edición directa y hueco.

## Criterios de aceptación

- [ ] Se distingue «Fin automático» del valor fijado y se muestra la ayuda «Fija el fin para dejar un silencio antes de la siguiente línea». Sin inicio se explica «Fija primero el inicio».
- [ ] Campo Fin y O o «Fijar fin aquí» fijan el fin mediante la operación existente, conservando inicio siguiente, pausa temporizada vecina y límites de palabras. Una acción inválida conserva el valor y expone el aviso vigente.
- [ ] «Usar fin automático», escucha de comprobación, deshacer y guardado conservan sus contratos.
- [ ] Para 12,40–15,80 s y 17,10–20,30 s, el fotograma a 15,79 s muestra la primera como activa, entre 15,80 y 17,09 s muestra la segunda en espera y a 17,10 s activa la segunda. Cubrir búsqueda en reproducción, offset y una pausa con marca.
- [ ] Una letra anterior sin fin fijado conserva sus tiempos efectivos y huecos. No generar fines ni migraciones al abrir.

## Verificación

Desde `app/`, ejecutar `npm test -- src/shared/letra.test.ts src/shared/letras/tiempos.test.ts src/shared/migraciones.test.ts src/renderer/src/vistas/editor/PanelSincronia.test.tsx src/renderer/src/vistas/editor/estado.test.ts src/renderer/src/karaoke/render.test.ts` y `npm run typecheck`. La integración E2E se cubre en 0145.

## Notas de implementación

Pendientes.
