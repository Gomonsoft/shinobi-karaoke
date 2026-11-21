# 0261 — Origen de las palabras, fin sin palabras importadas y regla «editar el inicio o el fin descarta las palabras»

- Estado: Hecha
- Paso del pipeline: 4 (editor; afecta a 5 y 6 por el render compartido)
- Fase: 8 de 0.2.1 · Lote B2 (modelo de palabras en `shared/`)
- Depende de: —
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §1, §3 y §4; [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-021); [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md#revisión-para-021--fase-8) (ajustar los silencios)
- Spec UX: [06 · 8.1 y 8.2](../ux/06-editor.md#81--tiempos-por-palabra-importados), criterios **E8-3**, **E8-4** (parte de dominio) y **E8-5**; [06 · Fase 9, «Conceptos»](../ux/06-editor.md#conceptos) (reglas de validez). Sin interfaz: el toast lo pinta 0268/0280.
- Tamaño: M

## Objetivo

Dejar en `shared/` el modelo de las palabras con origen, sus reglas de validez y la regla nueva de descarte, para que todas las vías (campos, teclado, marcadores, «Sincronizar al ritmo», «Ajustar los silencios») la apliquen igual y se deshagan en un paso.

## Archivos (solo estos)

- `app/src/shared/letra.ts` y `letra.test.ts`
- `app/src/shared/letras/tiempos.ts` y `tiempos.test.ts`
- `app/src/shared/silencios.ts` y `silencios.test.ts`

## Criterios de aceptación

- [x] `elementoLetraSchema` admite `origen_palabras: "importada" | "manual"` opcional, con lectura tolerante (valor fuera del catálogo → ausente). La semilla y las fixtures de 0.2.0 se validan igual que antes.
- [x] `tokenizarLinea(texto)` = `texto.trim().split(/\s+/)` sin vacíos. `DURACION_MINIMA_PALABRA_MS = 20`.
- [x] `validarPalabrasManuales(linea, finLinea): string[]`: una palabra por token con su texto y en orden, ≥ 20 ms cada una, sin solapes (`fin(k) ≤ inicio(k+1)`), primera ≥ inicio de la línea, última ≤ `finLinea`. `letraSchema` **no** la exige (unas palabras manuales dañadas no dejan la canción dañada): conserva las reglas de palabras de hoy.
- [x] `palabrasVisibles(el)` devuelve las palabras solo si `origen_palabras === "manual"` y `validarPalabrasManuales` no da problemas contra el fin fijado o, si no hay, contra el inicio del siguiente elemento con inicio; si no, `null`.
- [x] `finEfectivo` usa `palabrasVisibles` en el paso «fin de la última palabra»: con palabras importadas y `fin_ms: null`, el resultado es el mismo que sin palabras (**E8-3**).
- [x] `moverInicioLinea` **ya no desplaza** las palabras: descarta las de la línea movida (de cualquier origen) y las de la anterior si su fin fijado pasa a automático o si se solapan con el nuevo inicio.
- [x] `ajustarFin`, `fijarFin` y `usarFinAutomatico` descartan las palabras de la línea. `borrarTiempos` y `marcarInicioLinea` (también las líneas posteriores que pierden su tiempo) siguen descartando.
- [x] `palabrasDescartadas` (en `ResultadoTiempos` y `ResultadoMoverInicio`) lista solo las líneas que pierden palabras **manuales**.
- [x] Al quitar las palabras, el elemento queda con `palabras: null` y sin `origen_palabras`.
- [x] `proponerAjusteSilencios` trata las líneas con palabras importadas como líneas normales (el cambio aplicado las deja sin palabras) y sigue excluyendo las de palabras manuales (**E8-5**, parte de dominio).
- [x] No borra `desplazar` ni `fijarDesplazamiento` (los quita 0271).
- [x] No toca `renderer/`. Si `npm run test:cambios` muestra fallos en `vistas/editor/*.test.ts*` por la regla nueva, los anota con su nombre en las notas: los adapta 0268, dueña de esos archivos.

## Pruebas de feedback

- Unitarias (Vitest): esquema tolerante, `tokenizarLinea`, `validarPalabrasManuales` (cada regla), `palabrasVisibles` (importadas, manuales válidas y no válidas), `finEfectivo` con importadas = sin palabras, cada operación de la tabla de ADR 0021 §4 con importadas y con manuales, `palabrasDescartadas` solo con manuales, `silencios` con importadas incluidas y manuales excluidas.
- E2E: ninguna.
- Críticos: sí (`shared/`).
- Manual: guía de la fase 8 — en Final Ruin y Valiente, corregir el fin de una línea deja el barrido terminando con la línea; Ctrl+Z la devuelve tal cual.

## Notas de implementación

**Qué se hizo.** `origen_palabras` en `elementoLetraSchema` (`z.enum(['importada','manual']).optional().catch(undefined)`; `letraSchema` no exige las reglas manuales). Nuevas en `shared/letra.ts`: `DURACION_MINIMA_PALABRA_MS`, `tokenizarLinea`, `validarPalabrasManuales(linea, finLinea | null)` (finLinea null = sin tope superior), `palabrasVisibles(el, inicioSiguienteMs = null)` (tope = `el.fin_ms ?? inicioSiguienteMs`), `sinPalabras(el)` (palabras null y sin `origen_palabras`) y `tienePalabrasManuales(el)`. `finEfectivo` usa `palabrasVisibles` (importadas = sin palabras). `moverInicioLinea` ya no desplaza: descarta las de la línea movida y las de la anterior (fin fijado que pasa a automático o solape). `ajustarFin`/`fijarFin`/`usarFinAutomatico` (vía `cambiarFin`), `borrarTiempos`, `marcarInicioLinea` y `borrarTiemposLinea` descartan y quitan el origen; `palabrasDescartadas` solo lista manuales. `proponerAjusteSilencios` incluye las importadas (quedan sin palabras) y excluye las manuales. Sin cambio de fin no hay descarte (p. ej. `fijarFin` con el mismo valor).

**Archivos.** `app/src/shared/letra.ts`, `letras/tiempos.ts`, `silencios.ts` y sus tests.

**Decisión sobre la firma.** La tarea dice `palabrasVisibles(el)`, pero para el tope «inicio del siguiente» hace falta contexto: segundo parámetro opcional `inicioSiguienteMs`. Sin él, solo se comprueba contra el fin fijado (render con `LineaRender` puede pasar el `finEfectivo`/siguiente que tenga).

**Pruebas.** `vitest` de `shared/letra`, `shared/silencios` y `shared/letras/*`: 132 correctas. Lectura tolerante de archivos de 0.2.0 (palabras importadas con último fin distinto del fin fijado): el esquema no cambia las reglas de palabras de hoy, así que se leen igual.

**Fallos fuera de `shared/` por la regla nueva** (de 0268, dueña de `vistas/editor`): `estado.test.ts` («previsualiza desde la misma base con offset ±200», «mantiene el último límite legal…», «limita el historial y avisa cuando descarta palabras», «edita un fin sin mover la pausa…») y `Editor.test.tsx` (varias, algunas por S/desplazamiento que retira 0268/0270/0271). No se han separado los que ya fallaban por ediciones a medias de otros lotes.

**Deuda.** `aPeticionTiempos` (enviar `origen_palabras`) es de 0262. `desplazar`/`fijarDesplazamiento` siguen (los quita 0271).

