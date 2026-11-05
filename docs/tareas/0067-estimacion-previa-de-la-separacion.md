# 0067 — Estimación previa de la separación ("Tardará unos N minutos")
- Estado: Hecha
- Paso del pipeline: 2
- Depende de: 0056, 0059
- ADRs: 0004 (Tiempos medidos y estimados; manifiesto y factor medido), 0009 §2 (`factores`, `estimacion`)
- Spec UX: docs/ux/04-progreso-pipeline.md (Tiempo restante: "Antes de empezar… «Tardará unos N minutos»"; `prog.eta.previa`), docs/ux/02-biblioteca.md (tarjeta en cola)
- Cuándo: en paralelo con 0060, 0063 y 0064; lo usan 0065 (ritmo esperado), 0068, 0071 y 0074

## Objetivo
Una única función que estime la duración de la separación de una canción con el modo y perfil vigentes, y un formateo compartido de "Tardará unos N minutos".

## Criterios de aceptación
- [ ] `shared/estimacion.ts`:
  - `estimarSegundosSeparacion(duracionMs, perfil, modo, factoresMedidos, manifiesto)` → `{ min, max, origen } | null`, con `origen`: `'medido_equipo'` (factor de `config`), `'referencia_medida'` (factor del manifiesto no nulo) o `'estimado'` (factor `null` y valor de `estimacion`) (`preguntas/0021` §3). La interfaz usa las variantes `.aprox` (`pa.listo.tiempo.aprox`, `aj.sep.tiempo.aprox`) solo con `'estimado'`. Reutiliza `estimarMinutosSeparacion` de `manifiesto.ts` (no lo duplica) y suma el coste fijo de arranque: ≈ 2 s de importar torch, 3–15 s de preparación y 1–3 s de carga del modelo (0005 §5 y §7). Se suman 10 s a `min` y 20 s a `max`, constantes con comentario.
  - `textoEstimacionPrevia({min, max})` → "Tardará unos N minutos" con N = redondeo hacia arriba del punto medio en minutos.
    - Por debajo de 2 min: "Tardará 1 minuto aprox." / "Tardará menos de 1 minuto" (mismas reglas que `prog.eta`).
    - `null` → sin texto: la interfaz no muestra nada, no "Calculando".
  - La usan también el ritmo esperado de 0064/0065 (con el punto medio) y los Ajustes (0074, "unos {a}–{b} min por canción de 4 min").
- [ ] `separacion.estimar(cancionId)` (canal de 0059) en main: lee `metadatos.duracion_ms` de la canción y llama a la función con el perfil, el modo vigente (0056) y `factores_medidos`. `runtime.estimarSeparacion(duracionMs)` se reescribe sobre la misma función (sin `modeloDelPerfil`).
- [ ] Con un factor medido, se usa ese y no el del manifiesto. Con el perfil `cpu` sin medir, se usa `estimacion.cpu.calidad` del manifiesto.
- [ ] Tests (incluido el `origen` de cada caso): canción de 4 min en `mps` con Calidad (factor 1,08–1,27 → "Tardará unos 5 minutos"), en `cpu` con la estimación, con un factor medido, < 1 min, sin datos → `null`.

## Notas de implementación
- **Qué se hizo**: `app/src/shared/estimacion.ts` (`estimarSegundosSeparacion` -> `{min,max,origen}|null` en segundos, con el arranque fijo +10 s/+20 s en `ARRANQUE_MIN_S/MAX_S`; reutiliza `estimarMinutosSeparacion`; `textoEstimacionPrevia` con segundos; `minutosMedios`), exportado desde `shared/index.ts`. `runtime.estimarSeparacion` se reescribe sobre ella y devuelve **minutos** con `origen` (se elimina `aproximada`: `estimacionSeparacionSchema` es ahora `estimacionCancionSchema`); B2/B3 usan la variante aprox solo con `origen === 'estimado'`. `app/src/main/separacion/estimar.ts` (`estimarCancion`) es el `separacion.estimar(cancionId)` (lee `metadatos.duracion_ms`); **0065 debe cablearlo** en `SeparacionIpc` (no hay servicio de separación aún). Cierra la deuda de 0044/0051: `anadir/AvisoLarga.tsx` añade "(unos {n} minutos en tu equipo)" al aviso de canción larga en los paneles de Archivo y YouTube, con N = punto medio redondeado hacia arriba (sin cifra si no hay estimación).
- **Decisiones**: la unidad de la función compartida es el segundo (la IPC sigue en minutos, como ya estaba definida). El texto "Tardará unos N minutos" aún no se muestra en ninguna vista: lo consumirán 0068/0071/0074 y el ritmo esperado de 0064/0065.
- **Cómo probarlo**: `npx vitest run src/shared/estimacion.test.ts src/main/separacion src/main/runtime/servicio.test.ts src/renderer/src/vistas/anadir`.
- **Deuda técnica**: cablear `estimarCancion` en 0065; los fallos de lint/typecheck/test de progreso (0063/0064) no son de esta tarea.
