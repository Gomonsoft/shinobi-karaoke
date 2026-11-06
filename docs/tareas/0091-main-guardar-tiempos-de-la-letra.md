# 0091 — Main: `ServicioLetras.guardarTiempos` (tiempos y desplazamiento sin tocar el texto)
- Estado: Pendiente
- Paso del pipeline: 4 y 5
- Depende de: 0090
- ADRs: 0010 (§2), 0006 (invariantes de la letra, escritor único, Revisión 2026-11-05), 0005 (`finEfectivo`, palabras)
- Spec UX: docs/ux/06-editor.md ("Guardado, borrador y lista", criterio 13)
- Archivos: `app/src/main/letras/servicio.ts` y `app/src/main/letras/servicio.test.ts`. **No toca archivos compartidos.**
- Paralelizable con: todas las tareas de interfaz y dominio de la fase (0092–0101).

## Contexto para quien implementa
- `ServicioLetras` es el **único escritor** de `cancion.json#letra` y de `pasos.letra` (tarea 0083). Escribe siempre con su método privado `escribir(id, letra, debounceMs)`, que llama a `ServicioBiblioteca.actualizar(id, { letra, pasos: { letra: {...} } }, { debounceMs })`. `actualizar` actualiza el índice en memoria **en el acto** y encola la escritura atómica; aquí se escribe **sin *debounce*** (ADR 0010 §2): el editor ya agrupa los cambios (1 s) y necesita que la promesa se resuelva cuando el archivo está escrito, para poder vaciar el guardado antes de salir.
- `editarTexto` ya documenta la regla de orden: "Todo el cálculo es síncrono hasta `actualizar`". `guardarTiempos` debe seguirla (**ningún `await` antes de llamar a `escribir`**), para que un `guardarTiempos` seguido de `biblioteca.marcarLista` vea los tiempos nuevos.
- Invariantes de la letra (ADR 0006), que valida `letraSchema` (`shared/letra.ts`):
  - `inicio_ms` **estrictamente** crecientes entre los elementos que lo tienen, pausas incluidas;
  - `fin_ms` no nulo exige inicio y cumple `inicio < fin ≤ inicio del siguiente elemento con inicio`;
  - `palabras` no nulas exigen inicio y no pueden ser una lista vacía; sus inicios son crecientes, cada una cumple `inicio < fin`, la primera empieza ≥ inicio de la línea y la última termina ≤ inicio del siguiente elemento con inicio;
  - una pausa tiene `texto: ''` y `palabras: null`.
- Contrato `GuardarTiempos` (0090): `{ cancionId, offset_ms (±30000), tiempos: [{ id, inicio_ms, fin_ms, palabras }] }`.

## Objetivo
Persistir los tiempos y el desplazamiento global que produce el editor, sin poder cambiar textos, ids, tipos ni orden, conservando un único escritor de `letra`.

## Criterios de aceptación
- [ ] `guardarTiempos(p)` sustituye el *stub* de 0090. Reglas, en este orden y todas síncronas:
  1. `biblioteca.obtener(p.cancionId)` es `null` (no existe o está dañada) → `ARGUMENTOS_NO_VALIDOS` "La canción no existe o está dañada."
  2. La canción no tiene letra, o `p.tiempos.length !== letra.lineas.length`, o algún `p.tiempos[i].id !== letra.lineas[i].id` → `ErrorBiblioteca('LETRA_DESACTUALIZADA', 'La letra ha cambiado desde que se abrió el editor.')`.
  3. Por elemento `i`, sobre una copia de `letra.lineas[i]`:
     - **línea**: `inicio_ms` y `fin_ms` se toman de `p`. `palabras`:
       - `null` en `p` → `null`;
       - si no, la guardada debe ser no nula, con la misma longitud y el mismo `texto` en cada posición; los tiempos se toman de `p`. Si no, `ARGUMENTOS_NO_VALIDOS` "Las palabras no coinciden con la letra guardada.";
     - **pausa**: `inicio_ms` debe ser el guardado o `null`, `fin_ms` el guardado o `null`, y `palabras` `null`. Si no, `ARGUMENTOS_NO_VALIDOS`.
  4. Nueva letra `{ origen, lrclib_id }` (los guardados), `offset_ms: p.offset_ms` y las líneas resultantes, validada con `letraSchema.safeParse`. Si falla → `ARGUMENTOS_NO_VALIDOS` "Los tiempos no son válidos." con el primer problema en el registro (`registro` si el servicio lo tiene; si no, sin registro).
  5. Si `JSON.stringify` de la nueva letra es igual al de la guardada → se devuelve el resumen actual sin escribir (`biblioteca.obtenerResumen`).
  6. Si no → `escribir(id, nueva, 0)`, sin *debounce*.
- [ ] No cambia `estado`: una `lista` sigue `lista` aunque queden líneas sin inicio (`incompleta` se deriva, ADR 0006). `pasos.letra` sigue `completado` y se actualiza `actualizado`, porque se reutiliza `escribir`.
- [ ] Se acepta con la separación en curso y no pisa `pasos.separacion` (lo garantiza `actualizar` con cambio parcial). Hay un test con una canción `en_curso` y un `actualizar` de progreso intercalado.
- [ ] **Orden**: un test llama `guardarTiempos` (todas las líneas con inicio) y, sin esperar, `biblioteca.marcarLista`. La canción queda `lista` y `cancion.json` en disco tiene los tiempos nuevos tras `flushTodo()`.
- [ ] Tests (Vitest, directorio temporal, como los de 0083):
  - éxito: dos llamadas seguidas → `cancion.json` queda con la última;
  - desplazamiento `offset_ms` −250 guardado;
  - mover una línea con palabras (palabras desplazadas) y borrar sus tiempos (`palabras: null`);
  - `LETRA_DESACTUALIZADA` por longitud, por id y por orden distintos, y por letra `null`;
  - palabras con texto distinto o que aparecen donde no había → `ARGUMENTOS_NO_VALIDOS`;
  - una pausa a la que se intenta dar un inicio que no tenía → `ARGUMENTOS_NO_VALIDOS`; quitar el inicio a una pausa → aceptado;
  - inicios no crecientes → `ARGUMENTOS_NO_VALIDOS` sin escribir;
  - sin cambios → no escribe (espía de `actualizar`);
  - canción `lista` que pierde un inicio → sigue `lista` y `incompleta: true` en el resumen.
- [ ] El JSDoc de la clase actualiza la lista de métodos: "Único escritor de `letra`: guardar, editarTexto, guardarTiempos".

## Verificación
```bash
cd app
npm run lint && npm run typecheck && npm run format:check
npx vitest run src/main/letras src/main/biblioteca
```

## Notas de implementación
(las rellena el programador al terminar)
