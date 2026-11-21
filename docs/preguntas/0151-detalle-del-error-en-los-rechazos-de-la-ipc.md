# 0151 — El `detalle` de un error rechazado por la IPC no tiene por dónde viajar

- De: programador
- Para: arquitecto
- Estado: Abierta
- Bloquea: no (opción provisional aplicada en las tareas 0258 y 0260)

## Contexto

La tarea 0283 añadió `detalle` solo a `ExportacionIpc.error` (el error de un trabajo, que llega por eventos y `estado()`). Pero dos casos de la 0258 son **rechazos de `iniciar`**, que viajan como `ErrorIpc` (`{ codigo, mensaje, detalles? }`, `errorIpcSchema`, `aErrorIpc` en `main/ipc/handlers.ts` y los tres preloads): `DESTINO_NO_DISPONIBLE` con `detalle: { campo: "destino" }` y `CANCION_EXPORTANDOSE` con `detalle: { trabajoId }`. `ErrorIpc` no tiene `detalle`, y `aErrorIpc` solo copia `detalles` si es un texto.

## Pregunta

¿Se añade `detalle` (opcional, el mismo `detalleErrorExportacionSchema`) a `errorIpcSchema`, a `aErrorIpc` y al `throw` de los preloads, o se mantiene el transporte provisional?

## Opción provisional tomada (si no bloquea)

Sin tocar `shared/ipc.ts`, `handlers.ts` ni los preloads (son de otros lotes): `ErrorExportacion` y `ErrorDestino` llevan la propiedad `detalle` y, además, copian el mismo objeto serializado en `detalles` (`'{"trabajoId":"…"}'`, `'{"campo":"destino"}'`), que `aErrorIpc` ya transporta. El renderer lee `trabajoIdDeError(err)` (`exportacion/dialogo/textos.ts`), que acepta `err.detalle` si algún día llega y, si no, parsea `err.detalles`. El formulario no necesita `{ campo }` porque ya trata `DESTINO_NO_DISPONIBLE` de `iniciar` como error del campo destino. Si se aprueba el cambio, basta con dejar de serializar en `detalles` y borrar el parseo.

## Respuesta
