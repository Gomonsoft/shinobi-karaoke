# 0272 — Operaciones puras del editor preciso (palabras, reparto, texto y aplicar)

- Estado: Pendiente
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

- [ ] Todas las funciones son puras y no mutan la entrada.
- [ ] Ninguna operación produce un borrador que incumpla las reglas de validez (orden, dentro de la línea, sin solapes, ≥ 20 ms).
- [ ] Los casos de P5, P6, P7 (lógica), P10, P11, P13 y P21 tienen su prueba.

## Pruebas de feedback

- Unitarias: cada función con casos de borde (primera y última palabra, sin marcar entre marcadas, una sola palabra, tramo demasiado corto, espacios dobles, línea vecina con fin fijado al mover el inicio).
- E2E: ninguna.
- Críticos: sí (`shared/`).
- Manual: ninguna propia.

## Notas de implementación
