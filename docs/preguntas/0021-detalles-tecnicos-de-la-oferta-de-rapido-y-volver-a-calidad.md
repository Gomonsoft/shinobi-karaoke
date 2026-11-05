# 0021 — Detalles técnicos de la oferta del modelo Rápido y de "Volver a Calidad"
- De: disenador-ux
- Para: arquitecto
- Estado: Respondida
- Bloquea: no (las specs 01, 04 y 08 ya describen el comportamiento esperado; si alguno no es viable, se ajusta el texto)

## Contexto
Al responder [`0019`](0019-calidad-por-defecto-y-rapido-con-consentimiento.md) se actualizaron `ux/01` (B1–B4, diálogo compartido `aviso-rapido`), `ux/04` (banner con la oferta) y `ux/08` (sección informativa y "Volver a Calidad"). Hay cuatro puntos que dependen de la API del runtime (tareas 0056 y 0057).

## Pregunta
1. **"Reintentar" tras fallar la descarga de Rápido ya aceptado** (`ux/01`, B4; `ux/04`, banner): la spec pide que "Reintentar" vuelva a descargar **Rápido** sin pedir otra vez el consentimiento (ya está en `rapido_aceptado`) y sin mostrar de nuevo la oferta. Con la tarea 0057, si la descarga falla el modo sigue en `calidad`, así que un "Reintentar" normal de la fase de modelo volvería a Calidad. ¿Se resuelve llamando otra vez a `aceptarYUsarRapido(origen)` (¿la oferta sigue "vigente" para su precondición?) o con otro mecanismo? ¿Qué vale `ofrecerRapido` en ese momento?
2. **Descarga de "Volver a Calidad" fuera de Ajustes** (`ux/08`): la spec dice que la descarga continúa si el usuario sale de Ajustes, que al volver se ve su progreso y que cerrar la app la interrumpe **sin diálogo** (se conserva el `.descarga` reanudable). ¿Expone el estado del runtime una operación `volverACalidad` en curso (progreso, error) para que Ajustes se reenganche? ¿El diálogo de cierre de la app debe ignorarla (no es un trabajo de canción)?
3. **Estimación "aproximada"** (`pa.listo.tiempo.aprox`, `aj.sep.tiempo.aprox`): la interfaz necesita saber si el tiempo estimado viene de un factor **medido** (en el equipo o en el manifiesto) o de la estimación del ADR 0004 (factor `null`). ¿Puede `estimarSeparacion` devolver también ese origen?
4. **Descripción del equipo en Ajustes** (`aj.sep.equipo`): para "tarjeta gráfica NVIDIA ({n} GB)" y "tarjeta gráfica NVIDIA (no se puede usar: se usa el procesador)", ¿el estado del runtime expone la VRAM detectada y si el diagnóstico rebajó el perfil?

## Opción provisional tomada (si no bloquea)
1. Reintentar llama otra vez a `aceptarYUsarRapido` con el mismo origen.
2. Si el estado no expone la operación, al volver a Ajustes se muestra el botón "Volver a Calidad…" de nuevo (la descarga reanudable continúa donde lo dejó al pulsarlo).
3. Sin el dato, se usa siempre la variante `.aprox` cuando el factor del manifiesto es `null` y no hay factor medido en `config.json`.
4. Sin VRAM: "tarjeta gráfica NVIDIA".

## Respuesta
(arquitecto, 2026-11-05)

Los cuatro puntos son viables tal como los describen las specs. Se aceptan las opciones provisionales 1 y 3 con un ajuste técnico; las 2 y 4 se mejoran porque el dato ya existe o es barato exponerlo. Detalle en ADR 0004 (Revisión 2026-11-05 bis) y en las tareas 0057, 0066, 0067 y 0074.

1. **Reintentar tras fallar la descarga de Rápido ya aceptado → se vuelve a llamar a `aceptarYUsarRapido(origen)`** (opción provisional).
   - La precondición de 0057 pasa a ser: oferta vigente **o** "Rápido pendiente".
   - **Rápido pendiente** se deriva de `config.json`, sin campos nuevos: `rapido_aceptado` no nulo, `modo === 'calidad'` y Rápido fuera de `modelos_descargados`. Es decir, el usuario aceptó y la descarga no terminó. Así sobrevive a un reinicio. Deja de cumplirse en cuanto Rápido queda verificado: después, aunque se vuelva a Calidad, hará falta un fallo nuevo y una oferta nueva.
   - El estado del runtime expone `rapidoPendiente: boolean`.
   - Mientras `rapidoPendiente`, `ofrecerRapido` vale **`false`**: la interfaz no repite la oferta ni el diálogo. "Reintentar" llama a `aceptarYUsarRapido(origen)` (consentimiento ya guardado, se conserva la primera fecha) y, en la separación, después a `separacion.separar(id)`.
   - **Al reiniciar la app** con la separación aún en `error`, la vista vuelve a mostrar el banner de error de Calidad. Si `rapidoPendiente`, su botón secundario es "Usar el modelo Rápido" **sin diálogo**: el consentimiento ya consta. No pide texto nuevo: es el mismo botón sin "…".
2. **"Volver a Calidad" fuera de Ajustes → sí, el estado del runtime la expone.**
   - `estado().volverACalidad`: `null` o `{ estado: 'descargando' | 'error', bytes, total, error: { codigo, mensaje } | null }`. El progreso llega por el `alProgreso` del runtime que ya existe. Al volver a Ajustes, la vista se reengancha leyendo el estado.
   - Es una **operación del runtime, no un trabajo de canción**: no aparece en el panel de actividad, no cuenta para `trabajos.hayPendientes()` y **el diálogo de cierre la ignora** (0073).
   - Al salir se aborta la descarga sin preguntar y se conserva `modelos/<archivo>.descarga`; el siguiente "Volver a Calidad" continúa con `Range`.
   - Solo puede haber una a la vez: una segunda llamada recibe la misma promesa.
   - `runtime.cancelarVolverACalidad()` la cancela.
   - Si una separación empieza mientras se descarga Calidad, usa Rápido (modo vigente al empezar).
3. **Origen de la estimación → sí.** `estimarSeparacion` y `separacion.estimar` devuelven `{ min, max, origen: 'medido_equipo' | 'referencia_medida' | 'estimado' }`:
   - `medido_equipo`: factor de `config.separacion.factores_medidos`;
   - `referencia_medida`: factor del manifiesto no nulo;
   - `estimado`: factor `null` en el manifiesto y valor de `estimacion`.
   La interfaz usa la variante `.aprox` solo con `estimado`. Tarea 0067.
4. **VRAM y rebaja → sí, ya existen en `config.instalacion`.** `hardware.gpu`, `hardware.vram_mb`, `perfil_previsto` y `motivo_rebaja` (0031/0032). El estado del runtime expone:
   - `equipo: { gpu: string | null, vramMb: number | null, perfilPrevisto, perfil, motivoRebaja }`.
   - "Tarjeta gráfica NVIDIA ({n} GB)" con `perfil === 'cuda'` y `vramMb`, redondeado a GB.
   - "…(no se puede usar: se usa el procesador)" con `perfilPrevisto === 'cuda'` y `perfil === 'cpu'`.
   - Sin VRAM conocida: "tarjeta gráfica NVIDIA".
   - Apple Silicon y CPU: los textos de la spec, sin datos extra.
   Tarea 0074.

Tareas ajustadas: 0057 (precondición, `rapidoPendiente`, `volverACalidad` en el estado, cancelación y cierre), 0067 (origen), 0066, 0068 y 0074 (consumen estos datos), 0073 (ignora "Volver a Calidad").

