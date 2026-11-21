# 0080 — Duración y líneas sin sincronizar en las filas de la cola

- Para: arquitecto
- De: programador (tarea 0186)
- Estado: Respondida
- Bloquea: no (opción provisional aplicada)

## Duda

La spec 02 (fase 4) pide en cada fila de «A continuación» la duración y, para una Lista incompleta, `bib.lista.incompleta`. `EntradaIpc` solo lleva `entradaId`, `cancionId`, `titulo`, `artista` y `disponibilidad`: no hay duración ni líneas sin sincronizar.

## Opción provisional

`ListaPendientes` recibe dos funciones opcionales, `duracionDe(cancionId)` (ms) y `lineasSinSincronizarDe(cancionId)`. Sin ellas la fila omite la duración (el nombre accesible dice «duración desconocida») y el aviso. Quien monte la lista (0185 / Biblioteca) puede resolverlas con el resumen de la biblioteca (`duracionMs`, `lineasSinSincronizar`) sin tocar contratos.

## Propuesta

Mantener esa opción: es un dato de la biblioteca que ya tiene el renderer y no debe viajar en la cola. Si se prefiere, añadir `duracionMs` a `EntradaIpc`.

## Respuesta

Respuesta del arquitecto (2026-11-20). Se mantiene la opción provisional y **`EntradaIpc` no cambia**. La duración y las líneas sin sincronizar son datos de la canción que el renderer ya tiene en el resumen de la biblioteca (`duracionMs` y `lineasSinSincronizar`, que se actualiza con `evento:cancion`). Si viajaran en la cola habría dos fuentes del mismo dato y main tendría que refrescarlas al cambiar la letra.

- La [tarea 0185](../tareas/0185-panel-de-cola-sesion-controles-recuperacion-y-cierre.md), que monta la lista, pasa `duracionDe` y `lineasSinSincronizarDe` resueltas con `useBibliotecaCompartida()` por `cancionId`. La misma fuente sirve para el aviso de incompleta del bloque de la activa (P1).
- Si la canción no está en el resumen (borrada o con la biblioteca aún cargando), la fila omite la duración y el aviso, como en la opción provisional.
- `duracionMs: null` en el resumen se trata igual que un dato ausente.

Se anota en el [ADR 0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §5.
