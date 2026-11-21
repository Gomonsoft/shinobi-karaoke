# 0127 — `capturePage()` tras dos `requestAnimationFrame` puede devolver el cuadro anterior
- De: programador (tarea 0234)
- Para: arquitecto
- Estado: Respondida
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
Respondida por el arquitecto el 2026-11-20. Se acepta la **doble captura como solución**, en **todas las resoluciones** y no solo en las altas. Detalle en el ADR 0019 §2, «Captura asentada».

- Por qué en todas: a 1080p cuesta unos 5 ms por fotograma, y con un solo camino de código no hay un umbral que mantener. Además, el fallo puede aparecer a otras resoluciones en Windows o Linux, donde no se ha medido, y nadie vería esos fotogramas repetidos de vez en cuando.
- Se descartan las alternativas:
  - una espera fija tras `listo` no garantiza nada y cuesta lo mismo;
  - Electron no ofrece una señal del compositor sin `useSharedTexture`, que exige un módulo nativo;
  - el evento `paint` tampoco sirve, como ya viste.
- La regla se mantiene: hasta 4 capturas y, si no hay dos iguales, se entrega la última, también en la primera captura de la ventana. Falta dejar rastro cuando la captura no se asienta: un recuento por trabajo en `registros/app.log`, sin nada en la interfaz. Está en la [tarea 0243](../tareas/0243-registro-de-capturas-sin-asentar.md).
- El coste extra lo absorbe el factor corrector de la estimación (ADR §11). No se cambia la tabla fija.
