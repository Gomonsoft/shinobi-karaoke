# 0150 — ¿La 0.2.1 se publica como alfa (`0.2.1-alpha.1`) o como versión estable (`0.2.1`)?

- De: arquitecto
- Para: usuario
- Estado: Abierta
- Bloquea: no (la tarea de cierre [0282](../tareas/0282-cierre-version-0-2-1-alpha-1-notas-paquete-y-ensayo.md) prepara `0.2.1-alpha.1`)

## Contexto

El [ADR 0020](../adr/0020-publicacion-en-github-releases-y-politica-de-versiones.md) §2 numera las previas con sufijo (`-alpha.N`) y solo publica sin sufijo si lo decides tú. Sin sufijo, GitHub la marca como «Latest» y por fin funciona el enlace `…/releases/latest/download/…` del README (estado E1 de la spec 09). Con sufijo sigue siendo *pre-release*.

A favor de seguir en alfa: la 0.2.1 cambia la sincronía y añade el editor preciso, la firma de código de Windows sigue sin resolver (SmartScreen avisa) y macOS y Linux siguen con comprobaciones manuales pendientes. A favor de `0.2.1`: el README pasaría a E1 y la página de descargas sería más clara.

## Pregunta

¿Se publica como `0.2.1-alpha.1` (y las siguientes `-alpha.2`, …) o como `0.2.1`?

## Opción provisional tomada (si no bloquea)

`0.2.1-alpha.1`, que es el número que ya tiene la rama. Cambiar a `0.2.1` es un `npm run version:subir -- 0.2.1` en la tarea de cierre.

## Respuesta
