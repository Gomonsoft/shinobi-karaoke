# 0075 — E2E: separación con el separador falso (flujo completo, cola, cancelar, cierre, panel y avisos)
- Estado: Hecha
- Paso del pipeline: 2
- Depende de: 0065, 0068, 0069, 0071, 0072, 0073
- ADRs: 0009 §8 (dobles de prueba; la CI normal sin red ni descargas grandes)
- Spec UX: docs/ux/04-progreso-pipeline.md (criterios 1–7, 9–12, 14), docs/ux/02-biblioteca.md (línea de paso)
- Cuándo: cierra el bloque principal de la Fase 3. 0076 la sigue o va en paralelo si comparten los *fixtures*

## Objetivo
Probar en la app empaquetada para pruebas (`npm run build` + Playwright `_electron`) todo el camino de la separación **sin PyTorch, sin modelos reales y sin red**: runtime falso (`SHINOBI_RUNTIME_FALSO`, instalación `completa` con Calidad "verificado"), worker real en modo desarrollo y separador falso (`SHINOBI_SEPARADOR_FALSO`, 0060). Salda también la deuda de la Fase 1: "E2E de eventos IPC y del indicador de actividad con trabajos reales".

## Criterios de aceptación
- [x] *Fixture* `e2e/fixtures/separacion.ts`: escribe el escenario del separador (segundos y pasos cortos, p. ej. 4 s y 8 pasos), prepara el runtime falso y genera un audio de prueba (WAV con un tono, como en 0046). Los avisos del sistema van a un registro (`SHINOBI_AVISOS_PRUEBAS`, 0072).
- [x] **Flujo feliz**: importar un archivo local → la vista de progreso muestra "Preparar el audio" ✓ y "Separar voz e instrumental" con `prog.fase.cargando`, luego %, y luego ✓ con la duración real.
  - Se pueden reproducir "Voz" e "Instrumental": el `<audio>` carga desde `shinobi-media://` sin errores de consola.
  - `cancion.json` tiene `pistas` con `voz.flac` e `instrumental.flac`, y el paso `completado`.
  - `config.json` tiene un factor medido para `calidad`.
  - No queda `pistas.tmp/`.
- [x] **Navegar sin interrumpir**: con la separación en curso, "Volver a la biblioteca". La tarjeta muestra el progreso en vivo y, al terminar, aparece `prog.toast.ok`.
- [x] **Cola**: dos canciones. La segunda muestra `prog.cola` con el título de la primera y `prog.eta.previa`, y empieza cuando termina la primera.
- [x] **Cancelar**:
  - en curso → diálogo → paso `pendiente`, "Separar ahora" visible y sin `pistas.tmp/`;
  - "Separar ahora" → vuelve a separar;
  - en cola → se retira sin diálogo.
- [x] **Panel de actividad**: botón con "1 en curso · 1 en cola", panel con las dos filas, [Ir] navega a la vista de progreso y [✕] cancela. Al terminar todo, "✓ Terminado" y el botón desaparece.
- [x] **Cierre con trabajos**: cerrar la ventana con una separación en curso → diálogo de cierre con el foco en "Seguir trabajando" → "Cerrar de todos modos". Se relanza la app con el mismo directorio de datos: la canción aparece "Interrumpido" con "Reintentar"; "Reintentar" desde la tarjeta la relanza sin salir de la Biblioteca. Ningún proceso del worker queda vivo (como en 0024).
- [x] **Aviso sin foco**: con la ventana sin foco (`win.blur()` desde el proceso principal de la prueba), al terminar se registra una notificación (Windows/Linux) o un rebote con insignia (macOS), según el SO del runner.
- [x] Corren en la CI normal de Linux (xvfb), como los E2E existentes, en < 60 s en total. Ninguno descarga nada ni importa `torch`. Comprobación: el escenario del separador es obligatorio y la prueba falla si el worker emite un `log` del adaptador real.

## Notas de implementación
- **Archivos**: `app/e2e/fixtures/separacion.ts` (WAV estéreo con tono, escenario del separador, runtime falso con modelos diminutos, modelo Calidad sembrado con su yaml y `verificados.json`, registro de avisos, helpers `importar`, `cerrar`, `procesosWorker`) y `app/e2e/separacion.spec.ts` (8 pruebas: flujo feliz, navegar sin interrumpir + toast, cola, cancelar en curso y "Separar ahora", cancelar en cola, panel, cierre con trabajos y reintento, aviso sin foco).
- **Decisiones**: el modelo se siembra en disco (no se descarga) para no depender de 0066. Para dos canciones se importa el mismo WAV con títulos distintos desde el formulario ("Primera", "Segunda"). El separador real no se usa: se comprueba `pistas.modelo.version === 'falso'` y el escenario es obligatorio. "Ningún proceso del worker queda vivo" se comprueba con `ps` filtrando por la carpeta de datos (se omite en Windows). La ventana de pruebas cuenta siempre como sin foco (`SHINOBI_AVISOS_PRUEBAS`); además se llama a `blur()`; el registro esperado es notificación (Linux/Windows) o rebote + insignia (macOS).
- **Probar**: `cd app && SHINOBI_UV=<uv> npm run build && SHINOBI_UV=<uv> npx playwright test e2e/separacion.spec.ts`.
- **Deuda**: la suite tarda ~65 s en local (la mayor parte es el arranque de Electron y del worker en cada prueba); si la CI se queja, agrupar pruebas o bajar los segundos del escenario. Sin verificación manual en Windows/Linux reales de las notificaciones.
- **Mantenimiento**: ajustado `importar-youtube.spec.ts` ("cerrar la app durante la descarga") a 0070: Reintentar ya no abre la vista de progreso (ver notas de 0070).
