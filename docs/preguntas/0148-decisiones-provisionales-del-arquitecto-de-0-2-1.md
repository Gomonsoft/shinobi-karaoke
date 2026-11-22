# 0148 — Decisiones provisionales del arquitecto para 0.2.1 (revisar cuando puedas)

- De: arquitecto
- Para: usuario
- Estado: Abierta
- Bloquea: no (aplicadas en el [ADR 0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md), la revisión para 0.2.1 del [ADR 0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md#revisión-para-021--fase-7-correcciones-pendientes-de-alpha1) y las tareas 0257–0283)

## Contexto

Pediste un PR cuanto antes, así que donde había dudas apliqué la opción recomendada. Ninguna borra datos. Las decisiones de interfaz están aparte, en la [0147](0147-decisiones-provisionales-de-ux-de-0-2-1.md) del diseñador.

## Pregunta

¿Estás de acuerdo con estas cinco? Basta con decir el número de las que quieras cambiar.

1. **Velocidad lenta sin cambiar el tono, solo dentro del editor preciso.** En el bucle de la línea y al escuchar una palabra, a 0,5× y 0,75× la voz conserva su tono (se prepara el trozo de la línea estirado, sin dependencias nuevas). En el resto del editor la velocidad lenta sigue bajando el tono, como ahora. Si en las pruebas la precisión no llega (10 ms), la ventana usa la velocidad de siempre y muestra la nota «el tono también baja». *Alternativa:* conservar el tono en todo el editor (otro tipo de procesado en tiempo real, con más riesgo para la precisión de las marcas).
2. **«Ajustar los silencios» incluye ahora las líneas con palabras importadas** (Final Ruin, Valiente, Sinmigo…): su fin se ajusta y sus palabras importadas se quitan. Sigue sin tocar las líneas con palabras hechas a mano. *Alternativa:* seguir saltándose esas líneas.
3. **El fin automático deja de salir de las palabras importadas.** Una línea con palabras importadas y sin fin fijado pasará a terminar donde terminaría sin ellas (por ejemplo, al empezar la siguiente). No se escribe nada en el archivo, pero puede cambiar dónde termina alguna línea de Assassins Creed Unity o Sinmigo. *Alternativa:* seguir usando la última palabra importada solo para el fin.
4. **Captura 4K en Linux sin tarjeta gráfica (tarea 0242): no se investiga más.** Con el sondeo nuevo, en un equipo así esos perfiles salen como no disponibles antes de elegirlos. Linux real con tarjeta gráfica queda en la guía manual.
5. **La estimación de tamaño de la exportación se recalibra con las medidas de Final Ruin** y queda un 25–30 % por encima de lo real (antes, 2,2–2,7 veces). Las resoluciones 1440p y 4K no se han medido y quedan del lado alto.

## Opción provisional tomada (si no bloquea)

Las cinco, tal como están escritas.

## Respuesta
