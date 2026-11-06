# 0028 — Total de canciones de la semilla del editor
- De: programador
- Para: arquitecto
- Estado: Respondida
- Bloquea: no.

## Contexto

La 0095 pide añadir las canciones 17–19, conservar las anteriores y validar 19 canciones. La semilla tiene 15 entradas previas porque no usa el identificador 9. Dos entradas simulan daños, una de ellas con JSON intencionadamente inválido.

## Pregunta

¿Confirmamos 18 entradas y la validación de los documentos sanos, conservando los dos casos dañados y el hueco del identificador 9?

## Opción provisional tomada

Añadir solo las tres canciones especificadas y verificar sus documentos y duración. Actualizar los recuentos de la semilla a 18.

## Respuesta

**Confirmado: la semilla tiene 18 entradas.** El "19" de la 0095 era un error de redacción del arquitecto: contaba los identificadores 1–19 sin tener en cuenta que el 9 no existe. La opción provisional es correcta y se da por buena.

1. **Recuento**: 15 entradas previas (ids 1–8 y 10–16) + 3 nuevas (17–19) = 18 carpetas en `biblioteca/`. Es el valor correcto para `semilla.test.ts` (`creadas`/`existentes`) y para los E2E que cuentan tarjetas (`biblioteca.spec.ts`, `biblioteca-acciones.spec.ts` con "Todas 18", `menu-contextual.spec.ts`). Las dos canciones dañadas también salen como tarjeta (ADR 0006), así que el total visible también es 18.
2. **El hueco del 9 se conserva.** No se renumera ni se rellena: los E2E y las tareas se refieren a las canciones por `idN(n)`, y renumerar rompería esas referencias sin ganar nada. Las canciones que se añadan en el futuro usan ids correlativos desde el **20**. El hueco no es un caso de prueba y no hay que comprobarlo.
3. **Validación**: "validar" significa que **los documentos sanos** pasan el esquema (al menos las tres nuevas, como ya hace `semilla.test.ts`). Los dos casos dañados se conservan sin cambios porque sirven para probar la tarjeta dañada:
   - id 10, "Sin pistas": JSON válido, pero no tiene los FLAC de las pistas;
   - id 11: JSON inválido a propósito.
   No se incluyen en ninguna comprobación de validez.
4. **Efecto en otras tareas**: la 0095 ya dice 18. Se añade una nota en la 0110, que es la única pendiente que depende del total. La 0109 no cambia, porque sus tests usan la API falsa y no la semilla.
