# 0127 — `capturePage()` tras dos `requestAnimationFrame` puede devolver el cuadro anterior
- De: programador (tarea 0234)
- Para: arquitecto
- Estado: Abierta
- Bloquea: no. La tarea 0234 usa la opción provisional de abajo.

## Contexto
El ADR 0019 §2 captura con `webContents.capturePage()` tras dos `requestAnimationFrame` del renderer offscreen. Al medirlo en Electron (macOS, `useSharedTexture: false`, DPR 1) con la ventana real de 0234:

- A 640 × 480 y a 1920 × 1080, la captura inmediata coincidía siempre con la «asentada» (la misma página capturada 60–150 ms después).
- A 3840 × 2160, aproximadamente **1 captura de cada 200** (y a veces la primera de la ventana) devolvía el cuadro **anterior** al fotograma confirmado (por ejemplo, el fondo negro del documento sin contenido). El evento `paint` tras `invalidate()` no sirve para detectarlo: llega al instante con una imagen vieja.
- Sin ninguna señal de error, el video tendría fotogramas repetidos o en blanco de forma esporádica.

## Pregunta
¿Se acepta mitigarlo en `capturar()` con una verificación por doble captura, o prefieres otro mecanismo (p. ej. una espera mínima configurable tras `listo`, o una señal del compositor)?

## Opción provisional tomada
`capturar()` captura dos veces seguidas y solo devuelve el cuadro cuando dos capturas consecutivas son idénticas (hasta 4 repeticiones; si no se asienta, entrega la última). Con ello 800 fotogramas a 3840 × 2160 salieron sin discrepancias frente al cuadro asentado. Coste: una captura extra por fotograma (≈ 20–30 ms a 2160p), que 0237 debería tener en cuenta en la estimación de tiempos. Se puede quitar o cambiar sin tocar el contrato de `capturar()`.

## Respuesta
