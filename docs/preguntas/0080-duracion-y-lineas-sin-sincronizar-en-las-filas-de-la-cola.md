# 0080 — Duración y líneas sin sincronizar en las filas de la cola

- Para: arquitecto
- De: programador (tarea 0186)
- Estado: Abierta
- Bloquea: no (opción provisional aplicada)

## Duda

La spec 02 (fase 4) pide en cada fila de «A continuación» la duración y, para una Lista incompleta, `bib.lista.incompleta`. `EntradaIpc` solo lleva `entradaId`, `cancionId`, `titulo`, `artista` y `disponibilidad`: no hay duración ni líneas sin sincronizar.

## Opción provisional

`ListaPendientes` recibe dos funciones opcionales, `duracionDe(cancionId)` (ms) y `lineasSinSincronizarDe(cancionId)`. Sin ellas la fila omite la duración (el nombre accesible dice «duración desconocida») y el aviso. Quien monte la lista (0185 / Biblioteca) puede resolverlas con el resumen de la biblioteca (`duracionMs`, `lineasSinSincronizar`) sin tocar contratos.

## Propuesta

Mantener esa opción: es un dato de la biblioteca que ya tiene el renderer y no debe viajar en la cola. Si se prefiere, añadir `duracionMs` a `EntradaIpc`.
