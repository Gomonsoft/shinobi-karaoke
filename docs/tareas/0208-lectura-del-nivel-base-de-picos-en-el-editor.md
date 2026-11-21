# 0208 — Lectura del nivel base de picos en el editor

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: fase 2 (picos) integrada; sin dependencias de la fase 5
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §6.2, [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md#revisión-para-020--fase-5)
- Spec UX: no aplica (sin interfaz)

## Objetivo

Obtener en el renderer el nivel base completo (bloques de 10 ms) de la caché de picos de una canción, con el canal existente `picos.leer`, para alimentar «Ajustar los silencios».

## Contrato

- **`renderer/src/vistas/editor/picosBase.ts`** (nuevo): `leerPicosBase(api, cancionId, duracionMs, { signal? }): Promise<ResultadoPicosBase>`.
  - Primero llama a `picos.solicitar(id)`. Si no da `lista`, devuelve `{ estado: 'no_disponible' | 'generando' | 'error' }` sin leer.
  - Lee ventanas alineadas `[k × 40960, (k + 1) × 40960)` con `presupuesto: MAX_BLOQUES_PICOS` hasta que `picos.leer` devuelve `null` o se cubre la duración.
  - Exige en cada respuesta `pasoMs === 10` y `primerBloque === k × 4096`. Si no se cumple, el resultado es `error`.
  - Exige la misma `generacion` en todas las respuestas. Si cambia, reintenta **una** vez desde el principio y, si vuelve a cambiar, devuelve `generando`.
  - Concatena en un `Int16Array` de pares (mín, máx) y devuelve `{ estado: 'lista', generacion, pasoMs: 10, pares }`.
  - Admite cancelación con `AbortSignal`, porque la visita puede cerrarse.
- **Caché de la visita**: un pequeño memo por `cancionId + generacion` que evita releer en la misma visita. Lo usarán 0209 y 0215.
- Sin cambios en main, en el preload ni en el contrato.

## Archivos

`app/src/renderer/src/vistas/editor/picosBase.ts` (nuevo) y `picosBase.test.ts`.

## Criterios de aceptación

- [ ] Con una API doble que sirve 10 000 bloques sintéticos, se hacen 3 lecturas y se reconstruye el array exacto.
- [ ] Un cambio de `generacion` a mitad reintenta una vez. Si se repite, devuelve `generando`.
- [ ] `solicitar` con `generando`, `no_disponible` o `error` no lee.
- [ ] Una respuesta con `pasoMs` 20 da `error`.
- [ ] Abortar detiene la lectura.

## Pruebas de feedback

- Unitarias: `picosBase.test.ts` con la API doble.
- E2E: ninguna (la cubre el E2E de 0215).
- Críticos: no.
- Manual: nada.

## Notas de implementación

- Se creó `picosBase.ts` con `leerPicosBase(api, cancionId, duracionMs, { signal })` y `olvidarPicosBase()`. Es una función pura sobre `api.picos` y no toca main, preload ni el contrato.
- Lee ventanas de 40 960 ms con presupuesto de 4096 bloques. Valida `pasoMs === 10` y `primerBloque === k × 4096`. Decodifica los pares int16 little-endian y concatena en un `Int16Array`.
- La generación se compara con la de `solicitar`. Si cambia, reintenta una vez y después devuelve `generando`.
- Memo a nivel de módulo por `cancionId:generacion`. Sirve para 0209 y 0215, y `olvidarPicosBase()` lo vacía.
- Si se aborta, devuelve `{ estado: 'error' }` sin leer más. Es una elección provisional, porque el contrato no fija el resultado de abortar.
- Pruebas: `picosBase.test.ts` (8 casos). Sin E2E ni manual.
- Deuda: ninguna.
