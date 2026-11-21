# 0068 — Ids y conteo en el estado reducido de la secundaria

- Para: arquitecto
- De: programador (tarea 0182)
- Estado: Abierta
- Bloquea: no (opción provisional aplicada)

## Duda

`EstadoSecundariaIpc` y los comandos `transicion`/`error` no llevan:

1. el id de la candidata (`sesion.empezar(candidataId)`, «Empezar ya» e «Iniciar»);
2. el id de la entrada fallida cuando falla al consumirse sin haberse cargado en la secundaria (`sesion.siguiente(desdeEntradaId)`, «Pasar a la siguiente canción») ni su título (spec 07 S4 muestra «título»);
3. el número de pendientes (el texto `ses.cierre` dice «Quedan {n} canciones»).

## Opción provisional

- `empezar` usa `transicionId` o, si no, el último `entradaId` cargado: main responde sin cambios (no coincide con la candidata), así que esos botones de la secundaria no actúan hasta resolverlo.
- `siguiente`/`repetir` usan el último `entradaId` cargado (vale para «Otra vez» y para un fallo de la propia secundaria).
- S4 muestra el título solo si la propia secundaria informó el error.
- El diálogo de cierre dice «Quedan canciones pendientes» sin número.

## Propuesta

Añadir a `estadoSecundariaIpcSchema`: `candidataId` (uuid, nullable), `activaId` (entrada activa, terminada o fallida), `tituloActiva` y `pendientes` (número). Al llegar, cambiar `AppSecundaria.tsx` (`idCandidata`, `idParaAvanzar`) y `secundaria/textos.ts`.
