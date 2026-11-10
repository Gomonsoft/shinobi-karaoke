# 0172 — Biblioteca: agrupar por artista y álbum, búsqueda en álbum y línea de tema

- Estado: Hecha
- Paso del pipeline: 5
- Depende de: [0164](0164-contratos-ipc-de-temas-y-apariencia.md) (y las funciones de [0163](0163-modelo-puro-de-temas-e-identidad.md)); en paralelo con 0169–0171 y 0175
- ADRs: [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §3 (`neutra`), §4, §9
- Specs: [Biblioteca · Fase 3](../ux/02-biblioteca.md#fase-3-de-020--temas-y-biblioteca): «Barra de herramientas», «Grupos», «Tarjeta: tema y portada», «Editar datos», «Foco y desplazamiento», «Estados nuevos» (B1–B4, B6, B7, B12–B15)

## Objetivo

Añadir «Agrupar por» persistente, grupos por artista y por álbum con identidad estricta y nombre visible, plegado de sesión, búsqueda flexible en título, artista y álbum por palabras, teclado *roving* entre grupos, línea de tema en la tarjeta, portada según `neutra` y el movimiento de la tarjeta al editar datos. Deja los encabezados de grupo con **dos huecos** (`casilla` y `tema`) que rellenan 0173 y 0174 sin tocar el componente.

## Contrato

- **Agrupación pura** (`vistas/biblioteca/agrupacion.ts`): de la lista filtrada a grupos con las claves del resumen (`claves.artista`, `claves.album`), nombre con `nombreVisibleGrupo`, orden con `Intl.Collator(undefined, { sensitivity: "base" })`, «Sin artista»/«Sin álbum» al final, «{álbum} — Sin artista» separado y álbumes homónimos de distinto artista separados. Recuento «{v} de {n}» con búsqueda o filtro.
- **Búsqueda** (`filtrado.ts`): `normalizarBusqueda` + espacios colapsados, cada palabra debe aparecer en título, artista o álbum. Nunca se usa como identidad.
- **Preferencia**: lee `config.biblioteca.agrupar` y escribe con `config.actualizar` al cambiar el control. El plegado vive en memoria de sesión.
- **Tarjeta**: línea `bib.tarjeta.tema` con `apariencia.temaNombre` y procedencia corta (`procedenciaCorta` de `renderer/src/temas/textos.ts` si 0169 ya está; si no, claves locales que 0169 absorbe), incluida «predeterminado anterior» («◐ Noche ninja · predeterminado anterior»). Una línea: si no cabe, se corta con «…» y el texto completo va en `title` y al final de `bib.aria.tarjeta`; «Tema personalizado», «Estilo incluido», «⚠ Tema no disponible». Portada con miniatura si `miniatura !== null && apariencia.neutra`, sin comparar estilos (ADR 0016 §3: `predeterminado_anterior` es neutra). Se deja de leer `config.estilo_predeterminado` en `Biblioteca.tsx` y `TarjetaCancion.tsx`. Menú ⋯ con hueco para «Aplicar tema…» (lo cablea 0173).
- **Editar datos**: al guardar un cambio de artista o álbum, la tarjeta se mueve al grupo nuevo, se despliega si hacía falta, recibe el foco con `block: "nearest"`, se anuncia `bib.anuncio.movida` y, si cambió `temaId` o `procedencia`, `bib.toast.temaCambiado`. Sigue visible hasta el siguiente cambio de búsqueda, filtro o agrupación aunque deje de coincidir.
- **Teclado y foco**: un punto de tabulación para todas las tarjetas, flechas cruzando grupos, Inicio/Fin por grupo y Ctrl/Cmd + Inicio/Fin global, grupos plegados excluidos; reglas de foco y anclaje de desplazamiento de la spec; `role="status"` con `bib.anuncio.resultados` a 500 ms.

## Archivos

- `app/src/renderer/src/vistas/biblioteca/agrupacion.ts`, `agrupacion.test.ts`, `EncabezadoGrupo.tsx` (nuevos).
- `app/src/renderer/src/vistas/biblioteca/Biblioteca.tsx`, `Biblioteca.test.tsx`, `filtrado.ts`, `filtrado.test.ts`, `TarjetaCancion.tsx`, `tarjeta.ts`, `tarjeta.test.tsx`, `DialogosCancion.tsx`, `biblioteca.module.css`, `useBiblioteca.ts`.
- Textos de la vista (`bib.*` nuevos) donde la Biblioteca los tenga hoy.

## Criterios de aceptación

- [x] B1: «Agrupar por» ofrece las tres opciones, persiste al cambiar de vista y al reiniciar (comprobado con el doble de `config`), y «Sin agrupar» es idéntica a la rejilla anterior.
- [x] B2–B3: «Queen», «QUEEN » y «queen» forman un grupo; «Canción» y «Cancion», dos; «Greatest Hits» de ABBA y de Queen, dos; los grupos sin metadatos van al final sin [Tema…] y con su texto.
- [x] B4: «queen   greatest» encuentra «Queen · Greatest Hits»; la búsqueda exige todas las palabras, se combina con filtro y agrupación, oculta grupos vacíos y anuncia el recuento una vez.
- [x] B6 y B14 (con resúmenes de prueba): la línea de tema muestra nombre y procedencia en los cuatro niveles y en `aleatorio`, `predeterminado_anterior` e `incluido`; la miniatura solo con `neutra`. Al cambiar el resumen de una canción de YouTube de `predeterminado` a `predeterminado_anterior` (los dos `neutra: true`), la portada no cambia y la línea pasa a «… · predeterminado anterior». Una línea de tema larga a 1280 × 720 al 125 % se corta con «…» y conserva el texto completo en `title` y en el nombre accesible.
- [x] B7: editar el artista mueve la tarjeta, despliega el grupo, deja el foco en ella, anuncia `bib.anuncio.movida` y muestra `bib.toast.temaCambiado` solo si cambió el tema efectivo.
- [x] B12–B13, B15: foco y desplazamiento según la spec; flechas cruzan grupos y saltan plegados; volver del reproductor conserva agrupación, plegado, filtro, búsqueda y desplazamiento.
- [x] Con 500 canciones, agrupar y filtrar tarda < 16 ms por pulsación en Vitest (medición orientativa) y no reordena por eventos en vivo.

## Notas de implementación

- **Hecho**: «Agrupar por» persistente (`useAgrupar` en `useBiblioteca.ts`, `config.biblioteca.agrupar`), agrupación pura (`agrupacion.ts`), `EncabezadoGrupo.tsx` con los huecos `casilla` y `tema`, búsqueda por palabras en título, artista y álbum, línea de tema en la tarjeta (`textosTema.ts`), portada por `apariencia.neutra` (`usaMiniatura(r)` ya no compara estilos ni lee `config.estilo_predeterminado`), teclado *roving* entre grupos, anuncio de resultados (500 ms), «Editar datos» que mueve la tarjeta (despliega, enfoca, anuncia, toast de tema) y foco tras eliminar a la vecina.
- **Puntos de extensión**: 0173 pasa `casilla` a `EncabezadoGrupo` (antes del botón de plegar) y añade `aplicarTema` a `AccionesTarjeta` (el menú ⋯ ofrece «Aplicar tema…» solo si existe); 0174 pasa `tema` (solo se pinta en grupos `asignable`; `Grupo` trae `artista` y `album` visibles). Ambos comparten únicamente unas líneas de `Biblioteca.tsx` (`grupos.map`).
- **Deuda / a unificar**: `textosTema.ts` (`PROCEDENCIA_CORTA`, `lineaDeTema`) es provisional; debe unificarse con `procedenciaCorta` de 0169 (`renderer/src/temas/textos.ts`). El toast `bib.toast.temaCambiado` sin nombre de tema usa la línea de tema en minúscula. Con búsqueda o filtro activos el recuento siempre es «{v} de {n}» (también si v = n). El anclaje del desplazamiento ante eventos en vivo se deja al `overflow-anchor` del navegador. Faltan los E2E y las capturas B16 (0176).
- **Probar**: `npx vitest run src/renderer/src/vistas/biblioteca` (127 pruebas; nuevas en `agrupacion.test.ts`, `Biblioteca.agrupacion.test.tsx`, `filtrado.test.ts`, `tarjeta.test.tsx`).
