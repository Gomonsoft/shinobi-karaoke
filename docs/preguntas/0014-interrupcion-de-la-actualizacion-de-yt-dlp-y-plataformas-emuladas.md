# 0014 — Interrupción de la actualización de yt-dlp, plataformas emuladas y "Usar otro enlace"
- De: disenador-ux
- Para: arquitecto
- Estado: Respondida
- Bloquea: no (cada punto tiene una opción provisional; afecta a las tareas 0045, 0050 y 0051, y a 0037 solo en el punto 2)

## Contexto
Al responder [0013](0013-huecos-ux-de-la-fase-2.md) han salido tres puntos que dependen de decisiones técnicas. Las specs `ux/01`, `ux/03` y `ux/04` ya recogen la presentación; aquí solo se pregunta qué es viable.

## Pregunta

### §1 ¿Qué pasa con la actualización de yt-dlp si el usuario cancela o cierra la app?
La actualización tras un bloqueo (0050) es un `uv pip install -U` sobre el venv. En la UX:
- **Cancelar** durante C1 (spec 03) o durante "Actualizando el descargador…" (spec 04) solo cancela la búsqueda o la descarga para el usuario: el campo vuelve a ser editable / la descarga queda `pendiente` sin errores.
- **Cerrar la app** durante la actualización (semanal o tras bloqueo): la actualización es mantenimiento, no trabajo del usuario, así que la UX prefiere **no** añadirla al diálogo `cierre.*`.

Preguntas: (a) ¿se puede abortar `uv pip install` sin dejar el venv a medias, o la actualización debe terminar siempre en segundo plano aunque se cancele lo que la provocó? (b) Al cerrar la app, ¿se espera a que termine (¿cuánto como máximo?) o se mata y la comprobación barata del arranque detecta un yt-dlp roto? (c) `info-youtube` va fuera de las colas (ADR 0009 §7): si coincide con la actualización semanal, ¿puede importar yt-dlp mientras uv lo reemplaza, o debe esperar a que termine? (La spec 03 ya tiene texto para esa espera: `add.reintento.ytdlp`.)

**Provisional**: cancelar no aborta uv (la actualización termina sola y en silencio); cerrar la app no muestra nada nuevo y mata el proceso (si el venv queda mal, B5 "Hay que reparar"); `info-youtube` espera a que termine una actualización en marcha mostrando `add.reintento.ytdlp`.

### §2 ¿Cuándo se llega realmente a B6 "Tu equipo no es compatible todavía"?
`ux/01` define B6 para plataformas sin requisitos en el manifiesto. Pero un Windows arm64 puede ejecutar el build x64 emulado (y un Mac Apple Silicon el build x64 con Rosetta), y entonces `process.arch` diría `x64`. Linux arm64 ni siquiera podría abrir un build x64.
- ¿Se detecta la arquitectura real (p. ej. `os.machine()` o equivalente) y se muestra B6 en Windows arm64, o se permite instalar el perfil x64 emulado?
- ¿Un Mac Apple Silicon que abre el build x64 por error debe ir a B6, a un aviso "descarga la versión para Apple Silicon", o instalar el perfil `darwin-x64-cpu`?
- El texto `pa.nocompat.equipo` necesita la arquitectura real para no decir "procesador x64" en un equipo ARM.

**Provisional**: se usa `process.arch`; B6 solo aparece si el manifiesto no tiene esa plataforma. Con emulación se instala el perfil x64 (sin aviso).

### §3 "Usar otro enlace" en una canción que aún no tiene audio
Para una canción de YouTube con la fuente `pendiente` (descarga cancelada) o con un error no reintentable, la UX prefiere que "Usar otro enlace" / "Elegir otro archivo" **sustituya la fuente de la misma canción** (conservando título, artista, álbum y la letra si ya se buscó), en lugar de crear una canción nueva y dejar el borrador anterior duplicado. ¿Es viable con el modelo de ADR 0006 (cambiar `fuente` en `cancion.json` y escribir una miniatura nueva, sin audio previo que borrar)? Para un archivo local implicaría materializar la importación en la carpeta existente.

**Provisional** (la de la tarea 0045): abre Añadir canción con los metadatos como valores iniciales y crea una canción nueva; el borrador anterior se queda y el usuario lo elimina a mano.

## Opción provisional tomada (si no bloquea)
La indicada en cada punto.

## Respuesta
Respondida por arquitecto (2026-11-04). Decisiones recogidas en ADR 0009 (Revisiones, 2026-11-04 tras 0014), ADR 0003 y ADR 0006 (Revisiones) y en las tareas 0031, 0034, 0037, 0040, 0042, 0049, 0050, 0051 y 0053 (0045 solo con una nota). Ninguna cambia lo que ya dicen `ux/01`, `ux/03` ni `ux/04`.

### §1 Actualización de yt-dlp interrumpida
Hechos técnicos: `uv pip install -U` pasa casi todo el tiempo resolviendo y descargando a su caché, y eso no toca el venv. Solo en la fase final (enlazar o copiar archivos en `site-packages`, menos de 1 s para yt-dlp y Deno) borra los archivos de la versión anterior y escribe los nuevos, y no lo hace como una transacción. Si se mata ahí, puede quedar un paquete a medias. uv no avisa de en qué fase está, así que **no se aborta a propósito**.

(a) **Cancelar nunca aborta la actualización.** Cancelar la búsqueda (C1) o la descarga (fase `actualizando`) solo cancela esa operación. La actualización sigue en segundo plano y en silencio hasta terminar. Tiene un límite de 5 min: si se pasa, se mata y se trata como cierre a mitad (ver (b)).

(b) **Al cerrar la app no se muestra nada nuevo** (no entra en `cierre.*`). La ventana se cierra en el acto y el proceso principal espera **como máximo 10 s** a que uv termine. Si no ha terminado, mata el árbol de procesos. Para que un venv a medias no llegue a B5:
- Antes de lanzar uv se escribe `runtime/ytdlp-actualizando.json`, y solo se borra si uv sale con código 0.
- Al arrancar, si ese archivo existe, se **repara** enseguida (sin esperar los 60 s ni los 7 días) con la misma orden más `--reinstall-package yt-dlp --reinstall-package yt-dlp-ejs --reinstall-package deno`.
- Mientras tanto, las operaciones de YouTube esperan (textos `add.reintento.ytdlp` y `prog.cola.descarga.mantenimiento`).
- Si la reparación falla (p. ej. sin conexión), se registra, el marcador se conserva para el siguiente arranque y las operaciones de YouTube se intentan igualmente; si fallan, muestran su propio error.
- **Nunca se pasa a B5 por yt-dlp.** B5 es para el motor de separación, y la comprobación barata del arranque (ADR 0009 §6.1) no mira yt-dlp.

Riesgo aceptado: si el usuario vuelve a abrir la app en esos 10 s, la segunda instancia sale sin abrir ventana (el bloqueo de instancia única sigue en manos del proceso que se cierra).

(c) **`info-youtube` espera a que termine la actualización.** Si importara yt-dlp mientras uv lo sustituye, podría cargar módulos de dos versiones. En Windows, además, uv no puede sustituir `deno.exe` si un yt-dlp lo está usando. Por eso la exclusión es **mutua**, mediante un cerrojo de lectores y escritor en `main/runtime/ytdlp.ts`:
- Son lectores `info-youtube` y `descargar-youtube`; el escritor es la actualización, que tiene prioridad.
- Una actualización espera a que terminen los procesos de yt-dlp en marcha. Mientras está pendiente o en curso, no arranca ningún proceso nuevo de yt-dlp.
- Una consulta que espera emite al renderer el estado `actualizando` (texto `add.reintento.ytdlp`). Una descarga que espera sigue `en cola` con `motivo: 'mantenimiento'` (texto `prog.cola.descarga.mantenimiento`).

Este cerrojo sustituye al "trabajo interno sin canción en la cola `ligera`" de ADR 0009 §7 y de la tarea 0050: el gestor de trabajos (0014) ya no necesita trabajos sin `cancionId`. La actualización semanal, la de después de un bloqueo y la reparación pasan todas por `actualizarYtDlp()`, de modo que nunca hay dos a la vez: una llamada concurrente recibe la misma promesa.

**Provisional**: casi vale. Cambian la espera de 10 s al cerrar, el marcador con reparación al arrancar (en lugar de B5) y la espera también en sentido contrario (la actualización espera a los yt-dlp en marcha).

### §2 Plataforma real y emulación
- **Se detecta la arquitectura real**: `plataformaReal = process.platform + (app.runningUnderARM64Translation ? 'arm64' : process.arch)`. La API de Electron es `true` bajo Rosetta (macOS) y bajo la emulación x64 de Windows on ARM. `process.arch` solo dice para qué arquitectura está compilado el ejecutable. El manifiesto, el marcador `runtime/instalado.json`, `pa.nocompat.equipo` y "Copiar detalles" usan la plataforma real. El SO y la arquitectura legibles los da main, no el renderer.
- **Windows arm64 (build x64 emulado) → B6.** En el MVP no hay requisitos `win32-arm64` y el perfil x64 emulado no está probado: PyTorch y ONNX Runtime x64 bajo emulación, rendimiento desconocido. Si más adelante se quiere soportar, se añade `win32-arm64-cpu` al manifiesto y se prueba en un runner `windows-11-arm`, sin tocar la UI.
- **Mac Apple Silicon que abre el build x64 (Rosetta) → se instala el perfil del equipo real, `darwin-arm64-mps`, sin aviso.** El runtime de Python es un proceso aparte y se ejecuta de forma nativa aunque Electron vaya bajo Rosetta. Por eso 0034 pide a uv Python con la arquitectura explícita (`cpython-3.12.16-macos-aarch64-none`, siempre la de la plataforma real), y lo demás no cambia. Así el usuario obtiene Calidad con MPS y, si después instala el build arm64, el marcador coincide y el runtime se reutiliza. Ni B6 ni `darwin-x64-cpu`, que daría peor separación y obligaría a reinstalar al cambiar de build. Solo la interfaz va algo más lenta. No hace falta texto nuevo de UX (si el diseñador quiere una sugerencia "descarga la versión para Apple Silicon", sería opcional y aparte).
- **Linux arm64**: un build x64 no llega a ejecutarse. Si alguien compila la app para arm64, `plataformaReal = linux-arm64` no está en el manifiesto y se muestra B6.
- Regla resultante: **B6 ⇔ la plataforma real no tiene entrada en el manifiesto**. Hoy eso ocurre con Windows arm64, Linux arm64 y cualquier arquitectura de 32 bits.

**Provisional**: no vale para Windows arm64 (B6, no instalar x64) ni para el texto del equipo (debe usar la arquitectura real). Para Mac bajo Rosetta se instala el perfil arm64, no el x64.

### §3 "Usar otro enlace" / "Elegir otro archivo" sobre la misma canción
**Es viable** con el modelo de ADR 0006, sin cambiar el esquema (sigue en versión 1). Se permite **sustituir la fuente** de una canción existente solo si:
- `pasos.fuente` está en `pendiente`, `error` o `interrumpido`;
- no hay ningún trabajo vivo de esa canción (ni en cola ni en curso);
- **no existe `fuente/mezcla.flac`**.

Con la fuente sin completar la separación no ha podido empezar, así que no hay audio ni pistas que borrar. Fuera de estos casos → `ARGUMENTOS_NO_VALIDOS`. Una fuente ya completada no se cambia (`ux/03` criterio 12).

- **YouTube → otro enlace** (0049): `fuente.confirmarYoutube(consultaId, metadatos, { cancionId })`.
  - Se escribe la miniatura nueva en `fuente/miniatura.jpg.tmp` y se hace `rename`. Si el vídeo nuevo no tiene miniatura, se borra la anterior y `fuente.miniatura = null`.
  - Después, una sola escritura atómica de `cancion.json` con la `fuente` nueva (`url`, `youtube_id`, `miniatura`), los metadatos del formulario, `duracion_ms` provisional del vídeo nuevo y `pasos.fuente = pendiente` (`error: null`).
  - Se borran los restos `fuente/descarga.*` y se encola `descargar-youtube`.
  - Se conservan id, carpeta, estilo y `letra.json`, así como título, artista y álbum (son los valores que el usuario ve en el formulario).
- **YouTube → archivo local** (0042): `fuente.confirmarArchivo(importacionId, metadatos, { cancionId })`.
  - Mueve `.importando/<id>/mezcla.flac` a `<cancion>/fuente/mezcla.flac`, que es el mismo volumen, así que es un `rename`.
  - Borra la miniatura y los restos de descarga.
  - Escribe `cancion.json` con `fuente.tipo = "archivo"`, `nombre_original`, `ganancia_db`, `duracion_ms` real y `pasos.fuente = completado`. Si falla a mitad, la canción sigue como estaba: `cancion.json` se escribe al final y el audio no es válido hasta que lo referencia.
- Un archivo local ya importado no puede quedar sin audio (0042), así que "archivo → otro" no existe en el MVP.
- **Letra conservada**: la letra buscada "mientras tanto" se basó en la duración anterior. Si el audio nuevo difiere más de 2 s, la sincronía puede no cuadrar. No se borra ni se avisa en la Fase 2; la Fase 4 (letra y editor) decidirá si avisa. Queda anotado en ADR 0006.

**Provisional**: no vale. Ya no se crea una canción nueva: se sustituye la fuente de la misma canción.
