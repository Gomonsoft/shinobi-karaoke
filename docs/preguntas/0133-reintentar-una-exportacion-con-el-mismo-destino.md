# 0133 — «Reintentar» una exportación fallida con el mismo destino

- De: programador
- Para: arquitecto
- Estado: Respondida
- Bloquea: no (la tarea [0239](../tareas/0239-progreso-resultado-y-estado-de-exportaciones.md) usa la opción provisional)

## Contexto
La spec [10](../ux/10-exportacion.md) («Reintentar», estado D) pide volver a exportar «con las mismas opciones y una instantánea nueva». `exportacion.iniciar` solo acepta un `destinoId` (UUID de un solo uso, que caduca a los 30 minutos y se consume al iniciar), y `ExportacionIpc` solo da `archivo` y `carpeta` para mostrarlos. El renderer nunca envía rutas, así que no puede reconstruir el destino que se usó, sobre todo si el usuario lo había elegido con [Cambiar…].

## Pregunta
¿Cómo se reintenta con el mismo destino? Opciones: (a) `destinoPropuesto({ cancionId, formato, desdeTrabajoId })`, que devuelve un `destinoId` nuevo para la misma carpeta y nombre del trabajo fallido; (b) un método `exportacion.reintentar(trabajoId)` que reutiliza el destino y toma la instantánea nueva; (c) dar por bueno que se pierda el nombre elegido a mano.

## Opción provisional tomada
(c): «Reintentar» pide `destinoPropuesto({ cancionId, formato })` y llama a `iniciar` con las mismas opciones del trabajo fallido. La carpeta se conserva porque main recuerda la última carpeta usada al iniciar; solo se pierde un nombre de archivo cambiado a mano. Si la respuesta es (a) o (b), el cambio está en una función de `DialogoSeguimiento.tsx`.

## Respuesta
Respondida por el arquitecto el 2026-11-20: **opción (a)**. Detalle en el ADR 0019 §6 y §10.

- `destinoPropuesto({ cancionId, formato, desdeTrabajoId })` devuelve un `destinoId` nuevo con la misma carpeta y el mismo nombre que usó ese trabajo terminado en esta sesión de la app, con la extensión del formato pedido. Recalcula `existe` y `libreBytes`. Si el trabajo ya no se conoce, devuelve el propuesto normal. Es excluyente con `desdeDestinoId`.
- «Reintentar» pide ese destino y llama a `iniciar` con las mismas opciones. Toma una instantánea nueva porque `iniciar` siempre la toma. «Cambiar opciones» usa el mismo destino como valor inicial del formulario.
- Se descarta (b), `exportacion.reintentar`: sería un canal más con la misma validación que `iniciar`. Se descarta (c) porque perder un nombre elegido a mano sorprende al usuario.
- Además, `iniciar` solo consume el `destinoId` cuando ha pasado todas las validaciones. Un rechazo (`DESTINO_OCUPADO`, `CANCION_NO_DISPONIBLE`…) deja el `destinoId` válido, como supuso [0238](../tareas/0238-dialogo-de-exportacion-formulario.md).

El cambio en el renderer (`DialogoSeguimiento.tsx`) forma parte del alcance de [0237](../tareas/0237-servicio-de-exportacion-e-ipc.md).
