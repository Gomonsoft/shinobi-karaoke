# 0243 — Registro de capturas sin asentar

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: [0235](0235-render-por-fotograma-y-marca-de-agua.md) (doble captura en `capturar()`), [0237](0237-servicio-de-exportacion-e-ipc.md)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §2 («Captura asentada»), respuesta a [0127](../preguntas/0127-captura-offscreen-con-cuadro-obsoleto.md)
- Spec UX: —

## Objetivo
La doble captura se queda como solución en todas las resoluciones. Cuando a la cuarta captura no hay dos iguales, `capturar()` entrega la última sin avisar a nadie. Hace falta que quede rastro, para detectar si en otro sistema el problema es frecuente.

## Contrato
- `capturar()` (`main/exportacion/ventana.ts`) informa a quien la llama de si la captura quedó asentada, por ejemplo con `{ imagen, asentada: boolean, intentos }`, sin cambiar el resto del contrato.
- `ServicioExportacion` cuenta los fotogramas no asentados y, al terminar el trabajo, escribe una línea en `registros/app.log` si hay alguno: trabajo, perfil, fotogramas afectados y total. No se muestra nada en la interfaz.
- Si la regla ya se aplica en todas las resoluciones y a la primera captura de la ventana, no se cambia; si no, se iguala a lo que dice el ADR.

## Criterios de aceptación
- [ ] Con una ventana doble que nunca da dos capturas iguales, el trabajo termina, entrega la última captura de cada fotograma y el registro dice cuántos fotogramas no se asentaron.
- [ ] Con capturas estables no se escribe nada.

## Pruebas de feedback
- Unitarias: `ventana.test.ts` y `servicio.test.ts` con dobles.
- E2E: ninguna.
- Críticos: sí (toca `main/`).
- Manual: revisar `app.log` tras las exportaciones 4K de la guía (pasos de 4K/60).

## Notas de implementación
