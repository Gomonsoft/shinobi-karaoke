# 0267 — «▶ Reproducir» y «✎ Editar» en las tarjetas Lista y Letra lista

- Estado: Pendiente
- Paso del pipeline: 0 (Biblioteca)
- Fase: 8 de 0.2.1 · Lote C (render, biblioteca y preferencias)
- Depende de: 0266 (mismo lote: comparte la vista de Biblioteca)
- ADRs: [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §9 (bloqueo de edición durante la sesión)
- Spec UX: [02 · Fase 8, «Tarjeta Lista y Letra lista»](../ux/02-biblioteca.md#tarjeta-lista-y-letra-lista-reproducir-y-editar), criterios **B8-1** y **B8-2**; claves `bib.accion.editar`, `bib.accion.editar.aria`; [sistema visual · 0.2.1](../ux/sistema-visual.md#021--sincronía-editor-preciso-y-barra-de-carga-fases-8-y-9) (botón «Editar» de la tarjeta)
- Tamaño: S

## Objetivo

Que una canción terminada se pueda editar desde su tarjeta sin abrir el menú ⋯ (feedback, punto 7).

## Archivos (solo estos)

- `app/src/renderer/src/vistas/biblioteca/tarjeta.ts`, `TarjetaCancion.tsx`, `biblioteca.module.css`, `tarjeta.test.tsx` y los textos de la Biblioteca

## Criterios de aceptación

- [ ] Tarjetas Lista y Letra lista (también incompletas): «▶ Reproducir» (sin cambios, «A la cola» con sesión) y «✎ Editar» (fantasma, icono `pencil`) en una fila desde 240 px; con la línea de exportación o de incompleta, debajo de ella (B8-1).
- [ ] «Editar» y la tecla **E** con la tarjeta enfocada abren el editor de esa canción; Intro y Espacio no cambian. Borradores y Dañadas no cambian.
- [ ] Durante una sesión en otra pantalla, «Editar» es `aria-disabled` con el candado y, como E, abre `edi.bloqueo` sin navegar (B8-2). En modo selección los botones no se ven.
- [ ] Nombre accesible `bib.accion.editar.aria` y `aria-keyshortcuts="E"`.

## Pruebas de feedback

- Unitarias: `tarjeta.test.tsx` (acciones por estado y modalidad, E, sesión, modo selección).
- E2E: ninguna nueva; `e2e/biblioteca.spec.ts` solo si comprueba los botones de la tarjeta Lista.
- Críticos: sí (Biblioteca del flujo principal).
- Manual: ninguna propia; captura B8-7 en 0271.

## Notas de implementación
