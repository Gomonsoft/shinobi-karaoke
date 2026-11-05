# 0056 — Modelo Calidad por defecto en todos los perfiles y modo de separación interno (sin elección en Ajustes)
- Estado: Pendiente
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
(las rellena el programador al terminar)
