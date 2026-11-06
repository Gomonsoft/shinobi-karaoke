# 0027 — Restaurar palabras y pausas al deshacer después del autoguardado
- De: programador
- Para: arquitecto
- Estado: Respondida
- Bloquea: no.

## Contexto

El ADR 0010 §2 y la 0091 validan palabras y pausas contra la letra que el main tiene guardada en ese momento. Si una línea ya tiene `palabras: null`, el contrato rechaza que vuelva a recibir palabras. Si una pausa ya tiene `inicio_ms: null`, rechaza un inicio distinto de `null`.

Los criterios 14, 23 y 27 de `ux/06` piden deshacer marcas, borrados y descartes, restaurando palabras y pausas. El ADR 0010 exige autoguardar en un máximo de 2 s y autoguardar también cada deshacer. Tras guardar el borrado, el deshacer necesita restaurar precisamente los datos que la validación rechaza.

## Pregunta

¿Qué procedencia debe validar el main cuando el editor restaura palabras o el tiempo de una pausa que existían antes del borrado? Una opción es que `ServicioLetras` conserve, durante la visita, los textos de palabras y los tiempos de pausas que recibió de la letra original. La referencia tendría que invalidarse al sustituir o editar el texto de la letra y cuando termine la visita. ¿Se autoriza ampliar el contrato con esa referencia de edición, o se prefiere otro mecanismo?

## Opción provisional tomada

Mantener la validación del ADR y avanzar en las tareas independientes. Un historial local puede representar el deshacer sin resolver todavía la persistencia del caso descrito.

## Respuesta

**Arquitecto, 2026-11-05.** Se autoriza una referencia temporal de la letra en `ServicioLetras` para la visita activa. La revisión del [ADR 0010 §2](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md) fija el contrato y la validación.

- `letras.abrirEdicion(cancionId)` devuelve la canción y un `sesionId` emitido por el main. La referencia sale de esa misma instantánea.
- `letras.guardarTiempos(peticion, sesionId)` sigue enviando la misma instantánea de tiempos. Contra la referencia se comprueba que las palabras ya existían y conservan el texto, el orden y la relación temporal con el inicio de la línea. Los tiempos de una pausa pueden ser los de la referencia o `null`.
- `letras.cerrarEdicion(sesionId)` invalida solo esa visita. Cambiar efectivamente el texto, sustituir la letra o abrir otra visita invalida la anterior. Una escritura tardía con un identificador de visita obsoleto recibe `LETRA_DESACTUALIZADA`.

Conservar la referencia en memoria mantiene los datos de origen durante el deshacer y rehacer de una visita. Consultar la última copia del disco o `.bak` perdería ese origen tras sucesivos guardados. Añadir campos persistentes para conservar palabras y pausas eliminadas ampliaría el esquema y el ciclo de vida de esos datos. Llevar el historial al main exigiría trasladar al IPC cada operación del editor.

La 0091 amplía el contrato de la 0090 de forma puntual. La 0104 liga el guardado al identificador de visita y la 0105 gestiona la apertura, recarga y cierre. La 0110 comprueba borrar, esperar el guardado, deshacer y verificar el nuevo guardado.
