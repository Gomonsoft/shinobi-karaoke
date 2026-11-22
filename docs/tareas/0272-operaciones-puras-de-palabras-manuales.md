# 0272 — Operaciones puras del editor preciso (palabras, reparto, texto y aplicar)

- Estado: Hecha
- Paso del pipeline: 4 (editor)
- Fase: 9 de 0.2.1 · Lote B2 (modelo de palabras en `shared/`)
- Depende de: 0261
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §1, §4 y §9
- Spec UX: [06 · Fase 9](../ux/06-editor.md#fase-9-de-021--editor-preciso-de-línea): «Conceptos» (reparto y reglas de validez), «Marcar al vuelo», «Edición rápida del texto», «Contenido» (tiradores, campos, límites de la línea, repartir, quitar) y «Aplicar, cancelar y cerrar». Criterios **P5**, **P6**, **P7** (lógica de la marca), **P10**, **P11**, **P13** (fin fijado al aplicar), **P21**.
- Tamaño: M

## Objetivo

Dar a la ventana (0279) y al *reducer* del editor (0280) todas las operaciones de palabras como funciones puras, sin DOM ni audio, con las mismas reglas que valida main.

## Archivos (solo estos)

- `app/src/shared/letras/palabras.ts` (nuevo) y `palabras.test.ts` (nuevo)
- `app/src/shared/letras/index.ts` (reexportar)

## Contrato

- `PalabraBorrador = { texto: string; inicio_ms: number; fin_ms: number; marcada: boolean }`; `BorradorLinea = { texto, inicio_ms, fin_ms (efectivo), palabras: PalabraBorrador[], quitar: boolean }`. Tiempos en tiempo de letra.
- `cargarBorrador(letra, id, duracionMs)`: palabras manuales válidas → todas marcadas; si no (sin palabras, importadas o manuales no válidas) → todas sin marcar con el reparto, y `{ invalidas: true }` si eran manuales no válidas (P21, `edi.preciso.cargadasInvalidas`).
- `repartir(borrador)`: cada tramo de sin marcar seguidas se reparte, proporcional a los caracteres sin espacios (mínimo 1), sin huecos, entre el fin de la marcada anterior (o el inicio de la línea) y el inicio de la siguiente marcada (o el fin de la línea), en ms enteros (P5: «Is this the real life?» 12,000–14,000 s → «Is» 12,000–12,222 y «life?» 13,444–14,000 ± 1 ms).
- `marcarAlVuelo(borrador, k, ms)` → `{ borrador, siguiente, motivo: null | "pronto" | "fuera" }`: inicio de `k`, recorte del fin de la anterior, las posteriores que empiezan antes pasan a sin marcar; `fuera` en el margen; `pronto` si ms ≤ inicio de la anterior marcada o deja < 20 ms por cada sin marcar anterior. `finAlSoltar(borrador, k, ms)` (limitado por la siguiente marcada y el fin de la línea). Una pulsación corta deja el fin abierto (lo resuelve el reparto).
- `moverPalabra(borrador, k, campo, ms)` (tiradores, campos, I/O) y `ajustarPalabra(borrador, k, campo, deltaMs)` (Alt/Ctrl + flechas): paran en el último valor válido, devuelven el límite alcanzado (`anterior` | `siguiente` | `minimo`, para `edi.preciso.limite.*`) y marcan la palabra.
- `moverLimiteLinea(borrador, campo, ms, limitesEditor)`: dentro de las reglas del editor (`limitesInicio`, fin ≤ siguiente) y sin cruzar la primera/última **marcada** (límite `linea`); las sin marcar se reparten (P10).
- `repartirDeNuevo`, `quitarPalabras` (pone `quitar: true`), cualquier marca nueva pone `quitar: false`.
- `reaplicarTexto(borrador, textoNuevo)`: mismo número de tokens → conserva tiempos y estado por posición; distinto → LCS por igualdad de texto, emparejadas conservan, nuevas sin marcar y se reparten; devuelve `repartidas: k` (P11).
- `aplicarEdicionPrecisa(letra, id, borrador, duracionMs)` → `Letra`: texto, inicio (con `moverInicioLinea` para las vecinas, pero sin descartar las palabras propias), fin y palabras (`origen_palabras: "manual"`) o `null` si `quitar`; si quedan palabras y el fin era automático, lo **fija** (P13). El resultado pasa `validarPalabrasManuales`.

## Criterios de aceptación

- [x] Todas las funciones son puras y no mutan la entrada.
- [x] Ninguna operación produce un borrador que incumpla las reglas de validez (orden, dentro de la línea, sin solapes, ≥ 20 ms).
- [x] Los casos de P5, P6, P7 (lógica), P10, P11, P13 y P21 tienen su prueba.

## Pruebas de feedback

- Unitarias: cada función con casos de borde (primera y última palabra, sin marcar entre marcadas, una sola palabra, tramo demasiado corto, espacios dobles, línea vecina con fin fijado al mover el inicio).
- E2E: ninguna.
- Críticos: sí (`shared/`).
- Manual: ninguna propia.

## Notas de implementación

**Qué se hizo.** `app/src/shared/letras/palabras.ts` (nuevo, reexportado desde `letras/index.ts`) y `palabras.test.ts`. API: `cargarBorrador` (`{ borrador, invalidas }`), `repartir`, `repartirDeNuevo`, `quitarPalabras`, `marcarAlVuelo` (`{ borrador, siguiente, motivo }`), `finAlSoltar`, `moverPalabra` y `ajustarPalabra` (`{ borrador, limite: 'anterior'|'siguiente'|'minimo'|null }`), `limitesEditorDe(letra, id, duracionMs)` → `LimitesEditor { inicioMin, inicioMax, finMax }`, `moverLimiteLinea(borrador, campo, ms, limites)` (`{ borrador, limite: 'editor'|'linea'|null }`), `reaplicarTexto` (`{ borrador, repartidas }`), `validarBorrador` y `aplicarEdicionPrecisa(letra, id, borrador, duracionMs)` (lanza `RangeError` si el borrador no cumple las reglas).

**Decisiones (conservadoras, no bloquean).**
- `PalabraBorrador` lleva un campo opcional extra, `finAbierto`, para representar la pulsación corta («fin abierto»): el fin es provisional, la siguiente marca lo recorta a su inicio y, si no hay más, lo resuelve el reparto (la palabra encabeza el tramo a repartir con su inicio fijo).
- `marcarAlVuelo`: `fuera` también si tras el instante no queda sitio para las palabras que faltan (20 ms cada una); no hay un motivo propio.
- Cuando un texto nuevo o un cambio de límites deja un tramo sin sitio, `normalizar` recorta primero el fin de la marcada anterior y, si no basta, desmarca la vecina (nunca produce un borrador inválido; si la línea entera mide menos de 20 ms por palabra no hay solución y la UI debería impedirlo).
- Mover el inicio de una palabra marcada con fin cerrado se detiene en `fin − 20 ms` (límite `minimo`); en una sin marcar o con fin abierto empuja el fin.
- `aplicarEdicionPrecisa` guarda siempre todas las palabras (con el reparto de las sin marcar) salvo `quitar`; que un borrador sin cambios solo cierra lo decide la ventana (0279/0280). El fin se fija si quedan palabras, si ya era fijado o si el usuario lo cambió; si no, sigue automático.

**Pruebas.** `vitest` de `shared/letras/palabras.test.ts`: 43 correctas (P5 con las cifras de la spec, P6, P7 lógica, P10, P11, P13, P21 y una prueba pseudoaleatoria de 40 rondas de operaciones que comprueba la validez tras cada una; se verificó también con 3000 rondas).

**Deuda.** El mensaje de `RangeError` de `aplicarEdicionPrecisa` es técnico (no es microcopy). Ningún E2E ni guía manual propios.

