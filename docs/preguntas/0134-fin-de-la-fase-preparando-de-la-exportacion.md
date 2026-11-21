# 0134 — Cómo sabe main que el worker terminó de «preparar» antes de pedir fotogramas

- De: programador
- Para: arquitecto
- Estado: Respondida
- Bloquea: no (la tarea [0237](../tareas/0237-servicio-de-exportacion-e-ipc.md) usa la opción provisional y funciona)

## Contexto
La tarea 0237 y el ADR 0019 §1 (diagrama) dicen que main «espera el fin de `preparando`» antes de crear la ventana offscreen y empezar el bucle. Pero el worker (`exportar.py`, 0231) solo emite `progreso preparando` una vez, al empezar; el siguiente mensaje es `codificando` con `fotograma: 1`, y ese llega **después de leer el primer fotograma** de stdin. Esperar `codificando` antes de escribir el primero es un interbloqueo.

## Pregunta
¿Se añade al worker un mensaje de fin de preparación (p. ej. `progreso preparando` con `valor: 1`, o una fase nueva), o se da por bueno que la ventana cargue mientras el worker prepara el audio?

## Opción provisional tomada
Sin señal de fin de `preparando`: main lanza el worker y crea la ventana a la vez (ambos son la fase «preparando» de la spec 10, ADR 0019 §11: «instantánea, ventana, fuentes y audio») y el bucle empieza en cuanto la ventana pide su instantánea. La tubería frena al bucle por contrapresión (ADR 0019 §7: como mucho 2 fotogramas pendientes, ~66 MB a 4K) hasta que el worker termina de decodificar y mezclar el audio y empieza a leer. Medido con 1080p a 30 FPS: el trabajo completo de 30 s de canción tarda ~26 s y la cancelación en ~40 ms; no se observó ningún problema. Coste: la ventana offscreen y la decodificación del audio ocupan memoria a la vez (≈ 200 MB + 230 MB para 10 min de audio, dentro de lo medido en el ADR). Si se prefiere la secuencia estricta, el cambio es una línea en el worker y una espera en `ServicioExportacion.ejecutarTrabajo`.

## Respuesta
Respondida por el arquitecto el 2026-11-20: **se acepta la opción provisional**. El worker no anuncia el fin de `preparando`: main lanza el worker y crea la ventana a la vez, y la contrapresión de la tubería frena el bucle hasta que el worker empieza a leer. Es más simple que una secuencia estricta, no tiene interbloqueos y solapa la carga de la ventana con la decodificación del audio. La memoria de las dos a la vez está dentro de lo medido.

En la interfaz, «Preparar la canción» termina con el primer `codificando` (fotograma 1). El ADR 0019 se ha alineado: el diagrama de §1 muestra las dos cosas en paralelo, y §4 incluye «Preparación en paralelo». No hace falta cambiar código.
