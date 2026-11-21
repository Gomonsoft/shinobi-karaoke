# 0265 — Barra de espera como barra de carga

- Estado: Pendiente
- Paso del pipeline: 4, 5 y 6 (render compartido)
- Fase: 8 de 0.2.1 · Lote C (render, biblioteca y preferencias), primera del lote
- Depende de: —
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md#revisión-para-021--fase-8) (revisión para 0.2.1); [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §2 (modo fotograma)
- Spec UX: [07 · Fase 8, «Barra de espera como barra de carga»](../ux/07-reproductor.md#barra-de-espera-como-barra-de-carga), criterios **R8-3**, **R8-4**, **R8-5**, **R8-6**; [sistema visual · 0.2.1](../ux/sistema-visual.md#021--sincronía-editor-preciso-y-barra-de-carga-fases-8-y-9) (fila «Barra de espera»); [06 · 8.7](../ux/06-editor.md#87--barra-de-espera-en-la-vista-previa); [10 · «Efectos de la fase 8 en el video»](../ux/10-exportacion.md#efectos-de-la-fase-8-en-el-video), **V37** (barra)
- Tamaño: S

## Objetivo

Sustituir la barra centrada que se encoge por una barra de ancho fijo que se llena de izquierda a derecha con los dos colores del tema, idéntica en vista previa, reproductor, secundaria y video.

## Archivos (solo estos)

- `app/src/renderer/src/karaoke/PantallaLetra.tsx`, `pantallaLetra.module.css` y `PantallaLetra.test.tsx`

## Criterios de aceptación

- [ ] La barra es una pista (`letra.color`) de 40 % del ancho del área, centrada, con su centro a `45 % − 0,9 × S`, grosor `max(6px, 1cqh)` (el `1vh` de la spec en unidades de contenedor) y extremos redondeados, con la sombra de §10 en la pista; dentro, un relleno (`color_resaltado`) con `transform: scaleX(var(--k-fraccion))` y `transform-origin` izquierdo (R8-3).
- [ ] `fraccion` sigue saliendo de `render.ts` sin cambios; la variable se escribe en el mismo `requestAnimationFrame` y en el modo fotograma (`tiempoFijoMs`) de la exportación (R8-6).
- [ ] Con `barrido={false}` (Letra lista en reproductor, secundaria y video) la pista es `letra.color` al 35 % y el relleno `letra.color`; ningún elemento usa `color_resaltado` (R8-4). La vista previa del editor, que siempre pinta con barrido, usa los colores de karaoke.
- [ ] Sin animación de entrada ni salida; con movimiento reducido el relleno sigue avanzando (R8-5).
- [ ] Mostrar u ocultar la barra no mueve el texto (posición reservada de la fase 5).

## Pruebas de feedback

- Unitarias: `PantallaLetra.test.tsx` en modo fotograma: hueco de 8 s, `--k-fraccion` 0 / 0,5 / 1 a 0, 4 y 8 s; colores de pista y relleno con y sin barrido; atributo de movimiento reducido sin efecto en la fracción.
- E2E: ninguna nueva. Si alguna aserción de `e2e/fase5.spec.ts` o `e2e/reproductor.spec.ts` (lote D) mide la barra antigua, no tocarla: anotarlo en las notas para 0271.
- Críticos: sí (render del flujo principal).
- Manual: guía de la fase 8 — la barra se entiende a 5 m en una TV con fondos claros y oscuros; en Letra lista se distingue el relleno de la pista. Capturas R8-7 en 0271.

## Notas de implementación
