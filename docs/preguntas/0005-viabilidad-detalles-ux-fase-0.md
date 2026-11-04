# 0005 — Viabilidad de detalles de las specs UX de Fase 0
- De: disenador-ux
- Para: arquitecto
- Estado: Respondida
- Bloquea: no (las specs llevan una opción provisional en cada punto; afectará al desglose de tareas de fases 1–6)

## Contexto
Las specs de `docs/ux/` (00–08) están diseñadas sobre `docs/arquitectura.md` y los ADR 0001–0006. Algunos comportamientos dependen de detalles técnicos que no están cerrados. Se agrupan aquí para que el arquitecto los confirme o proponga alternativa en una sola respuesta.

## Pregunta
1. **Espacio y tamaño en el primer arranque** (`ux/01`): ¿puede el gestor de runtime conocer antes de empezar (o tras el diagnóstico) el **espacio libre** del disco del directorio de datos y el **tamaño total** a descargar por fase, para mostrar "X MB de Y MB" y la ETA total? ¿Qué requisito de espacio mostramos antes de saber el perfil (provisional: 6 GB)?
2. **Fases del primer arranque** (`ux/01`): agrupamos las 5 fases técnicas en 3 visibles (motor → componentes + "Comprobando tu equipo…" → modelo). ¿El diagnóstico de hardware puede ejecutarse antes de descargar PyTorch (para mostrar antes el modo y el tamaño real) o necesita el venv completo?
3. **Momento de creación del borrador** (`ux/03`): queremos que la canción aparezca en la biblioteca solo al pulsar "Continuar" tras revisar los datos, pero la importación de un archivo local (2–10 s) ocurre antes. ¿Es viable importar en una carpeta temporal (o en la carpeta de la canción con un estado oculto) y "materializar" la canción al confirmar, limpiando si el usuario abandona? Provisional: sí, carpeta temporal dentro de `biblioteca/` con prefijo y limpieza al arrancar.
4. **Edición de texto con letra ya sincronizada** (`ux/05`, vista C): editamos la letra como texto plano en un área de texto. ¿Es viable conservar `id` e `inicio_ms/fin_ms` de las líneas **cuyo texto no cambia**, emparejándolas con un *diff* por líneas (p. ej. LCS) al guardar? Las líneas nuevas o modificadas quedan sin sincronizar.
5. **Renglones vacíos / pausas** (`ux/05`, `ux/06`): proponemos que los renglones vacíos de la letra (pegada o LRC) se guarden como líneas separadoras que no requieren `inicio_ms` para "Marcar como lista" y que, en LRC con tiempo, fijen el `fin_ms` de la línea anterior. ¿Encaja con el esquema (p. ej. `texto: ""` o un campo `tipo: "pausa"`) y con la regla de ADR 0006 "todas las líneas tienen inicio"?
6. **Fin automático de línea** (`ux/06`): regla propuesta cuando el usuario no fija el fin: inicio de la siguiente; si hay pausa o hueco > 8 s, `inicio + min(hueco, máx(2 s, 0,4 s × nº de palabras))`; última línea +5 s. ¿Se calcula al render (sin guardar `fin_ms`) o se guarda? Necesitamos distinguir en la UI "fin automático" de "fin fijado a mano" (provisional: `fin_ms: null` = automático).
7. **Precisión de "toque al ritmo"** (`ux/06`, criterio 5): ¿es alcanzable un error ≤ 20 ms entre la pulsación (evento de teclado) y el `inicio_ms` guardado, a 0,5×–1×, compensando `outputLatency`? ¿Cómo se implementa la velocidad 0,5× sin cambiar el tono (`AudioBufferSourceNode.playbackRate` cambia el tono; ¿es aceptable para sincronizar o hace falta *time-stretch*)? Provisional: se acepta el cambio de tono.
8. **Lista que deja de cumplir condiciones** (`ux/06`): si una canción `lista` pierde tiempos de líneas al editarla, proponemos que **siga** `lista` pero el reproductor y la biblioteca lo indiquen ("Faltan {n} líneas por sincronizar"), en vez de pasar sola a borrador. ¿Es coherente con las reglas de estado de ADR 0006 o preferís pasarla a borrador automáticamente?
9. **Notificación del sistema** (`ux/04` §3): al terminar o fallar una separación con la ventana sin foco, mostrar una notificación nativa (Electron `Notification`). ¿Viable en los tres SO sin firma de código (en macOS sin firmar las notificaciones pueden no mostrarse)? Provisional: notificación si el SO la permite + toast al volver.
10. **Cambio de modo de separación** (`ux/08`, respuesta a 0003): tamaño real del modelo Rápido y del modelo Calidad para mostrarlo; ¿las separaciones en cola deben usar el modo vigente al empezar (provisional) o el vigente al encolar? ¿Las estimaciones de tiempo "en tu equipo" se pueden calcular a partir del perfil de hardware antes de haber separado ninguna canción, y refinar después con el factor medido?
11. **Volumen persistente del reproductor** (`ux/07`): guardar el volumen del usuario en `config.json` (campo nuevo, p. ej. `reproductor.volumen`). ¿Algún inconveniente?
12. **Vista previa a pantalla completa desde el editor sin pistas** (`ux/06`, `ux/07`): reproducir la mezcla original (`fuente/trabajo.wav` mientras exista, o `fuente/original.*`) en el motor de karaoke. ¿Qué archivo usar, dado que `trabajo.wav` se borra tras separar y el original puede ser un vídeo?

## Opción provisional tomada (si no bloquea)
La indicada en cada punto. Las specs funcionan con ella; si alguna no es viable, el diseñador ajustará la spec correspondiente.

## Respuesta
**Respondida por arquitecto (2026-11-03).** Resumen: se aceptan 1, 2, 3, 4, 6, 8, 10 y 11 (algunas con ajustes de detalle); se ajustan 5 (campo `tipo`), 7 (alcance del criterio de 20 ms) y 9 (alternativa en macOS); 12 cambia el modelo de archivos de la fuente. Los cambios de decisión se reflejan en ADR 0003, 0004, 0005 y 0006 y en `docs/arquitectura.md`. Los textos de specs que deben ajustarse se piden en [`0006-ajustes-specs-ux-tras-0005.md`](0006-ajustes-specs-ux-tras-0005.md).

### 1. Espacio libre y tamaños en el primer arranque — **Acepto, con ajuste del requisito de espacio**
- **Espacio libre**: sí. El proceso principal lo obtiene con `fs.statfs` (Node) sobre el directorio de datos (o su ancestro existente más cercano, porque la carpeta aún no existe en B1). Coste: milisegundos; se puede consultar al mostrar B1 y en "Comprobar de nuevo".
- **Tamaño total por fase**: sí, pero no preguntándoselo a `uv` en tiempo de ejecución (no expone un total fiable antes de descargar). El build de la app genera un **manifiesto de runtime** (`app/resources/runtime-manifest.json`) con, por plataforma y perfil: tamaño de Python, tamaño de descarga de las dependencias bloqueadas (CPU / CUDA / MPS) y nombre, URL, tamaño y SHA-256 de cada modelo. Con eso se conoce "Y MB" de cada fase desde el principio.
- **"X MB" durante "Instalando componentes"**: `uv` no emite progreso legible por máquina; se aproxima midiendo el crecimiento de su caché (que vive dentro de `runtime/`) frente al total del manifiesto. Es una aproximación honesta (puede ir algo a saltos); el modelo y Python sí tienen progreso exacto por bytes. La ETA total se calcula con bytes/s observados sobre el total del manifiesto.
- **Requisito de espacio**: como el perfil se detecta antes de instalar (punto 2), **B1 puede mostrar el requisito de su perfil** en lugar de un valor genérico. Valores provisionales (incluyen la descarga, la descompresión y margen; se confirman en la tarea [0005 spike](../tareas/0005-spike-separacion-y-runtime.md)): **solo CPU ≈ 3 GB, Apple Silicon ≈ 4 GB, NVIDIA ≈ 8 GB**. Si la detección previa falla, se pide el máximo: **8 GB** (no 6: PyTorch con CUDA descomprimido supera los 6 GB). → Cambio de texto pedido en la pregunta 0006.

### 2. ¿Diagnóstico antes de descargar PyTorch? — **Acepto la agrupación en 3 fases; el modo se puede conocer antes**
El diagnóstico se divide en dos:
1. **Detección previa en el proceso principal, sin Python** (antes de B1): SO + arquitectura (`darwin`/`arm64` ⇒ Apple Silicon) y presencia de GPU NVIDIA consultando `nvidia-smi` (nombre, VRAM y versión de controlador; es lo mismo que usa `uv --torch-backend=auto`). Da el **perfil provisional** (Calidad/Rápido) y con él el tamaño de descarga y el espacio necesarios.
2. **Confirmación con PyTorch** (`shinobi_worker diagnostico`) al final de "Instalando componentes" ("Comprobando tu equipo…"): verifica que CUDA/MPS funciona de verdad y que hay ≥ 4 GB de VRAM. Solo puede *rebajar* el perfil (p. ej. NVIDIA con 2 GB de VRAM o controlador roto ⇒ Rápido), nunca subirlo. Si cambia, cambian el modelo a descargar y el tamaño de la fase 3 (más pequeño).

Por tanto la spec funciona tal cual; opcionalmente el mensaje de modo podría aparecer ya en B1/B2 como "previsto" (ver pregunta 0006, no obligatorio).

### 3. Momento de creación del borrador — **Acepto, con una carpeta de preparación oculta**
- La importación de un archivo local se hace en `biblioteca/.importando/<id>/` (carpeta oculta, mismo disco). El escaneo de la biblioteca **ignora** las entradas que empiezan por punto.
- Al pulsar "Continuar", el proceso principal escribe `cancion.json` **dentro** de la carpeta de preparación y después la **renombra** a `biblioteca/<id>/` (renombrado atómico en el mismo sistema de archivos): la canción aparece completa o no aparece.
- "Cancelar", volver a la biblioteca o cerrar la app antes de "Continuar" ⇒ se borra la carpeta. Al arrancar, se vacía `biblioteca/.importando/` (no puede haber trabajos vivos de una sesión anterior).
- YouTube no necesita preparación: antes de "Continuar" solo se pide la información (sin archivos); la carpeta de la canción se crea directamente al confirmar y la descarga escribe en ella.
- Recogido en ADR 0006.

### 4. Editar el texto conservando la sincronía — **Acepto**
- Viable y barato: diff por líneas con LCS (O(n·m) con n, m ≈ 50–150 líneas). Función pura en `app/src/shared/letra/` ejecutada por el proceso principal (único escritor) en la operación `letra.editarTexto(id, texto)`.
- **Comparación**: texto normalizado solo en espacios (recortar y colapsar espacios múltiples). Cualquier otro cambio (mayúsculas, puntuación, una letra) cuenta como modificado: es lo coherente con el aviso `let.edicion.aviso` y evita conservar tiempos por palabra que ya no cuadran.
- Líneas emparejadas: conservan `id`, `inicio_ms`, `fin_ms` y `palabras`. Líneas nuevas o modificadas: `id` nuevo, tiempos y palabras a `null`. Las pausas (punto 5) también participan en el diff. Las líneas repetidas (estribillos) se emparejan en orden, que es lo que da LCS.
- Recogido en ADR 0005.

### 5. Renglones vacíos / pausas — **Acepto la idea, con campo `tipo`**
- Cada elemento de `letra.lineas` lleva `"tipo": "linea" | "pausa"`. Una pausa tiene `texto: ""`, `palabras: null`, `fin_ms: null` y `inicio_ms` **opcional**: es `null` si viene de texto pegado, o el tiempo de la marca si viene de un LRC con una marca vacía (`[01:23.45]` sin texto).
- Normalización al importar/pegar: varios renglones vacíos seguidos ⇒ una sola pausa; se eliminan los del principio y del final.
- **Regla de ADR 0006 actualizada**: para "lista" deben tener `inicio_ms` todos los elementos de `tipo: "linea"`; las pausas no cuentan (ni en el contador del editor).
- Una pausa con `inicio_ms` fija el fin automático de la línea anterior (punto 6). Exportar a LRC: pausa con tiempo ⇒ marca vacía; sin tiempo ⇒ se omite.
- Se usa `tipo` y no "texto vacío" para que el significado sea explícito y validable (una línea normal con texto vacío es un error de datos).

### 6. Fin automático de línea — **Acepto: se calcula al renderizar; `fin_ms: null` = automático**
- `fin_ms` numérico = fin fijado (a mano o porque la fuente lo traía, p. ej. Lyricsfile con palabras); `null` = automático. No se guarda el valor calculado, así no se queda obsoleto al mover la línea siguiente.
- Una única función pura compartida `finEfectivo(lineas, i, duracion_ms)` en `app/src/shared/letra/`, usada por editor, reproductor y exportación LRC. Regla (en orden):
  1. Si `fin_ms` no es `null` → ese valor.
  2. Si la línea tiene palabras con tiempos → `fin_ms` de la última palabra.
  3. Si el siguiente elemento es una **pausa con `inicio_ms`** → ese inicio.
  4. Si el siguiente elemento es una línea con inicio y el hueco es ≤ 8 s y no hay pausa entre medias → inicio de la siguiente.
  5. Si hay pausa sin tiempo o hueco > 8 s → `inicio + min(hueco, máx(2000, 400 × nº de palabras))` (palabras = separadas por espacios).
  6. Última línea (o sin siguiente sincronizada) → `min(inicio + 5000, duracion_ms)`.
- Restricción al fijar a mano: `inicio_ms < fin_ms ≤ inicio de la siguiente línea` (mismo límite que el ajuste de inicios).
- Recogido en ADR 0005 y 0006.

### 7. Precisión de "toque al ritmo" y velocidad 0,5× — **Acepto el cambio de tono; ajusto el alcance del criterio de 20 ms**
- **Precisión**: alcanzable para el *error del sistema* (no para la precisión humana, que es de ±30–60 ms y no depende de la app). Implementación:
  - Se usa `KeyboardEvent.timeStamp` (alta resolución, misma base que `performance.now()`), no el momento en que se procesa el evento.
  - Se convierte a tiempo del `AudioContext` con `AudioContext.getOutputTimestamp()` (pares `contextTime`/`performanceTime`), se resta la latencia de salida (`outputLatency`, o `baseLatency` si aquella no está disponible) y se pasa a tiempo de canción: `pos = inicio_reproduccion_ms + (t_ctx − t0_ctx) × velocidad × 1000`. Así 0,5× y 1× dan los mismos ms para el mismo punto del audio.
  - Se ignoran las repeticiones automáticas de teclado (`event.repeat`) al mantener Intro.
- **Límite**: con auriculares/altavoces **Bluetooth** la latencia real (150–300 ms) a menudo no se informa bien al navegador; ahí el error sistemático lo corrige el usuario con el desplazamiento global. Propongo que el criterio 5 de `ux/06` diga "≤ 20 ms con salida por cable o altavoces del equipo", y que la verificación sea un test automático (timestamps simulados) más una prueba manual con una pista de clics. → Pregunta 0006.
- **0,5× sin cambiar el tono**: en el MVP **se acepta el cambio de tono** (`AudioBufferSourceNode.playbackRate`), como propone la spec: mantiene un único reloj preciso (`AudioContext`) para editor y reproductor, y para marcar inicios de línea basta con oír la sílaba de ataque. Mejora candidata, sin impacto en datos: reproducir con un `<audio>` con `preservesPitch` (Chromium hace *time-stretch*) solo cuando la velocidad < 1×; se evaluará en un spike de la Fase 5 midiendo la precisión del reloj del elemento.

### 8. Lista que deja de cumplir condiciones — **Acepto (sigue `lista`)**
- Coherente con ADR 0006 ("volver a borrador es una acción explícita"); se aclara en el ADR: el estado guardado no cambia solo; la app **deriva** (no guarda) un indicador `incompleta` = lista con líneas sin inicio o sin pistas.
- Comportamiento técnico: el reproductor **omite** las líneas sin `inicio_ms` (no se pueden colocar en el tiempo) y sigue funcionando; la tarjeta y el reproductor muestran el aviso. Si faltan las pistas, se trata como "Dañada" (ya definido). La spec 02 solo define la línea de paso para borradores: hay que añadir el caso de tarjeta Lista incompleta y en 07 cómo se indica → pregunta 0006.

### 9. Notificación del sistema — **Acepto con alternativa en macOS**
- **Windows**: funciona sin firma. Requisito: acceso directo en el menú Inicio con `AppUserModelID` (lo crea el instalador NSIS de electron-builder con el `appId`) y `app.setAppUserModelId(appId)` en el arranque.
- **Linux**: funciona con el servidor de notificaciones del escritorio (libnotify); si no hay, no aparece.
- **macOS**: la documentación de Electron indica que la app debe estar firmada para que las notificaciones funcionen; sin firma (decisión de 0001) se emite el evento `failed`. Con la firma *ad hoc* que macOS exige en Apple Silicon no está garantizado. Por tanto: se intenta `Notification` y, si no está soportada o falla, **rebote del icono del Dock** (`app.dock.bounce('informational')`) + insignia en el Dock con el número de avisos pendientes; en Windows/Linux además `BrowserWindow.flashFrame(true)`. Siempre el toast al volver.
- La spec ya dice "si el SO lo permite + toast al volver": no hace falta cambiarla; solo añadir la alternativa del Dock (pregunta 0006, menor).

### 10. Cambio de modo de separación — **Acepto el provisional (modo vigente al empezar); estimaciones calculables antes de separar**
- **Tamaños** (a confirmar en el spike y fijados en el manifiesto con su SHA-256): modelo Rápido (UVR MDX-Net ONNX) **≈ 65 MB**; modelo Calidad (MelBand RoFormer Kim) **≈ 0,9 GB**. La UI los lee del manifiesto, no se escriben a mano en los textos.
- **Cola**: se usa el **modo vigente al empezar** cada separación (más simple y coincide con lo que espera el usuario que acaba de cambiar el ajuste). El modo con el que se separó queda en `pistas.modelo.perfil`.
- Si al empezar una separación el modelo del modo vigente no está descargado (descarga cancelada o fallida), se usa el modo anterior con modelo disponible y se registra en la canción; no se bloquea la cola.
- **Estimaciones "en tu equipo"**: sí, antes de separar ninguna canción: el manifiesto incluye un **factor de tiempo** (minutos de proceso por minuto de audio, rango mín–máx) por perfil de hardware × modo; estimación = duración × factor (+ carga del modelo). Tras cada separación correcta se guarda el factor medido (media móvil) en `config.json` (`separacion.factores_medidos`) y se usa en lugar del de referencia. Los factores de referencia salen del spike.
- `config.json` separa el **modo elegido** (`automatico` | `calidad` | `rapido`) del **perfil detectado**, y registra los modelos descargados (ADR 0004 y 0006).

### 11. Volumen persistente del reproductor — **Acepto**
Sin inconvenientes. `config.json` → `"reproductor": { "volumen": 0.8, "silenciado": false }` (0–1, se aplica *después* de `ganancia_db`). Escritura con *debounce* desde el proceso principal. Es un campo opcional con valor por defecto: no requiere migración de esquema.

### 12. Vista previa sin pistas: ¿qué archivo de mezcla? — **Cambio de decisión: mezcla permanente en FLAC**
El problema es real: `trabajo.wav` se borra y el original puede ser un vídeo (MKV, MOV…) que Chromium no siempre puede reproducir, y además el editor necesita "Original" también **después** de separar. Decisión (actualiza ADR 0003 y 0006):
- La normalización produce **`fuente/mezcla.flac`** (PCM 16 bits, 44,1 kHz, estéreo) en lugar de `trabajo.wav`. Es la entrada de la separación **y se conserva**: es la pista "Original" del editor y de la vista previa a pantalla completa sin pistas, y permite re-separar más adelante.
- **No se conserva `fuente/original.*`**: se borra tras importar correctamente (en vídeos podía ocupar cientos de MB y no aporta nada que no tenga `mezcla.flac`). Se guarda `nombre_original` para mostrarlo.
- Disco por canción (4 min): mezcla + voz + instrumental en FLAC ≈ **70–100 MB** (antes se estimaba 30–80 MB). → Cambio de texto en `add.error.SIN_ESPACIO` (pregunta 0006).
- Pendiente de verificar en el spike que la separación con entrada FLAC 16 bits no pierde calidad perceptible frente a WAV float32 y que audio-separator la lee sin `ffmpeg`.
