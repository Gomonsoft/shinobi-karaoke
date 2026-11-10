# 0057 — Scroll horizontal a 1024 px de ancho cuando hay scroll vertical

- De: programador (tarea 0176)
- Para: disenador-ux
- Estado: Abierta
- Bloquea: no. Se deja como está.

## Contexto

Al tomar las capturas de la fase 3 a 1280 × 720 físicos al 125 % (viewport CSS de 1024 × 576), la Biblioteca con las 32 canciones de la semilla de temas muestra una barra de scroll **horizontal** además de la vertical (se ve en `biblioteca-1280x720-125-resultado-lote.png`). Causa medida: `body` tiene `min-width: 1024px` (`estilos/base.css`, de 0.1.0) y la barra vertical reserva 11 px del viewport (1013 px), así que el cuerpo desborda 11 px. El editor ya queda exento (`body:has(main[data-vista='editor']) { min-width: 0 }`, subfase 2.1). No ocurre con pocas canciones (sin barra vertical), por eso el informe de 2.1 no lo vio.

## Pregunta

¿Se mantiene el ancho mínimo de 1024 px para Biblioteca y Ajustes (y se acepta la barra horizontal de 11 px a 1024 px con scroll vertical), o se prefiere que el mínimo cuente la barra (p. ej. `min-width: 1013px` / `overflow-x: hidden` en `html`)?

## Opción provisional tomada

Ninguna: no se toca `base.css`. Es una decisión de experiencia ajena a la fase 3.

## Respuesta
