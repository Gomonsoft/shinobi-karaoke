# 0049 — Política de la cola de reproducción

- De: arquitecto y disenador-ux
- Para: usuario
- Estado: Respondida
- Bloquea: no.

## Contexto

La ventana principal ordena pendientes y la secundaria consume la entrada activa. Una canción pendiente puede borrarse o perder sus pistas. Ver [ronda cruzada UX](../versiones/0.2.0/discusion/r2-disenador-ux.md).

## Pregunta

1. Al terminar una canción normalmente, ¿debe comenzar la siguiente automáticamente o esperar una acción?
2. Si una canción da error o la siguiente ya no está disponible, ¿pausar la cola para que decidas o saltarla con aviso? Si cierras la ventana del reproductor, ¿conservar pendientes en la principal para reanudar?
3. ¿Mantener la cola solo mientras la app está abierta o recuperarla al reiniciar?

## Propuesta para decidir

Avanzar solo al terminar normalmente, pausar con motivo si la siguiente no está disponible y conservar pendientes al cerrar la secundaria o ante error. Mantener la cola en memoria hasta salir de la app.

## Respuesta
1. Hay que poner un contador en el centro y animado con tiempo confgurable (por defecto 4 segundos) que un preview diga que cancion sigue en la cola en la parte derecha inferior.
2. Indicar al usuario la situacion, imagino que es si la cancion se borro, esta situacion, asi que dar aviso en una alerta y dar la opcion de pasar a la siguiente cancion por ahora
3. Por ahora solo mientras la app este abierta

Qué conserva la cola si se cierra la ventana secundaria a mitad de canción o durante la transición.? Se dara aviuso que hay cola, una laerta con opcion de cerrar y eliminar cola y cerrar y conservar, dejando como elemento seleccionado pues el ultimo en reproducirse.

### Respuesta ampliada

> Si, mismo segundo, el usuario puede reiniciar si lo desea.

## Decisión para el plan

La cola vive mientras la app esté abierta. El fin natural usa contador central animado configurable, 4 s por defecto, y vista previa inferior derecha. Un fallo se explica y se ofrece pasar a la siguiente canción. Al cerrar la secundaria se puede conservar o eliminar la cola o cancelar. Conservar selecciona el último elemento reproducido y permite reanudar al mismo segundo o reiniciarlo si se interrumpió. En una transición con la canción ya terminada se conserva la selección de contexto y la siguiente queda pendiente. Ver [ronda 4](../versiones/0.2.0/discusion/r4-arquitecto.md) y [plan de la alfa](../versiones/0.2.0/plan-2.md).
