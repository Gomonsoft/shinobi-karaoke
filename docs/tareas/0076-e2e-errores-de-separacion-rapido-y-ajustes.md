# 0076 — E2E: errores de separación, reintentos, oferta del modelo Rápido, Re-separar y "Volver a Calidad"
- Estado: Hecha
- Paso del pipeline: 2
- Depende de: 0066, 0070, 0074 y los *fixtures* de 0075
- ADRs: 0004 (Revisiones 2026-11-05: nunca Rápido sin consentimiento), 0009 §8
- Spec UX: docs/ux/04-progreso-pipeline.md (criterios 7, 8, 8b, 8c, 13, 18, 20), docs/ux/02-biblioteca.md (criterio 18, menú ⋯), docs/ux/08-ajustes-y-acerca.md (criterios 1–4), docs/ux/01-primer-arranque.md (diálogo `aviso-rapido`)
- Cuándo: última tarea de la Fase 3

## Objetivo
Cubrir en E2E, con los mismos dobles que 0075, todos los caminos de error y de consentimiento: los que más riesgo tienen de usar Rápido sin permiso o de dejar la canción en un estado sin salida.

## Criterios de aceptación
- [ ] **Reintento por memoria con éxito**: escenario con `MEMORIA_INSUFICIENTE` solo con `bloques: 'normal'` → el subpaso muestra `prog.reintento.memoria` y la tarjeta `bib.paso.reintento.memoria`, sin banner de error → ✓.
- [ ] **Muerte del proceso** (solo POSIX; en Windows se salta con un motivo): `morir_con_sigkill` en el intento 1 → mismo comportamiento que la memoria (`ux/04` criterio 20).
- [ ] **Memoria definitiva con oferta**: el escenario falla siempre por memoria.
  1. Aparece el banner `prog.error.MEMORIA_INSUFICIENTE` con `rapido.oferta.separacion`, [Reintentar] con el foco y [Usar el modelo Rápido…].
  2. Abrir el diálogo y Cancelar: `config.json` sin `rapido_aceptado` y nada descargado de Rápido.
  3. Volver a abrir y aceptar: descarga de Rápido (runtime falso) con `prog.fase.modelo.rapido`, y después la separación con Rápido → ✓. "Modelo Rápido · ⓘ" con `prog.modo.ayuda.rapido`; `config.json` con `rapido_aceptado` y `modo: 'rapido'`; `pistas.modelo` del Rápido.
- [ ] **Sin oferta con Rápido**: con el modo Rápido ya en uso y memoria definitiva → `prog.error.MEMORIA_INSUFICIENTE.rapido`, sin el botón de la oferta.
- [ ] **Fallo de la descarga de Rápido**: tras aceptar, la descarga falla (runtime falso) → error sin oferta. "Reintentar" vuelve a descargar Rápido **sin** el diálogo y separa.
- [ ] **Modelo que falta**: Calidad ausente en el runtime falso → `prog.fase.modelo` con MB, y en la tarjeta `bib.paso.modelo` → se separa. Con la descarga fallando por `SIN_CONEXION` → `prog.error.MODELO_NO_DISPONIBLE` con "Reintentar" y **sin** oferta. Con `VERIFICACION_FALLIDA` → con oferta.
- [ ] **Nunca Rápido sin consentimiento**: en todas las pruebas anteriores sin aceptar, el registro del worker no contiene ningún `separar` con `modelo.id: 'rapido'`. Se comprueba leyendo `registros/`.
- [ ] **Re-separar pistas**: borrar `pistas/voz.flac` de una canción completa y reescanear → tarjeta "Dañada" → menú ⋯ "Re-separar pistas" → se separa y la canción vuelve a estar bien. En una canción completa separada con Rápido, el menú no ofrece "Re-separar".
- [ ] **Cancelar trabajo** desde el menú ⋯ con la separación en curso → diálogo → `pendiente`.
- [ ] **Volver a Calidad** (Ajustes): con Rápido en uso, Calidad ausente y la descarga lenta del runtime falso:
  1. "Volver a Calidad…" → diálogo → barra en línea;
  2. salir a la Biblioteca y volver: la barra sigue (reenganche);
  3. al terminar, toast `aj.sep.toast.calidad` y "Modelo en uso: Calidad";
  4. la siguiente separación usa Calidad.
  Con la descarga fallando → `aj.sep.error.sigue` y Rápido sigue en uso.
- [ ] Corren en la CI normal de Linux sin red ni descargas reales, en < 90 s en total.

## Notas de implementación
- **Qué se hizo**: `app/e2e/separacion-errores.spec.ts` (14 pruebas) con los dobles de 0075. Cubre: reintento por memoria con éxito (subpaso y tarjeta, sin banner), muerte por SIGKILL (se salta en Windows; el escenario se reescribe durante el intento 1 para que el 2 no muera), memoria definitiva con oferta (foco en Reintentar, Cancelar sin efectos, aceptar → descarga de Rápido + separación, `rapido_aceptado`, `modo`, `pistas.modelo`), sin oferta con Rápido, fallo de la descarga de Rápido y Reintentar sin diálogo, modelo que falta (descarga dentro del trabajo, `SIN_CONEXION` sin oferta, `VERIFICACION_FALLIDA` con oferta), Re-separar (dañada → re-separada; el menú no lo ofrece en sanas ni con Rápido), Cancelar trabajo desde el menú ⋯ y "Volver a Calidad" (descarga lenta, reenganche, toast, siguiente separación con Calidad; con fallo, `aj.sep.error.sigue`).
- **Fixture** (`app/e2e/fixtures/separacion.ts`): `preparar(nombre, escenario, { runtime, sinCalidad, rapido })`, `llamadasRuntime`, `registrosWorker`; la siembra de modelos incluye los archivos extra (yaml de Calidad) en `verificados.json`.
- **Fallo del doble corregido**: `manifiestoParaEscenario` (runtime falso) con `modelos: 'diminutos'` descartaba los `extra`, así que Calidad descargada por el runtime falso no tenía su `.yaml` y el worker fallaba con `MODELO_NO_DISPONIBLE`. Ahora los extra también son diminutos (`escenario.ts` + `falso.test.ts`).
- **Nunca Rápido sin consentimiento**: `sinRapido()` comprueba `rapido_aceptado === null`, que no hay descargas de Rápido en el registro de llamadas del runtime falso, que ninguna canción tiene `pistas.modelo` de Rápido y que `registros/worker-*.log` no menciona Rápido (el registro del worker solo guarda stdout/stderr; la comprobación fuerte es la de la descarga y la de la canción).
- **Cómo probarlo**: `cd app && npm run build && npx playwright test e2e/separacion-errores.spec.ts`.
- **Notas**: el escaneo de la biblioteca solo ocurre al arrancar, así que "reescanear" en la prueba de Re-separar es cerrar y reabrir la app. Los textos de reintento son instantáneos (espera 0): se capturan con un `MutationObserver` en la página. Duración local ≈ 95 s en serie (14 pruebas); deuda: si la CI de Linux supera los 90 s, bajar `fases.modelo.ms` (6000) de "Volver a Calidad".
