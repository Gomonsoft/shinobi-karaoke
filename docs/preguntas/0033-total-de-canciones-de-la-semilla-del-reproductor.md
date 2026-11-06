# 0033 — Total de canciones de la semilla del reproductor
- De: programador
- Para: arquitecto
- Estado: Abierta
- Bloquea: no.

## Contexto

La 0115 pide añadir dos canciones, con los ids 20 y 21, y menciona un total de 21. La respuesta a la [0028](0028-total-de-canciones-de-la-semilla-del-editor.md) confirmó 18 carpetas hasta el id 19 y pidió conservar el hueco del id 9.

## Pregunta

¿Confirmamos que el total esperado en la 0115 es de 20 carpetas?

## Opción provisional tomada

Conservar las 18 carpetas anteriores y añadir solo los ids 20 y 21. Las pruebas esperan 20 carpetas y conservan la comprobación de idempotencia.
