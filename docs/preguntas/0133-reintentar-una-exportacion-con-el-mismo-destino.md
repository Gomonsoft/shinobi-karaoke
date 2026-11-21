# 0133 — «Reintentar» una exportación fallida con el mismo destino

- De: programador
- Para: arquitecto
- Estado: Abierta
- Bloquea: no (la tarea [0239](../tareas/0239-progreso-resultado-y-estado-de-exportaciones.md) usa la opción provisional)

## Contexto
La spec [10](../ux/10-exportacion.md) («Reintentar», estado D) pide volver a exportar «con las mismas opciones y una instantánea nueva». `exportacion.iniciar` solo acepta un `destinoId` (UUID de un solo uso, que caduca a los 30 minutos y se consume al iniciar), y `ExportacionIpc` solo da `archivo` y `carpeta` para mostrarlos. El renderer nunca envía rutas, así que no puede reconstruir el destino que se usó, sobre todo si el usuario lo había elegido con [Cambiar…].

## Pregunta
¿Cómo se reintenta con el mismo destino? Opciones: (a) `destinoPropuesto({ cancionId, formato, desdeTrabajoId })`, que devuelve un `destinoId` nuevo para la misma carpeta y nombre del trabajo fallido; (b) un método `exportacion.reintentar(trabajoId)` que reutiliza el destino y toma la instantánea nueva; (c) dar por bueno que se pierda el nombre elegido a mano.

## Opción provisional tomada
(c): «Reintentar» pide `destinoPropuesto({ cancionId, formato })` y llama a `iniciar` con las mismas opciones del trabajo fallido. La carpeta se conserva porque main recuerda la última carpeta usada al iniciar; solo se pierde un nombre de archivo cambiado a mano. Si la respuesta es (a) o (b), el cambio está en una función de `DialogoSeguimiento.tsx`.

## Respuesta
