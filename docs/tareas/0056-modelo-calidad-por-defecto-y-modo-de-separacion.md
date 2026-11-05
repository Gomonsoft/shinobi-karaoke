# 0056 — Modelo Calidad por defecto en todos los perfiles y modo de separación interno (sin elección en Ajustes)
- Estado: Hecha
- Paso del pipeline: 0 y 2
- Depende de: 0029, 0034, 0035 (Hechas); en paralelo con 0055
- ADRs: 0004, 0006 y 0009 (Revisiones 2026-11-05)
- Spec UX: docs/ux/01-primer-arranque.md (mensajes de modo `pa.modo.*`), docs/ux/08-ajustes-y-acerca.md; cambios pendientes en `preguntas/0019` (opción provisional)
- Cuándo: **antes de la Fase 3**: el comando `separar` y la estimación previa dependen del modelo vigente

## Objetivo
Que el primer arranque descargue **siempre** el modelo Calidad, también en equipos solo CPU, y que el modo de separación deje de depender del perfil. Rápido no se descarga ni se usa sin consentimiento; el flujo para aceptarlo es la tarea 0057.

## Criterios de aceptación
- [ ] `app/src/shared/manifiesto.ts`:
  - `modeloDelPerfil` desaparece y se sustituye por `MODELO_POR_DEFECTO = 'calidad'`.
  - `bytesTotalesInstalacion` suma siempre Calidad (913 MB + yaml).
  - Tests de `manifiesto.test.ts` y `manifiestoReal.test.ts` actualizados.
- [ ] `app/src/shared/config.ts`:
  - `separacion.modo`: `z.enum(['calidad', 'rapido'])`, por defecto `'calidad'`. Un `'automatico'` guardado se acepta al leer y se convierte en `'calidad'` (preprocesado; sin subir `esquema`, lectura tolerante del ADR 0006).
  - Nuevo `separacion.rapido_aceptado: z.string().datetime().nullable().default(null)`.
  - `ipc.ts`: la actualización de config desde el renderer **ya no acepta `separacion.modo`** (ni `rapido_aceptado`). Solo los cambian `aceptarYUsarRapido` y `volverACalidad` de 0057 (decisión del usuario, 2026-11-05: Rápido no es elegible en Ajustes). Test: una actualización con `modo` se rechaza.
  - Tests de `config.test.ts` y `configuracion/servicio.test.ts`, incluida la migración de `automatico`.
- [ ] `main/configuracion/servicio.ts` (modo efectivo):
  - devuelve `modo`;
  - si es `'rapido'` pero falta el consentimiento o el modelo, devuelve `'calidad'`;
  - nunca devuelve `'rapido'` sin `rapido_aceptado`;
  - se elimina la regla "sin perfil → `rapido`".
- [ ] `main/runtime/gestor.ts`:
  - **Fase de modelo**: descarga el modelo del **modo vigente**: Calidad, o Rápido solo si `modo === 'rapido'` y hay `rapido_aceptado`.
  - **Rebaja del diagnóstico** (`cuda` → `cpu`): no cambia el modelo. `recalcularTotales` ya no reduce el total por la rebaja.
  - **Defensa**: `descargarModelo('rapido')` sin `rapido_aceptado` lanza `ErrorRuntime('ARGUMENTOS_NO_VALIDOS', …)` y no escribe nada en `modelos/`. Lleva test.
- [ ] `main/runtime/servicio.ts`:
  - el `modo` publicado en el estado y `estimarSeparacion` usan el modo vigente, no el perfil;
  - la comprobación barata de §6 exige el modelo del modo vigente.
- [ ] **Instalaciones existentes de desarrollo** (perfil `cpu` con solo Rápido descargado, sin consentimiento):
  - al arrancar, la comprobación barata falla por falta de Calidad;
  - se muestra B5 "Hay que reparar…" y se descarga Calidad (solo la fase de modelo).
  - Test con el runtime falso.
- [ ] **Textos provisionales** (hasta `preguntas/0019`):
  - con perfil `cpu`, o rebajado, B2/B3 muestran el mensaje de Calidad adaptado ("con el procesador");
  - ninguna pantalla del primer arranque dice que se usará Rápido.
  - `PantallasInicio.tsx` / `modelo.ts` con los tamaños nuevos (≈ 1,3–1,4 GB en CPU).
- [ ] Escenarios del runtime falso (`main/runtime/falso/escenario.ts`) y E2E de 0039: el perfil `cpu` descarga Calidad; el escenario de rebaja sigue con Calidad.
- [ ] `app/scripts/instalar-runtime.mjs`: se quita el comentario de "Modo Rápido (el perfil `cpu` ya lo implica)". El script instala Calidad por defecto (el cambio de medición es la tarea 0058).
- [ ] `docs/ux` no se toca (es del diseñador). Si un texto de la spec contradice el comportamiento, se anota en las notas de esta tarea.

## Notas de implementación
**Qué se hizo**
- `shared/manifiesto.ts`: `modeloDelPerfil` -> `MODELO_POR_DEFECTO = 'calidad'`; `bytesTotalesInstalacion` suma siempre Calidad; nuevo `rangoDescargaPlataforma` (menor/mayor descarga para `pa.req.descarga.generica`).
- `shared/config.ts`: `separacion.modo` = `calidad | rapido` (por defecto `calidad`; `automatico` guardado se lee como `calidad` con `z.preprocess`, sin subir `esquema`) y `separacion.rapido_aceptado` (datetime | null). `ipc.ts`: el renderer ya no puede actualizar `separacion` (test en `handlers.test.ts` y `config.test.ts`); `estimacionSeparacionSchema` gana `aproximada?` y `RequisitosRuntimeIpc` gana `rangoDescarga?`.
- `configuracion/servicio.ts`: `modoSeparacionVigente` (Rápido solo con `modo` y `rapido_aceptado`) y `modoSeparacionEfectivo` (además exige el modelo descargado); se elimina la regla "sin perfil -> rapido".
- `runtime/gestor.ts`: la fase de modelo descarga el modelo del modo vigente; la rebaja no cambia modelo ni totales; nuevo `descargarModelo(id)` que lanza `ErrorRuntime('ARGUMENTOS_NO_VALIDOS')` para `rapido` sin `rapido_aceptado` (la fase de modelo aplica la misma defensa); la comprobación barata y la verificación completa exigen el modelo vigente. `servicio.ts` y `deteccion.ts` (`modoPrevisto` siempre `calidad`) usan el modo vigente.
- Instalaciones de desarrollo con solo Rápido: la comprobación barata devuelve `dañada/modelo` (B5 "Hay que reparar") y reparar descarga solo Calidad (tests en `arranque.test.ts`).
- Renderer: textos definitivos de `ux/01` tras la respuesta a la pregunta 0019 (`pa.modo.calidad.*`, `pa.modo.rebajado.*` con el tiempo de 4 min, `pa.listo.modelo`, `pa.listo.tiempo.aprox`, `pa.req.descarga.generica` calculado del manifiesto). B2 pide la estimación también durante la instalación y al cambiar la rebaja. `AcercaDe`: sin "Automático".
- `semilla.ts`, E2E y `instalar-runtime.mjs` (ya no fuerza `modo: 'rapido'`): Calidad. E2E 5 comprueba que la rebaja no cambia el total.

**Cómo probarlo**: `npm run lint && npm run typecheck && npx prettier --check . && npx vitest run && npm run test:e2e` (con `SHINOBI_UV`). Resultado: lint, typecheck y format limpios; 1030 tests pasan (6 omitidos); E2E 36 pasan (1 omitido, YouTube con red).

**Notas / deuda**
- `ux/01` dice 6-15 min para CPU x86; el manifiesto da `[1.5, 4] x 4 = 6-16`, así que la UI muestra "entre 6 y 16" (sale del manifiesto).
- La spec de `ux/08` (Ajustes sin elección de modo) y la oferta de Rápido (diálogo, banner B4, variante B2/B3) quedan para 0057 y la tarea de Ajustes; `nombreModoFinal` ya admite `rapido`.
- Los textos `rapido.*`, `aceptarYUsarRapido` y `volverACalidad` no se implementan aquí (0057).
