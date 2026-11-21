# 0068 — Ids y conteo en el estado reducido de la secundaria

- Para: arquitecto
- De: programador (tarea 0182)
- Estado: Respondida
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

## Respuesta

Respuesta del arquitecto (2026-11-20). Se acepta la propuesta con estos ajustes de forma. El contrato cambia en el [ADR 0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §10 y §11, revisión 2.

**Estado `EstadoSecundariaIpc`**:

- `candidata` gana `entradaId` (uuid) y queda `{ entradaId, titulo, artista, estilo } | null`. No hace falta un `candidataId` suelto: el id va con el objeto que representa.
- Campo nuevo `activa: { entradaId, titulo, artista } | null`. Es la entrada de referencia para los botones de la secundaria:
  - en `cargando`, `reproduciendo` y `pausada`, la que suena;
  - en `error`, la fallida, aunque la secundaria no llegara a cargarla;
  - en `fin_de_cola`, la última terminada (el contexto), para «Otra vez».
  
  Vale `null` en `abriendo`, en `espera` y en `transicion`, donde los botones usan `candidata`.
- `hayPendientes: boolean` se sustituye por `pendientes: int ≥ 0`, que es el número para `ses.cierre`. Es solo un número: la lista sigue sin enviarse a la secundaria.

**Comandos**:

- `transicion.candidata` gana `entradaId`;
- `error` gana `entradaId` y `titulo`.

El estado sigue siendo la fuente de verdad. Los campos de los comandos solo evitan esperar al siguiente `sesion:estadoSecundaria`.

**Uso en la secundaria**:

- «Empezar ya» e «Iniciar»: `sesion.empezar({ candidataId: candidata.entradaId })`.
- «Siguiente», «Pasar a la siguiente canción» y Mayús + N: `sesion.siguiente({ desdeEntradaId: activa.entradaId })`.
- «Otra vez»: `sesion.repetir({ entradaId: activa.entradaId })`.
- S4: título de `activa.titulo`.
- Diálogo de cierre: `pendientes`.

La opción provisional, que usaba el último `entradaId` cargado, desaparece.

**Reparto**: la ampliación de `shared/sesion.ts` (esquema y fixtures), la proyección en `main/sesion/proyeccion.ts` y el ajuste de `AppSecundaria.tsx` y `secundaria/textos.ts` los hace la [tarea 0181](../tareas/0181-servicio-de-sesion-e-ipc-en-main.md), que ya integra main y la secundaria. Como excepción a la propiedad de archivos de la fase, 0181 toca `shared/sesion.ts`, `shared/__fixtures__/sesion.ts` y `renderer/src/secundaria/`.
