# 0173 — Biblioteca: selección múltiple y «Aplicar tema…» en lote

- Estado: Hecha
- Paso del pipeline: 5
- Depende de: [0172](0172-biblioteca-agrupacion-busqueda-y-linea-de-tema.md), [0169](0169-base-de-temas-en-el-renderer.md) (en paralelo con [0174](0174-biblioteca-tema-de-artista-y-album.md))
- ADRs: [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §7 (`aplicar`, excepción por canción, progreso y resultado)
- Specs: [Biblioteca · Fase 3, «Selección múltiple y «Aplicar tema…»»](../ux/02-biblioteca.md#selección-múltiple-y-aplicar-tema) (B8–B11), [0054](../preguntas/0054-detalles-de-interfaz-de-temas-y-biblioteca.md) §8

## Objetivo

Modo selección con barra fija, casillas en tarjetas y casilla tri-estado en el hueco `casilla` del encabezado de grupo, rango con Mayús, «Seleccionar visibles», persistencia de la selección entre búsqueda, filtro, agrupación y plegado, y el diálogo «Aplicar tema» (confirmación con notas por canción, aplicación con progreso, resultado por canción y «Revisar y reintentar»). También «Aplicar tema…» en el menú ⋯ de una tarjeta.

## Contrato

- Estado de selección en un hook propio (`useSeleccion.ts`) por id, independiente de la vista; las eliminadas salen sin aviso; las que pasan a Dañada siguen contadas.
- No seleccionables: Dañadas con `motivo: "json"` (casilla `aria-disabled`, `bib.sel.noEditable`). Sí: borradores, listas y Dañadas por pistas.
- El diálogo usa `temas.previsualizar({ tipo: "aplicar", … })` y recalcula al cambiar el tema; notas `bib.lote.nota.*` derivadas de `antes` y `efecto`; botón con el número de `efecto: "cambia"`; inactivo con `bib.lote.nadaQueCambiar` si es 0.
- Ejecución: `temas.ejecutar` con progreso «Aplicando… {i} de {n}»; sin cerrar con Esc mientras dura; resultado con `aplicada`/`sin_cambios`/`omitida` (motivo)/`error` (código, «Copiar detalles»); «Revisar y reintentar» incluye solo `error` y `omitida: cambio` y vuelve a previsualizar.
- `CONFIRMACION_OBSOLETA` antes de empezar actualiza la lista con `tema.obsoleto`; `TEMA_NO_ENCONTRADO` o `BORRADO_PENDIENTE` → `tema.error.noExiste` sin aplicar.
- Catálogo vacío o en solo lectura: «Aplicar tema…» inactivo con `bib.temas.vacio` o `bib.temas.soloLectura`.

## Archivos

- `app/src/renderer/src/vistas/biblioteca/useSeleccion.ts`, `BarraSeleccion.tsx`, `CasillaGrupo.tsx`, `DialogoAplicarTema.tsx` y sus pruebas (nuevos).
- `app/src/renderer/src/vistas/biblioteca/Biblioteca.tsx` (montar barra, pasar `casilla` al encabezado, atajos Ctrl/Cmd + A y Esc), `TarjetaCancion.tsx` (casilla y menú ⋯), `biblioteca.module.css`, `Biblioteca.acciones.test.tsx`.
- No modifica `EncabezadoGrupo.tsx` (usa su hueco `casilla`).

## Criterios de aceptación

- [x] B8: «Seleccionar» y Ctrl/Cmd + A entran; Espacio, Intro y clic alternan; Mayús + clic hace rango en orden visual; Dañadas por JSON no se marcan y explican por qué, las Dañadas por pistas sí; casilla de grupo tri-estado; la selección sobrevive a búsqueda, filtro y agrupación y la barra dice cuántas quedan fuera; Esc y «Terminar» salen y vacían.
- [x] B9: el diálogo lista todas las seleccionadas con su nota, el aviso de personalizadas y el número que cambiará; con todas iguales, el botón está inactivo con su motivo.
- [x] B10 (con el doble): 3 aplicadas, 1 «No se pudo guardar» y 1 «Cambió mientras confirmabas»; «Revisar y reintentar» vuelve a confirmar solo esas 2.
- [x] B11: tras un lote correcto sale del modo con el foco en «Seleccionar»; con fallos, sigue en el modo con las fallidas seleccionadas y el foco en «Aplicar tema…»; el resultado se anuncia una vez.
- [x] Desde el ⋯ de una tarjeta el diálogo trabaja con una canción y devuelve el foco a la tarjeta.

## Notas de implementación

- **Hecho**: modo selección de sesión (`useSeleccion.ts`, por id; sobrevive a búsqueda, filtro, agrupación, plegado y a salir de la vista), `BarraSeleccion.tsx` (sticky; contador, «{k} fuera de la vista», «Aplicar tema…» inactivo con `bib.sel.ninguna`/`bib.temas.vacio`/`bib.temas.soloLectura`), `CasillaGrupo.tsx` (tri-estado, en el hueco `casilla`), casilla y alternancia en `TarjetaCancion.tsx` (sin ⋯ ni acción principal en el modo; Dañadas por JSON `aria-disabled` con `title` y aviso al intentar marcar), Mayús + clic en orden visual, Ctrl/Cmd + A, Esc y «Terminar» con foco a «Seleccionar», y `DialogoAplicarTema.tsx` (notas `bib.lote.nota.*` derivadas de `antes`/`efecto`, aviso de personalizadas, botón con las que cambian, progreso «Aplicando… i de n», resultado por canción, «Revisar y reintentar», `CONFIRMACION_OBSOLETA`, `TEMA_NO_ENCONTRADO`/`BORRADO_PENDIENTE`). «Aplicar tema…» en el ⋯ (foco de vuelta a la tarjeta). Textos en `textosSeleccion.ts`.
- **Decisiones**: el tema inicial del diálogo es el predeterminado si está entre los ofrecibles, si no el primero. «se aplicó a a de n» cuenta `aplicada` + `sin_cambios`. «Fallidas» = `error` + `omitida: cambio`; con fallos se queda en el modo con ellas seleccionadas. «fuera de la vista» cuenta las que no pasan búsqueda/filtro (las de grupos plegados no). Para procedencia `incluido` en la nota la spec no da texto: «Ahora usa el estilo incluido». No se usa `ProgresoOperacion` (el botón ya dice el avance).
- **Deuda**: con catálogo vacío o en solo lectura el ⋯ no ofrece «Aplicar tema…» (en lugar de mostrarlo inactivo) porque `ItemMenu` no admite estado inactivo; hace falta ampliar `MenuContextual`. Se tocó `temas/useCatalogoTemas.ts` (mínimo): tolera dobles sin `alCambiarTemas` (App.test y otros).
- **Probar**: `npx vitest run src/renderer/src/vistas/biblioteca` (nuevas: `Biblioteca.seleccion.test.tsx`, `useSeleccion.test.ts`, `textosSeleccion.test.ts`). Faltan E2E y capturas B16 (0176).
