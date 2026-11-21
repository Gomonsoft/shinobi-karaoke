# Informe de fase 3 · Temas y biblioteca

Las tareas 0163–0176 del [backlog](backlog.md) entregan el catálogo de temas con resolución única en main, la sección «Tema» del editor (con edición de un tema y borrador), la Biblioteca agrupada por artista y álbum con temas de grupo y «Aplicar tema…» en lote, y la sección «Temas» de Ajustes. Las specs son [Editor · Fase 3](../../ux/06-editor.md#fase-3-de-020--temas-y-biblioteca) (T1–T30), [Biblioteca · Fase 3](../../ux/02-biblioteca.md#fase-3-de-020--temas-y-biblioteca) (B1–B16) y [Ajustes · Fase 3](../../ux/08-ajustes-y-acerca.md#fase-3-de-020--temas-y-biblioteca) (A1–A15). Decisiones: [ADR 0016](../../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) y la revisión de [0006](../../adr/0006-persistencia-y-modelo-de-datos.md#revisión-para-020--fase-3).

## Qué se entregó

- **0163 · Modelo puro.** `shared/identidad.ts` (claves NFC/minúsculas de artista y álbum, grafía visible), `shared/temas.ts` (catálogo, resolución de la apariencia en cuatro niveles más respaldo) y `apariencia` opcional en `cancion.ts` sin subir el esquema de la canción.
- **0164 · Contratos IPC.** Canales `temas.*`, `biblioteca.guardarApariencia`, `config.biblioteca.agrupar` y dobles.
- **0165–0167 · Main.** `temas.json` (siembra, solo lectura, apartado del ilegible), cola de escrituras, crear/renombrar/duplicar, usos, impactos con ficha y confirmación obsoleta, operaciones por canción, grupo y predeterminado, y borrado recuperable con diario (congelar, retirar, reanudar, cancelar).
- **0168 · Migración y resolución.** Una biblioteca de esquema 1 no se reescribe; el estilo heredado pasa a ser el tema predeterminado («Mi estilo» o «Shinobi»). Resolución en vivo en `listar`/`obtenerResumen`. Semilla `sembrar(datos, { temas: true })`.
- **0169 · Base en el renderer.** `renderer/src/temas/`: catálogo, textos, muestra, selector y diálogos compartidos.
- **0170–0171 · Editor.** D1–D4, historial por selección, «Editar tema» con borrador en memoria, guardar con impacto, guardar como nuevo, salir y cerrar con borrador.
- **0172–0174 · Biblioteca.** «Agrupar por» persistente, búsqueda por álbum, línea de tema, modo selección, «Aplicar tema…», [Tema…] de grupo.
- **0175 · Ajustes › Temas.** Predeterminado, lista, avisos (apartado, solo lectura, faltan, borrado pendiente) y volver al origen.
- **0176 · Verificación.** Cuatro especificaciones E2E (48 casos), el ayudante `e2e/fixtures/temas.ts`, las 50 capturas, la estabilización de pruebas y este informe.

### Errores encontrados al cerrar la fase (corregidos, con prueba)

Todos aparecieron solo en Electron real: las pruebas de Vitest con jsdom no pueden verlos.

1. **El selector de tema no recibía clics dentro de un diálogo** (`temas/SelectorTema.tsx`). La lista se montaba en un portal de `<body>` y `Dialogo` pone `inert` a todos los hijos de `<body>` salvo el diálogo, así que la lista no era clicable en «Tema del artista/álbum…», «Aplicar tema…» y en los diálogos de predeterminado. Corrección: la lista se monta dentro del diálogo que contiene al selector. Prueba en `DialogoTemaGrupo.test.tsx` (la lista cuelga del diálogo y no queda bajo `inert`) y los casos E2E de Biblioteca.
2. **El encabezado de grupo nunca mostraba el tema asignado** (`vistas/biblioteca/agrupacion.ts`). `CatalogoIpc.asignaciones` lleva la grafía visible («Queen») pero `temaAsignadoAGrupo` buscaba por clave («queen»), de modo que todos los grupos decían «Sin tema de artista/álbum». Los dobles de 0174 usaban claves y por eso pasaba en Vitest. Corrección: se deriva la clave del nombre visible con `claveTexto`. Pruebas en `TemaGrupo.test.tsx`.
3. **Botones del diálogo «Tienes cambios sin guardar en el tema…» cortados** (hallazgo del usuario en revisión manual). Los tres botones no cabían en 30 rem y «Seguir editando» quedaba cortado por la izquierda. La causa era `.acciones` sin `flex-wrap` (corregido por la sesión principal). Se añade el E2E `botonesDentroDelDialogo` (cada botón visible y dentro del rectángulo del diálogo, a 1280 × 720 al 100 % y 125 %) para el diálogo de salida, el de impacto al guardar y el de eliminar con fallo parcial; también lo usan el de aplicar tema, el del tema de grupo, el de lote con fallo y el de quitar el predeterminado con fallo parcial. Captura: `editor-1280x720-100-dialogo-salir-borrador.png` y `…-125-…`. Ninguno de los otros diálogos de tres o más botones desborda.
4. **Pie de D3 cortado con el panel a 300 px** (`vistas/editor/panelEstilo.module.css`). Con dos columnas fijas, «Guardar en el tema…» no cabía (140 px de texto en 137 px) y se recortaba. Corrección: columnas `auto-fit` con mínimo de 9,5 rem (a 300 px los tres botones van apilados; desde 360 px, en dos filas como pide la spec) y relleno lateral de 8 px. Caso E2E con el panel a 300, 360 y 480 px.
5. **Los E2E existentes dejaron de cumplir los textos nuevos.** La caja de búsqueda pasó a «Buscar título, artista o álbum» (12 apariciones en `e2e/`) y el nombre accesible de la tarjeta termina con «Tema: …». Se actualizaron con selectores por expresión regular (`/^Buscar título/`) y una cola opcional en el nombre accesible. Además, `biblioteca/temas.json` aparecía como «canción» en los ayudantes que listan la carpeta (`importar-archivo`, `importar-youtube`, `youtube-red` y `fixtures/separacion.ts`): ahora se excluye.

### Pruebas intermitentes de Vitest (causa raíz)

Cuatro pruebas fallaban solo bajo la carga de la suite completa y pasaban aisladas. Las cuatro tenían la misma causa: afirmaban un foco que mueve un efecto asíncrono de forma síncrona. No se añadieron reintentos.

- `Editor.paneles.test.tsx` («Intro en el divisor…»). Con la letra sin sincronizar, `Editor.tsx` lleva el foco a «Sincronizar al ritmo» cuando llega la duración del audio (`focoInicialSync`). Bajo carga llegaba después de `divisor.focus()` y se lo quitaba (el foco recibido era el botón «Sincronizar»). Ahora la prueba espera primero a ese foco inicial.
- `Biblioteca.seleccion.test.tsx` (B10–B11 y B11): el foco en «Revisar y reintentar» / «Cerrar» lo mueve un efecto tras montar el resultado; se espera con `waitFor`.
- `DialogoImpactoTema.test.tsx`, `DialogoEliminarTema.test.tsx` y `TemasAjustes.test.tsx`: foco en [Reintentar] tras el fallo a mitad; igual.
- `usos.test.ts` (500 canciones en menos de 20 ms) y `LetraElegida.test.tsx` (`waitFor` de 1 s): se usa el mejor de cinco medidas y un tiempo de espera de 5 s respectivamente.

## Verificación

Equipo: Windows 11 Pro (compilación 26200), monitor de 3440 × 1440 a escala 100 % del sistema; las escalas de 125 % se simularon con `--force-device-scale-factor=1.25`. `worker/.venv` presente (`uv` en el PATH).

| Comprobación | Resultado |
|---|---|
| `npm run lint` | Correcto |
| `npm run typecheck` | Correcto |
| `npm run format:check` | Correcto |
| `npm run build` | Correcto |
| `npx vitest run` (Windows) | 2343 correctas, 42 omitidas y 8 fallos (2393 en total); dos ejecuciones completas seguidas con el mismo resultado |
| `npx playwright test --workers=1` (app completa) | 193 casos: 178 correctos, 15 omitidos, 0 fallos y 0 *flaky* en la ejecución final. Los 15 omitidos son los 10 de 2.1 (capturas de 2.1, perfil de una hora, letra y descarga con red, `SIGKILL` de separación) y los 5 de capturas de la fase 3 (opt-in) |

- Un caso nuevo (B7, «Editar datos», menú de tarjeta) falló una vez en una ejecución completa: el menú ⋯ de una tarjeta se cierra si la lista se desplaza justo después de agrupar. No se ocultó con reintentos globales: el ayudante `abrirMenuTarjeta` espera a que la vista se asiente y reintenta solo la apertura del menú; después se repitió el archivo 3 veces seguidas (45 casos correctos) y la ejecución final salió limpia.
- Los 8 fallos de Vitest son los conocidos de Windows: `EPERM` al crear enlaces simbólicos (6 en `appProtocolo.test.ts` y 2 en `medios.test.ts`). Se verifican en CI.
- Casos nuevos de esta tarea: `temas-migracion` (2), `temas-editor` (19: 12 de comportamiento y diálogos, 6 de viewports y 1 de anchos de panel), `temas-biblioteca` (15) y `temas-ajustes` (12), más 5 de capturas opt-in (`SHINOBI_CAPTURAS_3=1`). Ninguno usa red ni abre ventanas de sistema.
- **Fallos de escritura inyectados sin código de prueba en la app.** `fixtures/temas.ts` crea un directorio no vacío donde la persistencia abre su temporal (`<archivo>.tmp`): la escritura atómica de esa canción (o de `temas.json`) falla igual en Windows, macOS y Linux. «Reparar» es borrar ese directorio. El proceso se mata con `taskkill /T /F` en Windows (si no, los hijos de Chromium retienen la caché y el siguiente arranque falla) y con `SIGKILL` en el resto.
- **Biblioteca de esquema 1.** `temas-migracion.spec.ts` parte de la semilla base (20 canciones de 0.1.0, sin `apariencia`) con `config.estilo_predeterminado` cambiado («Mi estilo») o de fábrica («Shinobi»). Tras abrir la Biblioteca, el editor sin tocar nada y el reproductor: el hash de cada `cancion.json` es idéntico (única excepción admitida: un paso `en_curso`, que 0.1.0 ya pasaba a `interrumpido`), el estilo en disco coincide con el que recibe la Biblioteca, todas las tarjetas dicen «Tema: Tema personalizado» y la de YouTube con estilo heredado conserva la miniatura (la de estilo propio no).
- **Quitar el predeterminado.** `temas-ajustes.spec.ts` compara el estilo resuelto de las 32 canciones antes y después de quitarlo (idéntico), comprueba que la base `predeterminado_anterior` mantiene el vínculo vivo (editar «Noche ninja» después cambia el estilo de otra canción) y repite la comparación con el fallo en la 2.ª de 4 (ningún aspecto cambia; Reintentar guarda las 3 que faltan).
- Semilla: se usó la de 0168 tal cual (`5eed…30`–`41`). Las canciones extra de algunos casos (cinco usos de Neón, tema de origen inexistente) se crean con `clonarCancion` en `e2e/fixtures/temas.ts`, sin tocar la semilla.

### Resultado por criterio

Editor (T). Casos en `app/e2e/temas-editor.spec.ts` salvo indicación; «V» = Vitest (`Editor.temas.test.tsx` y relacionados).

| Criterio | Verificación | Resultado |
|---|---|---|
| T1 · Esquema 1 abre en «Tema personalizado» con el mismo estilo | `temas-migracion` (E2E) y V | Correcto |
| T2 · Procedencia en los cuatro niveles y «al azar» | Línea de tema de la tarjeta en `temas-biblioteca` (B6) y V | Correcto |
| T2b · Quitar el predeterminado deja el aspecto; «Volver a heredar» con base anterior | `temas-ajustes` (B1/T2b) | Correcto |
| T3 · Elegir tema, heredar y revertir | «asignar un tema, volver a heredar y personalizar» (sin medir los 100 ms) | Correcto; tiempo solo en V |
| T4–T5 · Personalizar y volver a «Temas definidos» | Mismo caso; el [Deshacer] del toast solo en V | Correcto |
| T6 · Resumen de solo lectura y contraste | V y capturas `tema-definidos`/`tema-asignado` | Correcto (V) |
| T7 · D3, pie sin partir entre 300 y 480 px | «panel a 300, 360 y 480 px» | Correcto tras el error 4 |
| T8–T9 · Guardar con impacto y recuento exacto | «editar el tema y guardar con el impacto exacto» (2 canciones, incluida esta; revisión 1 → 2; las canciones no se reescriben) | Correcto |
| T10 · Confirmación obsoleta | «una canción nueva usa el tema mientras se confirma» (pasa de 2 a 3) | Correcto |
| T11 · Fallo de escritura al guardar el tema | Solo V (`Editor.temas.test.tsx`); el E2E del fallo es el de `temas.json` en la deuda | Correcto (V) |
| T12–T13 · Salir y cerrar con borrador | «salir del editor con un borrador…» (seguir, cerrar la ventana, descartar) | Correcto |
| T14–T15 · Guardar como nuevo y usarlo | «guardar como tema nuevo y usarlo…» | Correcto |
| T16 · Renombrar y duplicar | Mismo caso | Correcto |
| T17–T18 · Eliminar con congelación | Mismo caso (1 canción; aspecto idéntico, `propio`) | Correcto |
| T19 · Fallo en la 3.ª de 5 y en la última | Dos casos: `tema.eliminar.parcial`, «Faltan 3 canciones», 3 filas, nota, foco en [Reintentar], reanudar; y f = 1 | Correcto |
| T20 · Deshacer tras eliminar no revincula | Solo V | Correcto (V) |
| T21 · «Tema del álbum/artista…» | Solo V; «Administrar temas…» en E2E de A10 | Correcto |
| T22 · Tema inexistente en D4 | «carpeta copiada con un tema que no existe» (sin reescritura) | Correcto |
| T22b · Destino `respaldo` | «volver a heredar con la base apuntando a un tema que no está» (sin diálogo, anuncio, Ctrl+Z) | Correcto |
| T23 · Solo lectura | `temas-ajustes` (A7) abre el editor con el catálogo intacto byte a byte | Correcto |
| T24 · Catálogo vacío | «sin temas la sección explica cómo crear el primero» | Correcto |
| T25 · Teclado | V; el E2E de selector con teclado no se añadió | Correcto (V) |
| T26 · Seis viewports y paneles sin partir ni cortar | `D1 y D3 en {6 viewports}` y «panel a 300, 360 y 480 px» | Correcto tras los errores 3 y 4 |
| T27 · Panel minimizado en D3 | Solo V | Correcto (V) |
| T28 · Muestras del selector | Capturas | Correcto (a ojo) |
| T29 · Capturas | 22 PNG en `docs/ux/revision-fase-3/` | Correcto |
| T30 · Sin regresiones de 2.1 | `editor-layout.spec.ts` y `editor.spec.ts` completos | Correcto |

Biblioteca (B). Casos en `app/e2e/temas-biblioteca.spec.ts`.

| Criterio | Verificación | Resultado |
|---|---|---|
| B1 · Agrupación persistente | Reinicio con «Artista» | Correcto |
| B2–B3 · Identidad, «Sin artista» | Grupo «Queen» de 3 y «Sin artista» | Correcto (los homónimos y variantes de grafía, en V) |
| B4 · Búsqueda por álbum y varias palabras | «opera», «queen jazz» | Correcto |
| B5 · Tema de artista/álbum | «asignar un tema a un artista» (herencia en vivo, sin escribir canciones) | Correcto tras el error 1 |
| B5b · Destinos distintos y «todas no disponibles» | Dos casos con tres canciones y con dos | Correcto |
| B6 · Herencia en cuatro niveles | Líneas de tema de las tarjetas | Correcto tras el error 2 |
| B7 · Editar datos mueve la tarjeta | Foco en la tarjeta y herencia nueva | Correcto |
| B8–B9 · Selección y «Aplicar tema…» | Selección, aplicar, Esc con diálogo y modo, menú ⋯ de tarjeta | Correcto |
| B10–B11 · Lote con fallo y cambio concurrente | Dos casos | Correcto |
| B12 · Búsqueda y foco | Foco en el campo; Vitest para el resto | Correcto |
| B13 · Teclado entre grupos | Solo V | Correcto (V) |
| B14 · Miniatura | `temas-migracion` | Correcto |
| B15 · Volver del reproductor | Agrupación, plegado, filtro, desplazamiento y foco | Correcto (modo selección, solo V) |
| B16 · Capturas y línea larga | 18 PNG; la línea larga a 1280 × 720 al 125 % lleva «…» y `title` completo | Correcto |

Ajustes (A). Casos en `app/e2e/temas-ajustes.spec.ts`.

| Criterio | Verificación | Resultado |
|---|---|---|
| A1 · Sección entre «Separación» y «Acerca de» | Capturas y todos los casos | Correcto |
| A2 · Cambiar el predeterminado con recuento | «cambiar el predeterminado con el impacto exacto» (5 canciones) | Correcto |
| A3 · Predeterminado en canción nueva | Solo V (necesita importar) | Correcto (V) |
| A4 · Eliminar el predeterminado | «eliminar el tema predeterminado desde la lista» | Correcto |
| A5 · Aleatorio estable | Solo V | Correcto (V) |
| A6 · Renombrar y duplicar | V y editor | Correcto |
| A7 · Ilegible, solo lectura | Apartado y esquema posterior (byte a byte); en solo lectura no hay selector ni ⋯ | Correcto; ver deuda |
| A7b · Migración | `temas-migracion` | Correcto |
| A7c · Aviso persistente y cerrable | Reinicia con y sin cerrar | Correcto |
| A8 · Referencias que faltan | Singular en V, plural (2) en E2E | Correcto |
| A9 · Borrado a medias | Matar el proceso, «Terminar de eliminar» con fallo nuevo y reparado, y «Cancelar el borrado» | Correcto |
| A10 · Volver al editor | ‹ Volver al editor, «Administrar temas…» y Esc a la pestaña Estilo | Correcto |
| A11 · Teclado | V | Correcto (V) |
| A12 · Capturas | 10 PNG | Correcto |
| A13 · Quitar el predeterminado | Mismo estilo en las 32 canciones, vínculo vivo y procedencia «anterior» | Correcto |
| A14 · Predeterminado nuevo no toca al azar ni anteriores | Los archivos de 38 y 39 no cambian | Correcto |
| A15 · Fallo en la 2.ª de 4 | `aj.temas.ninguno.parcial` con «Doble dos» y «Faltan 3», 3 filas, nota, foco, selector en el tema, aspecto intacto, Reintentar | Correcto |

### Rendimiento

`construirCatalogoTemas` con 500 canciones: prueba de Vitest (`usos.test.ts`) con el mejor de cinco medidas por debajo de 20 ms; la agrupación de 500 canciones, por debajo de 16 ms (`agrupacion.test.ts`). No se midió en Electron con 500 canciones reales: no hay un E2E de rendimiento de la fase.

### Capturas

50 PNG en [`docs/ux/revision-fase-3/`](../../ux/revision-fase-3/README.md) con el nombre y los tamaños del README, tamaño físico: editor 11 × 2 (1280 × 720 al 100 % y al 125 %), Biblioteca 9 × 2 (1280 × 800 al 100 %, 1280 × 720 al 125 %) y Ajustes 10 × 1 (1280 × 800), incluida `ajustes-1280x800-100-dialogo-quitar-predeterminado.png` (con la lista revelada). Se abrieron para revisarlas: `editor-1280x720-125-dialogo-salir-borrador`, `editor-1280x720-100-tema-editando`, `biblioteca-1280x800-100-seleccion`, `biblioteca-1280x720-125-resultado-lote`, `ajustes-1280x800-100-dialogo-quitar-predeterminado` y `ajustes-1280x800-100-temas-borrado-pendiente`. Observaciones en el README de la carpeta.

Comando: `SHINOBI_CAPTURAS_3=1 npx playwright test e2e/temas-capturas.spec.ts --workers=1` desde `app/`.

## Desviaciones

- **Solo lectura en Ajustes.** Con un catálogo de esquema posterior (o ilegible), Ajustes muestra el aviso y la lista vacía: no hay selector ni ⋯ que deshabilitar, porque el catálogo no se lee. La spec habla de «selector con `aria-disabled`»; solo ocurre cuando hay temas visibles.
- **El `tema.eliminar.parcial` del E2E** se comprueba con las cuatro o cinco canciones del caso, en el orden del borrado (título con colador).
- **A3 y A5** (canción nueva con predeterminado y aleatoria estable) no tienen E2E: exigirían importar una canción; los cubren las pruebas de main de 0168.
- **`temas-capturas.spec.ts`** no estaba en la lista de archivos de la tarea; es el equivalente al caso opt-in de 2.1.

## Deuda y seguimiento

- **«Aplicar tema…» oculto** en el ⋯ de la tarjeta con el catálogo vacío o en solo lectura, en lugar de inactivo con motivo (`MenuContextual` no admite ítems inactivos; 0173).
- **Toasts de una sola acción.** `tema.toast.error` de Ajustes lleva [Reintentar] pero no [Copiar detalles] (`AccionToast` admite una; 0175). En el editor se amplió con `accionSecundaria`.
- **Textos sin definir en la spec:** `aj.temas.errorCarga`, estado de carga (esqueletos) y «Ahora usa el estilo incluido» en las notas del lote.
- **E2E que faltan** y se cubren solo en Vitest: tiempo de 100 ms al elegir (T3), deshacer del toast (T5), fallo de escritura al guardar un tema (T11), teclado (T25), panel minimizado en D3 (T27), canción nueva con predeterminado y aleatoria (A3, A5), modo selección tras volver del reproductor (B15).
- **Scroll horizontal de 11 px** a 1024 px de ancho con scroll vertical, por `body { min-width: 1024px }` de 0.1.0 (visible en `biblioteca-1280x720-125-resultado-lote.png`). Pregunta [0057](../../preguntas/0057-ancho-minimo-del-cuerpo-y-scroll-horizontal-a-1024-px.md).
- **CI.** Comprobar en el PR los casos nuevos en Linux (xvfb) y macOS (el 125 % y el viewport de 1024 × 576 dependen de que el sistema conceda el tamaño; los casos de viewport se omiten con anotación si no) y los 8 casos de Vitest con enlaces simbólicos. El mecanismo de fallos (`<archivo>.tmp` como directorio) y `taskkill`/`SIGKILL` no se ha probado en macOS ni en Linux.

## Preguntas abiertas

- [0051](../../preguntas/0051-seguimiento-automatico-del-cabezal.md) (para el usuario, no bloquea): el seguimiento automático del cabezal sigue sin implementar.
- [0057](../../preguntas/0057-ancho-minimo-del-cuerpo-y-scroll-horizontal-a-1024-px.md) (para UX, no bloquea): ancho mínimo del cuerpo y barra horizontal a 1024 px.
