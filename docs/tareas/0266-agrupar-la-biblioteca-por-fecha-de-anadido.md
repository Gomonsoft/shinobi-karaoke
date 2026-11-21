# 0266 — Agrupar la Biblioteca por «Fecha de añadido»

- Estado: Pendiente
- Paso del pipeline: 0 (Biblioteca)
- Fase: 8 de 0.2.1 · Lote C (render, biblioteca y preferencias)
- Depende de: 0283 (`creada` en el resumen), 0264 (mismo lote, en orden)
- ADRs: [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md#revisión-para-021--agrupar-por-fecha-de-añadido) (revisión para 0.2.1); [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-021) (`creada` tolerante)
- Spec UX: [02 · Fase 8, «Agrupar por «Fecha de añadido»»](../ux/02-biblioteca.md#agrupar-por-fecha-de-añadido), criterios **B8-3**, **B8-4**, **B8-5**, **B8-6**; claves `bib.agrupar`, `bib.grupo.fecha.*`, `bib.grupo.sinFecha*`; [sistema visual · 0.2.1](../ux/sistema-visual.md#021--sincronía-editor-preciso-y-barra-de-carga-fases-8-y-9) (encabezado de grupo por fecha)
- Tamaño: M

## Objetivo

Cuarta opción de «Agrupar por» con los grupos Hoy · Ayer · Esta semana · Este mes · un grupo por mes y año · Sin agrupar, a partir de `creada`.

## Archivos (solo estos)

- `app/src/shared/config.ts` (`AGRUPACIONES_BIBLIOTECA` con `"fecha"`) y `config.test.ts`
- `app/src/shared/cancion.ts` (`CREADA_POR_DEFECTO` y `creada` tolerante) y `cancion.test.ts`
- `app/src/main/biblioteca/resumen.ts` (`creada: string | null`) y su test
- `app/src/renderer/src/vistas/biblioteca/agrupacion.ts`, `agrupacion.test.ts`, `EncabezadoGrupo.tsx`, `Biblioteca.tsx` (control «Agrupar por») y sus tests y textos

## Criterios de aceptación

- [ ] `creada` se lee con `.catch(CREADA_POR_DEFECTO)` (`1970-01-01T00:00:00.000Z`): una canción con `creada` ausente o ilegible **no** sale dañada y no se reescribe al abrir. El resumen da `creada: null` en ese caso.
- [ ] `config.biblioteca.agrupar` acepta `"fecha"` con la lectura tolerante de siempre; se conserva al volver de otra vista y al reiniciar (B8-3).
- [ ] La función pura de agrupación recibe la fecha actual y aplica los grupos, el orden, los solapes, la fecha futura (= Hoy) y la semana desde el lunes en hora local exactamente como B8-4 (los dos escenarios del criterio como pruebas).
- [ ] Dentro de un grupo por fecha, orden por `creada` descendente; en «Sin agrupar», por `modificada` (B8-5).
- [ ] Encabezados como los de la fase 3, sin tema ni [Tema…]; «Sin agrupar» al final con `bib.grupo.sinFecha.ayuda` (singular y plural) (B8-6). Búsqueda, filtro, selección, plegado y *roving tabindex* como en las demás agrupaciones.
- [ ] Los grupos se recalculan al mostrar la vista, no bajo el cursor; una canción nueva aparece en «Hoy».

## Pruebas de feedback

- Unitarias: `agrupacion.test.ts` (B8-4 completo, B8-5, B8-6), `cancion.test.ts` (tolerancia), `resumen` (`null`), `config.test.ts`.
- E2E: `e2e/temas-biblioteca.spec.ts` solo si comprueba las opciones del control (ajustar y ejecutar).
- Críticos: sí (`shared/`, `main/`, Biblioteca).
- Manual: guía de la fase 8 — elegir «Fecha de añadido» con la biblioteca real y reiniciar. Captura B8-7 en 0271.

## Notas de implementación
