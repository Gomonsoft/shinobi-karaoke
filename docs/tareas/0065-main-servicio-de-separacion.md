# 0065 — Main: servicio de separación (encolar en la cola pesada, pistas, factor medido y limpieza)
- Estado: Hecha
- Paso del pipeline: 2
- Depende de: 0056, 0059, 0060, 0063, 0064
- ADRs: 0004 (Ejecución; Revisiones 2026-11-05), 0006 (`pistas`, pasos), 0009 §4 (`*.partial`), §8 (dobles)
- Spec UX: docs/ux/04-progreso-pipeline.md (estados del paso), docs/ux/00-mapa-de-vistas.md §3 (secuencia)
- Cuándo: en paralelo con 0061, 0062, 0067 y 0068 (la vista se prueba antes con la API falsa)

## Objetivo
`main/separacion/servicio.ts`: lanza, recoge y limpia las separaciones. Los reintentos por memoria, la descarga del modelo que falta y la oferta de Rápido son de 0066. Aquí la política de reintento es `null`.

## Criterios de aceptación
- [ ] **Encolar automáticamente al completar la fuente**:
  - archivo local: tras materializar la canción (0042);
  - YouTube: en el `alResultado` de `descargar-youtube` (0049), después de escribir `fuente` `completado`.
  - No se encola al arrancar la app (los `pendiente`/`interrumpido` esperan a "Separar ahora"/"Reintentar") ni para las canciones de la semilla.
- [ ] **`separar(cancionId)`** (canal `separacion.separar` de 0059). Se acepta si:
  - la canción no está dañada por JSON ilegible;
  - existe `fuente/mezcla.flac` y el paso `fuente` está `completado`;
  - no hay ningún trabajo vivo de esa canción en la cola pesada;
  - `separacion` está en `pendiente`, `error` o `interrumpido`, o en `completado` con la canción **dañada porque faltan las pistas** ("Re-separar pistas", `ux/02`).
  En otro caso → `ARGUMENTOS_NO_VALIDOS` (sin escribir nada). Con la instalación no `completa` → `RUNTIME_NO_DISPONIBLE`.
- [ ] **Argumentos** (0059):
  - `modelo` = el del **modo vigente al empezar** (servicio de configuración de 0056: Calidad, o Rápido solo con `rapido_aceptado`), leído cuando el trabajo **empieza** y no al encolarlo (`ux/08`: los que están en cola usan el modo vigente al empezar). Hace falta un gancho del gestor `alEmpezar(trabajo) → args`, o construir los args de forma perezosa; anotar cuál se eligió;
  - `dispositivo` = `cuda` si el perfil vigente es `cuda`, si no `cpu` (Apple Silicon incluido, `preguntas/0010`);
  - `bloques` = `normal`;
  - `salida_dir` = `biblioteca/<id>/pistas.tmp/`, vaciada y creada antes de lanzar.
  - `TrabajoIpc.modo` = el modo realmente usado.
- [ ] **Progreso**: pasa a 0064 el ritmo esperado (duración de `metadatos.duracion_ms` × factor del modo y perfil vigentes, con la misma función que la estimación previa de 0067).
- [ ] **Al terminar bien** (`alResultado`, una sola escritura de `cancion.json` con el gestor):
  - mueve `pistas.tmp/voz.flac` y `instrumental.flac` a `pistas/` (`rename`; sustituye las anteriores si las había) y borra `pistas.tmp/`;
  - `pistas = { voz: 'pistas/voz.flac', instrumental: 'pistas/instrumental.flac', modelo: { perfil, nombre: <archivo del modelo>, version: <audio-separator> } }` (ADR 0006);
  - paso `separacion` `completado`; la canción deja de estar dañada por pistas (recalcular el resumen, como hace ya `servicio.ts`);
  - **factor medido**: `segundos_total / 60 / minutos de audio` → `config.separacion.factores_medidos[modo]` como media móvil (α = 0,5 con el anterior; el primero se guarda tal cual). No se guarda si el trabajo cambió de dispositivo en un reintento (0066).
- [ ] **Al cancelar o fallar** (`alDescartar`): borra `pistas.tmp/` y `modelos/*.partial`. Las pistas anteriores (Re-separar) **no** se tocan. Paso → `pendiente` (cancelación), `error` o `interrumpido` (cierre), con la lógica de 0014.
- [ ] **Al arrancar**: borra cualquier `biblioteca/*/pistas.tmp/` que quede (junto a la limpieza de `*.partial` que ya existe).
- [ ] **Doble**: `SHINOBI_SEPARADOR_FALSO` (y `SHINOBI_INTENTO`) se pasan al worker **solo sin empaquetar** (`app.isPackaged` → se borra, como `SHINOBI_YTDLP_FALSO` en `index.ts`).
- [ ] `biblioteca.eliminar(id)` sigue cancelando antes la separación (0014); test con un trabajo vivo.
- [ ] Tests:
  - unitarios con el gestor y el worker falsos: encolado al completar la fuente (archivo y YouTube), reglas de aceptación de `separar`, args con modo y dispositivo, modo leído al empezar (cambio de modo con el trabajo en cola), resultado → `pistas` + factor, cancelación → `pistas.tmp` borrada y pistas previas intactas, limpieza al arrancar;
  - integración (`*.integracion.test.ts`) con el worker real y el separador falso de 0060: dos canciones → la segunda en cola hasta que termina la primera.

## Notas de implementación
- **Servicio** (`app/src/main/separacion/servicio.ts`, `ServicioSeparacion`): `separar` (reglas de aceptación, `RUNTIME_NO_DISPONIBLE` tras validar argumentos), `alCompletarFuente`, `limpiarAlArrancar` (`biblioteca/*/pistas.tmp` y `modelos/*.partial`), `estimar` (cablea `estimarCancion` de 0067) y `entornoSeparadorFalso` (solo sin empaquetar; `index.ts` lo pasa al worker). Política de reintento `null`.
- **Gancho elegido: `alEmpezar`** en el gestor (`PeticionTrabajo.alEmpezar(trabajo) -> { args, ritmoEsperado?, modo?, dispositivo? }`): los args (modo vigente, dispositivo, `pistas.tmp` vaciada) y el ritmo esperado se calculan cuando el trabajo empieza. `TrabajoIpc.modo`/`dispositivo` salen de ahí. `PlanReintento.dispositivo?` queda preparado para 0066.
- **Encolado automático**: YouTube, por suscripción al gestor (trabajo `descargar-youtube` terminado `completado`, es decir tras escribir `fuente` completado); archivo local, con `ServicioImportacionArchivo.deps.alFuenteLista` tras `materializar`. No se encola al arrancar, ni en la semilla, ni al sustituir la fuente.
- **Ritmo esperado**: `estimarSegundosSeparacion` (0067) menos el arranque fijo medio (15 s). **Factor medido**: `segundos_total / 60 / minutos`, media móvil α = 0,5 en `config.separacion.factores_medidos[modo]`; no se guarda si el dispositivo o el modelo del resultado difieren de los del inicio.
- `pistas.modelo.perfil` = id del modelo (`calidad`/`rapido`, como el ejemplo del ADR 0006), `nombre` = archivo del checkpoint, `version` = audio-separator.
- **Tests**: `separacion/servicio.test.ts` (gestor real con worker falso y biblioteca real), `servicio.integracion.test.ts` (worker real + separador falso; `SHINOBI_UV`), `trabajos/gestor.test.ts` no cambia. Probar: `npx vitest run src/main/separacion`.
- **Deuda / para otras tareas**: la política de reintento de `separar` y `SHINOBI_INTENTO` por intento (0066, hoy el entorno se fija al lanzar el cliente); la descarga del modelo que falta (0066: ahora `MODELO_NO_DISPONIBLE`); no se encola al sustituir la fuente (queda "Separar ahora").
