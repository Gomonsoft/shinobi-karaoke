# 0164 — Contratos IPC de temas, apariencia y preferencia «Agrupar por»

- Estado: Hecha
- Paso del pipeline: 4 y 5
- Depende de: [0163](0163-modelo-puro-de-temas-e-identidad.md) (puede ir en paralelo con [0165](0165-catalogo-y-cola-de-apariencia-en-main.md))
- ADRs: [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §7, §9, §11, [0008](../adr/0008-seguridad-de-electron-y-protocolos-propios.md#revisión-para-020--fase-3), [0006](../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--fase-3), [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--fase-3)
- Specs: [Editor · Fase 3](../ux/06-editor.md#fase-3-de-020--temas-y-biblioteca), [Biblioteca · Fase 3](../ux/02-biblioteca.md#fase-3-de-020--temas-y-biblioteca), [Ajustes · Fase 3](../ux/08-ajustes-y-acerca.md#fase-3-de-020--temas-y-biblioteca)

## Objetivo

Publicar de una vez todos los contratos que consumen las tareas de main y de renderer, para que puedan avanzar en paralelo con dobles. **Es la única tarea de la fase que modifica `shared/ipc.ts`, `shared/canales.ts`, `shared/config.ts` y `preload/index.ts`** (con la excepción acotada de 0170, que retira `estilo_predeterminado` de `configParcialRendererSchema`). No implementa lógica de temas en main.

## Contrato

**Canales** (`shared/canales.ts`): `temas.catalogo`, `temas.previsualizar`, `temas.ejecutar`, `temas.crear`, `temas.renombrar`, `temas.duplicar`, `temas.reanudarBorrado`, `temas.cancelarBorrado`, `temas.descartarAvisoApartado`, `biblioteca.guardarApariencia`; eventos `temas:cambiado` y `temas:progreso`. Se **retira** `biblioteca.guardarEstilo`.

**Esquemas** (`shared/ipc.ts`), con los límites del ADR 0016 §11:
- `seleccionAparienciaSchema`: `{ modo: "propio", estilo } | { modo: "tema", temaId } | { modo: "heredar" }`.
- `operacionTemaSchema` (unión discriminada por `tipo`): `editar { temaId, revisionTema, estilo }`, `borrar { temaId }`, `aplicar { cancionIds[1..2000] únicos, seleccion: { modo: "tema", temaId } | { modo: "heredar" } }`, `asignarGrupo { nivel, artista, album?, temaId | null }` (album obligatorio solo con `nivel: "album"`), `predeterminado { temaId | null }`.
- `impactoIpcSchema` con `ficha`, `afectadas` (`antes`/`despues` `{ procedencia, temaId, temaNombre }`, `efecto: "cambia" | "fija_base" | "sin_cambios"`), `desglose`, `excluidas`, `totalGrupo`, `esPredeterminado`, `asignacionesRetiradas`, `revisionTema`, `sesionEnCurso` (ADR 0016 §7).
- `resultadoOperacionIpcSchema` `{ catalogoEscrito, canciones: [{ id, estado: "aplicada" | "sin_cambios" | "omitida" | "error" | "pendiente", motivo?, codigo? }] }`. `pendiente` = no se llegó a intentar porque la operación se detuvo en el primer fallo (`predeterminado` a `null`, `borrar` y `reanudarBorrado`; ADR 0016 §7, revisión 2).
- `catalogoIpcSchema`: temas `{ id, nombre, revision, estilo, enBorrado, usos: { total, cancion, album, artista, predeterminado, aleatorio, predeterminadoAnterior }, grupos: { artistas: string[], albumes: { artista, album }[] } }`, `predeterminado`, `predeterminadoUsos`, `asignaciones` con nombres visibles, `borradoPendiente: { temaId, nombre, total, restantes } | null`, `soloLectura`, `apartado: string | null`, `referenciasFaltantes` (ADR 0016 §9).
- `temaIpcSchema` `{ id, nombre, revision, estilo }`; `progresoTemaSchema` `{ ficha: uuid | null, operacion: "aplicar" | "borrar" | "predeterminado", temaId: uuid | null, hechas, total }` (`ficha: null` solo en `reanudarBorrado`, ADR 0016 §7).
- `procedenciaSchema` con las nueve procedencias del ADR 0016 §3 (si 0163 ya la exporta desde `shared/temas.ts`, se reutiliza) y `destinoHeredarSchema` `{ procedencia, temaId: uuid | null, temaNombre: string | null }`, con `procedencia` distinta de `propio` y `cancion`.
- `resumenCancionSchema` gana `album`, `claves`, `apariencia: { modo, procedencia, temaId, temaNombre, neutra, alHeredar }` (`alHeredar`: `destinoHeredarSchema`, ADR 0016 §3). `estilo` deja de ser nullable si el código lo permite (siempre resuelto); si no, documentar por qué.
- `cancionIpc` de `biblioteca.obtener` gana `resuelta: { estilo, procedencia, temaId, temaNombre, alHeredar }`.
- El error `CONFIRMACION_OBSOLETA` lleva el impacto nuevo en `detalles` (serializado y validado con `impactoIpcSchema` en el renderer).

**Config** (`shared/config.ts`): `biblioteca: { agrupar: z.enum(["ninguno","artista","album"]).catch("ninguno") }` con `.prefault({})`, tolerante como `editor.paneles`. `configParcialRendererSchema` admite `biblioteca: z.strictObject({ agrupar: enum })` sin `.catch`.

**Preload y tipos** (`preload/index.ts`, `ShinobiApi` en `shared/ipc.ts`): `window.shinobi.temas.*`, `biblioteca.guardarApariencia`, `alCambiarTemas(cb)`, `temas.alProgreso(cb)`. Sin rutas.

**Puente provisional en main**: `main/ipc/handlers.ts` registra `biblioteca.guardarApariencia` con validación completa y, hasta 0168, solo implementa `{ modo: "propio", estilo }` con la escritura que hoy hace `guardarEstilo` (los otros modos responden `ErrorDatosInvalidos`). Los canales `temas.*` se declaran en la lista de canales permitidos pero se registran en 0168. Para que `tsc` y los E2E sigan en verde, `main/biblioteca/resumen.ts` y la respuesta de `biblioteca.obtener` rellenan los campos nuevos con valores provisionales: `album` y `claves` reales (con `shared/identidad.ts`), y `apariencia`/`resuelta` como `propio` con el estilo en disco y `neutra` según `esAparienciaNeutra` con `config.estilo_predeterminado`. `alHeredar` provisional: `{ procedencia: "incluido", temaId: null, temaNombre: null }`. 0168 los sustituye por la resolución real.

**Renderer, cambio mecánico**: `vistas/editor/guardado.ts` y `useGuardadoEditor.tsx` pasan de `guardarEstilo(id, estilo)` a `guardarApariencia(id, { modo: "propio", estilo })`, sin cambiar comportamiento. Los dobles (`vistas/editor/fixturesApi.ts`, `vistas/biblioteca/fixturesApi.ts`, `vistas/biblioteca/resumenPrueba.ts` y el doble del preload de E2E si existe) exponen la API nueva con un catálogo en memoria configurable (temas, usos, impactos y resultados programables), para que 0169–0175 prueben sin main.

## Archivos

- `app/src/shared/canales.ts`, `app/src/shared/ipc.ts`, `app/src/shared/config.ts`, `app/src/shared/config.test.ts`.
- `app/src/preload/index.ts`.
- `app/src/main/ipc/handlers.ts`, `app/src/main/ipc/handlers.test.ts` (solo el puente de `guardarApariencia` y la retirada de `guardarEstilo`).
- `app/src/main/biblioteca/resumen.ts` y el punto de `servicio.ts` que arma la respuesta de `obtener` (solo los campos provisionales).
- `app/src/renderer/src/vistas/editor/guardado.ts`, `guardado.test.ts`, `useGuardadoEditor.tsx`, `fixturesApi.ts`.
- `app/src/renderer/src/vistas/biblioteca/fixturesApi.ts`, `resumenPrueba.ts`.
- `app/e2e/ipc.spec.ts` (si enumera canales).

## Criterios de aceptación

- [ ] Cada esquema tiene pruebas de aceptación y de rechazo en los límites: 0 y 2001 ids, ids repetidos, nombre de 61 caracteres o vacío tras recortar, `temaId` no UUID, `asignarGrupo` de álbum sin `album`, artista de 201 caracteres o solo espacios, `estilo` incompleto.
- [ ] `configPredeterminada().biblioteca.agrupar === "ninguno"`; un `config.json` con `biblioteca: 3` o `agrupar: "x"` abre con `"ninguno"` sin `.danado` y conserva el resto; `config.actualizar({ biblioteca: { agrupar: "album" } })` persiste y `"x"` se rechaza con `ErrorDatosInvalidos`.
- [ ] `biblioteca.guardarEstilo` ya no existe en canales, preload ni tipos; el editor guarda el estilo propio con `guardarApariencia` y sus pruebas de autoguardado siguen en verde.
- [ ] `tsc`, Vitest y los E2E existentes en verde (el editor y el reproductor se comportan igual que antes).
- [ ] Los dobles permiten programar `CONFIRMACION_OBSOLETA`, `TEMA_NOMBRE_DUPLICADO`, `TEMAS_SOLO_LECTURA`, `BORRADO_PENDIENTE`, progreso (también con `ficha: null` para `reanudarBorrado`), resultados por canción (incluido `pendiente`) y el `alHeredar` de cada resumen.
- [ ] `destinoHeredarSchema` rechaza `procedencia: "propio"` y `"cancion"`; `progresoTemaSchema` acepta `ficha: null` y rechaza una `operacion` desconocida.

## Notas de implementación

**Qué se hizo.**
- `shared/canales.ts`: grupo `temas` (9 canales), eventos `temasCambiado` y `temasProgreso`; `guardarEstilo` retirado, `biblioteca.guardarApariencia` añadido.
- `shared/ipc.ts`: `PROCEDENCIAS`/`procedenciaSchema` (definido aquí porque 0163 solo exporta el tipo `Procedencia`; `satisfies` garantiza que coinciden), `origenAparienciaSchema`, `destinoHeredarSchema`, `DESTINO_HEREDAR_PROVISIONAL`, `aparienciaResumenSchema`, `resueltaSchema`, `cancionIpcSchema`, `seleccionAparienciaSchema`, `operacionTemaSchema`, `impactoIpcSchema`, `resultadoOperacionIpcSchema` (rev. 3: `titulo`/`artista` obligatorios y `codigo` obligatorio en `error`), `temaIpcSchema`, `catalogoIpcSchema`, `progresoTemaSchema`, `crearTemaSchema`, `renombrarTemaSchema`, `duplicarTemaSchema` y sus tipos; `ApiShinobi.temas`, `guardarApariencia`, `alCambiarTemas`. `resumenCancionSchema` gana `album`, `claves`, `apariencia`; `configParcialRendererSchema` admite `biblioteca.agrupar`.
- `shared/config.ts`: `biblioteca.agrupar` con lectura tolerante (`AGRUPACIONES_BIBLIOTECA`).
- `preload/index.ts`: `temas.*`, `guardarApariencia`, `alCambiarTemas`.
- Main: `handlers.ts` (puente de `guardarApariencia` solo `propio`; `temas.*` validan y responden `ARGUMENTOS_NO_VALIDOS` hasta 0168; `obtener` añade `resuelta` provisional), `biblioteca/resumen.ts` (`aparienciaProvisional`, `album`, `claves`), `servicio.ts` (pasa `estiloBase()` como estilo heredado).
- Renderer: `guardado.ts`/`useGuardadoEditor.tsx` usan `guardarApariencia`; nuevo doble `vistas/biblioteca/temasFalsos.ts` (catálogo en memoria; programa impactos, resultados, fallos incluidos `CONFIRMACION_OBSOLETA` con impacto en `detalles`, progreso con `ficha: null`, `pendiente`, `respaldo`); `fixturesApi` de editor y biblioteca, `resumenPrueba.ts` (`cancionIpcPrueba`, `aparienciaResumenPrueba`) y el doble del editor (`fijarApariencia` para `alHeredar`).

**Decisiones.**
- `claves.album` es `claveAlbumTexto({artista, album})` (única por artista+álbum); `claves.artista` es `claveArtista`.
- `estilo` del resumen sigue `nullable` solo por la canción dañada por JSON.
- `asignarGrupo` con `nivel: "artista"` rechaza `album`.
- El servicio de config es tolerante (`'x'` pasa a `ninguno`, como `editor.paneles`); el rechazo estricto (`ARGUMENTOS_NO_VALIDOS`) es del esquema de la IPC.
- `revisionTema` e `totalGrupo` del impacto son `null` cuando no aplican.
- Los canales usan `:` (`temas:catalogo`) como el resto.

**Cómo probarlo.** `cd app && npx vitest run src/shared/temasIpc.test.ts src/shared/config.test.ts src/main/ipc src/renderer/src/vistas/biblioteca/temasFalsos.test.ts`.

**Deuda técnica.** Los handlers `temas.*` son stubs hasta 0168; `alHeredar` y `resuelta` son provisionales. Los E2E de IPC/seguridad/editor se ejecutaron tras el cambio.
