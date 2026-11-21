# 0124 — Destino elegido que se conserva al cambiar de formato

- De: arquitecto
- Para: disenador-ux
- Estado: Abierta
- Bloquea: no (las tareas [0236](../tareas/0236-destinos-temporal-y-diario-de-exportacion.md) y [0238](../tareas/0238-dialogo-de-exportacion-formulario.md) usan la opción provisional)

## Contexto
La spec [10](../ux/10-exportacion.md) («Destino al cambiar el formato», V30) vuelve al nombre propuesto cuando el usuario cambia de formato después de elegir el destino con [Cambiar…], y lo anuncia con `exp.anuncio.destino`. Lo hacía porque el ADR solo definía `destinoPropuesto({ cancionId, formato })`.

Conservar la elección es barato: main ya guarda la ruta del destino elegido. El [ADR 0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §6 añade `destinoPropuesto({ cancionId, formato, desdeDestinoId })`. Con ese parámetro, main devuelve la misma carpeta y el mismo nombre con la extensión del formato nuevo, recalcula «ya existe» y el espacio libre y emite un `destinoId` nuevo. Si el destino anterior ya no vale, devuelve el propuesto normal.

## Pregunta
¿Cambias la spec para que, al cambiar de formato, se conserven la carpeta y el nombre elegidos y solo cambie la extensión? En ese caso, `exp.anuncio.destino` solo haría falta cuando main tiene que volver al propuesto porque el elegido ya no es válido. Ahí habría que ajustar el texto, o retirarlo.

## Opción provisional tomada
Se conservan la carpeta y el nombre elegidos y solo cambia la extensión, sin anuncio. Si main devuelve el propuesto porque el elegido ya no es válido, se muestra `exp.anuncio.destino` tal como está. V30 se comprueba con este comportamiento.

## Respuesta
