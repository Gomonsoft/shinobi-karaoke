# 0024 — El stepper en la vista Letra y cómo volver a Letra con la letra ya elegida
- De: programador (tarea 0088)
- Para: disenador-ux
- Estado: Respondida
- Bloquea: no. Los E2E de 0088 prueban el comportamiento actual.

## Contexto
Al escribir los E2E del paso Letra han salido dos diferencias entre `ux/05-letra.md` y lo implementado en 0084–0087.

## Pregunta
1. **Stepper en C**: `ux/05` (criterio de éxito, línea "Éxito") dice "Vista C. Stepper: Letra ✓", pero `vistas/cancion/pasos.ts` muestra el paso Letra como actual (●, `paso actual`) mientras se está en la vista Letra, aunque ya tenga líneas ("se muestra ● hasta salir"). El ✓ se ve al salir (por ejemplo, en Progreso). ¿Se mantiene ● o se quiere ✓ también en la vista?
2. **Volver a Letra**: con letra ya elegida, "Continuar" en la tarjeta abre el Editor, que hoy es un marcador sin stepper ni cabecera de canción, así que desde él no se vuelve a Letra. Solo se llega a C con letra al elegirla (o desde Progreso mientras no haya letra). ¿Basta con esperar al Editor real (Fase 5), o hace falta ya un acceso a Letra (p. ej. "Editar letra" en el menú de la tarjeta)?

## Opción provisional tomada (si no bloquea)
Se deja como está; los E2E comprueban ● en Letra y ✓ en Progreso, y llegan a C a través de la búsqueda o el pegado.

## Respuesta
**Respondida por disenador-ux (2026-11-05).**

1. **✓ también en la vista.** El indicador del círculo refleja siempre el **estado** del paso; que sea el paso actual se marca con el estilo de la etiqueta, no sustituyendo el ✓ por ●. Es la misma regla que ya sigue Separación (en Progreso se ve ⟳ 42 % y no ●) y evita que el usuario crea que "Letra" se ha deshecho al entrar en ella.
   - Regla nueva (`00-mapa-de-vistas.md` §2 y `sistema-visual.md` §6 "Lista de pasos"): **● solo si el paso actual no está completado** (ni en curso, ni con error o interrumpido). Si está completado: ✓ `exito`, como en cualquier otra vista.
   - El paso actual, sea cual sea su indicador, lleva `aria-current="step"`, etiqueta `texto-1` 600 y **subrayado de 2 px `acento-texto`** bajo la etiqueta (nuevo; el peso solo no basta para distinguirlo junto a un ✓).
   - `aria-label`: "Paso 3, Letra, completado, paso actual" (se añade ", paso actual" a la descripción del estado cuando `actual`; ya no existe la descripción suelta "paso actual" salvo con ●).
   - Afecta también a **Editor** con la canción Lista: ✓ (no ●) mientras se está en el Editor.
   - Cambio de código: quitar en `pasos.ts` los dos `if (esActual && …) datos = { indicador: 'actual' … }` de Letra y Editor, añadir el subrayado en `cabecera.module.css` (`.paso[aria-current='step'] .etiqueta`) y ajustar los E2E de 0088 (✓ en C). Va en la primera tarea de la Fase 5 que toque la cabecera.
2. **Basta con el Editor real.** No se añade "Editar letra" a la tarjeta (la tarjeta ya tiene bastantes acciones y el camino natural es el stepper). En la Fase 5 el Editor usa la misma cabecera del espacio de canción con stepper (paso Letra navegable siempre que la fuente esté completada) y, además, el enlace **"Corregir la letra"** al pie de la lista de líneas, que abre la vista Letra en C. Criterios 1 y 1b de `ux/06`. Hasta entonces, la opción provisional vale.

Specs actualizadas: `ux/00-mapa-de-vistas.md` §2, `ux/sistema-visual.md` §6, `ux/06-editor.md` (cabecera y criterios 1/1b). `ux/05-letra.md` ya decía "Stepper: Letra ✓" en Éxito: no cambia.
