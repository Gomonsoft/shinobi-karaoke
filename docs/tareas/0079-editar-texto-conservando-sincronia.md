# 0079 — Editar el texto conservando la sincronía (diff LCS por líneas)

- Estado: Hecha
- Paso del pipeline: 3
- Depende de: 0078
- ADRs: 0005 (Decisión §3 "Editar el texto"), 0006 (invariantes, palabras)
- Spec UX: docs/ux/05-letra.md (vista C, "Edición en C", criterio 11); `preguntas/0005` §4
- Cuándo: en paralelo con 0080, 0081 y 0084.

## Objetivo

Función pura `aplicarTextoEditado(letra, texto, generarId)` en `app/src/shared/letras/`. Convierte el texto de la vista C en la letra nueva y conserva `id`, tiempos, fin fijado y palabras de las líneas que no cambian. La ejecuta el main en `letras.editarTexto` (0083).

## Criterios de aceptación

- [x] **`letraATexto(letra)`**: una línea por renglón y una pausa como renglón vacío. Es el contenido inicial del área de texto de C. Se cumple que `aplicarTextoEditado(letra, letraATexto(letra))` deja la letra igual (mismos ids).
- [x] **Texto nuevo**: se interpreta con `textoPlanoALetra` (0078), con las mismas reglas de pausas. Las marcas `[mm:ss]` que se escriban aquí son **texto literal**, no se detecta LRC (provisional, `preguntas/0022` §3).
- [x] **Emparejamiento**: LCS sobre la secuencia de elementos.
  - Clave de comparación: `tipo` más el texto con los espacios normalizados (`trim` y espacios repetidos reducidos a uno). Las mayúsculas, la puntuación y cualquier otro carácter cuentan como cambio.
  - Las pausas se emparejan entre sí, y una pausa emparejada conserva su `inicio_ms`.
  - Empates en orden: ante líneas repetidas (estribillos), se empareja la primera aparición con la primera, sin cruces. Un test lo fija.
  - Las líneas emparejadas conservan `id`, `inicio_ms`, `fin_ms` y `palabras`, con el texto nuevo, que solo puede diferir en espacios.
  - Las líneas nuevas o modificadas reciben un id nuevo y quedan sin tiempos.
- [x] **Resultado**: pasa por `normalizarLetra` (0078) **sin regenerar los ids** de las emparejadas. Por ejemplo, funde dos pausas que han quedado juntas al borrar la línea que las separaba, conservando el tiempo de la primera que lo tenga. Siempre cumple `letraSchema`. `origen`, `lrclib_id` y `offset_ms` no cambian.
- [x] **Rendimiento**: con 2000 líneas, por debajo de 50 ms en el CI (LCS O(n·m) con poda del prefijo y el sufijo comunes).
- [x] Tests:
  - editar una línea del medio;
  - insertar, borrar y reordenar;
  - estribillo repetido con una de sus apariciones editada;
  - solo cambios de espacios;
  - mayúsculas;
  - borrar todo, que da cero líneas (el main decide qué hacer, 0083);
  - línea con palabras conservadas;
  - pausa con tiempo conservada y pausas fundidas;
  - texto con CRLF.

## Notas de implementación

- Archivos: `app/src/shared/letras/editar.ts` (`letraATexto`, `aplicarTextoEditado`, exportadas desde `letras/index.ts`) y `editar.test.ts`.
- Se interpreta el texto con `textoPlanoALetra` (ids provisionales), LCS con clave `tipo + texto normalizado` (poda de prefijo/sufijo, tabla Uint16, empate: primera con primera) y se pasa por `normalizarLetra`; después se devuelven los ids de las emparejadas (los supervivientes son una subsecuencia del mismo tipo). Un generador envuelto evita colisiones con ids conservados.
- Las emparejadas toman el texto nuevo (puede diferir en espacios internos, que se conservan tal cual); las pausas emparejadas conservan `inicio_ms`.
- Rendimiento: el test usa límites holgados (1 s edición típica, 3 s peor caso) para no depender de la carga de la CI; en máquina libre ~20-50 ms incluso en el peor caso.
- Probar: `npx vitest run src/shared/letras`.
- Deuda: ninguna.
