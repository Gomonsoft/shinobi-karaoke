# 0264 — El render solo pinta palabra a palabra las palabras hechas a mano

- Estado: Pendiente
- Paso del pipeline: 4, 5 y 6 (render compartido: editor, reproductor, secundaria y exportación)
- Fase: 8 de 0.2.1 · Lote C (render y biblioteca)
- Depende de: 0261 (`palabrasVisibles`)
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §2; [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §2 (igualdad modelo-fotograma)
- Spec UX: [07 · Fase 8, «Resaltado»](../ux/07-reproductor.md#resaltado), criterio **R8-1**; [06 · 8.1](../ux/06-editor.md#81--tiempos-por-palabra-importados), criterio **E8-1** (modelo de render); [06 · Fase 9, «Cómo se pinta»](../ux/06-editor.md#cómo-se-pinta), criterio **P18** (modelo); [10 · Fase 7, «Efectos de la fase 8 en el video»](../ux/10-exportacion.md#efectos-de-la-fase-8-en-el-video), **V37** (parte de palabras)
- Tamaño: S

## Objetivo

Que las líneas con palabras importadas se barran de forma progresiva entre su inicio y su `finEfectivo`, en las cuatro superficies, sin tocar sus datos.

## Archivos (solo estos)

- `app/src/renderer/src/karaoke/render.ts` y `render.test.ts`

## Criterios de aceptación

- [ ] `dibujar` y `fotogramaEstatico` usan `palabrasVisibles(linea)`: con palabras importadas, `LineaRender.palabras` es `null` y `progreso` es el de la línea.
- [ ] Con palabras manuales el resultado es el de hoy (progreso por palabra; mitad resaltada en la pantalla de pausa).
- [ ] El fin de la línea y la espera no cambian (siguen saliendo de `finEfectivo`).
- [ ] La prueba de exportación existente que compara el modelo pintado con `fotogramaEn` (V17) sigue pasando sin cambios.

## Pruebas de feedback

- Unitarias: `render.test.ts` con una línea importada (barrido progresivo a mitad de la línea, `palabras: null`) y una manual (progreso por palabra); `fotogramaEstatico` con ambas.
- E2E: ninguna nueva. Si alguna aserción de `e2e/reproductor.spec.ts` (lote D) o `e2e/exportacion.spec.ts` (lote A) depende de palabras importadas de la semilla, no tocarla: anotarlo en las notas para 0271.
- Críticos: sí (render del flujo principal).
- Manual: guía de la fase 8 — Final Ruin y Valiente en el reproductor y exportadas: el barrido termina con la línea.

## Notas de implementación
