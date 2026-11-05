# 0087 — Integración de la letra con el stepper, la vista de progreso, la Biblioteca y la semilla
- Estado: Hecha
- Paso del pipeline: 3
- Depende de: 0084 (vista montada), 0077. Para comprobarlo con datos reales, 0083.
- ADRs: 0006 (paso actual derivado, `incompleta`, regla de `pasos.letra`)
- Spec UX: docs/ux/00-mapa-de-vistas.md §2–§3 (stepper con motivos `paso.motivo.*` definitivos, "Continuar"); docs/ux/02-biblioteca.md (líneas "Falta la letra" / "Faltan {n} líneas por sincronizar"); docs/ux/04-progreso-pipeline.md ("Buscar la letra mientras tanto", "Buscar la letra" / "Ir al editor", criterios 5 y 9)
- Cuándo: después de 0084; en paralelo con 0085 y 0086.

## Objetivo
Que el paso Letra encaje con el resto de la app: navegación, indicadores del stepper, botones de la vista de progreso, líneas y "Continuar" de la Biblioteca. También, que la semilla de desarrollo tenga canciones con letra en todos los estados.

## Criterios de aceptación
- [x] **Stepper** (`vistas/cancion/pasos.ts`):
  - Letra navegable con la fuente completada, aunque la separación esté en curso;
  - Letra ✓ si `pasos.letra` es `completado`;
  - Editor navegable con letra y, si no, el motivo `paso.motivo.sinLetra` "Primero elige una letra";
  - motivos definitivos (`preguntas/0022` §8, `ux/00` §2) con las claves `paso.motivo.*`: `sinFuente` "Primero añade el audio" (pasos 2–4 con la fuente `pendiente`, `error` o `interrumpido`), **nuevo** `descargando` "Espera a que termine la descarga" (Letra y Editor con la fuente `en_curso`) y `sinLetra`. Se sustituyen las constantes provisionales de 0043 (`MOTIVO_SIN_LETRA` y la de sin fuente) por estas claves.
  Se revisa que el indicador cambia **en vivo** con `evento:cancion` al guardar o al vaciar la letra (0083), sin recargar. Test que lo cubre.
- [x] **Vista de progreso** (0068/0069):
  - "Buscar la letra mientras tanto" y "Buscar la letra" abren la vista Letra real;
  - la separación sigue y el stepper muestra su porcentaje mientras se está en Letra;
  - `hayLetra` pasa a calcularse con `contarLineas(cancion.letra) > 0`, no con `letra != null` (una letra con cero líneas no cuenta), para elegir entre "Buscar la letra" e "Ir al editor".
- [x] **"Continuar" y `vistaAlContinuar`**: sin letra, con la separación completada o vista → Letra; con letra → Editor (`ux/00` §3). Se marca `progresoVisto` al salir de Progreso hacia Letra, si no se hacía ya.
- [x] **Biblioteca**:
  - con `pasos.letra` pendiente, la tarjeta dice "Falta la letra";
  - con letra y líneas sin inicio, "Faltan {n} líneas por sincronizar" (en singular con 1);
  - se actualiza en vivo al guardar desde Letra;
  - si hay un trabajo activo, se muestra el trabajo (`ux/02`).
  Ya existe (0019/0070): esta tarea añade los tests con una letra guardada por `letras.guardar` y corrige lo que falle.
- [x] **Semilla** (`npm run semilla`), con letras inventadas:
  - una canción con la fuente completada, la separación en curso y sin letra, para probar "Buscar la letra mientras tanto";
  - una con letra de LRCLIB sincronizada por línea;
  - una con letra pegada sin sincronizar;
  - una `lista` con letra por palabra.
- [x] Tests (Testing Library):
  - stepper en vivo;
  - los tres motivos, incluido `descargando` con la fuente `en_curso`;
  - Progreso con una letra de cero líneas → "Buscar la letra";
  - "Continuar" a Letra y a Editor;
  - tarjetas con letra pendiente y a medias tras un evento.

## Notas de implementación
- Qué se hizo: `vistas/cancion/pasos.ts` sustituye las constantes provisionales por `MOTIVOS` con las claves `paso.motivo.sinFuente`, `descargando` y `sinLetra`; Letra y Editor muestran `descargando` con la fuente `en_curso` o con un trabajo de fuente vivo (en cola), `sinLetra` con la fuente completada y sin letra, y `sinFuente` en el resto. Progreso calcula `hayLetra` con `contarLineas(letra) > 0`. Nuevo `navegacion/progresoVisto.ts` (conjunto en memoria): se marca al salir de Progreso hacia Letra (botones y stepper) y la Biblioteca lo pasa a `vistaAlContinuar` (`progresoVisto`). La línea de la tarjeta de la Biblioteca ya funcionaba (0019/0070); se añaden tests. Semilla: canciones 14 (fuente lista, separando, sin letra), 15 (letra «LRCLIB» sincronizada por línea) y 16 (letra pegada sin sincronizar); la `lista` con letra por palabra ya existía (nº 2). Letras inventadas.
- Archivos clave: `cancion/pasos.ts`, `cancion/CabeceraCancion.tsx`, `progreso/Progreso.tsx`, `biblioteca/Biblioteca.tsx`, `navegacion/progresoVisto.ts`, `main/biblioteca/semilla.ts`.
- Probar: `npx vitest run src/renderer/src/vistas/{cancion,progreso,biblioteca} src/main/biblioteca/semilla.test.ts`; `npm run semilla`.
- Decisiones: `progresoVisto` solo vive mientras la app está abierta (no se persiste). El stepper en vivo ya lo daban Letra y Progreso con `alCambiarCancion`; el test cubre el cambio de resumen en la cabecera.
- Deuda: sin E2E propio (0088).
