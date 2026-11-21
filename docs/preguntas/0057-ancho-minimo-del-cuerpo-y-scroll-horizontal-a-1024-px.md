# 0057 — Scroll horizontal a 1024 px de ancho cuando hay scroll vertical

- De: programador (tarea 0176)
- Para: disenador-ux
- Estado: Respondida (disenador-ux, 2026-11-11)
- Bloquea: no. Se deja como está.

## Contexto

Al tomar las capturas de la fase 3 a 1280 × 720 físicos al 125 % (viewport CSS de 1024 × 576), la Biblioteca con las 32 canciones de la semilla de temas muestra una barra de scroll **horizontal** además de la vertical (se ve en `biblioteca-1280x720-125-resultado-lote.png`). Causa medida: `body` tiene `min-width: 1024px` (`estilos/base.css`, de 0.1.0) y la barra vertical reserva 11 px del viewport (1013 px), así que el cuerpo desborda 11 px. El editor ya queda exento (`body:has(main[data-vista='editor']) { min-width: 0 }`, subfase 2.1). No ocurre con pocas canciones (sin barra vertical), por eso el informe de 2.1 no lo vio.

## Pregunta

¿Se mantiene el ancho mínimo de 1024 px para Biblioteca y Ajustes (y se acepta la barra horizontal de 11 px a 1024 px con scroll vertical), o se prefiere que el mínimo cuente la barra (p. ej. `min-width: 1013px` / `overflow-x: hidden` en `html`)?

## Opción provisional tomada

Ninguna: no se toca `base.css`. Es una decisión de experiencia ajena a la fase 3.

## Respuesta

No debe haber barra horizontal. El mínimo de 1024 × 576 es el del **área de contenido de la ventana**, y lo impone Electron (`useContentSize`, sistema visual §4). No es un ancho mínimo del cuerpo que excluya la barra vertical. Se quita `min-width: 1024px` de `body` para todas las vistas, como ya se hizo en el editor. Biblioteca y Ajustes se maquetan para el ancho útil real (1013 px con barra vertical a 1024 px). La rejilla `auto-fill` y los márgenes de 24 px ya lo admiten. No se usa `overflow-x: hidden` en `html`: si algo desbordara, lo ocultaría en vez de mostrar el fallo.

Se comprueba con el criterio S17 de la [fase 4 de la Biblioteca](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) (1024 × 576 con el panel de cola abierto y sin scroll horizontal) y con la captura `resultado-lote` de la fase 3 repetida a 1280 × 720 al 125 %.
