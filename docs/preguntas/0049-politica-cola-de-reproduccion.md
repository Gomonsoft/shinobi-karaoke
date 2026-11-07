# 0049 — Política de la cola de reproducción

- De: arquitecto y disenador-ux
- Para: usuario
- Estado: Abierta
- Bloquea: transiciones y persistencia de la feature 11

## Contexto

La ventana principal ordena pendientes y la secundaria consume la entrada activa. Una canción pendiente puede borrarse o perder sus pistas. Ver [ronda cruzada UX](../versiones/0.2.0/discusion/r2-disenador-ux.md).

## Pregunta

1. Al terminar una canción normalmente, ¿debe comenzar la siguiente automáticamente o esperar una acción?
2. Si una canción da error o la siguiente ya no está disponible, ¿pausar la cola para que decidas o saltarla con aviso? Si cierras la ventana del reproductor, ¿conservar pendientes en la principal para reanudar?
3. ¿Mantener la cola solo mientras la app está abierta o recuperarla al reiniciar?

## Propuesta para decidir

Avanzar solo al terminar normalmente, pausar con motivo si la siguiente no está disponible y conservar pendientes al cerrar la secundaria o ante error. Mantener la cola en memoria hasta salir de la app.

## Respuesta
