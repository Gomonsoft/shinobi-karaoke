# Informe de fase 6 · Exportación de video

Las tareas 0230–0241 y 0243 del [backlog](backlog.md) entregan la exportación de una canción a un video local con la letra y el estilo reproducidos de forma determinista: un render por índice de fotograma en una ventana offscreen, una tubería con contrapresión hasta el worker PyAV que codifica (MKV con AV1 + Opus, o WebM con VP9 + Opus), un destino temporal con sustitución atómica, la cola, el diálogo con su progreso, resultado y errores, y los puntos de entrada desde la Biblioteca, el editor, el panel de actividad y el cierre de la app. La tarea **0242** (captura 4K en Linux con tamaño incorrecto) es condicional y **sigue pendiente**: solo se hace si falla el paso 8.10 de la guía manual en Linux con GPU real. Las specs son [Exportación](../../ux/10-exportacion.md) (V1–V30 sin V24, y M1–M9), [Biblioteca · Fase 6](../../ux/02-biblioteca.md#fase-6-de-020--exportación) (X1–X7) y [Editor · Fase 6](../../ux/06-editor.md#fase-6-de-020--exportación) (EX1–EX7). Decisión: [ADR 0019](../../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md), con las revisiones del 2026-11-20 (captura asentada, preparación en paralelo, umbral de memoria de 7 GiB, diario, avisos de limpieza e interrupción) y revisiones de [0017](../../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) (convivencia con la sesión), 0006, 0008, 0012 y 0013.

**Estado: Implementada; CI sin confirmar en verde sobre el HEAD; pendiente de la guía manual.** La [guía manual](../../Test-manuales/0.2.0/fase-6-exportacion.md) (17 casos) **no se ha ejecutado todavía**. Todo lo que depende de ella (calidad visual del video, sincronía percibida, reproductores externos, tiempos en Windows y Linux, 4K/60, memoria, exportar durante una sesión con dos pantallas reales, sustitución con el archivo abierto en Windows, cierre y caída de la app, «Mostrar en la carpeta», suspensión del equipo, y la comprobación de 2160 líneas en Linux con GPU real) consta aquí como «pendiente de la guía manual», no como verificado. El cierre formal de la fase espera a esa ejecución.

La fase vive en `alpha-2` (PR borrador [#9](https://github.com/Gomonsoft/shinobi-karaoke/pull/9)), junto con las fases 4 y 5.

## Qué se entregó

| Tarea | Entrega | Estado |
|---|---|---|
| [0230](../../tareas/0230-contratos-compartidos-de-la-exportacion.md) | Contratos: catálogo de 48 perfiles, parámetros de codificación, estimaciones, `nombrePropuesto`, 10 canales IPC, códigos de error, `config.exportacion`, preloads y dobles | Hecha |
| [0231](../../tareas/0231-worker-comando-exportar.md) | Comando `exportar` del worker (PyAV, lectura de stdin, mezcla de audio, verificación final) | Hecha |
| [0232](../../tareas/0232-capacidades-de-exportacion-y-licencias-de-codecs.md) | Comando `capacidades-exportacion` y comprobación de licencias de códecs en las 6 ruedas | Hecha |
| [0233](../../tareas/0233-cliente-del-worker-con-tuberia-y-bucle-de-fotogramas.md) | Cliente del worker con tubería y prioridad baja; bucle de fotogramas con contrapresión | Hecha |
| [0234](../../tareas/0234-ventana-offscreen-de-exportacion-y-rol.md) | Ventana offscreen, rol `exportacion`, tercer preload y entrada de build | Hecha |
| [0235](../../tareas/0235-render-por-fotograma-y-marca-de-agua.md) | `PantallaLetra` con `tiempoFijoMs`, animaciones por fotograma, anfitrión de exportación y marca de agua | Hecha |
| [0236](../../tareas/0236-destinos-temporal-y-diario-de-exportacion.md) | Destinos (`destinoId` de un solo uso), temporal, sustitución y diario | Hecha |
| [0237](../../tareas/0237-servicio-de-exportacion-e-ipc.md) | `ServicioExportacion`: cola, perfiles, estimaciones, instantánea, cancelación con limpieza, avisos de arranque, IPC y cierre | Hecha |
| [0238](../../tareas/0238-dialogo-de-exportacion-formulario.md) | Diálogo: formulario, perfiles no soportados, notas, destino y muestra | Hecha |
| [0239](../../tareas/0239-progreso-resultado-y-estado-de-exportaciones.md) | Progreso, cola, cancelación, éxito, errores, toasts y anuncios | Hecha |
| [0240](../../tareas/0240-puntos-de-entrada-de-la-exportacion.md) | Biblioteca (⋯ y línea de la tarjeta), editor (⋯ y Ctrl/Cmd + E), panel de actividad, eliminar y cierre | Hecha |
| [0241](../../tareas/0241-pruebas-de-integracion-capturas-e-informe-de-la-fase-6.md) | `exportacion.spec.ts` (3 pruebas), `exportacion-capturas.spec.ts`, 20 capturas, este informe | Hecha; el cierre formal espera a la guía manual |
| [0242](../../tareas/0242-captura-4k-en-linux-con-tamano-incorrecto.md) | Captura 4K en Linux sin GPU | **Pendiente (condicional)**: solo si falla el paso 8.10 de la guía |
| [0243](../../tareas/0243-registro-de-capturas-sin-asentar.md) | `capturar()` devuelve `{ imagen, asentada, intentos }` y el servicio registra en `app.log` los fotogramas no asentados | Hecha |

## Verificación

### Estrategia

Con la [estrategia de pruebas](../../pruebas.md), la lógica va a Vitest y pytest; los E2E cubren solo la integración que exige Electron real con el worker PyAV; la regresión completa la ejecuta el CI y lo que necesita hardware va a la guía.

- **Vitest** (por tarea): contratos (`shared/exportacion.test.ts`, `exportacionIpc.test.ts`), main (`main/exportacion/{bucle,destinos,diario,servicio,ventana}.test.ts`, `main/ipc/handlers.exportacion.test.ts`), render (`karaoke/PantallaLetra.test.tsx`, `animacionesPorFotograma.test.ts`), anfitrión (`renderer/exportacion/{AppExportacion,MarcaDeAgua,estado}.test.*`), diálogo (`exportacion/dialogo/{DialogoExportacion,modelo}.test.*`, `ProveedorExportacion.test.tsx`) y puntos de entrada (`exportacion/puntosDeEntrada.test.tsx`, `vistas/editor/Editor.exportar.test.tsx`).
- **pytest** del worker (`worker/tests/test_exportar.py`, 6 pruebas con ambos formatos a 320 × 240; `test_capacidades_exportacion.py`; `test_inspeccionar_av.py`), que corre en los 3 sistemas.
- **E2E** (`app/e2e/`, secundarias; con la app real, el worker PyAV, la ventana offscreen y la tubería, a 640 × 480 y 24 FPS por la IPC):
  - **E1** `exportacion.spec.ts` «exporta a MKV: 3 s a 640×480, fotogramas y barrido visible»: 72 fotogramas, 1 flujo de audio, FPS y duración leídos con PyAV, sin temporales ni `en-curso.json`; los píxeles del color de resaltado crecen entre el fotograma 53 y el 69.
  - **E2** «cancelar a mitad conserva el archivo previo y no deja temporal ni diario»: a mitad de 30 s de audio, resultado `cancelada` y la carpeta solo contiene el archivo previo con el mismo hash (WebM).
  - **E3** «“Letra lista” a WebM: sin barrido y con los fotogramas esperados»: 72 fotogramas y ningún píxel del color de resaltado.
  - **E4** `exportacion-captura.spec.ts` (2 casos, 640 × 480 y 3840 × 2160): la captura de la ventana offscreen es exacta y en BGRA. El de 3840 × 2160 **se omite solo en Linux sin GPU** y solo si la captura sale como mucho 2 px menor (regla 10 de `pruebas.md`); en macOS y Windows es obligatorio.
- **Capturas**: `exportacion-capturas.spec.ts`, opt-in (`SHINOBI_CAPTURAS_6=1`), fuera de la regresión.

### CI

| Ejecución | Commit | Resultado |
|---|---|---|
| [44858445678](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/44858445678) (`alpha-2`, PR #9) | `750727b` | **Correcto en los 6 trabajos.** En Ubuntu: Vitest 3134 correctas y 12 omitidas (235 archivos), E2E con xvfb **193 correctos, 25 omitidos, 0 fallos**; worker 346 correctas. Es el último verde completo. |
| [44860307263](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/44860307263) | `8d2c700` | **Fallo.** Windows en verde (Vitest 3184 correctas y 13 omitidas). Ubuntu: Vitest 3184 correctas, E2E 193 correctos y **1 fallo**: `exportacion-captura.spec.ts › captura 640x480 exacta y en BGRA` (`bytes.subarray is not a function`), **prueba desfasada** tras la 0243 (ahora `capturar()` devuelve un objeto); corregida en `fd5a9eb`. macOS: **1 fallo unitario** en `Progreso.test.tsx` («con el motor reparado reintenta separar incluso si Rápido quedó pendiente»), intermitente, **en investigación** (ya falló una vez en Windows en otro caso); no es de esta fase. |
| [44861652267](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/44861652267) | `fd5a9eb` | **Completado: fallo, sin regresión de la fase.** Windows en verde. Ubuntu: Vitest 3184 correctas; E2E **195 correctos, 27 omitidos y 1 fallo**: `temas-editor.spec.ts:434` («los botones de los diálogos de tres acciones caben en el diálogo… a 100 %», de la fase 3) por **tiempo agotado de 90 s** con «Worker teardown timeout» (la app no cerró): **inestable**, no relacionado con las specs de esta fase (`fase5.spec.ts` y `exportacion*.spec.ts` pasan; `exportacion-captura` 640 × 480 ya pasa tras `fd5a9eb`). macOS: **1 fallo unitario** distinto del anterior, `Editor.test.tsx` («recarga una visita desactualizada en pausa»): **inestable**. Con este run ya van dos pruebas unitarias de macOS que fallan de forma intermitente (`Progreso.test.tsx` y `Editor.test.tsx`) y una de Windows. |

Los E2E solo corren en Ubuntu. En Windows y macOS la exportación se ejercita con Vitest y con el pytest del worker, que codifica con PyAV real en los 3 sistemas, pero **la ventana offscreen y la captura reales solo se ven en Ubuntu (sin GPU)**. Los dos commits locales posteriores a `fd5a9eb` (`03d81e8` y `6339db2`, el arreglo del diálogo) no están empujados, así que ningún run cubre el HEAD local. Antes de fusionar a `main` hay que reconfirmar el verde sobre el HEAD final.

### Defectos encontrados por el CI o el ensayo y su corrección

| Defecto | Dónde se vio | Clasificación | Corrección |
|---|---|---|---|
| El worker `exportar` no cerraba el contenedor antes de borrar el temporal: `PermissionError` en Windows | `test_exportar.py`, run [44853661863](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/44853661863) | **Regresión real** (0231, `worker/shinobi_worker/exportar.py`); también habría fallado para un usuario de Windows | `fd8181c` |
| Captura offscreen de 3839 × 2159 en Linux con Xvfb sin GPU; la app la rechaza con `PERFIL_NO_SOPORTADO` | `exportacion-captura` 3840 × 2160, run [44856768872](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/44856768872) (`acc0e0b`; 1 de 15 fallos) | **De entorno** (límite de la superficie software); **riesgo abierto** en Linux real | Prueba omitida solo ahí (`90b2d78`, `774ec8d`); paso 8.10 de la guía; tarea 0242 condicional |
| 1 px de scroll de página en el Editor: la región `aria-live` del proveedor de exportación copiaba el estilo de «solo lector» sin `top` ni `left` | 14 de los 15 fallos del mismo run (`editor-layout.spec.ts`) | **Regresión** (0239/0240, `ProveedorExportacion`); repetía la de la fase 4 con otro aviso oculto | Clase única `soloLector` en `componentes.module.css` (`90b2d78`, `774ec8d`); los críticos comprueban `scrollHeight ≤ innerHeight`; regla 9 de `pruebas.md` |
| Fotograma obsoleto: a 3840 × 2160 una de cada ~200 capturas devolvía el cuadro anterior, sin error | Ensayo del programador (0234), pregunta [0127](../../preguntas/0127-captura-offscreen-con-cuadro-obsoleto.md) | **Defecto real** (Chromium) | Doble captura en todas las resoluciones (0235, ADR 0019 §2); 0243 registra en `app.log` los fotogramas no asentados |
| `ENOTEMPTY` al limpiar el directorio temporal de `servicio.test.ts` | Run [44859783219](https://github.com/Gomonsoft/shinobi-karaoke/actions/runs/44859783219) (`36e7c59`), Ubuntu | **Inestable** (de la prueba, carrera con el borrado) | `8d2c700`: la limpieza reintenta |
| `exportacion-captura` 640 × 480: `bytes.subarray is not a function` | Run 44860307263 (`8d2c700`), Ubuntu | **Prueba desfasada** (consecuencia prevista de la 0243) | `fd5a9eb` |
| Tres defectos del diálogo a 720 de alto: popover «Qué formato elegir» recortado por la zona de scroll, doble barra de scroll (la columna de la muestra con la suya) y avisos («ya existe», errores, notas) bajo el pliegue | Toma de las capturas (0241) a 1280 × 720 al 125 % | **Defecto de UI** (0238, `Formulario.tsx`, `exportacion.module.css`) | Una sola zona de scroll, popover en línea y avisos pegados al borde inferior (`03d81e8`, integrado en `6339db2`); capturas regeneradas. **Sin prueba automática**; el caso 17.1 de la guía lo vigila. Los commits no están empujados |
| Pruebas unitarias intermitentes en macOS: `Progreso.test.tsx` (run 44860307263; una vez en Windows en otro caso) y `Editor.test.tsx` («recarga una visita desactualizada en pausa», run 44861652267) | CI | **Inestable**, causa sin determinar; no son de la exportación | En investigación |
| `temas-editor.spec.ts:434` con tiempo agotado de 90 s y «Worker teardown timeout» | Run 44861652267, Ubuntu (primer run con `exportacion.spec.ts`) | **Inestable** (fase 3); las tres pruebas de exportación pasan | Vigilar si se repite |

### Medidas

Las medidas existentes son de **un solo intento**, hechas por los programadores en un **MacBook M1 (Apple Silicon)**, no las de la guía manual:

| Medida | Valor | Origen |
|---|---|---|
| 640 × 480 a 24 FPS, 72 fotogramas (MKV), con el arranque de la app | 3,1 s | Tarea 0237 |
| 1920 × 1080 a 30 FPS, 900 fotogramas (30 s de canción) | 26,3 s | Tarea 0237 |
| Cancelar a mitad (1080p / 720p) y limpiar | 40 ms, sin temporal ni diario | Tarea 0237 |
| 3 s a 640 × 480 en MKV, prueba completa con el arranque | unos 2,8 s | Tarea 0241 |
| 5 s a 1080p30 en MKV, «Tardó 3 s» | 3 s | Tarea 0241 |
| `exportacion.spec.ts` completa (3 pruebas) | unos 7,5 s (2,8 + 1,6 + 2,7) | Tarea 0241, 2 pasadas |
| Prueba técnica del ADR 0019 (M1 de 8 GB, equipo sin ventilador) | De extremo a extremo: 1080p30 de 0,9 a 1,4 veces la duración; 4K/30 unas 5 veces; 4K/60 (equipo caliente) de 9 a 19 veces; picos del worker de 360 MB (720p) a 1,2 GB (4K) | ADR 0019 §2–§3, cifras orientativas (± 30 %) |

**Pendientes de la guía manual** (ninguna existe todavía): tiempo y tamaño de 1080p30 y 3840 × 2160 a 60 FPS en Windows y Linux (caso 8); equipo modesto con 1280 × 720 y 4K/60, memoria y usabilidad (caso 9); error de la estimación respecto del tiempo real (± 50 %) y mejora en la segunda exportación (8.7–8.8); cortes de audio y tirones al exportar durante una sesión en dos pantallas reales (caso 11); suspensión (caso 15). Las cifras de la prueba técnica no valen para Windows ni Linux ni equipos más lentos que un M1.

### Capturas

20 PNG en [`docs/ux/revision-fase-6/`](../../ux/revision-fase-6/README.md), 10 estados × 2 (1280 × 800 al 100 % y 1280 × 720 al 125 %), con exportaciones reales de 5 s a 1080p30, regeneradas tras corregir los tres defectos del diálogo. **Faltan 4 estados de V29** (`en-cola`, `fallo`, `perfil-no-soportado`, `sin-perfiles`): necesitan un doble o un equipo que no existen en la app empaquetable (están cubiertos por Vitest); `bloqueo-sesion` no existe porque V23 se retiró. La captura `tarjeta-exportando` solo muestra el tooltip del ⋯, **no el menú abierto** que pide X7. La revisión del diseñador sigue por hacer. Comando: `SHINOBI_CAPTURAS_6=1 npx playwright test e2e/exportacion-capturas.spec.ts --workers=1` desde `app/`.

## Resultado por criterio

Leyenda: «V» = Vitest o pytest (archivo bajo `app/src/`; `renderer/src/` se abrevia `R/`); «E1–E4» = E2E de arriba; «Guía n» = caso de la guía manual, **no ejecutada**. Un criterio cuya parte dependiente de la guía no está verificada se marca «Parcial»; «Sin evidencia» significa que ninguna prueba ni la guía cubren esa parte.

### Exportación (V)

| Criterio | Verificación | Resultado |
|---|---|---|
| V1 · «Exportar video…» en el ⋯ de Lista, Letra lista e incompleta, también con sesión; no en borrador ni Dañada; «Ver exportación» | V `R/exportacion/puntosDeEntrada.test.tsx` («una Lista ofrece “Exportar video…” entre “Editar datos” y “Aplicar tema…”», «un borrador y una Dañada no ofrecen exportar», «exportándose: “Ver exportación”…»). No hay prueba con Letra lista, incompleta ni con sesión. Guía 1.1–1.2 | Parcial |
| V2 · Editor: ⋯ y Ctrl/Cmd + E abren el diálogo tras vaciar el guardado; motivos; modo sincronizar | V `puntosDeEntrada.test.tsx` («pausa, vacía el guardado y abre el diálogo…», «sin pistas o sin líneas con inicio no hace nada y explica el motivo», «en el modo sincronizar no hace nada»), `R/vistas/editor/Editor.exportar.test.tsx` (EX1, EX2) | Correcto (V) |
| V3 · Formulario completo; foco inicial en Audio; Esc cierra sin exportar | V `R/exportacion/dialogo/DialogoExportacion.test.tsx` («muestra audio, proporción, resolución, FPS, formato, destino, estimación y muestra», «con el foco inicial en Audio y Esc cierra sin exportar») | Correcto (V) |
| V4 · Resoluciones por proporción; cambiar de proporción elige la equivalente | V `DialogoExportacion.test.tsx` («lista las resoluciones de cada proporción y elige la equivalente al cambiarla»), `modelo.test.ts` («cambiar de proporción elige la resolución equivalente y corrige el FPS»), `shared/exportacion.test.ts` (48 combinaciones) | Correcto (V) |
| V5 · Perfiles no soportados con motivo; cambio de FPS con anuncio; menos de 8 GB sin 2160 líneas | V `DialogoExportacion.test.tsx` («marca los perfiles no soportados con su motivo y cambia el FPS con aviso», «anuncia el cambio automático de FPS…»), `main/exportacion/servicio.test.ts` («con 7,5 GiB se ofrece 2160 líneas y con 6 GiB sale motivo memoria», «un codificador que no abre la resolución máxima marca el perfil con motivo codificador»). **El umbral implementado es 7 GiB, no 8** (ADR revisado). Guía 10 | Correcto (V), con desviación |
| V6 · Sin voz, «Instrumental y voz» inactiva con `exp.audio.sinVoz` | V `DialogoExportacion.test.tsx` («sin voz deshabilita “Instrumental y voz” y fuerza el instrumental») | Correcto (V) |
| V7 · [Cambiar…] abre «Guardar» con carpeta y nombre propuestos; cancelar no cambia | V `main/exportacion/destinos.test.ts` («usa la carpeta recordada…», «fuerza la extensión del formato», «cancelar devuelve null y el destinoId sigue valiendo»), `shared/exportacion.test.ts` (`nombrePropuesto`). El diálogo del sistema real: Guía 1.18 | Parcial |
| V8 · Destino existente: `exp.aviso.existe` y «Exportar y sustituir» | V `DialogoExportacion.test.tsx` («con archivo existente avisa y el primario sustituye (E)»). Guía 2.6 y 12 | Correcto (V) |
| V9 · Notas en su orden, ninguna impide exportar; espacio solo con las dos cifras | V `DialogoExportacion.test.tsx` («muestra las notas en el orden de la spec…», «no avisa del espacio si falta una de las cifras») | Correcto (V) |
| V10 · Se recuerdan las opciones, no el nombre | V `servicio.test.ts` («worker, ventana y bucle producen el archivo…» comprueba `config.exportacion`), `shared/exportacionIpc.test.ts` (lectura tolerante), `modelo.test.ts` (opciones recordadas). Guía 1.17 | Correcto (V) |
| V11 · Progreso con subpasos, porcentaje que no retrocede y tiempo; segundo plano | V `R/exportacion/ProveedorExportacion.test.tsx` («muestra los tres subpasos…», «el porcentaje no retrocede con un evento atrasado», «“Seguir en segundo plano” y Esc cierran sin cancelar»), `estado.test.ts`. Guía 5.1–5.7 | Correcto (V) |
| V12 · Segunda exportación en cola y empieza sola; «Quitar de la cola»; la separación no espera | V `ProveedorExportacion.test.tsx` («explica detrás de qué exportación espera y la quita sin confirmar»), `servicio.test.ts` («la segunda exportación espera y empieza sola…», «cancelar una exportación en cola…»). **Que la separación avance a la vez no tiene prueba.** Guía 5.9–5.12 | Parcial |
| V13 · Cancelar pide confirmación; no queda temporal ni archivo nuevo; el previo conserva el contenido (hash) | E2 (hash y sin temporal ni diario), V `ProveedorExportacion.test.tsx` («confirma la cancelación en línea (B3)…»), `servicio.test.ts` («cancelar en curso mata el worker y limpia temporal y diario»). Guía 5.13–5.17 | Correcto (V y E2E) |
| V14 · Editar durante la exportación no cambia el video (instantánea) | V `servicio.test.ts` («editar la canción durante la exportación no cambia la instantánea (V14)»). No hay E2E que decodifique el video tras editar. Guía 5.8 | Parcial |
| V15 · Éxito con los datos; «Mostrar en la carpeta» selecciona el archivo; toast | V `ProveedorExportacion.test.tsx` («éxito: muestra los datos y enfoca “Mostrar en la carpeta”», «éxito: toast con “Mostrar en la carpeta”…»), `servicio.test.ts` («“Mostrar en la carpeta” de un trabajo completado señala el destino…»). El explorador real en los tres sistemas: Guía 14 | Parcial (pendiente de la guía manual) |
| V16 · Resolución, FPS constantes, formato, duración, audio estéreo con la ganancia | E1 (MKV) y E3 (WebM): 72 fotogramas, 1 flujo de audio, FPS y duración con PyAV, solo a 640 × 480 y 24 FPS; V `worker/tests/test_exportar.py` (ambos formatos, «mezcla y normalización»). **El estéreo con la ganancia de la canción no se comprueba en E2E.** Guía 3.13 y 17.7 | Parcial |
| V17 · El fotograma del render de exportación es idéntico al del render compartido; sondas ≤ 16 niveles | V `PantallaLetra.test.tsx` («E1…», «E2: el mismo instante da el mismo DOM, vengas de donde vengas»), `animacionesPorFotograma.test.ts`, `AppExportacion.test.tsx`; E1 (el color de resaltado crece entre el fotograma 53 y el 69). **No existe la comparación del `FotogramaLetra` con `fotogramaEn` para n muestreados** que pedía el ADR y que 0235 dejó a 0241, ni la medición de ± 16 niveles (0241 solo mide crecimiento de color). Guía 17.4 | Parcial |
| V18 · Letra lista sin barrido; un borrador siempre con barrido | E3 (ningún píxel del color de resaltado); V `shared/fase5.test.ts` (`modalidadEfectiva` da `karaoke` en un borrador). El borrador exportado con barrido no se prueba de extremo a extremo. Guía 3.11 y 17.5 | Parcial |
| V19 · Marca de agua en todos los fotogramas, abajo a la derecha, márgenes y cuerpo, sin pisar la letra | V `R/exportacion/MarcaDeAgua.test.tsx`, `AppExportacion.test.tsx` (la pinta). Las medidas a 640 × 480 y a 3840 × 2160 las hizo 0235 a mano y no están persistidas. Guía 3 y 17.6 | Parcial |
| V20 · Cada código de error con su título, explicación y acciones; posición; archivo conservado; Reintentar; Copiar detalles | V `ProveedorExportacion.test.tsx` (`it.each` de 8 códigos: `SIN_ESPACIO`, `DESTINO_NO_DISPONIBLE`, `CANCION_NO_DISPONIBLE`, `PERFIL_NO_SOPORTADO`, `MEMORIA_INSUFICIENTE`, `RUNTIME_NO_DISPONIBLE`, `SIN_CODIFICADOR`, `ERROR_INTERNO`; «“Reintentar” exporta con las mismas opciones y una instantánea nueva», «“Cambiar opciones” vuelve al formulario…», «el archivo conservado sale de `destinoExistia`…»), `DialogoExportacion.test.tsx` (`DESTINO_OCUPADO` en el campo), `servicio.test.ts` («un fallo de rename da `DESTINO_NO_DISPONIBLE` y deja intacto el archivo anterior»). `LIMPIEZA_FALLIDA` sale como toast (V22). «Copiar detalles»: solo se comprueba que está visible. Guía 6.5 y 17.3 | Parcial |
| V21 · Fallo con el diálogo cerrado: toast persistente con [Ver] | V `ProveedorExportacion.test.tsx` («fallo: toast persistente con [Ver] que abre D») | Correcto (V) |
| V22 · Limpieza fallida: toast con «Mostrar en la carpeta» | V `ProveedorExportacion.test.tsx` («limpieza fallida: toast…», «aviso de limpieza fallida al arrancar…»), `servicio.test.ts` («si el temporal no se puede borrar: `limpiezaFallida`…»). El bloqueo real de Windows: Guía 12.5 y 13 | Correcto (V) |
| V23 · Con sesión: sin candado, `exp.nota.sesion`, «Exportar» activo; la nota aparece y desaparece; abrir una sesión no cambia el diálogo de pantallas | V `DialogoExportacion.test.tsx` (la nota de sesión en el orden de las notas, «Exportar» activo). **Sin E2E con sesión** (la tarea 0241 lo pedía y no se hizo), sin prueba de que la nota cambie con la sesión abierta, ni de que el diálogo de pantallas no cambie. Guía 11 (11.10) | Parcial |
| V24 | Retirado en la spec | — |
| V25 · Cerrar la app con exportación: `exp.cierre.item` y `exp.cierre.extra`; «Seguir trabajando»; «Cerrar de todos modos» borra el temporal | V `puntosDeEntrada.test.tsx` («lista “exportar «{título}»” y añade el texto de los videos a medio exportar», «con trabajos y exportaciones suma las dos…», «sin exportaciones activas cierra sin preguntar»), `servicio.test.ts` (`hayEnCurso`, cancelación con limpieza). «Al reabrir no aparece ningún aviso» y el cierre real: Guía 13 | Parcial |
| V26 · Tras matar el proceso: restos borrados y un solo `exp.toast.interrumpida` | V `main/exportacion/diario.test.ts` («tras una caída borra el temporal y el diario y avisa una sola vez»), `servicio.test.ts` («un diario de una caída da un único aviso “interrumpida”…»), `ProveedorExportacion.test.tsx` («tras una caída avisa una sola vez…»). Proceso muerto de verdad: Guía 13 | Parcial |
| V27 · Operable con teclado en todos los estados; foco al cerrar; nunca en `body` | V `ProveedorExportacion.test.tsx` (foco en «Mostrar en la carpeta» al terminar; Esc), `DialogoExportacion.test.tsx` (foco inicial). **Sin prueba que afirme el recorrido completo ni «nunca en `body`»**. Guía 5.19 | Parcial |
| V28 · Los lectores reciben solo los hitos; errores como `alert` | V `ProveedorExportacion.test.tsx` («anuncia solo los hitos en la región educada», `getByRole('alert')` en cada fallo), `estado.test.ts` («solo anuncia hitos…»). Lector real: Guía 5.20 | Correcto (V) |
| V29 · Cabe a 1024 × 576 y 1280 × 800 sin scroll horizontal, con cabecera y botones; 14 capturas | 20 PNG de 10 estados × 2 formatos (regeneradas tras los arreglos del diálogo). **Faltan 4 estados** y **ninguna prueba mide el scroll horizontal ni la visibilidad de cabecera y botones**. Guía 17.1–17.2 | Parcial |
| V30 · WebM: pista, extensión, formato corto y estimación; popover ⓘ; formato sin soporte; destino al cambiar | V `DialogoExportacion.test.tsx` («WebM cambia la pista, la extensión del destino y la estimación (V30)», «el popover ⓘ se abre con Intro y Esc lo cierra devolviendo el foco», «un formato sin soporte queda `aria-disabled` y se elige el otro», «con todos “no comprobado”…»). **El destino al cambiar de formato no sigue la letra de V30**: se aplica la opción provisional de [0124](../../preguntas/0124-destino-conservado-al-cambiar-de-formato.md) (se conservan carpeta y nombre), que la spec contradice. Guía 1.19 | Parcial (desviación) |

### Biblioteca (X)

| Criterio | Verificación | Resultado |
|---|---|---|
| X1 · «Exportar video…» entre «Editar datos» y «Aplicar tema…»; no en borrador ni Dañada | V `puntosDeEntrada.test.tsx` (Lista; borrador y Dañada sin ella), `Biblioteca.acciones.test.tsx` (los menús incluyen el ítem). Letra lista e incompleta sin prueba propia. Guía 1.1–1.2 | Parcial |
| X2 · «Ver exportación» y «Cancelar exportación…»; en cola sin confirmar | V `puntosDeEntrada.test.tsx` («exportándose: “Ver exportación” y “Cancelar exportación…”…», «✕ pide cancelar con la confirmación del proveedor»), `ProveedorExportacion.test.tsx` (quitar de la cola sin confirmar) | Correcto (V) |
| X3 · Línea `bib.exp.linea` actualizada ≥ 1 vez cada 2 s sin mover el foco ni reordenar; `bib.exp.cola`; desaparece al terminar | V `puntosDeEntrada.test.tsx` («indeterminada al preparar o terminar, y sin línea al terminar», línea con el porcentaje y en cola), `servicio.test.ts` («como mucho 4 por segundo, y la ETA es null los primeros 15 s»). El foco y el no reordenar no se prueban. Guía 5.5 | Parcial |
| X4 · Panel de actividad con [Ir] y [✕]; cuenta en el indicador | V `puntosDeEntrada.test.tsx` («cuenta las exportaciones y lista una fila con [Ir] y ✕», «✕ pide cancelar…») | Correcto (V) |
| X5 · Eliminar una canción que se exporta: `exp.eliminar.extra` y sin temporal | V `servicio.test.ts` («cancelarDeCancion cancela la en curso y la en cola de esa canción»). El texto extra del diálogo de eliminar y el cableado de `index.ts` no tienen prueba. Guía 5.18 y 17.9 | Parcial |
| X6 · Con sesión, exportar sin candado y con `exp.nota.sesion`; abrir la sesión con la exportación en curso | Ver V23. Guía 11 | Parcial |
| X7 · Captura de la tarjeta con la línea y el ⋯ abierto | `exportacion-1280x800-100-tarjeta-exportando.png` muestra la línea «Exportando video 36 %» y solo el tooltip del ⋯, **sin el menú abierto**. Guía 17.8 | Parcial |

### Editor (EX)

| Criterio | Verificación | Resultado |
|---|---|---|
| EX1 · Pausa, vaciar guardado, abrir el diálogo; historial, selección, pista y velocidad intactos; foco de vuelta | V `Editor.exportar.test.tsx` («Ctrl/Cmd + E pausa el audio, vacía el guardado y abre el diálogo de exportación (EX1)»), `puntosDeEntrada.test.tsx`. Historial, selección, pista, velocidad y foco de vuelta sin prueba. Guía 1.12–1.13 | Parcial |
| EX2 · Motivos; Ctrl/Cmd + E inactivo en sincronizar, «Error de audio», campo de texto o diálogo abierto | V `Editor.exportar.test.tsx` («con la separación sin completar el ítem está `aria-disabled` y Ctrl/Cmd + E no hace nada (EX2)»), `puntosDeEntrada.test.tsx` (sin líneas, sincronizar). Error de audio, campo de texto y diálogo abierto sin prueba. Guía 1.14–1.15 y 17.10 | Parcial |
| EX3 · Fallo de guardado: `edi.exp.guardado` | V `puntosDeEntrada.test.tsx` («si el guardado falla pregunta: “Quedarme” no abre nada y “Exportar igualmente” sí») | Correcto (V) |
| EX4 · Borrador de tema: nota `edi.exp.temaBorrador` y el video usa lo guardado | V `puntosDeEntrada.test.tsx` (`temaBorrador: true`), `DialogoExportacion.test.tsx` (nota «tema sin guardar»), `servicio.test.ts` (instantánea de lo guardado). Guía 2.4 | Correcto (V) |
| EX5 · Un cambio durante la exportación se autoguarda y no entra en el video | V `servicio.test.ts` («editar la canción… no cambia la instantánea (V14)»). Sin E2E. Guía 5.8 | Parcial |
| EX6 · Con la exportación en curso, «Ver exportación» abre su estado | V `puntosDeEntrada.test.tsx` («con una exportación de la canción en curso es “Ver exportación” y abre su estado») | Correcto (V) |
| EX7 · El diálogo de atajos incluye `edi.atajo.exportar` | V `Editor.exportar.test.tsx` («el diálogo de atajos incluye Ctrl/Cmd + E (EX7)») | Correcto (V) |

### Verificación manual (M)

| Criterio | Caso de la guía | Resultado |
|---|---|---|
| M1 · Calidad visual en los dos formatos y todas las resoluciones | 3 | Pendiente de la guía manual |
| M2 · Sincronía percibida (≥ 6 min) | 4 | Pendiente de la guía manual |
| M3 · Reproductores externos (VLC, OBS, Firefox, Chrome, Safari, los de serie) | 7 | Pendiente de la guía manual |
| M4 · Perfil modesto y 4K/60 en un equipo modesto | 8 y 9 | Pendiente de la guía manual |
| M5 · Exportar durante un evento en dos pantallas reales | 11 | Pendiente de la guía manual |
| M6 · Sustitución, cancelar y el archivo abierto en Windows | 12 | Pendiente de la guía manual |
| M7 · Cerrar la app a mitad y matar el proceso | 13 | Pendiente de la guía manual |
| M8 · «Mostrar en la carpeta» en los tres sistemas | 14 | Pendiente de la guía manual |
| M9 · Suspensión del equipo | 15 | Pendiente de la guía manual |

### Resumen de los criterios

- **Sin prueba automática de una parte esencial (comprobables a mano; casilla en el caso 17 de la guía):** V12 (la separación no espera a la exportación), V14 y EX5 (el video no contiene lo editado después; solo se prueba la instantánea), V16 (estéreo con ganancia), V17 (comparación del modelo y ± 16 niveles), V18 (borrador con barrido), V19 (geometría de la marca), V23 y X6 (la nota con la sesión y el diálogo de pantallas), V29 (sin scroll horizontal; 4 estados sin captura), X5 (texto de eliminar), EX1 (foco, historial y selección) y EX2 (Error de audio, campo de texto y diálogo abierto).
- **Parcial por depender de la guía manual (hardware, sistema o persona real):** V1, V7, V15, V20 (Copiar detalles), V25, V26, V27, V30, X1, X3, X7.
- **Pendiente de la guía manual:** M1–M9.
- **Correcto con Vitest o E2E en verde:** V2–V6, V8–V11, V13, V21, V22, V28, X2, X4, EX3, EX4, EX6, EX7.

## Desviaciones

Respecto de las specs y del ADR 0019, según las notas de las tareas:

- **Umbral de memoria de 7 GiB (0237, revisión del ADR §5).** La spec (V5) y los textos dicen «8 GB»: un equipo de 8 GB informa menos de 8 GiB en Windows y Linux. La spec no se ha actualizado.
- **Destino al cambiar de formato (0238, opción provisional de la pregunta 0124).** Se conservan la carpeta y el nombre y solo cambia la extensión; la spec (V30) vuelve al propuesto con aviso. La pregunta sigue abierta (ver abajo).
- **Canales con `:` (0230)**, como el resto del código, y no con puntos como en el ADR.
- **Sin fin de la fase «preparando» (0237, pregunta 0134 aceptada):** main lanza el worker y crea la ventana a la vez; el bucle empieza cuando la ventana pide su instantánea.
- **El diario se borra siempre (0237)**, también con `limpiezaFallida` (el ADR decía conservarlo; ya está revisado).
- **Una segunda exportación de la misma canción** responde `ARGUMENTOS_NO_VALIDOS` (no hay código propio).
- **Animaciones por fotograma (0235):** se usa el nacimiento anotado desde el modelo (`data-nace-ms`) en lugar de «n − n₀ del fotograma observado» del ADR; da lo mismo en la secuencia normal.
- **Bucle (0233):** «máximo 2 fotogramas en vuelo» se interpreta como umbral de espera; puede haber 3 en cola justo tras escribir.
- **Capturas asentadas (0243, ADR §2):** el ADR dice «máximo de 4» capturas y «a la cuarta»; el código hace una captura y hasta 4 reintentos (hasta 5), como dice la nota de 0243.
- **Destinos (0236):** con otra extensión se añade la del formato (`x.avi` pasa a `x.avi.mkv`); en Windows se rechazan nombres reservados.
- **Diálogo (0238):** popover ⓘ y lista de resoluciones en línea (no en portal); las dos columnas pasan a una al estrechar (la spec fija 720 px de diálogo y 760 px de umbral, que se contradicen); el recorte del nombre largo es al final, no por el centro.
- **Resultado (0239):** «Tardó…» y la línea «El archivo que ya había…» dependen de los datos de main; el toast de éxito solo lleva «Mostrar en la carpeta».
- **Puntos de entrada (0240):** texto provisional `No se puede exportar ahora mismo.` para el ítem inactivo en sincronizar y con «Error de audio»; sin entrada de exportación en las Dañadas.
- **Pruebas (0241):** no existe `SHINOBI_EXPORTACION_PERFIL_PRUEBA` (se usa 640 × 480 a 24 FPS del catálogo); no se hizo la prueba con sesión abierta (V23) que pedía la tarea; la sonda mide el crecimiento del color y no la diferencia media.
- **Linux sin GPU (ADR §2, riesgo abierto):** la captura de 3840 × 2160 sale 1 px menor y se rechaza; la prueba se omite allí.

## Deuda y seguimiento

- **0237:** las exportaciones terminadas se recuerdan en memoria (50 como máximo) y se pierden al reiniciar; «Mostrar en la carpeta» de un trabajo fallido sin `limpiezaFallida` responde `DESTINO_NO_DISPONIBLE`.
- **0236:** `access(W_OK)` es una comprobación débil en Windows (no mira ACL).
- **0238:** la marca de agua de la muestra es propia de `MuestraExportacion`; conviene reutilizar `MarcaDeAgua.tsx`.
- **0240:** el motivo de «inactivo» del editor y el aviso de tema borrador pueden afinarse si el diseñador define su microcopy.
- **0234:** `e2e/seguridad.spec.ts` («la secundaria…») falla por tiempo en macOS de desarrollo también sobre la base `97ec2b2`; el CI no lo reproduce.
- **0243:** revisar `registros/app.log` tras las exportaciones 4K de la guía por si hay fotogramas no asentados.
- **Optimizaciones posibles** (ADR 0019): capturar con el evento `paint` y sustituir la tubería por memoria compartida, solo si la guía muestra tiempos inaceptables.
- **Capturas:** 4 estados de V29 sin imagen y X7 con el ⋯ cerrado.

## Decisiones provisionales pendientes del usuario

Las preguntas **0120** y **0130** siguen con **estado «Abierta» y `Para: usuario`**; no bloquean y sus opciones provisionales están aplicadas. **0124** también sigue **«Abierta»** (`Para: disenador-ux`), aunque su opción provisional ya está implementada (el encargo de este informe la daba por respondida).

| Pregunta | Opción provisional aplicada | Dónde se nota |
|---|---|---|
| [0120](../../preguntas/0120-formatos-y-resoluciones-de-la-exportacion.md) | Los dos formatos (MKV por defecto y WebM) y 2560 × 1440 en 16:9 | V3, V4, V30 (el arquitecto lo confirmó técnicamente en 0131) |
| [0130](../../preguntas/0130-decisiones-de-producto-de-la-exportacion.md) §1 | Se puede exportar un borrador desde el editor, con nota y siempre con barrido | V18, guía 2.3 |
| 0130 §2 | «Instrumental y voz» con la voz al 100 % | V16, guía 3.13 |
| 0130 §3 | Sin silencio previo: el video dura lo mismo que la canción | M2 |
| 0130 §4 | **Sin efecto**: exportar y la sesión conviven (ADR 0019 §9); solo hay una nota | V23, X6 |
| 0130 §5 | Se recuerdan audio, proporción, resolución, FPS, formato y carpeta (no el nombre) | V10 |
| [0100](../../preguntas/0100-decisiones-provisionales-de-la-fase-5.md) §3 | El video usa el movimiento del estilo aunque el sistema pida movimiento reducido | ADR 0019 §2; sin prueba |
| [0124](../../preguntas/0124-destino-conservado-al-cambiar-de-formato.md) | Se conservan carpeta y nombre al cambiar de formato | V30 (contradice la spec) |

Respondidas: [0127](../../preguntas/0127-captura-offscreen-con-cuadro-obsoleto.md), [0131](../../preguntas/0131-contratos-tecnicos-de-la-exportacion.md), [0132](../../preguntas/0132-avisos-de-limpieza-e-interrupcion-de-la-exportacion.md), [0133](../../preguntas/0133-reintentar-una-exportacion-con-el-mismo-destino.md) y [0134](../../preguntas/0134-fin-de-la-fase-preparando-de-la-exportacion.md). Propuestas que no entran en 0.2.0: [006](../../propuestas/006-exportar-varias-canciones-a-video.md) (varias canciones), [007](../../propuestas/007-codificacion-de-video-por-hardware.md) (codificación por hardware) y [008](../../propuestas/008-formato-de-video-de-maxima-compatibilidad.md) (formato de máxima compatibilidad).

## Riesgos abiertos

- **La guía manual no se ha ejecutado.** Sin ella no hay evidencia de la calidad visual, la sincronía, la compatibilidad con reproductores, los tiempos en Windows y Linux, 4K/60 ni la convivencia con una sesión real.
- **Linux sin GPU, 4K (0242).** La captura de 3840 × 2160 sale 1 px menor y se rechaza; si el paso 8.10 de la guía falla en Linux con GPU real, hay que hacer la tarea 0242 (o marcar esos perfiles como no soportados). Hasta entonces, en CI esa prueba se omite.
- **Convivencia con una sesión en dos pantallas reales** (GPU, CPU y memoria compartidas): `perfilCompatibleConSesion` está vacía y solo la guía (caso 11) puede mostrar cortes de audio. Si los hay, se abre una revisión del ADR 0019 §9.
- **Tiempos de 4K/60.** La prueba técnica da de 5 a 20 veces la duración en un M1 con el equipo caliente; en equipos más lentos o sin ventilador puede ser peor, y la estimación inicial puede quedarse corta.
- **Compatibilidad de los formatos.** MKV con AV1 y WebM con VP9 no se abren en QuickTime ni en muchos televisores antiguos (propuesta 008); en Windows el MKV con AV1 puede necesitar la extensión de Microsoft Store (guía, caso 7).
- **Umbral de memoria de 7 GiB** sin contrastar con un equipo real de 8 GB (guía, caso 10).
- **Windows:** sustituir un archivo abierto en otro programa y las notificaciones del sistema solo se ven en la guía.
- **Capturas no asentadas.** La doble captura corrige el fotograma obsoleto, pero la frecuencia en Windows y Linux no se ha medido; 0243 deja el rastro en `app.log`.
- **Diálogo en pantallas pequeñas.** Los tres arreglos de 720 de alto no tienen prueba automática y no están empujados.
- **CI sobre el HEAD final**, con dos pruebas unitarias intermitentes en macOS y un E2E de la fase 3 con tiempo agotado, todos en investigación o vigilancia.

## Incoherencias encontradas al escribir el informe

- La pregunta **0124 sigue «Abierta»** (para `disenador-ux`), pero su opción provisional está implementada y contradice la letra de V30 de la spec 10. La guía (paso 1.19) describía el comportamiento de la spec; se ha corregido para recoger el implementado.
- La nota de 0241 daba como «no corregidos» dos defectos del diálogo (popover recortado y doble barra de scroll); ya están corregidos y se ha actualizado la nota.
- **X7** pide la tarjeta con el ⋯ abierto; la captura solo tiene el tooltip.
- **V17**: el ADR y la spec piden comparar el modelo del fotograma con el render compartido; 0235 lo delegó en 0241 y 0241 solo mide color.
- La tarea **0241** pedía una prueba E2E con sesión abierta (V23) y un perfil `SHINOBI_EXPORTACION_PERFIL_PRUEBA`; ni uno ni otro existen.
- **ADR 0019 §2** dice «máximo de 4» capturas; el código hace hasta 5 (nota de 0243).
- Spec 10 · V5 y los textos dicen «8 GB»; el umbral real es 7 GiB.
- `docs/pruebas.md` no listaba las specs de las fases 4 a 6; se completa con este cierre.
- La guía de la fase 6 llevaba un aviso «pendiente de ajustar al cerrar la fase»; se revisaron sus textos citados frente a lo implementado (coinciden salvo el paso 1.19) y se retira el aviso. La tabla de guías de `Test-manuales/README.md` se actualiza.
- La spec 10 · B habla de los primeros 15 s «Calculando tiempo…»; el renderer lo muestra mientras main no da la estimación (main la omite 15 s), equivalente.

## Preguntas abiertas

Abiertas, ninguna bloquea: **0120** y **0130** (para el usuario) y **0124** (para el diseñador UX). Respondidas: 0127, 0131, 0132, 0133 y 0134.

## Estado del CI al cerrar

**Último run completado: `44861652267` sobre `fd5a9eb` (el último commit empujado). Resultado: fallo** (ver la fila de la tabla): Windows y los 3 trabajos del worker en verde; Ubuntu con 1 E2E inestable de la fase 3 (`temas-editor.spec.ts`, tiempo agotado) y macOS con 1 prueba unitaria inestable (`Editor.test.tsx`). El último run **totalmente en verde** sigue siendo `44858445678` sobre `750727b`. **Ningún run cubre el HEAD local `6339db2`** (dos commits sin empujar). Antes de fusionar a `main` hay que repetir el CI, investigar las pruebas unitarias intermitentes de macOS (`Progreso.test.tsx`, `Editor.test.tsx`) y comprobar si el timeout de `temas-editor.spec.ts` se repite (si se repite, sospechar de un proceso que no cierra tras las specs nuevas).
