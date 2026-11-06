# 0010 — Editor: motor de audio con Web Audio, reloj de pulsaciones, guardado de sincronía y estilo, y render compartido

- Estado: Aceptado
- Fecha: 2026-11-05
- Paso del pipeline: 4 (Editor) y 5 (Guardado)

## Contexto
La Fase 5 construye el editor (`docs/ux/06-editor.md`): sincronía por línea "al ritmo" (Intro marca el inicio; mantenerla ≥ 300 ms marca el fin), ajuste fino de ±10/±100 ms, desplazamiento global, deshacer/rehacer, velocidad 0,5×/0,75×/1×, escucha de Original/Voz/Instrumental, estilo con vista previa y aviso de contraste, autoguardado y "Marcar como lista".

Restricciones heredadas:
- Arquitectura §7: un motor de reproducción y render compartido por el editor y el reproductor (Fase 6), con Web Audio y DOM/CSS.
- ADR 0005: error del sistema ≤ 20 ms en la marca con salida por cable o altavoces, a cualquier velocidad. Por debajo de 1× el tono baja en el MVP; la conservación del tono era "a evaluar en la Fase 5".
- ADR 0006: un único escritor de `cancion.json` (el servicio de biblioteca, en el main) y un único escritor de `letra` (`ServicioLetras`, tarea 0083). Autoguardado con *debounce* de ~1 s.
- ADR 0008: el renderer no toca el disco. El audio llega por `shinobi-media://`, con CORS exacto, y la CSP ya admite `connect-src shinobi-media:`.

Hay que decidir:
1. cómo se reproduce el audio y se mide el instante de cada pulsación;
2. quién escribe los tiempos y el estilo, y con qué contrato;
3. dónde viven la lógica de edición y el historial de deshacer;
4. cómo se dibuja la letra para que el reproductor la reutilice.

## Alternativas consideradas

### 1. Motor de audio
| Opción | Licencia | Pros | Contras |
|--------|----------|------|---------|
| A. **Web Audio: el FLAC entero decodificado en un `AudioBuffer` (`fetch` + `decodeAudioData`) y reproducido con `AudioBufferSourceNode` + `GainNode`** | Chromium (BSD) | Reloj de muestra exacto: el tiempo de canción se calcula a partir de la hora de arranque de la fuente y del reloj de salida (`getOutputTimestamp`). Cambiar de pista conserva la posición. Chromium decodifica FLAC. Ya era la decisión de la arquitectura §7. | ≈ 85 MB de memoria por pista de 4 min (float32 estéreo). `playbackRate` baja el tono. |
| B. `<audio>` + `preservesPitch` (con `MediaElementAudioSourceNode`) | Chromium | Conserva el tono a 0,5× y 0,75×. Poca memoria. | `currentTime` del elemento se actualiza a saltos y su relación con la salida no está documentada. Medir ≤ 20 ms exige heurísticas, y cada cambio de pista o *seek* añade latencia variable. |
| C. *Time-stretch* propio (SoundTouch en WASM, LGPL-2.1, o Rubber Band, GPL) sobre Web Audio | LGPL / GPL | Tono conservado con reloj exacto. | Dependencia nueva y binario WASM que mantener, CPU en tiempo real y más superficie de pruebas. Desproporcionado para el MVP. |

### 2. Escritura de los tiempos y del estilo
| Opción | Pros | Contras |
|--------|------|---------|
| A. **Ampliar `ServicioLetras` con `guardarTiempos`, que solo cambia tiempos y desplazamiento, y añadir al servicio de biblioteca `guardarEstilo` y el canal de `marcarLista`** | Se mantiene un único escritor de `letra`. El contrato no permite cambiar textos, ids ni el orden. Reutiliza la cola atómica con *debounce* de 0007. | Tres canales IPC nuevos. |
| B. Un `ServicioEditor` nuevo que escriba `letra` y `estilo` | Agrupa el editor en un sitio. | Dos escritores de `letra`, lo que contradice el ADR 0006 y la tarea 0083. |
| C. Canal genérico `biblioteca.actualizar(id, cancionParcial)` desde el renderer | Un solo canal. | El renderer podría escribir cualquier campo: validación débil y superficie IPC amplia (ADR 0008). |
| D. Reutilizar `letras.guardar` (sustituye la letra entera) | Sin canales nuevos. | Normaliza y genera ids nuevos, así que pierde la identidad de las líneas. Además permite cambiar el texto desde el editor. |

### 3. Lógica de edición y deshacer
| Opción | Pros | Contras |
|--------|------|---------|
| A. **Funciones puras de tiempos en `shared/letras/tiempos.ts` y un *reducer* del editor con historial de instantáneas en el renderer** | Se prueba sin DOM ni audio. El historial es de la sesión (`ux/06`) y no se persiste. Guardar es enviar la última instantánea. | El renderer mantiene una copia local de la letra mientras el editor está abierto. |
| B. Historial en el main (operaciones por IPC) | Una sola fuente de verdad. | Cada pulsación hace un viaje de ida y vuelta, el deshacer tiene latencia, y el historial queda en un proceso que no lo necesita. |

### 4. Render de la letra
| Opción | Pros | Contras |
|--------|------|---------|
| A. **DOM + CSS con unidades de contenedor (`cqh`/`cqw`), barrido con `background-clip: text` y `requestAnimationFrame` que solo escribe variables CSS** | Un único componente para la vista previa (16:9 dentro del editor) y el reproductor (pantalla completa), con los valores de `sistema-visual.md` §10 en unidades relativas al alto. Texto accesible y fuentes del sistema de `@font-face`. | Partir en 2 renglones equilibrados exige medir (`text-wrap: balance` y comprobar la altura). |
| B. Canvas 2D | Control total del dibujo. | Hay que reimplementar el ajuste de texto, la sombra, las fuentes y la accesibilidad. |

## Decisión

### 1. Motor de audio: opción A
- Hay un `MotorAudio` por vista (`renderer/src/karaoke/motorAudio.ts`) sobre un `AudioContext` inyectable para los tests.
  - Cada pista (`original` = `fuente/mezcla.flac`, `voz`, `instrumental`) se descarga con `fetch('shinobi-media://<id>/<ruta>')` y se decodifica con `decodeAudioData` **la primera vez que se usa**.
  - Se conservan como máximo **2** `AudioBuffer` decodificados (LRU) para acotar la memoria (≈ 170 MB con canciones de 4 min).
  - Ganancia = `10^(ganancia_db/20) × volumen`. El volumen es `config.reproductor.volumen`/`silenciado`, el mismo del reproductor (`preguntas/0025` §8).
- **Velocidad** con `playbackRate`: el tono baja por debajo de 1×. **Se mantiene lo decidido en el ADR 0005 y no se hace el spike de `preservesPitch`** (`preguntas/0025` §5; el tooltip es la variante "si baja el tono"): la opción B no garantiza la precisión exigida y la C no compensa en el MVP. Conservar el tono queda como mejora futura (opción C), sin impacto en los datos.
- **Reloj** (funciones puras en `renderer/src/karaoke/reloj.ts`):
  - **Anclaje**: al arrancar o reanclar, `{ ctxInicio, posInicioMs, velocidad }`, donde `ctxInicio` es el `currentTime` con el que se llama a `start()`. Al cambiar de velocidad, buscar o cambiar de pista, se reancla.
  - **Contexto oído en un instante del reloj de `performance`** (`tEv` en ms, que es la escala de `KeyboardEvent.timeStamp` y de `performance.now()`):
    - con `getOutputTimestamp()` válido (`performanceTime > 0`): `ctxOido = contextTime + (tEv − performanceTime) / 1000`. Esta marca ya incluye la latencia de salida y **no se resta otra vez**;
    - si no: `ctxOido = currentTime − (performance.now() − tEv) / 1000 − (outputLatency + baseLatency)`.
  - **Tiempo de canción**: `msCancion = posInicioMs + (ctxOido − ctxInicio) × 1000 × velocidad`. Así una marca a 0,5× da los mismos ms que a 1× para el mismo punto del audio.
  - **Tiempo de letra** = `msCancion − letra.offset_ms`. La letra se dibuja con el tiempo de letra, y toda marca o "fijar aquí" guarda `inicio_ms = round(msCancion − offset_ms)`, con mínimo 0. Así, un desplazamiento de +250 ms hace que la letra aparezca 250 ms más tarde.
- **Pulsaciones**:
  - se ignoran las que tienen `KeyboardEvent.repeat`;
  - el fin se mide con el `timeStamp` del `keyup`, si `keyup − keydown ≥ 300 ms` en reloj real;
  - el editor captura el teclado en fase de captura (`window.addEventListener('keydown', …, true)`) y llama a `preventDefault()` en las teclas que trata, para que el atajo global de Esc no navegue.
- **Pruebas**:
  - la precisión se comprueba con marcas simuladas (≤ 20 ms a 0,5×, 0,75× y 1×, con `getOutputTimestamp` y sin él) y con una prueba manual con una pista de clics generada (tarea 0111);
  - los E2E usan el audio real de Chromium. Sin dispositivo de salida, Chromium pasa a una salida falsa y el reloj avanza;
  - con `SHINOBI_SILENCIAR_AUDIO=1`, y solo sin empaquetar, el main silencia la ventana con `webContents.setAudioMuted(true)`.

### 2. Escritura: opción A
- **Referencia de la visita** (revisión de [0027](../preguntas/0027-restaurar-tiempos-despues-del-autoguardado.md)):
  - `letras.abrirEdicion(cancionId)` devuelve `{ cancion, sesionId }` desde la misma lectura del índice. Devuelve `null` si la canción no se puede obtener. `ServicioLetras` crea un UUID opaco y guarda en memoria la referencia de letra de esa instantánea. Hay como máximo una visita activa en la ventana única. Al abrir otra se descarta la anterior.
  - `letras.cerrarEdicion(sesionId)` libera la referencia si corresponde a la visita activa. Es idempotente. Al salir del editor, se resuelve primero el vaciado pendiente o se confirma el descarte y después se cierra la visita. Al cerrar la ventana se libera la referencia que quede.
  - Una sustitución de letra o una edición efectiva de su texto invalida la referencia de esa canción al aplicar el cambio al índice. La validación previa al cambio y la edición sin cambios conservan la visita. Los cambios de estilo y separación tampoco la invalidan.
- **`letras.guardarTiempos({ cancionId, offset_ms, tiempos }, sesionId)`**, en `ServicioLetras`, que sigue siendo el único escritor de `letra`:
  - `tiempos` trae un elemento por cada elemento de la letra guardada, en el mismo orden y con el mismo `id`: `{ id, inicio_ms, fin_ms, palabras }`;
  - el main copia de lo guardado `tipo`, `texto`, `origen`, `lrclib_id` y el texto de las palabras; solo cambian tiempos y `offset_ms`;
  - las palabras pueden quedar en `null`. Una lista de palabras debe corresponder en cantidad, texto y orden a la de la línea en la referencia. Cada inicio y fin se desplaza por el mismo delta que el inicio de la línea respecto a esa referencia. Esto permite restaurarlas aunque la escritura anterior las haya quitado;
  - una pausa admite `inicio_ms` y `fin_ms` de la referencia o `null`, y siempre `palabras: null`;
  - se valida con `letraSchema` y se escribe sin *debounce* (el *debounce* está en el renderer);
  - si la visita ya no corresponde a la canción, la letra falta o sus elementos ya no coinciden en identidad y orden, el main responde **`LETRA_DESACTUALIZADA`**. El editor descarta los tiempos pendientes, abre una visita con la canción actual y vacía el historial. El estilo pendiente se sigue guardando;
  - el cálculo es síncrono hasta llamar a `actualizar`, igual que `editarTexto` (0083). Así dos llamadas seguidas, o una seguida de `marcarLista`, se aplican en orden.
  - una escritura ya encolada conserva su turno si se cierra la visita o cambia el texto. Los envíos posteriores de la visita invalidada se rechazan antes de encolar.
- Zod valida el identificador de canción, el UUID de visita y los tiempos en el proceso principal (ADR 0008). El UUID es un segundo argumento IPC. `GuardarTiempos` y `aPeticionTiempos` conservan su forma de instantánea.
- **`biblioteca.guardarEstilo(id, estilo)`**: `ServicioBiblioteca.actualizar(id, { estilo })`, sin *debounce*.
- **`biblioteca.marcarLista(id)`**: expone el `ServicioBiblioteca.marcarLista` que ya existe (0010), con `ARGUMENTOS_NO_VALIDOS` si falta algo.
- "Usar este estilo en canciones nuevas" usa `config.actualizar({ estilo_predeterminado })`, que ya existe.
- **Validación del degradado** (deuda de 0006): `estiloSchema` exige `posicion` no decreciente entre paradas.
- **Guardado y *debounce*.** Este bloque sustituye al *debounce* de 1 s en el main que se planteó primero.
- **Debounce en el renderer, escritura inmediata en el main** (respuesta a `preguntas/0025` §4):
  - el renderer agrupa los cambios y envía la última instantánea tras 1 s sin cambios, o como mucho a los 2 s del primero;
  - `guardarTiempos` y `guardarEstilo` escriben sin *debounce* (`debounceMs: 0`), así que la promesa se resuelve cuando el archivo está escrito;
  - "vaciar el guardado" (antes de salir del editor, de marcar como lista o de cerrar la ventana) es enviar lo pendiente ya y esperar la respuesta. Si falla, el editor muestra `edi.dialogo.salir`;
  - indicador: "Guardando…" mientras hay cambios sin enviar o en vuelo. Tras un fallo se reintenta cada 5 s.
- **Cerrar la ventana con cambios sin guardar**: el renderer avisa al main con `app.guardadoPendiente(true/false)` (canal nuevo).
  - Con cambios pendientes, el control de cierre (`main/cierre.ts`, 0036/0073) trata la ventana como "algo en curso" y envía `app:solicitudCierre`.
  - El renderer vacía el guardado, con un tope de 2 s, y responde con `app.confirmarCierre()`. Si además hay trabajos, el diálogo de cierre de 0073 se muestra antes.
- **Desplazamiento global**: `offset_ms` en [−30000, +30000], validado en `guardarTiemposSchema`. `letraSchema` no se cambia, para no invalidar datos ya guardados (lectura tolerante).

### 3. Edición y deshacer: opción A
- **Operaciones puras de tiempos** en `app/src/shared/letras/tiempos.ts`, sobre `moverInicioLinea`, `borrarTiemposLinea` y `finEfectivo` (0006):
  - límites entre vecinos;
  - ajustes con tope;
  - `marcarInicioLinea` (marca al ritmo), que borra los tiempos de los elementos posteriores con inicio ≤ marca (`preguntas/0025` §2);
  - fin al soltar, con tope en el siguiente inicio;
  - fijar aquí;
  - fin automático;
  - desplazamiento global;
  - payload de `guardarTiempos`.
- **El *reducer* del editor** (`renderer/src/vistas/editor/estado.ts`):
  - guarda instantáneas `{ letra, estilo }` en un historial de hasta 200 entradas;
  - agrupa los cambios seguidos del mismo campo de estilo en menos de 1 s;
  - "marca + fin al soltar" es una sola entrada;
  - Retroceso del modo "al ritmo" deshace la última entrada si es una marca de la sesión de sincronía actual.

### 4. Render: opción A
- Hay un **modelo puro** (`renderer/src/karaoke/render.ts`): línea actual y siguiente, progreso del barrido por línea o por palabra, pantalla de título, indicador de entrada `●●●` y la línea en pausa con la mitad resaltada.
- Hay un **componente** `PantallaLetra` (`renderer/src/karaoke/PantallaLetra.tsx`):
  - `container-type: size` y tamaños en `cqh` según `sistema-visual.md` §10;
  - barrido con capas y `background-clip: text`, o `clip-path`;
  - `requestAnimationFrame` que lee el tiempo de una función y escribe variables CSS, sin renderizar React en cada fotograma.
  Lo reutiliza el reproductor de la Fase 6.
- **Contraste**: funciones puras en `renderer/src/karaoke/contraste.ts`:
  - luminancia y contraste WCAG;
  - 11 muestras del degradado interpoladas en sRGB;
  - ΔE CIE76 en CIELAB;
  - letra blanca o negra recomendada;
  - resaltado sugerido.

### Fuera de esta fase
"Probar a pantalla completa" (criterio 42 de `ux/06`) y la acción [▶ Reproducir] del toast `bib.toast.lista` abren el reproductor, que es de la Fase 6. Se implementan allí, sobre `PantallaLetra` y `MotorAudio` (`preguntas/0025` §1). En la Fase 5 el botón y la tecla F no se muestran, y el toast sale sin acción.

## Consecuencias
- **Positivas**:
  - precisión de marca verificable con tests deterministas;
  - un solo escritor por campo;
  - el contrato de tiempos no permite cambiar el texto desde el editor;
  - el motor y el render sirven tal cual para el reproductor;
  - sin dependencias nuevas.
- **Negativas / riesgos**:
  - memoria: hasta ~170 MB de audio decodificado con canciones de 4 min, y ~420 MB con canciones de 10 min (2 buffers);
  - a 0,5× y 0,75× el tono baja (aceptado en el ADR 0005);
  - la precisión con Bluetooth no se garantiza y se corrige con el desplazamiento global (`edi.ayuda.bluetooth`);
  - si la app se cierra de golpe (fallo o corte de luz), se pierden como mucho ~2 s de cambios (*debounce* del renderer). Un cierre normal vacía antes el guardado;
  - `LETRA_DESACTUALIZADA` es un código más en el catálogo.
- **Licencias**: no se añade ninguna dependencia. Web Audio, `fetch` y CSS son de Chromium/Electron (MIT/BSD).
- **Impacto en UX**:
  - "Cargando audio…" la primera vez que se escucha cada pista (< 1 s en canciones de 4 min);
  - cambiar a una pista ya usada es inmediato si sigue en memoria y, si no, se vuelve a decodificar;
  - el botón "Probar a pantalla completa" llega en la Fase 6.

## Revisiones

- 2026-11-05 ([0027](../preguntas/0027-restaurar-tiempos-despues-del-autoguardado.md)). Se conserva en el main la referencia temporal de la visita para restaurar palabras y pausas después del autoguardado. El historial sigue en el renderer y el esquema de disco conserva la versión 1. La 0091 incorpora `abrirEdicion`, `cerrarEdicion` y el UUID obligatorio en `guardarTiempos`, con los ajustes de IPC, preload y doble de pruebas de 0090. La 0104 liga el envío de tiempos a la visita y la 0105 abre y cierra esa visita. En 0110 se comprueba la restauración después de que el borrado se haya guardado en disco.

## Fuentes
- `AudioContext.getOutputTimestamp()` (MDN, consultado el 2026-11-05): https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp
- `AudioContext.outputLatency` y `BaseAudioContext.decodeAudioData`: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency , https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData
- `AudioBufferSourceNode.playbackRate`: https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/playbackRate
- `HTMLMediaElement.preservesPitch`: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch
- `KeyboardEvent.timeStamp`/`repeat`: https://developer.mozilla.org/en-US/docs/Web/API/Event/timeStamp , https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat
- Unidades de contenedor CSS (`cqh`): https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_size_and_style_queries#container_query_length_units
- `text-wrap: balance`: https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap
- Electron `webContents.setAudioMuted`: https://www.electronjs.org/docs/latest/api/web-contents#contentssetaudiomutedmuted
- Salida de audio falsa de Chromium cuando no hay dispositivo: https://codereview.chromium.org/2632733002
- SoundTouch (LGPL-2.1): https://www.surina.net/soundtouch/ ; Rubber Band (GPL): https://breakfastquay.com/rubberband/
