# 0011 — Reproductor: pantalla completa de la ventana, pantalla encendida, motor con voz guía, capa sobre la vista de origen y pistas que faltan

- Estado: Aceptado
- Fecha: 2026-11-06
- Paso del pipeline: 6 (Reproductor)

## Contexto
La Fase 6 construye el reproductor a pantalla completa (`docs/ux/07-reproductor.md`, revisión 2026-11-06). De la Fase 5 (ADR 0010) ya existen:
- `MotorAudio`: Web Audio, una pista sonando cada vez (conmuta entre original, voz e instrumental), hasta 2 `AudioBuffer` en LRU, reloj con `getOutputTimestamp`;
- el modelo puro de render (`karaoke/render.ts`) y `PantallaLetra`;
- la vista `{ tipo: 'reproductor'; id }`, que hoy muestra un marcador.

Lo que pide la spec y el usuario:
- **Esc sale con una sola pulsación**, también a pantalla completa. F y ⛶ alternan pantalla completa y ventana. Al salir, la ventana vuelve al estado anterior. El icono refleja los cambios hechos con el menú, F11 o el botón verde de macOS. El zoom no funciona en el reproductor.
- La pantalla **no se apaga mientras suena**. En pausa o al salir, vuelve a lo normal.
- El reproductor se abre **encima** de la vista de origen, que se queda montada:
  - la Biblioteca conserva filtro, búsqueda y desplazamiento;
  - el editor conserva historial, selección, pista y velocidad, y al volver queda con el cabezal donde estaba el reproductor.
- **Silencio previo**: si la primera línea entra antes de 6 s, el tiempo empieza en `−(6 s − t1)` sin audio. `●●●` sale siempre antes de la primera línea.
- **Voz guía** (pregunta 0030, decisión del usuario): la voz separada (`pistas/voz.flac`) suena sobre el instrumental con un volumen propio, una tecla la silencia o la reactiva sin perder el nivel, y el nivel se recuerda.
- Si falta el instrumental, la canción pasa a "Dañada" sin reiniciar. Si existe pero no se puede leer, no.
- Los toasts que llegan con el reproductor abierto se retienen hasta salir.

Restricciones: ADR 0008 (IPC mínima, validada con Zod y con el remitente comprobado), ADR 0006 (un único escritor) y ADR 0010 (precisión del reloj).

## Alternativas consideradas

### 1. Pantalla completa
| Opción | Licencia | Pros | Contras |
|--------|----------|------|---------|
| A. API Fullscreen del DOM (`element.requestFullscreen()`) | Chromium (BSD) | Sin IPC nuevo; el permiso `fullscreen` ya se concede (ADR 0008). | En Electron, Esc lo consume la capa de acceso exclusivo de Chromium para salir de la pantalla completa, y la página no recibe un `keydown` fiable (electron#40342, #40365). Además pide activación de usuario reciente (falla tras el `await` del vaciado del editor) y no ve el estado de la ventana: no puede restaurar "maximizada". |
| B. **Pantalla completa de la ventana** (`BrowserWindow.setFullScreen`) pedida por IPC, con los eventos `enter-full-screen`/`leave-full-screen` | Electron (MIT) | Esc llega a la página como cualquier tecla. Sin activación de usuario. El main conoce y restaura el estado previo, ve los cambios del menú, F11 y el botón verde, y los diálogos y toasts siguen visibles. | Canales IPC nuevos. En macOS la transición es asíncrona (~0,7 s) y una petición durante la transición se pierde: hay que guardar el estado deseado y reaplicarlo. |
| C. `setSimpleFullScreen` en macOS y B en el resto | Electron (MIT) | Instantánea en macOS. | Distinta por SO y no coincide con lo que muestra el botón verde. |

### 2. Pantalla encendida
| Opción | Pros | Contras |
|--------|------|---------|
| A. **`powerSaveBlocker.start('prevent-display-sleep')` en el main mientras suena** | Estable en los 3 SO; se libera de forma explícita. | Un canal más. |
| B. Screen Wake Lock API | Estándar web. | Exige conceder `screen-wake-lock` (hoy denegado, ADR 0008) y su soporte en Electron varía por plataforma. |
| C. Nada | Sin código. | Web Audio no impide que la pantalla se apague. |

### 3. Motor de audio del reproductor (voz guía + silencio previo)
| Opción | Pros | Contras |
|--------|------|---------|
| A. **Motor propio del reproductor (`MotorReproductor`)**: dos `AudioBufferSourceNode` (instrumental y voz) arrancados con el **mismo** `when` del `AudioContext`, cada uno con su `GainNode` hacia una ganancia maestra; admite posiciones negativas programando `start()` en el futuro; reutiliza `reloj.ts` y `pistas.ts` | Sincronía exacta a la muestra entre las pistas (mismo reloj, mismo instante). El editor no cambia. Silencio previo con la misma precisión que el resto, y la pausa durante el silencio previo sale gratis. | Una clase nueva (~250 líneas) que repite parte de `MotorAudio`. |
| B. Ampliar `MotorAudio` con "capas" simultáneas | Un solo motor. | Toca el núcleo del editor (LRU, conmutación, fragmentos de escucha), con riesgo para la precisión ya probada (0094, 0111). |
| C. Dos `MotorAudio` en paralelo | Sin código de motor nuevo. | Dos `AudioContext` con relojes distintos: la voz deriva respecto al instrumental, y pausar o buscar en los dos no es atómico. |
| D. Silencio previo con `performance.now()` y `reproducir({ desdeMs: 0 })` al llegar a 0 | Sencillo. | Un salto de unos ms al pasar a 0 y la pausa del tramo hay que llevarla aparte. |

### 4. Dónde vive el reproductor
| Opción | Pros | Contras |
|--------|------|---------|
| A. **Una capa modal a nivel de `App`** (Biblioteca y toast) y **una capa dentro del editor** (Probar), las dos con el mismo componente `Reproductor` | La vista de origen no se desmonta: la Biblioteca conserva su estado y el editor su historial. El editor pasa su instantánea en memoria y recibe los cambios de desplazamiento como una acción de su *reducer*. | El editor debe liberar su audio mientras la capa está abierta, para no tener 4 buffers en memoria. |
| B. Navegar a la vista `reproductor` y volver | Un único anfitrión. | La Biblioteca y el editor se desmontan: se pierde lo que la spec pide conservar. |

### 5. Instrumental que falta
| Opción | Pros | Contras |
|--------|------|---------|
| A. **`biblioteca.comprobarPistas(id)`**: recalcula "Dañada" de una canción y emite `evento:cancion` | Reutiliza `detectarDanada`; la Biblioteca se actualiza sola. | Un canal más. |
| B. Volver a escanear toda la biblioteca | Sin canal. | Lento y desproporcionado. |

## Decisión

### 1. Pantalla completa de la ventana: opción B
- `app/src/main/ventana/modoReproductor.ts`: `ControlModoReproductor`, sobre una ventana y un bloqueador inyectables. Se vincula a la ventana en `crearVentana()`.
  - `entrar()`: recuerda el estado de la ventana (`normal` | `maximizada` | `pantalla_completa`) y la pone a pantalla completa.
  - `salir()`: la devuelve al estado recordado. Si estaba maximizada y Electron no la restaura así, llama a `maximize()`.
  - `fijarPantallaCompleta(activa)`: para F y ⛶.
  - Guarda el **estado deseado** y lo reaplica al recibir `enter-full-screen`/`leave-full-screen` si una petición llegó durante una transición.
  - Emite cada cambio real (también los del menú, F11 o el botón verde) al renderer por `ventana:pantallaCompleta`.
  - Mientras está en modo reproductor, desactiva los elementos de zoom del menú (ids `zoom-mas`, `zoom-mas-oculto`, `zoom-menos`, `zoom-restablecer`) y los vuelve a activar al salir.
- El menú "Ver" gana `{ role: 'togglefullscreen' }` (F11 en Windows/Linux, Ctrl+Cmd+F en macOS).
- Canales `CANALES.ventana`: `modoReproductor(activo)`, `fijarPantallaCompleta(activa)`, `estaEnPantallaCompleta()`, `evitarReposo(activo)` y el evento `ventana:pantallaCompleta`.
- **Pruebas**: con `SHINOBI_PANTALLA_COMPLETA_SIMULADA=1` (solo sin empaquetar) la ventana es un doble que cambia de estado al momento, porque Xvfb sin gestor de ventanas no emite los eventos. Un E2E sin el doble comprueba `isFullScreen()` real en Windows y macOS.
- **Seguridad**: el renderer no usa la API Fullscreen, así que se retira `fullscreen` de los permisos concedidos (ADR 0008, Revisiones).

### 2. Pantalla encendida: opción A
- `evitarReposo(true)` cuando el reproductor **empieza a sonar** (también durante el silencio previo) y `false` en pausa, en la pantalla final, en el error y al salir.
- El main lo libera además al cerrarse la ventana y cuando el renderer recarga o se cae (`render-process-gone`, `did-start-navigation` de la página principal).

### 3. Motor del reproductor: opción A
- `app/src/renderer/src/karaoke/motorReproductor.ts`, `MotorReproductor`:
  - **modo `karaoke`**: instrumental + voz, decodificadas en paralelo. El audio empieza cuando las dos están listas (spec 07 §"Voz guía": < 1 s con 4 min de audio), o cuando la voz falla, y entonces suena solo el instrumental;
  - **modo `original`** (vista previa del editor sin instrumental): solo `fuente/mezcla.flac` y sin voz;
  - **ganancias**: maestra = `10^(ganancia_db/20) × volumen` (0 si `silenciado`); voz = `voz_guia` (0 si `voz_guia_silenciada`). La voz va **antes** de la maestra, así que el volumen general también la afecta. Cambiar el volumen no reinicia las fuentes;
  - **posiciones negativas**: `reproducir({ desdeMs: −n })` ancla en `ctx.currentTime` con `posInicioMs = −n` y programa `start(ctxInicio + n/1000, 0)`. `posicionMs()` devuelve valores negativos durante el silencio previo. Pausar ahí guarda la posición negativa y reanudar vuelve a programar. `buscar(ms ≥ 0)` lo cancela;
  - **final**: `finalizado: true` cuando la fuente principal llega al final del buffer. Lo ponen a `false` `reproducir` y `buscar`;
  - **errores** por pista (`instrumental`/`voz`/`original`): `no_encontrada` (respuesta 404 de `shinobi-media://`), `lectura` (otra respuesta no correcta o fallo de red) y `decodificacion`, con un `detalle` de texto para "Copiar detalles";
  - el reproductor siempre va a 1×.
- **Configuración** (`config.reproductor`, lectura tolerante, sin cambiar la versión del esquema): se añaden `voz_guia: number` en [0, 1] (por defecto 0,3) y `voz_guia_silenciada: boolean` (por defecto `true`, porque el karaoke empieza sin voz). Los nombres y valores son los de la spec 07. Un `config.json` antiguo los toma por defecto, y el renderer puede escribirlos (`configParcialRendererSchema`).
- **Editor**: `MotorAudio` gana `liberarAudio()`, que pausa y descarta los buffers pero conserva la pista, la velocidad y la posición. El editor lo llama al abrir "Probar" y vuelve a decodificar su pista bajo demanda al volver ("Cargando audio…", < 1 s). La memoria máxima con la capa abierta queda en 2 buffers (≈ 170 MB con 4 min de audio).
- **Render**: `render.ts` trata la primera línea como precedida de un hueco infinito, así que siempre muestra `●●●` en sus 3 s previos. Afecta igual a la vista previa del editor. `pantallaLetra.module.css` quita el tope de 140 px (`--k-tamano: max(32px, 7.5cqh)`, sistema-visual §10).

### 4. Capas: opción A
- **Componente** `vistas/reproductor/Reproductor.tsx`: recibe la canción ya resuelta (título, artista, letra, estilo, duración, `ganancia_db`), el modo de audio (`karaoke`/`original`), el origen (`biblioteca`/`editor`), la posición inicial y si aplica el silencio previo, el volumen compartido y *callbacks* (`alSalir(posicionMs)`, `alDesplazar`, `alFallarPista`). Lleva su propio `MotorReproductor`, llama a `ventana.modoReproductor(true/false)` al montarse y al desmontarse, y escucha el teclado en fase de captura con `preventDefault()` (ADR 0010 §1). Es una capa `role="dialog"` `aria-modal="true"` que pone el resto de la app `inert`. Así `hayCapaAbierta()` pausa los atajos globales y las acciones del menú.
- **Capa de la Biblioteca**: un contexto `navegacion/reproductor.tsx` (`useReproductor().abrir(id)`) en `App.tsx` dibuja `ReproductorBiblioteca` encima del `Marco` sin cambiar la vista. Lee la canción con `biblioteca.obtener` y la configuración con `config.obtener`. Al cerrarse, enfoca la tarjeta de la canción. **Se elimina la variante `{ tipo: 'reproductor' }` de `Vista`.**
- **Capa del editor**: "Probar" vacía el guardado (`vaciar()`), libera el audio del editor y monta `Reproductor` con la instantánea en memoria:
  - `,`/`.` despachan una acción de desplazamiento del *reducer* que agrupa toda la prueba en **un** paso de deshacer;
  - al salir, el editor busca la posición devuelta por `alSalir`, selecciona la línea que sonaba, restaura su pista y su velocidad y devuelve el foco al botón.
- **Volumen**: un único hook `karaoke/useVolumenCompartido.ts` (sale de `useVolumenEditor`) escribe `config.reproductor` como mucho cada 500 ms. Lo crea cada anfitrión y lo pasa al reproductor.
- **Toasts retenidos**: `gestorToasts` gana `retenerToasts(activo)`. Mientras está activo, los toasts nuevos se guardan y, al desactivarlo, se muestran los 3 más recientes. Lo activa el reproductor al montarse.

### 5. Pistas que faltan: opción A
- `biblioteca.comprobarPistas(id): Promise<ResumenCancionIpc | null>` en `ServicioBiblioteca`, en serie con las escrituras de la canción. Recalcula `detectarDanada`, actualiza el índice y emite `evento:cancion` si cambia. Devuelve `null` si la canción no existe.
- El reproductor llama a `alFallarPista` con el tipo de error. El anfitrión de la Biblioteca llama a `comprobarPistas` solo con `no_encontrada`. Con `lectura`/`decodificacion` no se marca nada (spec 07, criterio 23).
- **Voz**: si falla solo la voz, el instrumental sigue sonando y el control de voz queda `aria-disabled` (`rep.voz.nodisponible`). Con `no_encontrada` también se llama a `comprobarPistas`, y la canción aparece Dañada al volver.

## Consecuencias
- **Positivas**:
  - Esc sale con una pulsación en los 3 SO;
  - la pantalla no se apaga mientras se canta;
  - voz guía sincronizada a la muestra y recordada;
  - probar desde el editor no pierde nada;
  - el editor no cambia de motor;
  - sin dependencias nuevas.
- **Negativas / riesgos**:
  - en macOS, entrar en pantalla completa tarda ~0,7 s y crea un Escritorio (Space), pero el audio empieza igualmente al momento;
  - cinco canales IPC y un evento nuevos;
  - con voz guía la memoria del reproductor es de 2 buffers (≈ 170 MB con 4 min de audio y ≈ 420 MB con 10 min). Se compensa con que el editor libera su audio;
  - si el proceso principal se cae con el bloqueo de reposo activo, lo libera el sistema al terminar el proceso.
- **Licencias**: ninguna dependencia nueva (Electron, MIT; Chromium, BSD).
- **Impacto en UX**:
  - el control de voz guía (volumen + silenciar) sustituye al interruptor de "voz original" de la opción A de 0030;
  - al volver de "Probar" el editor tarda < 1 s en tener el audio listo.

## Fuentes
- Electron `BrowserWindow`: `setFullScreen`, `isFullScreen` ("On macOS, fullscreen transitions take place asynchronously"), `enter-full-screen`/`leave-full-screen`, `setSimpleFullScreen` (consultado el 2026-11-06): https://www.electronjs.org/docs/latest/api/browser-window
- Electron `powerSaveBlocker` (`prevent-display-sleep`): https://www.electronjs.org/docs/latest/api/power-save-blocker
- Esc y pantalla completa HTML en Electron: https://github.com/electron/electron/issues/40342 , https://github.com/electron/electron/issues/40365
- `Element.requestFullscreen` y activación de usuario (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen
- `AudioBufferSourceNode.start(when, offset)`, programación con el reloj del `AudioContext` (MDN): https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start

## Revisión para 0.2.0 — fase 4

Reproductor en la ventana secundaria y cola. Fecha: 2026-11-11. El detalle está en el [ADR 0017](0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md).

- **§1 Pantalla completa.** De `ControlModoReproductor` sale un `ControlPantallaCompleta` por ventana, que guarda el estado deseado, lo reaplica tras las transiciones asíncronas de macOS y difunde los cambios reales. La principal conserva el envoltorio actual, que restaura el estado previo y desactiva el zoom. La secundaria usa el control base sin restauración, en la pantalla que elige el usuario (ADR 0017 §2). El doble `SHINOBI_PANTALLA_COMPLETA_SIMULADA` pasa a aplicarse por ventana.
- **§2 Pantalla encendida.** Hay un único `GestorReposo` con titulares. El reproductor local mantiene esta regla: retiene solo mientras suena. La sesión en vivo retiene durante toda su vida, también en pausa y entre canciones, y libera al terminar por cualquier causa (ADR 0017 §4). `ventana.evitarReposo` sigue siendo solo de la principal.
- **§3 Motor.** No cambia. La secundaria usa el mismo `MotorReproductor` y es el **único** motor de audio durante una sesión. No se precarga la canción siguiente.
- **§4 Capas.** `Reproductor.tsx` gana `origen: 'sesion'`. En ese modo:
  - ocupa todo el documento de la secundaria, sin `inert`, sin `aria-modal` y sin retener toasts;
  - no usa `CuentaFinal`: el fin natural solo se informa a main, que decide la transición, el fin de cola o el error;
  - pinta la cuenta de transición y la vista previa a partir del restante que envía main;
  - recibe los comandos de transporte de la principal a través de main.

  Mientras haya una sesión no se abren las capas locales: ni «Reproducir» de la Biblioteca ni «Probar a pantalla completa». Main rechaza `ventana.modoReproductor(true)` con `SESION_EN_CURSO`.
- **§5 Pistas que faltan.** El mismo criterio se aplica en la sesión. Con `no_encontrada`, main llama a `comprobarPistas`. Además revalida la canción y el instrumental cada vez que una entrada de la cola pasa a activa.
