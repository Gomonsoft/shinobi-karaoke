# 0029 — La semilla «Editor: separando» no muestra el porcentaje en el editor
- De: programador
- Para: arquitecto
- Estado: Respondida
- Bloquea: no.

## Contexto

La 0110 pide, para la canción 18 «Editor: separando», que Voz e Instrumental muestren «Disponible cuando termine la separación (42 %)» y que el popover de «Marcar como lista» muestre el motivo de la separación. La semilla guarda `separacion` en curso al 42 %, pero al arrancar la app reconcilia las separaciones sin trabajo vivo como interrumpidas. En el editor, la canción llega con el motivo «Disponible cuando se separen las pistas» y el popover ofrece «Separar las pistas» con «Ir a Separación».

## Pregunta

¿El E2E debe comprobar el texto del estado interrumpido (lo que hace hoy la app), o se quiere cubrir también el porcentaje con una separación real con el separador falso (`SHINOBI_SEPARADOR_FALSO`)? El porcentaje y «en cola» ya están cubiertos por los tests de componente del editor.

## Opción provisional tomada

El E2E comprueba el comportamiento real con la semilla (motivo «Disponible cuando se separen las pistas» y popover con «Separar las pistas» / «Ir a Separación»). No se cambia la semilla ni el criterio de la app.

## Respuesta
(arquitecto, 2026-11-06)

**Se acepta la opción provisional: el E2E comprueba el estado interrumpido.** Lo que estaba mal era el criterio de la 0110, no la app.

1. **La reconciliación al arrancar es correcta y no se cambia.** Un trabajo no sobrevive a un reinicio (ADR 0006 y 0009: al arrancar, los pasos `en_curso` sin trabajo vivo pasan a `interrumpido`). Una semilla no puede dejar una separación "al 42 %" que siga viva tras lanzar la app: cualquier semilla en curso se verá siempre como interrumpida.
2. **No se añade un E2E del porcentaje en el editor con el separador falso.** El texto `edi.no.disponible.pista` con el porcentaje y "en cola" ya están cubiertos por los tests de componente del editor, y el progreso real de una separación con el separador falso ya lo cubre el E2E de la 0075. Un E2E más solo repetiría el cableado del evento de progreso, que no cambia en el editor.
3. **Limpieza pequeña** para que nadie vuelva a confundirse al revisar a mano (`npm run semilla`): la canción 18 pasa a llamarse **«Editor: separación interrumpida»**. Va en la tarea [0115](../tareas/0115-semilla-del-reproductor-y-nombre-de-la-cancion-18.md) de la Fase 6 (semilla, su test y la constante `T18` de `e2e/editor.spec.ts`). La canción 14 («Separando, sin letra») se queda como está: la usa el E2E de letras y su nombre describe lo que se guardó.
4. El criterio de la 0110 sobre la canción 18 queda anotado como sustituido por esta respuesta (nota en la tarea).

