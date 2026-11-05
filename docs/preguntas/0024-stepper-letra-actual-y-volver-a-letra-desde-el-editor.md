# 0024 — El stepper en la vista Letra y cómo volver a Letra con la letra ya elegida
- De: programador (tarea 0088)
- Para: disenador-ux
- Estado: Abierta
- Bloquea: no. Los E2E de 0088 prueban el comportamiento actual.

## Contexto
Al escribir los E2E del paso Letra han salido dos diferencias entre `ux/05-letra.md` y lo implementado en 0084–0087.

## Pregunta
1. **Stepper en C**: `ux/05` (criterio de éxito, línea "Éxito") dice "Vista C. Stepper: Letra ✓", pero `vistas/cancion/pasos.ts` muestra el paso Letra como actual (●, `paso actual`) mientras se está en la vista Letra, aunque ya tenga líneas ("se muestra ● hasta salir"). El ✓ se ve al salir (por ejemplo, en Progreso). ¿Se mantiene ● o se quiere ✓ también en la vista?
2. **Volver a Letra**: con letra ya elegida, "Continuar" en la tarjeta abre el Editor, que hoy es un marcador sin stepper ni cabecera de canción, así que desde él no se vuelve a Letra. Solo se llega a C con letra al elegirla (o desde Progreso mientras no haya letra). ¿Basta con esperar al Editor real (Fase 5), o hace falta ya un acceso a Letra (p. ej. "Editar letra" en el menú de la tarjeta)?

## Opción provisional tomada (si no bloquea)
Se deja como está; los E2E comprueban ● en Letra y ✓ en Progreso, y llegan a C a través de la búsqueda o el pegado.

## Respuesta
(la rellena el diseñador)
