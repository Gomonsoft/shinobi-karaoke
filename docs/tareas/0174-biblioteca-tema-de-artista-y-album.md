# 0174 — Biblioteca: tema de artista y de álbum desde el encabezado del grupo

- Estado: Hecha
- Paso del pipeline: 5
- Depende de: [0172](0172-biblioteca-agrupacion-busqueda-y-linea-de-tema.md), [0169](0169-base-de-temas-en-el-renderer.md) (en paralelo con [0173](0173-biblioteca-seleccion-multiple-y-aplicar-tema.md))
- ADRs: [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §4, §7 (`asignarGrupo`)
- Specs: [Biblioteca · Fase 3, «Grupos» y «Tema de un artista o de un álbum»](../ux/02-biblioteca.md#tema-de-un-artista-o-de-un-álbum) (B5, B5b, B6), incluidas la variante «destinos distintos» de `bib.grupo.impacto` al quitar el tema de un grupo y el destino `respaldo` de [0056](../preguntas/0056-destino-respaldo-y-canciones-pendientes.md)

## Objetivo

Rellenar el hueco `tema` del encabezado de grupo: texto `bib.grupo.tema`/`bib.grupo.sinTemaPropio`/`bib.grupo.temaBorrando`, botón [Tema…] con su nombre accesible y `DialogoTemaGrupo` de 0169; tras aplicar, toast `bib.grupo.toast`, tarjetas actualizadas en vivo sin moverse y foco de vuelta en [Tema…].

## Contrato

- El tema del grupo sale de `CatalogoIpc.asignaciones` por clave (artista, o par artista + álbum), nunca del nombre visible.
- Los grupos visuales (sin artista, sin álbum, álbum sin artista) no tienen [Tema…] y muestran `bib.grupo.sinTema.*`.
- Catálogo vacío o en solo lectura: [Tema…] inactivo con `bib.temas.vacio` o `bib.temas.soloLectura`.
- Tras `temas:cambiado`, la Biblioteca vuelve a pedir `biblioteca.listar()` una vez (ADR 0016 §9) y conserva foco y desplazamiento.
- Los textos del impacto (también al quitar, con destinos iguales o distintos, la fila de cada canción y el destino `respaldo`: fila «destino no disponible», «quitar, todas no disponibles» y `bib.grupo.impacto.noDisponible`) son de `DialogoTemaGrupo` de 0169, que los saca del `despues` de cada afectada. Esta tarea no los recalcula: comprueba el flujo de punta a punta.
- Tras quitar el tema de un grupo con afectadas que van a `respaldo`, sus tarjetas muestran «⚠ Tema no disponible» (línea de tema de 0172); el toast es `bib.grupo.toast` (quitar), sin variante propia.

## Archivos

- `app/src/renderer/src/vistas/biblioteca/TemaGrupo.tsx`, `TemaGrupo.test.tsx` (nuevos).
- `app/src/renderer/src/vistas/biblioteca/Biblioteca.tsx` (pasar `tema` al encabezado y refrescar con `temas:cambiado`), `biblioteca.module.css`.
- No modifica `EncabezadoGrupo.tsx` (usa su hueco `tema`).

## Criterios de aceptación

- [x] B5: [Tema…] muestra el impacto recalculado al cambiar de opción, excluyendo personalizadas, asignadas y (artista) las de álbum con tema; al aplicar, las tarjetas afectadas cambian portada y línea de tema sin moverse, el encabezado muestra el tema y el foco vuelve a [Tema…]; quitar el tema devuelve sus canciones al siguiente nivel. Si todas van al mismo destino, el diálogo dice «{n} canciones pasarán a usar «{tema}», {procedencia}». Si no (por ejemplo, una con base «al azar» y otra que sigue al predeterminado), muestra la variante «destinos distintos» y la lista revelable da el destino de cada una («usará «{tema}» ({procedencia corta})» o «usará el estilo incluido»). Tras aplicar, la línea de tema de cada tarjeta coincide con el destino anunciado.
- [x] B5b (con el doble y sembrado en 0176): un álbum con tema y dos canciones que lo heredan, una con base «al azar» de un tema que no está en el catálogo y otra sin base; elegir «Sin tema de álbum» muestra «destinos distintos», `bib.grupo.impacto.noDisponible` con r = 1 y, en «Ver las canciones», la fila «destino no disponible» con ⚠ y sin nombre de tema; si las dos tienen esa base, «quitar, todas no disponibles» sin la línea extra. Botones y foco inicial no cambian. Tras aplicar, esas tarjetas muestran «⚠ Tema no disponible» y el foco vuelve a [Tema…].
- [x] B6: con una canción asignada, una con tema de álbum, una con tema de artista y una con el predeterminado, la línea de tema de cada tarjeta es la esperada.
- [x] Un tema de grupo en borrado pendiente se ve con `bib.grupo.temaBorrando` y [Tema…] permite elegir otro.
- [x] Confirmación obsoleta, error de escritura y tema inexistente se tratan como en el editor.

## Notas de implementación

- **Hecho**: `TemaGrupo.tsx` rellena el hueco `tema` (solo grupos `asignable`): `bib.grupo.tema`/`sinTemaPropio`/`temaBorrando`, [Tema…] con nombre accesible, `DialogoTemaGrupo` de 0169, toast `bib.grupo.toast`, error con toast y «Copiar detalles», foco de vuelta a [Tema…] (explícito). El tema del grupo sale de `CatalogoIpc.asignaciones` por clave (`temaAsignadoAGrupo` en `agrupacion.ts`, a partir del id del grupo). Inactivo con `bib.temas.vacio`/`soloLectura`. `useBiblioteca` vuelve a pedir `listar()` una vez por `temas:cambiado` y fusiona en su sitio (`fusionarResumenes`, sin reordenar). Unificado `textosTema.ts` con `procedenciaCorta` (borrada `PROCEDENCIA_CORTA`, textos visibles idénticos); ahí quedan también los textos `GRUPO`.
- **Decisiones**: si el tema del grupo está en borrado, el diálogo arranca en «Sin tema…» (no se ofrece el tema en borrado).
- **Probar**: `npx vitest run src/renderer/src/vistas/biblioteca/TemaGrupo.test.tsx` (incluye flujo B5, B5b con el doble y refresco único). Faltan E2E, siembra de B5b y capturas (0176).
