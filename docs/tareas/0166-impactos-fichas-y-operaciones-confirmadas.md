# 0166 — Impactos, fichas de confirmación y operaciones confirmadas

- Estado: Hecha
- Paso del pipeline: 4 y 5
- Depende de: [0165](0165-catalogo-y-cola-de-apariencia-en-main.md)
- ADRs: [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §5, §6 (A1, B1, C1), §7
- Specs: [Editor · Fase 3, «Diálogos»](../ux/06-editor.md#diálogos), [Biblioteca · Fase 3, «Tema de un artista o de un álbum» y «Selección múltiple»](../ux/02-biblioteca.md#fase-3-de-020--temas-y-biblioteca), [Ajustes · Fase 3](../ux/08-ajustes-y-acerca.md#fase-3-de-020--temas-y-biblioteca), [0052](../preguntas/0052-predeterminado-y-canciones-que-dependen-de-el.md)

## Objetivo

Implementar `previsualizar(op)` y `ejecutar(op, ficha)` para `editar`, `aplicar`, `asignarGrupo` y `predeterminado` (el `borrar` es de 0167), con fichas en memoria, recálculo dentro de la cola, `CONFIRMACION_OBSOLETA`, resultado por canción y progreso.

## Contrato

- **Impacto** (`main/temas/impacto.ts`, funciones puras sobre índice y catálogo): devuelve la forma `ImpactoIpc` del ADR 0016 §7 (afectadas con `antes`/`despues`/`efecto`, `desglose`, `excluidas`, `totalGrupo`, `esPredeterminado`, `asignacionesRetiradas`, `revisionTema`, `sesionEnCurso: false`). Para calcular `despues`, simula la operación sobre una copia del catálogo o de la apariencia y vuelve a resolver.
  - `editar`: afectadas = canciones cuya resolución da ese tema; `antes === despues` en tema, efecto `cambia`.
  - `aplicar`: todas las indicadas; efecto `sin_cambios` si ya tienen `modo: "tema"` con ese tema (o `heredar` cuando la selección es heredar y ya heredan); `excluidas.danadas` y `excluidas.noExisten`.
  - `asignarGrupo`: canciones del grupo que heredan y cambian de resultado; `totalGrupo`; `excluidas` por `propio`, `cancion` y (artista) `album`. La clave se deriva en main del texto recibido. Quitar (`temaId: null`) calcula a qué pasan.
  - `predeterminado`: afectadas = las que heredan **sin base** y sin tema de grupo. Hacia un tema: efecto `cambia`. Hacia `null`: efecto `fija_base` y `despues` igual que `antes` con procedencia `predeterminado_anterior`. Las de base fijada no aparecen (C1).
- **Fichas** (`main/temas/fichas.ts`): `Map<uuid, { op canónica, impacto, creada }>`, máximo 16 (expulsa la más antigua), caducidad 10 min, un solo uso, reloj inyectable.
- **Ejecutar**, dentro de la cola:
  - ficha desconocida, caducada o usada → `CONFIRMACION_OBSOLETA` con impacto nuevo;
  - `op` distinta de la previsualizada → `ErrorDatosInvalidos`;
  - recálculo y comparación (canciones, efectos, `revisionTema`, `esPredeterminado`); si difiere → `CONFIRMACION_OBSOLETA` con el impacto nuevo, sin escribir. **Excepción `aplicar`**: comparación por canción → `omitida` (`cambio`, `no_existe`, `danada`), el resto se aplica;
  - tema inexistente → `TEMA_NO_ENCONTRADO`; en borrado → `BORRADO_PENDIENTE`; catálogo en solo lectura → `TEMAS_SOLO_LECTURA`.
- **Escrituras**:
  - `editar`: una escritura del catálogo (`estilo`, `revision + 1`, `modificado`). No reescribe canciones.
  - `aplicar`: por canción y en orden, `actualizar(id)` con `{ modo: "tema", tema_id }` o `{ modo: "heredar" }` conservando `base`, y refresco de `estilo`/`tema_nombre` (instantánea). Un error en una canción → `error` con código y se sigue con las demás.
  - `asignarGrupo`: una escritura del catálogo (alta, cambio o baja de la asignación con `nombre_*` = grafía recibida).
  - `predeterminado` hacia un tema: una escritura del catálogo. Hacia `null` (B1): primero cada afectada con `base: { tipo: "predeterminado_anterior", tema_id: X }` y su instantánea, después el catálogo. Si falla una canción, se detiene **sin** escribir el catálogo y devuelve el resultado de **todas** las afectadas, en orden: `aplicada`, la que falló como `error` con `codigo` y las no intentadas como `pendiente` (`catalogoEscrito: false`).
- **Progreso**: emite `temas:progreso { ficha, operacion, temaId, hechas, total }` tras cada canción escrita (como mucho cada 100 ms, siempre al terminar). `operacion` es `aplicar` o `predeterminado`; `temaId` es el tema aplicado (o `null` con `{ modo: "heredar" }`) o el predeterminado que se quita.
- Tras cada ejecución con escritura de catálogo, `temas:cambiado`; cada canción escrita emite su `cancion:cambiada` a través del puerto.

## Archivos

- `app/src/main/temas/impacto.ts`, `fichas.ts`, `operaciones.ts` y sus `*.test.ts` (nuevos).
- `app/src/main/temas/servicio.ts` (sustituye los `NO_IMPLEMENTADO` de `previsualizar` y `ejecutar`).

## Criterios de aceptación

- [x] `editar` (T8 de la spec 06): con una canción asignada, una de álbum, una de artista, una de predeterminado, una personalizada y una con otro tema asignado, el impacto tiene 4 afectadas y el desglose `{ cancion: 1, album: 1, artista: 1, predeterminado: 1 }`.
- [x] T10: crear una canción que hereda el predeterminado entre `previsualizar` y `ejecutar` → `CONFIRMACION_OBSOLETA` con 5 afectadas y nada escrito. Una revisión de tema distinta da el mismo error.
- [x] B10: lote de 5 con un fallo de escritura inyectado en la 3.ª y la 4.ª modificada entre confirmar y ejecutar → 3 `aplicada`, 1 `error` y 1 `omitida: cambio`; las 3 aplicadas persisten con su instantánea refrescada.
- [x] B5: `asignarGrupo` de artista excluye personalizadas, asignadas y las de álbum con tema, con `totalGrupo` correcto; quitar la asignación devuelve sus canciones al siguiente nivel; homónimos de álbum de otro artista no cuentan.
- [x] A1: cambiar el predeterminado de X a Y cambia solo las canciones sin base (y las sin base con procedencia `incluido` por no haber predeterminado), no las de base `aleatorio`, `predeterminado_anterior` ni `incluido` (C1).
- [x] B1: quitar el predeterminado X deja a sus canciones con `base: predeterminado_anterior` X, el mismo estilo resuelto y procedencia `predeterminado_anterior`; editar X después las cambia; el catálogo queda con `predeterminado: null`. Con un fallo en la 2.ª de 3, el resultado es `[aplicada, error, pendiente]`, el catálogo sigue con X, ninguna canción cambia de aspecto y una nueva previsualización cuenta solo las 2 que faltan.
- [x] Fichas: la 17.ª expulsa la más antigua; a los 10 min caduca (reloj falso); reutilizarla da `CONFIRMACION_OBSOLETA`.
- [x] En solo lectura todas las operaciones responden `TEMAS_SOLO_LECTURA` sin escribir; con un tema en borrado, `BORRADO_PENDIENTE`.
- [x] El progreso de un lote de 50 llega a `hechas: 50` y no emite más de 10 eventos por segundo.

## Notas de implementación

**Qué se hizo.** `main/temas/`: `impacto.ts` (puro: `calcularImpacto`, `mismoImpacto`, `catalogoConAsignacion`), `fichas.ts` (`Fichas`: 16 máx., 10 min, un solo uso, reloj inyectable), `operaciones.ts` (ejecutores `editar`, `asignarGrupo`, `predeterminado` a tema/null, `aplicar`; `Avance` para `temas:progreso`), `errores.ts` (`ErrorTemas` movido aquí; `servicio.ts` lo reexporta), `puertoDePrueba.ts` (solo tests: biblioteca en memoria con fallos inyectables y `montarServicio`).
- API nueva de `ServicioTemas`: `previsualizar(op) -> ImpactoIpc`, `ejecutar(op, ficha) -> ResultadoTemas`, opciones `alProgreso` y `reloj`. Los tipos `OperacionTema`/`ImpactoIpc`/`ProgresoTemaIpc` son los de `shared/ipc.ts` (0164). `ResultadoTemas`/`EstadoCancion` son locales: igual que `ResultadoOperacionIpc` más `titulo` y `artista` en cada entrada (ADR 0016 rev. 3); 0168 los sustituye por el tipo IPC cuando 0164 lo amplíe.
- Contrato rev. 3: B1 y `aplicar` rellenan `titulo`/`artista` (en `omitida: no_existe` salen del impacto confirmado). `asignarGrupo` al quitar puede dar `despues: respaldo` con `efecto: cambia` (resolución normal).

**Decisiones.**
- Ficha siempre de un solo uso, incluso si `ejecutar` falla por operación distinta. `CONFIRMACION_OBSOLETA` lleva en `detalles` `{ ficha, ...impacto }` con una ficha nueva atada a la operación tal como llegó (para `editar` con revisión vieja, el renderer debe volver a previsualizar con `revisionTema` del impacto).
- `previsualizar editar` con revisión distinta ya da `CONFIRMACION_OBSOLETA` (como `renombrar`).
- `aplicar` decide por canción justo antes de escribirla (tras el `await` de las anteriores), así una modificación a mitad de lote la omite (`cambio`). El resultado va en el orden de `cancionIds`; `afectadas` del impacto va por título. `total` del progreso = canciones que se van a escribir (las omitidas al escribir también cuentan un paso).
- `excluidas` solo se rellena en `asignarGrupo` (y `danadas`/`noExisten` en `aplicar`); en las demás va a 0.
- `predeterminado` con el mismo tema o `null` sobre `null`: sin afectadas y sin escritura (`catalogoEscrito: false`). Quitar el predeterminado cuando el tema está en borrado: `BORRADO_PENDIENTE`. Con un borrado pendiente, `borrar` de otro tema también da `BORRADO_PENDIENTE`.
- Si la escritura final del catálogo falla tras escribir todas las canciones (B1), se devuelve `catalogoEscrito: false` con todas `aplicada` en vez de lanzar; un reintento solo cuenta lo que falte.
- `asignarGrupo` sin cambio real en las asignaciones no escribe.
- `CancionIndice.metadatos.titulo?` añadido (0168 debe rellenarlo: ordena y rotula).

**Cómo probarlo.** `npx vitest run src/main/temas`. 18 pruebas nuevas en `operaciones.test.ts` (T8, T10, revisión, fichas 16/10 min/un uso, B10, no_existe/danada/sin_cambios, progreso de 50 con ≤10 eventos/s, B5, álbum homónimo, respaldo al quitar, A1, C1, B1 con y sin fallo, solo lectura, BORRADO_PENDIENTE).

**Deuda.** No hay `impacto.test.ts` ni `fichas.test.ts` sueltos: se prueban a través del servicio. El orden de `afectadas` usa `Intl.Collator('es')`.
