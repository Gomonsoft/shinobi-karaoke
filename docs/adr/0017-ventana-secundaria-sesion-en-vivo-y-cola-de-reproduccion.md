# 0017 — Ventana secundaria de rol fijo, sesión en vivo con main como dueño y cola de reproducción

- Estado: Aceptado
- Fecha: 2026-11-11
- Paso del pipeline: 6 (reproductor) y, por el bloqueo, 4 (editor)
- Versión: 0.2.0-alfa, fase 4 (features 10 · Ventana secundaria y 11 · Cola)
- Alineado con las specs UX de la fase 4 ([02](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola), [06](../ux/06-editor.md#fase-4-de-020--ventana-secundaria-y-cola), [07](../ux/07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola), [08](../ux/08-ajustes-y-acerca.md#fase-4-de-020--ventana-secundaria-y-cola), [mapa](../ux/00-mapa-de-vistas.md) y [sistema visual](../ux/sistema-visual.md)) y con las preguntas respondidas [0058](../preguntas/0058-interfaz-de-la-sesion-en-vivo-y-la-cola.md) (UX), [0059](../preguntas/0059-conductas-de-la-sesion-en-vivo-ante-incidencias.md) (usuario: 1B, 2A, 3B y 4A), [0060](../preguntas/0060-letra-y-controles-de-sonido-durante-la-sesion.md) (usuario: 1A y 2A) y [0061](../preguntas/0061-reproductor-en-otra-pantalla-con-wayland.md) (UX: Wayland).
- Revisión 1: 2026-11-11, conciliación con las specs y las respuestas. Cambian:
  - §3: la ventana pasa a una ventana sin cortar el audio y no hay incidencias de pantalla si se desconoce la pantalla;
  - §5: motivos de fallo y abrir con una canción descarta la última reproducida;
  - §6: deshacer al quitar;
  - §7: revalidación por índice al empezar la cuenta y completa al consumir; con la cola agotada, añadir arranca la cuenta (0059-3B); «Descartar»;
  - §8: reanudar al principio si se cerró antes de la primera línea;
  - §9: la sesión solo se inicia desde la Biblioteca y no hay editor en solo lectura; la vista Letra queda bloqueada (0060-1A);
  - §12: `transicion_s` es un entero de 1 a 30.

## Contexto

La fase 4 del [plan](../versiones/0.2.0/plan-2.md#fase-4--reproducción-en-eventos) pide mostrar la letra en otra pantalla y operar el evento desde la ventana principal. Las decisiones de producto ya están tomadas:

- **Evento** ([0048](../preguntas/0048-escucha-editor-durante-evento.md)): un único transporte audible. Mientras la sesión en la ventana emergente está activa, el editor queda bloqueado, también en pausa y entre canciones, con el aviso «No se puede editar mientras el reproductor está abierto en otra ventana». Si había un editor abierto, se resuelve su autoguardado antes de iniciar. Biblioteca y cola siguen operables. El selector de dispositivo de audio queda para el futuro (prioridad baja).
- **Cola** ([0049](../preguntas/0049-politica-cola-de-reproduccion.md)): vive en memoria mientras la app está abierta. Al terminar una canción de forma natural se muestra un contador central animado (4 s por defecto, configurable) con la vista previa de la siguiente abajo a la derecha. La cuenta solo se reinicia si cambia la candidata. Un fallo se explica y se pasa a la siguiente solo por acción explícita. Al cerrar con cola: «Cerrar y eliminar cola», «Cerrar y conservar cola» o cancelar. Conservar guarda la selección del último elemento reproducido y su segundo. Al reabrir se reanuda en ese segundo y se puede reiniciar. Si terminó antes del cierre, queda como contexto y se ofrece iniciar la siguiente.

Lo que existe hoy (código de 0.1.0 y fases 1–3):

- Una sola `BrowserWindow` creada en [main/index.ts](../../app/src/main/index.ts) (`crearVentana`). Varios puntos asumen que es la única: `BrowserWindow.getAllWindows()[0]` en el cierre, `second-instance`, `activate` y los avisos, y `difundir` envía todos los eventos a todas las ventanas.
- `ControlModoReproductor` ([main/ventana/modoReproductor.ts](../../app/src/main/ventana/modoReproductor.ts)), vinculado a esa ventana: pantalla completa con estado previo, zoom del menú y `powerSaveBlocker` ([ADR 0011](0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md) §1–§2).
- `remitenteIpcValido` ([main/seguridad.ts](../../app/src/main/seguridad.ts)) comprueba ventana de la app, *frame* principal y origen, sin distinguir ventanas ([ADR 0008](0008-seguridad-de-electron-y-protocolos-propios.md) §7).
- El reproductor (`vistas/reproductor/Reproductor.tsx`) es una capa modal con su propio `MotorReproductor` (instrumental + voz guía), una `CuentaFinal` de 10 s que termina saliendo y anfitriones en Biblioteca y editor.
- El editor usa `MotorAudio`, autoguardado con *debounce* en el renderer y `app.guardadoPendiente` ([ADR 0010](0010-editor-motor-de-audio-reloj-y-guardado.md) §2).
- La cola de trabajos (`GestorTrabajos`) sirve al pipeline y no tiene orden manual ni controles de sesión.

Restricciones: sin dependencias nuevas, IPC mínima validada con Zod y remitente comprobado (ADR 0008), un solo escritor de datos (ADR 0006), precisión del reloj de audio (ADR 0010) y funcionamiento en Windows, macOS y Linux. Discusión: [R1](../versiones/0.2.0/discusion/r1-arquitecto.md#10--ventana-secundaria--l), [R2](../versiones/0.2.0/discusion/r2-arquitecto.md), [R4](../versiones/0.2.0/discusion/r4-arquitecto.md) y sus cruces con UX ([R1](../versiones/0.2.0/discusion/r1-disenador-ux.md#10-ventana-secundaria), [R2](../versiones/0.2.0/discusion/r2-disenador-ux.md), [R4](../versiones/0.2.0/discusion/r4-disenador-ux.md)).

## Alternativas consideradas

Ninguna opción añade dependencias. Todas usan Electron (MIT) y Chromium (BSD).

### 1. Dónde suena el audio de la sesión

| Opción | Pros | Contras |
|---|---|---|
| A. **En la secundaria, con el `MotorReproductor` existente** | La imagen y el audio comparten reloj (el mismo de 0011). La sesión no depende del estado ni de las recargas de la principal. | La principal no puede escuchar nada mientras dura la sesión (aceptado en 0048). |
| B. En la principal, enviando el reloj a la secundaria por IPC | La secundaria solo pinta. | Latencia y deriva entre audio y letra. El evento queda atado al editor y a recargas de la principal (R1, plan). |
| C. Dos motores, uno por ventana | Cada ventana es autónoma. | Eco o doble memoria. Pausar y buscar no son atómicos. |
| D. Audio en un `utilityProcess` | Aislado de ambas ventanas. | No hay Web Audio fuera de un renderer. Habría que reescribir el motor. |

### 2. Cómo se carga la secundaria

| Opción | Pros | Contras |
|---|---|---|
| A. **Entrada HTML propia (`reproductor.html`) y *preload* propio (`preload/secundaria`)**, en el mismo origen `shinobi-app://app` | La secundaria solo carga el código del reproductor y solo ve su API. El rol lo asigna main al crear la ventana. El CORS de medios no cambia. | Una entrada más en el build del renderer y del preload. |
| B. El mismo `index.html` con `?rol=secundaria` | Sin cambios de build. | Toda la app cargada en la ventana pública. El preload expone ambas API. El rol se deduce de una URL que el propio renderer puede cambiar. |
| C. `WebContentsView` dentro de la principal | Un solo `BrowserWindow`. | No puede ir a otra pantalla ni a pantalla completa por separado. |

### 3. Dueño del estado de la sesión y de la cola

| Opción | Pros | Contras |
|---|---|---|
| A. **Main** (`ServicioSesion`), con revisión, identificador por entrada y operaciones serializadas | Sobrevive a recargas y caídas de cualquiera de las dos ventanas. Un único punto que decide el avance y descarta eventos tardíos. Puede revalidar en disco. | Más IPC: cada cambio es un viaje de ida y vuelta (milisegundos, sin efecto perceptible en una cola). |
| B. El renderer principal | Sin canales nuevos de cola. | El avance depende de que la principal esté viva. Una recarga pierde la cola. Main no podría validar quién manda. |
| C. El renderer secundario | Avanza sin IPC. | Cerrar o perder la secundaria pierde la cola, en contra de «conservar» (0049). |
| D. Reutilizar `GestorTrabajos` | Infraestructura existente. | Su ciclo de vida, persistencia y reintentos son de trabajos pesados. No expresa orden manual, entrada activa ni transición (R1). |

### 4. Comunicación entre ventanas

| Opción | Pros | Contras |
|---|---|---|
| A. **IPC con main de intermediario, canales por rol y comandos dirigidos** | Main valida cada mensaje y conserva la autoridad. | Dos saltos para un comando de la principal a la secundaria (≈ 1 ms). |
| B. `MessageChannelMain` directo entre ventanas | Latencia mínima. | Main deja de ver y validar el tráfico, lo que contradice A del punto 3. |
| C. Un canal genérico de reenvío | Pocos canales. | Concede permisos excesivos (R1). |

### 5. Temporizador de la transición

| Opción | Pros | Contras |
|---|---|---|
| A. **Fecha límite monotónica en main**. La secundaria pinta la cuenta a partir del restante | Un único árbitro del avance. Se congela al confirmar un cierre y se reinicia al cambiar la candidata sin coordinar dos relojes. | La cuenta pintada puede desviarse unos milisegundos del avance real. |
| B. La secundaria cuenta y avisa a main al llegar a 0 | Cuenta exacta en pantalla. | Si la secundaria se ralentiza o cae, el avance se pierde o se duplica. |
| C. La principal cuenta | — | El avance depende de la ventana de operación. |

### 6. Pantalla de destino y pantalla completa

| Opción | Pros | Contras |
|---|---|---|
| A. **`screen` en main, ventana creada dentro de `workArea` de la pantalla elegida, `setBounds` al estar lista y `setFullScreen` con el control de transiciones de 0011** | Funciona igual en los tres sistemas con X11, Windows y macOS. Reutiliza la gestión de transiciones asíncronas de macOS. | En Wayland la aplicación no puede colocar ventanas (ver Consecuencias). |
| B. `fullscreen: true` en el constructor | Una línea. | En macOS puede mostrarse en la pantalla equivocada y mostrar la ventana antes de tiempo (electron#42165). |
| C. API Fullscreen del DOM con `getScreenDetails()` (Window Management API) | Elige pantalla desde la página. | Exige conceder `window-management` y activación de usuario, y reabre el problema de Esc ya descartado en 0011. |

### 7. Garantía de un único audio

| Opción | Pros | Contras |
|---|---|---|
| A. **Bloqueo en la interfaz más silenciado de la principal desde main (`webContents.setAudioMuted(true)`) mientras dure la sesión** | Aunque un error de la interfaz llegara a crear audio en la principal, no se oiría. | Ninguno relevante: la principal no reproduce nada durante la sesión. |
| B. Solo el bloqueo de la interfaz | Más simple. | Un fallo de la interfaz produciría doble audio en directo. |

## Decisión

Opciones elegidas: 1A, 2A, 3A, 4A, 5A, 6A y 7A. La cola se guarda solo en memoria (decisión de producto en 0049).

### 1. Roles de ventana

- **Dos roles fijos**: `principal`, la ventana actual, y `secundaria`, como mucho una. Los guarda `RegistroVentanas` (`main/ventana/registro.ts`) por identidad de `webContents`. Main asigna el rol al crear la ventana y nunca lo toma de un argumento, de la URL ni de un mensaje del renderer.
- `RegistroVentanas` sustituye todos los `BrowserWindow.getAllWindows()[0]`:
  - el cierre, `second-instance` y los avisos usan `principal()`;
  - `activate` crea la principal si falta, aunque siga abierta la secundaria;
  - el menú envía `evento:menu` solo a la principal, y la secundaria no recibe acciones del menú.
- **Ciclo de vida**: la secundaria no sobrevive a la principal. Cerrar la principal con una sesión activa pasa por el control de cierre (§9) y después cierra la secundaria sin preguntar por la cola. En Windows y Linux la app sale y la cola desaparece. En macOS la app sigue abierta y la cola se conserva, porque nadie confirmó eliminarla.

### 2. La ventana secundaria

- **Entradas propias**:
  - `renderer/reproductor.html` con la misma CSP y `<meta name="referrer" content="origin">`;
  - `renderer/src/secundaria/main.tsx`, que monta el `Reproductor` en modo sesión;
  - `preload/secundaria.ts`, que expone `window.shinobiReproductor` y no `window.shinobi`.
  
  electron-vite compila dos entradas de renderer y dos de preload (`build.rollupOptions.input`). `appProtocolo` sirve `reproductor.html` desde la misma carpeta, sin cambios. En desarrollo se carga `${ELECTRON_RENDERER_URL}/reproductor.html`.
- **Opciones de `BrowserWindow`**:
  - las mismas `webPreferences` de seguridad (`sandbox`, `contextIsolation` y sin `nodeIntegration`);
  - `backgroundThrottling: false`, para que los temporizadores, `requestAnimationFrame` y los informes de posición sigan aunque la ventana quede tapada;
  - `autoplayPolicy: 'no-user-gesture-required'` explícito (es el valor por defecto de Electron), porque la secundaria empieza a sonar sin un gesto en su propio documento;
  - `show: false`, fondo negro y título «Shinobi Karaoke · Reproductor» (`rep.cola.ventana`);
  - `setMenu(null)` en Windows y Linux;
  - sin mínimo de 1024 × 576: la secundaria no tiene layout de la app.
- **Creación en la pantalla elegida** (`main/sesion/ventanaSecundaria.ts`):
  1. `screen.getAllDisplays()` debe contener el `pantallaId` pedido. Si no, responde `PANTALLA_NO_DISPONIBLE`.
  2. Se crea la ventana con `x`, `y`, `width` y `height` dentro de `workArea` de esa pantalla, al 80 % y centrada.
  3. En `ready-to-show` se repite `setBounds` (alivio de electron#18622 con pantallas de distinta resolución), se muestra con `showInactive()` y, si se pidió, se aplica `setFullScreen(true)`.
  
  `showInactive()` deja el foco del teclado en la principal, que es la ventana de operación. Hay una excepción (spec 07): si la pantalla elegida es la de la principal y se pidió pantalla completa, la secundaria la cubre, así que se muestra con `show()` y recibe el foco.
- **Pantalla completa**: se extrae de `ControlModoReproductor` un `ControlPantallaCompleta` por ventana (estado deseado, reaplicación tras `enter-full-screen`/`leave-full-screen` y difusión de cambios reales). La principal lo envuelve con la restauración del estado previo y el zoom de 0011. La secundaria lo usa sin restauración: se crea para esto y se cierra al terminar. F alterna en la ventana enfocada (R2). La principal puede alternarlo con `sesion.fijarPantallaCompleta`.
- **Zoom**: la secundaria fija `zoomFactor` en 1 y lo restablece en `zoom-changed`. Los elementos de zoom del menú se desactivan mientras la secundaria tiene el foco.
- **Pantallas** (`main/sesion/pantallas.ts`): `PantallaIpc = { id, etiqueta, ancho, alto, escala, principal, conVentanaPrincipal }`, donde `principal` es `getPrimaryDisplay()` y `conVentanaPrincipal` es la pantalla de `getDisplayMatching(principal.getBounds())`. Si `label` llega vacío (habitual en Linux), la etiqueta es «Pantalla {n}», numerada por orden de `x` y luego `y`. Main difunde `pantallas:cambiadas` a la principal con `display-added`, `display-removed` y `display-metrics-changed`. Se permite elegir la misma pantalla que la principal (útil con un solo monitor y para probar), con la nota `ses.completa.misma` de la spec 02.
- **Preferencia**: al abrir una sesión, main guarda `config.reproductor.secundaria` con `{ pantalla: { id, etiqueta, ancho, alto }, pantalla_completa }` (ADR 0006, revisión de fase 4). Para preseleccionar se busca primero por `id`, después por etiqueta y tamaño y, si nada coincide, la primera pantalla distinta de la de la principal. Nunca se abre sin una elección explícita.

### 3. Recuperación

| Incidencia | Qué hace main |
|---|---|
| **Se desconecta la pantalla de la secundaria** (`display-removed` con su `id`, o `getDisplayMatching` deja de devolverla) | Sale de pantalla completa y mueve la secundaria a la pantalla de la principal, en ventana al 80 % de su `workArea`, centrada y sin robar el foco (spec 07). Si la de la principal ya no existe, usa la primaria. **El audio y la cola siguen sin cortes** (spec 07 §«Recuperación»). Registra la incidencia `pantalla_perdida` con la etiqueta perdida, y la principal ofrece «Cambiar de pantalla…». Main recuerda la pantalla perdida y si estaba en pantalla completa. |
| **Vuelve a conectarse esa pantalla** (`display-added` con el mismo `id`, o con la misma etiqueta y tamaño) | No mueve la secundaria sola. Registra la incidencia `pantalla_reconectada`, y la principal ofrece «Llevar el reproductor allí» (`sesion.moverAPantalla`, que restaura la pantalla completa si la tenía). |
| **La pantalla es desconocida** (`colocacion: 'sistema'`, Wayland) | No hay incidencias `pantalla_perdida` ni `pantalla_reconectada`, y `moverAPantalla` responde `PANTALLA_NO_DISPONIBLE`. La interfaz muestra `ses.wayland` (0061). |
| **Cambia la resolución** de la pantalla de la secundaria | Si está en ventana, la recoloca dentro del nuevo `workArea`. En pantalla completa no hace nada, porque el sistema lo resuelve. |
| **La secundaria se cierra por el usuario** | Sigue el flujo de cierre de §9. |
| **Cae el renderer de la secundaria** (`render-process-gone`) o se recarga (`did-start-navigation` del *frame* principal) | Destruye la ventana y cierra la sesión **conservando la cola**, porque una caída no confirma una eliminación (R4). La entrada activa queda como reanudable en el último segundo informado, extrapolado si estaba sonando (§8). Libera el bloqueo de edición, el de reposo y el silencio de la principal, y registra la incidencia `secundaria_caida`. La principal ofrece reabrir. No se reabre sola, para evitar bucles de caídas. |
| **La secundaria no responde** (`unresponsive`) | Registra la incidencia `secundaria_no_responde`. La principal ofrece «Esperar» y «Cerrar y volver a abrir». Cerrar usa `sesion.forzarCierre`, que hace `destroy()` y conserva la cola como en una caída, y después la principal abre el diálogo de pantallas. `responsive` borra la incidencia. |
| **Cae o se recarga la principal** | La sesión sigue: la secundaria es autónoma. Al volver, la principal pide `sesion.estado()` y se resincroniza. El bloqueo de edición sigue vigente. |
| **Main termina de golpe** | El sistema libera el bloqueo de reposo al terminar el proceso (como en 0011). La cola se pierde, igual que al salir. |

### 4. Reposo

- Un único `GestorReposo` (`main/ventana/reposo.ts`) con titulares (`local` y `sesion`). Mantiene `prevent-display-sleep` mientras haya alguno.
- El reproductor local mantiene su regla de 0011: retiene solo mientras suena.
- **La sesión retiene durante toda su vida**, también en pausa, transición, espera, error y fin de cola: la secundaria es una salida pública y una pausa en un evento no debe apagar el proyector. Se libera al terminar la sesión por cualquier causa (§3, §9) y en `before-quit`. Coincide con la spec 07 §«Apertura y foco».

### 5. La sesión y la cola en main

`main/sesion/`:

- `cola.ts`: modelo puro de la cola;
- `maquina.ts`: *reducer* puro de la sesión. Recibe eventos y devuelve el estado nuevo y una lista de efectos (comandos a la secundaria, programar o cancelar la fecha límite, revalidar);
- `servicio.ts`: `ServicioSesion`, que serializa todas las operaciones en una cadena de promesas, ejecuta los efectos e inyecta reloj, temporizador, biblioteca, ventanas, pantallas, reposo y configuración.

**Estado** (`EstadoSesionIpc`, solo para la principal):

```ts
{
  revision: number                // sube con cada cambio; el renderer descarta revisiones menores
  sesion: null | {
    sesionId: uuid                // uno por apertura de la secundaria
    fase: 'abriendo' | 'cargando' | 'reproduciendo' | 'pausada'
        | 'transicion' | 'espera' | 'error' | 'fin_de_cola'
    pantalla: PantallaIpc | null  // null si no se conoce (Wayland)
    pantallaCompleta: boolean
    cierrePendiente: boolean      // confirmación abierta: transición congelada
    transicion: null | { transicionId: uuid, candidataId: uuid, restanteMs: number, duracionMs: number, congelada: boolean }
    error: null | { entradaId: uuid, motivo: MotivoFallo, codigo: string }  // codigo para «Copiar detalles»
    incidencia: null | { tipo: 'pantalla_perdida' | 'pantalla_reconectada' | 'secundaria_no_responde', ... }
  }
  activa: null | EntradaIpc & { posicionMs: number, duracionMs: number }
  pendientes: EntradaIpc[]        // orden de reproducción
  contexto: null | { entrada: EntradaIpc, posicionMs: number | null, pausada: boolean, terminada: boolean }  // última reproducida
  incidencia: null | { tipo: 'secundaria_caida' | 'reanudacion_fallida', ... }  // fuera de sesión
}
EntradaIpc = { entradaId: uuid, cancionId, titulo, artista, disponibilidad: 'ok' | MotivoNoDisponible }
MotivoNoDisponible = 'no_encontrada' | 'no_lista' | 'sin_pistas' | 'ilegible'
MotivoFallo = MotivoNoDisponible | 'lectura' | 'decodificacion' | 'otro'
```

Correspondencia con `cola.causa.*` de la spec 02:

| Motivo | Causa en la spec 02 |
|---|---|
| `no_encontrada` | Ya no está en la biblioteca. |
| `no_lista` | Volvió a borrador. |
| `sin_pistas` | Dañada porque faltan las pistas. |
| `ilegible` | Dañada porque no se puede leer `cancion.json`. |
| `lectura`, `decodificacion` | No se ha podido leer su audio (error del motor, 0011). |
| `otro` | Algo salió mal. |

- **Identidad por entrada**: cada «Agregar» crea un `entradaId` (UUID), así que repetir una canción da entradas distintas. La posición conservada pertenece a la entrada.
- **La cola existe sin sesión**. Se puede encolar con la secundaria cerrada. Abrir una sesión consume la cola.
- **Límite**: 500 pendientes (`COLA_LLENA`). Es un tope de memoria y de tamaño de mensaje, no de producto.
- **Títulos y disponibilidad vivos**: `ServicioSesion` se suscribe a los eventos de la biblioteca. Es una consulta al índice, sin disco.
  - Una canción **eliminada** quita sus entradas pendientes (spec 02).
  - Una canción que vuelve a borrador o queda dañada marca sus entradas con el motivo. Siguen visibles en su sitio hasta que se quitan o les llega el turno.
  - Eliminar o volver a borrador la canción de la **entrada activa** se rechaza con `CANCION_EN_REPRODUCCION`. La spec 02 ya lo deshabilita, así que esto es una defensa.
- **Apertura**:
  - con la cola vacía, la sesión empieza en `espera` sin candidata;
  - con pendientes y sin contexto, consume la primera al momento;
  - con contexto, aplica §8;
  - con `inicio: cancion` (`donde: 'ahora'`), la canción se pone delante de las pendientes y se consume. **La última reproducida se descarta**, también si estaba interrumpida: es la variante «ya no seguirá desde {mm:ss}» de `ses.empieza` (0058).
- **Instantánea al consumir, no al encolar**: la canción se lee y se resuelve (estilo con el catálogo vigente, ADR 0016) en el momento en que la entrada pasa a activa. Desde ahí la secundaria conserva esa instantánea aunque cambie el tema.

### 6. Operaciones de la cola (desde la principal)

Las operaciones se refieren a entradas por id, no por índice, para que un cambio concurrente no mueva otra entrada. Todas devuelven el `EstadoSesionIpc` nuevo.

- `cola.agregar({ cancionId, donde: 'siguiente' | 'final' | { antesDe: uuid | null, siRevision: int } })`:
  - «Reproducir a continuación» crea la entrada al frente de pendientes y «Agregar al final» (también «A la cola» y «Agregar otra vez al final»), al final;
  - la tercera forma sirve para «Deshacer» de «Quitar» (spec 02). Si la revisión sigue siendo `siRevision`, la entrada se coloca delante de `antesDe`; si no, al final;
  - el «Deshacer» de un alta es `cola.quitar` de la entrada devuelta;
  - si la canción no existe o no está Lista, responde `CANCION_NO_DISPONIBLE`.
- `cola.mover({ entradaId, antesDe: uuid | null })`: coloca la entrada delante de otra, o al final con `null`. «Subir», «Bajar» y el arrastre se traducen a esto en el renderer. Si la entrada o la referencia no están en pendientes, responde `ENTRADA_NO_ENCONTRADA`. Mover a la misma posición no cambia la revisión.
- `cola.quitar({ entradaId })`: quita una pendiente (respuesta con `revision` y la entrada que la seguía, para «Deshacer»). También quita la activa **fallida** (fase `error`): es «Descartar» de la spec 02 y deja la sesión en `espera`, sin candidata si no quedan pendientes. La activa que suena no se quita: se usa `sesion.siguiente`.
- `cola.vaciar({ contexto: boolean })`: quita todas las pendientes y, con `contexto: true`, también la última reproducida. «Vaciar…» (con sesión) usa `false` y no interrumpe la activa. «Eliminar cola…» (sin sesión) usa `true`.
- Ninguna operación de cola interrumpe la activa ni envía comandos a la secundaria, salvo que cambie la candidata durante una transición (§7).

### 7. Avance, transición y protección ante eventos tardíos o duplicados

**Informes de la secundaria** (`sesion.informar`), siempre con `{ sesionId, entradaId }`:

- `lista` (canción cargada);
- `reproduciendo`;
- `pausada`;
- `posicion` (como mucho 2 por segundo y en cada pausa o búsqueda);
- `fin` (fin natural: `finalizado` del motor);
- `error` (tipo de 0011: `no_encontrada`, `lectura` o `decodificacion`, con la pista).

Main **ignora sin error** (`{ ok: true, valor: { aplicado: false } }`, registrado como depuración) todo informe cuyo `sesionId` no sea el de la sesión vigente, cuyo remitente no sea el `webContents` de esa sesión o cuyo `entradaId` no sea el de la activa. Así un `fin` que llega tarde, de la canción anterior o repetido no produce un segundo avance.

**Fin natural**:

1. Se acepta solo si la activa está en `reproduciendo` o `pausada`. Un segundo `fin` encuentra la fase `transicion`, `espera`, `error` o `fin_de_cola` y se ignora.
2. La activa pasa a `contexto` con `terminada: true`.
3. La candidata es la primera pendiente.
   - Sin pendientes, fase `fin_de_cola`: la secundaria muestra «Fin de la cola», sin cuenta de salida y sin cerrarse (§10).
   - Con candidata, se comprueba su `disponibilidad` en el índice (sin disco). Si ya se sabe no disponible, fase `error` con su motivo, sin cuenta (spec 07 §«Revalidación»). No se saltan entradas solas. La comprobación completa en disco se hace al consumir.
4. Con una candidata válida: fase `transicion`, con un `transicionId` nuevo y una fecha límite en `performance.now()` de main más `config.reproductor.transicion_s × 1000`. Esa duración se fija al empezar la cuenta. Si la cuenta se reinicia por un cambio de candidata, usa la misma duración, aunque `transicion_s` haya cambiado (spec 08).

**Durante la transición**:

- Tras cada operación de cola se recalcula la candidata.
  - Si su `entradaId` no cambia, la fecha límite se mantiene.
  - Si cambia, se crea otro `transicionId`, la cuenta vuelve a empezar con la duración completa y la secundaria recibe la nueva vista previa.
  - Si no queda candidata, la transición se cancela y se pasa a `fin_de_cola`.
  - Si la nueva candidata ya se sabe no disponible, la cuenta se cancela y se pasa a `error`.
- `sesion.detenerTransicion({ transicionId })` pasa a `espera`: candidata visible, sin cuenta.
- `sesion.empezar({ candidataId })` consume la candidata **al momento, sin cuenta**, con su pantalla de título. Es «Empezar ya» en la cuenta, «Iniciar» en espera con candidata e «Iniciar ahora» del toast. Solo actúa si `candidataId` sigue siendo la candidata. Si no, responde con el estado actual sin cambios.
- Al cumplirse la fecha límite, el temporizador entrega su `transicionId`. Si ya no es el vigente, se descarta.

**Consumir una entrada** (avance, `siguiente`, inicio y reanudación):

1. La entrada sale de pendientes.
2. **Se revalida**:
   - `biblioteca.obtener(id)` existe y está en estado Lista;
   - `comprobarPistas(id)` confirma el instrumental en disco y actualiza Dañada como en 0011.
   
   Si falla, fase `error` con `{ entradaId, motivo }`. La entrada queda como activa fallida, sin sonar.
3. Si es válida, la secundaria recibe `cargar` con el DTO de §10 y la fase pasa a `cargando`. Con `lista` y el arranque del motor pasa a `reproduciendo`.

**Fallos**:

- Un `error` de la pista principal pasa a fase `error`. Con `no_encontrada`, main llama a `comprobarPistas`.
- Si solo falla la voz, se sigue con el instrumental, como en 0011.
- **Nunca se avanza solo tras un fallo**. La principal muestra el motivo y ofrece «Pasar a la siguiente canción» (`sesion.siguiente`). La secundaria muestra un mensaje breve para el público (R4).

**`sesion.siguiente({ desdeEntradaId })`** («Siguiente» y «Pasar a la siguiente canción»):

- Interrumpe la activa que suena, o descarta la activa fallida, y **empieza la cuenta** de la candidata, igual que un fin natural (spec 07). Sin pendientes no hace nada.
- Es idempotente por referencia: solo actúa si `desdeEntradaId` coincide con la activa o con la fallida. Un doble clic, o la principal y la secundaria pulsando a la vez, producen un único avance. El segundo responde con el estado actual.
- **Añadir con la cola agotada arranca la cuenta (0059-3B)**. En `fin_de_cola`, la primera pendiente que llega se trata como el fin natural de la última canción: comprobación por índice y fase `transicion` con la duración configurada, o `error` si ya se sabe no disponible. Valen las mismas reglas: «Detener cuenta», «Empezar ya» y reinicio solo si cambia la candidata. El contexto sigue siendo la última terminada.
- **En `espera` no se arranca solo**: añadir con la espera sin candidata la deja en `espera` con esa candidata, que se arranca con `sesion.empezar`. La espera es el estado al que el operador llegó a propósito («Detener cuenta», abrir con la cola vacía o tras «Descartar»), o el de reabrir tras una canción terminada.
- **`sesion.repetir({ entradaId })`** («Otra vez» en el fin de la cola, en la principal o en la secundaria) solo actúa sobre la entrada del contexto terminado y en `fin_de_cola`. La vuelve a consumir al momento, con su pantalla de título y revalidación, como una entrada nueva al frente.

**Transporte desde la principal**: `sesion.transporte({ accion: 'pausar' | 'reanudar' | 'reiniciar', entradaId })`. Main lo reenvía como comando a la secundaria solo si `entradaId` es la activa. «Reiniciar canción» vuelve al principio de esa entrada, con la pantalla de título y el silencio previo, y conserva el orden de pendientes. En la secundaria, el transporte y sus teclas (espacio, ⏮, búsqueda, voz, volumen y F) actúan sobre su motor y se informan a main. Sus botones de sesión («Siguiente», «Empezar ya», «Detener cuenta», «Iniciar», «Otra vez» y «Pasar a la siguiente canción») llaman a los mismos canales que la principal.

**Comandos a la secundaria** (`sesion:comando`), siempre con `{ sesionId, revision }`:

- `cargar { entrada, desdeMs, pausada, anuncio: 'inicio' | 'reanudacion' }`;
- `pausar { causa }`;
- `reanudar`;
- `reiniciar`;
- `transicion { candidata: { titulo, artista }, restanteMs, duracionMs } | null`;
- `fin_de_cola`;
- `error { motivo }`.

La secundaria ignora los comandos de otra sesión y los de transporte de otra entrada.

### 8. Cierre de la secundaria, conservación y reanudación

- **Solicitar el cierre** abre el mismo flujo desde cualquier origen: el botón «Cerrar reproductor» de la secundaria o de la principal, Ctrl/Cmd + W en la secundaria, el botón de cierre de su ventana o Alt + F4 (`sesion.solicitarCierre()`). **Esc no cierra la sesión**: en la secundaria solo sale de la pantalla completa (spec 07). Main intercepta `close` de la secundaria con `preventDefault()`, salvo en un cierre ya confirmado, forzado o de salida de la app. En Windows y Linux la secundaria no tiene menú, así que Ctrl + W lo atiende su renderer.
- **Sin pendientes**, se cierra sin preguntar: activa y contexto se descartan y la cola queda vacía.
- **Con pendientes**:
  1. `cierrePendiente: true`. La transición se congela y guarda su `restanteMs`. Si había candidata, no avanza aunque venza la fecha límite. La canción en curso sigue sonando bajo el diálogo.
  2. La interfaz muestra «Hay canciones en cola» con «Cerrar y eliminar cola», «Cerrar y conservar cola» y «Cancelar», **en la ventana donde se pidió el cierre** (spec 02). `cierrePendiente` lleva el rol de origen para que la otra ventana muestre la espera y desactive sus controles de sesión. Si la canción termina mientras el diálogo está abierto, queda como terminada y no empieza la cuenta.
  3. `sesion.confirmarCierre({ cola: 'eliminar' | 'conservar', revision })`: si la revisión cambió, responde `CONFIRMACION_OBSOLETA` con el estado nuevo, para que la interfaz confirme sobre lo que hay.
  4. `sesion.cancelarCierre()` reanuda la transición congelada con su restante. No la reinicia, porque la candidata no cambió.
- **Conservar**:
  - la cola mantiene el orden y los ids de las pendientes;
  - si la activa sonaba o estaba en pausa, pasa a `contexto` con `terminada: false`, `pausada` según su estado y `posicionMs` = último informe + tiempo transcurrido desde él (con el reloj monotónico de main) si sonaba. La precisión basta para «el mismo segundo»;
  - si la canción ya había terminado (transición o espera), el contexto es la terminada y la candidata sigue pendiente (0049).
- **Eliminar**: vacía pendientes, activa y contexto.
- **Reabrir** (`sesion.abrir` con `inicio: 'reanudar'`):
  - con un contexto no terminado, se revalida esa entrada y se carga en `posicionMs`, sin pantalla de título ni silencio previo, en el mismo estado (en pausa si se cerró en pausa) y con `anuncio: 'reanudacion'`. Si `posicionMs` es anterior a la primera línea (silencio previo o pantalla de título), empieza desde el principio, como una entrada nueva. «Reiniciar canción» usa `sesion.transporte('reiniciar')`;
  - con un contexto terminado, la sesión abre en `espera` con la primera pendiente como candidata (o sin candidata), y se arranca con `sesion.empezar`;
  - si la entrada guardada ya no está disponible, se aplica el flujo de error de §7.
- Las entradas reanudables y el contexto **solo viven en memoria**. Salir de la app los descarta.

### 9. Bloqueo de edición y autoguardado al iniciar

- **Autoridad en main**: `ServicioSesion.edicionBloqueada()` es verdadero desde que se acepta `sesion.abrir` hasta que la sesión termina por cualquier causa: cierre, caída o salida. Cubre las fases `abriendo`, `cargando`, `pausada`, `transicion`, `espera`, `error` y `fin_de_cola`.
- **Canales que responden `EDICION_BLOQUEADA` mientras dura**:
  - `letras.abrirEdicion` (no se abren visitas nuevas);
  - `letras.guardarTiempos`;
  - `biblioteca.guardarApariencia`;
  - `biblioteca.marcarLista`;
  - `letras.guardar`, `letras.editarTexto` y `letras.leerArchivo`, porque la vista Letra también se bloquea (0060-1A, spec 06);
  - `ventana.modoReproductor(true)` desde la principal: ni «Reproducir» local ni «Probar a pantalla completa».
- **Siguen disponibles**: Biblioteca (metadatos, borrar y volver a borrador salvo para la activa, temas y lotes), Añadir canción, Ajustes y la cola. La escucha de la vista de progreso se bloquea en la interfaz (spec 06). Main además silencia la principal. Los cambios que afecten a entradas de la cola se ven en la revalidación al consumir (§7). La activa no cambia, porque su instantánea ya está cargada.
- **Silencio de la principal**: al aceptar la sesión, main llama a `principal.webContents.setAudioMuted(true)`. Al terminar, restaura el valor previo, respetando `SHINOBI_SILENCIAR_AUDIO`.
- **Autoguardado al iniciar**. La sesión **solo se inicia desde la Biblioteca** (spec 06, 0058 §3), así que nunca hay un editor montado al abrir.
  - Para llegar a la Biblioteca desde el editor se usa su salida normal: diálogo del borrador de tema si lo hay, salida del modo al ritmo, `vaciar()` del guardado con `edi.dialogo.salir` si falla, `cerrarEdicion` y `liberarAudio`. Así el autoguardado queda resuelto antes.
  - Main mantiene la defensa: si `app.guardadoPendiente` sigue activo (un guardado que termina tarde), `sesion.abrir` responde `GUARDADO_PENDIENTE` sin crear la ventana. El diálogo de apertura muestra `ses.error.guardando` y permite reintentar.
  - **No hay editor en solo lectura**: se descarta la variante «bloquear, vaciar, abrir» con el editor montado de la versión anterior de este punto.
  - Una visita de letra que siguiera abierta por un error se libera al aceptar la sesión (`letras.cerrarEdicion` interno).
- **Intentos de editar durante la sesión** (Editar, Continuar hacia Letra o Editor, los pasos 3–4 del stepper, «Abrir editor» de un toast): el renderer muestra el diálogo `edi.bloqueo` y no navega ni llama a main. El rechazo de main es la defensa.
- **Volumen y voz guía** no se controlan desde la principal (0060-2A). Siguen en el reproductor de la secundaria.
- **Salir de la app con una sesión o con cola** (0059-4A): `hayAlgoEnCurso` incluye `sesionActiva` y `colaNoVacia`, y el control de cierre pregunta antes de salir o de cerrar la principal. El texto es `ses.salir`, o el diálogo de trabajos de la spec 04 con `ses.salir.extra`. En macOS, cerrar la ventana principal usa la variante «cerrar ventana»: la secundaria se cierra y la cola se conserva, como en una caída. Al confirmar, la secundaria se cierra sin el diálogo de cola. Con la cola vacía y sin sesión, no se pregunta.

### 10. La secundaria por dentro

- `Reproductor.tsx` gana `origen: 'sesion'`, sin capa modal ni `inert`: es todo el documento. El anfitrión `secundaria/AppSecundaria.tsx` traduce los comandos de §7 a llamadas del `MotorReproductor` existente y los cambios de su estado a `sesion.informar`. **Es el único motor de audio de la sesión.**
- **DTO `cargar.entrada`**:
  - `entradaId`, `cancionId`, `titulo`, `artista`, `duracionMs`, `gananciaDb`;
  - `letra` y `estilo` resuelto (instantánea);
  - `lineasSinSincronizar`;
  - `silencioPrevio: boolean` (como hoy).
  
  Sin rutas de archivo: el motor construye `shinobi-media://<id>/pistas/...` como ahora (`karaoke/pistas.ts`). El protocolo de medios no cambia, porque la secundaria tiene el mismo origen que la principal y su CORS exacto la cubre (ADR 0008 §2).
- En modo sesión **no hay `CuentaFinal` de salida** ni pantalla final. El final natural solo informa `fin`. La secundaria pinta los estados de la spec 07 (S1 cuenta, S2 en espera, S3 fin de la cola y S4 fallo) a partir del estado reducido y de los comandos. La cuenta sale de `restanteMs`, con un `performance.now()` local. Con movimiento reducido cambia el número sin animación (R4). Solo anuncia la siguiente al empezar la transición y cuando cambia la candidata.
- El estado reducido de la secundaria (`EstadoSecundariaIpc`) solo incluye fase, candidata (título, artista y estilo resuelto para el fondo de S1 y S2), si hay pendientes, `cierrePendiente` y el motivo genérico de fallo. No incluye la lista de pendientes ni detalles técnicos.
- **Volumen y voz guía**: la secundaria lee `sesion.preferencias()` (solo `config.reproductor`) y escribe con `sesion.guardarPreferencias(parcial)`, un esquema estricto con los mismos rangos que `config.reproductor`, como mucho cada 500 ms (como `useVolumenCompartido`).
- **Toasts**: la secundaria no muestra toasts de la app. La principal sigue mostrando los suyos, porque no hay capa local abierta.

### 11. Contratos IPC por rol

Los esquemas van en `shared/sesion.ts` y `shared/ipc.ts`, y los nombres en `shared/canales.ts`. Siguen todas las reglas de ADR 0008: tupla validada con Zod, respuestas `{ ok, valor | error }` y sin rutas ni detalles internos.

**Comprobación del remitente** (`remitenteIpcValido(evento, canal)`, que sustituye a la actual):

1. `evento.sender` está en `RegistroVentanas` y su rol tiene permitido `canal` según `ROLES_POR_CANAL`, una tabla en `shared/canales.ts` que declara los roles de **cada** canal. Un test exige que no falte ninguno.
2. `evento.senderFrame === sender.mainFrame`.
3. El origen de la URL del *frame* es el del renderer.
4. La ruta es la del documento del rol: `/index.html` o `/` para la principal, y `/reproductor.html` para la secundaria.
5. Los canales de la secundaria exigen además que el `webContents` sea el de la sesión vigente, y los informes llevan su `sesionId` (§7).

Si falla cualquier paso, la respuesta es el error genérico actual (`ARGUMENTOS_NO_VALIDOS`, «Origen no permitido.»), sin revelar el motivo. La secundaria tiene bloqueada **toda** navegación (`will-navigate` siempre `preventDefault`), además de la política común.

**Canales nuevos**:

| Canal | Rol | Argumentos | Respuesta |
|---|---|---|---|
| `pantallas.listar` | principal | — | `{ pantallas: PantallaIpc[], colocacion: 'libre' \| 'sistema' }` |
| `sesion.estado` | principal | — | `EstadoSesionIpc` |
| `sesion.abrir` | principal | `{ pantallaId: int, pantallaCompleta: bool, inicio: { tipo: 'cancion', cancionId, donde: 'ahora' } \| { tipo: 'cola' } \| { tipo: 'reanudar' } }` | `EstadoSesionIpc` |
| `sesion.mostrar` | principal | — | `void` (muestra la secundaria sin robar el foco ni cambiar la pantalla) |
| `sesion.moverAPantalla` | principal | `{ pantallaId: int }` | `EstadoSesionIpc` |
| `sesion.fijarPantallaCompleta` | principal | `bool` | `void` |
| `sesion.transporte` | principal | `{ accion: 'pausar' \| 'reanudar' \| 'reiniciar', entradaId: uuid }` | `EstadoSesionIpc` |
| `sesion.siguiente` | principal, secundaria | `{ desdeEntradaId: uuid }` | estado del rol |
| `sesion.empezar` | principal, secundaria | `{ candidataId: uuid }` | estado del rol |
| `sesion.detenerTransicion` | principal, secundaria | `{ transicionId: uuid }` | estado del rol |
| `sesion.repetir` | principal, secundaria | `{ entradaId: uuid }` | estado del rol |
| `sesion.forzarCierre` | principal | — | `EstadoSesionIpc` |
| `sesion.solicitarCierre` | principal, secundaria | — | estado del rol (`EstadoSesionIpc` o `EstadoSecundariaIpc`) |
| `sesion.confirmarCierre` | principal, secundaria | `{ cola: 'eliminar' \| 'conservar', revision: int }` | `void` |
| `sesion.cancelarCierre` | principal, secundaria | — | `void` |
| `cola.agregar` | principal | `{ cancionId, donde: 'siguiente' \| 'final' \| { antesDe: uuid \| null, siRevision: int } }` | `{ estado: EstadoSesionIpc, entradaId: uuid }` |
| `cola.mover` | principal | `{ entradaId: uuid, antesDe: uuid \| null }` | `EstadoSesionIpc` |
| `cola.quitar` | principal | `{ entradaId: uuid }` | `{ estado: EstadoSesionIpc, antesDe: uuid \| null }` |
| `cola.vaciar` | principal | `{ contexto: bool }` | `EstadoSesionIpc` |
| `sesion.inicial` | secundaria | — | `{ sesionId, comandoActual \| null, estado: EstadoSecundariaIpc }` (al cargar el documento) |
| `sesion.informar` | secundaria | `{ sesionId, entradaId, tipo, posicionMs?, error? }` | `{ aplicado: bool }` |
| `sesion.preferencias` / `sesion.guardarPreferencias` | secundaria | — / parcial estricto de `reproductor` | `ConfigReproductor` |
| `ventana.fijarPantallaCompleta` / `ventana.estaEnPantallaCompleta` | principal, secundaria (cada una sobre su ventana) | como hoy | como hoy |

- `sesion.abrir` con `inicio: cancion` y `donde: 'ahora'` crea una entrada al frente de pendientes y la consume. Las pendientes que ya hubiera siguen detrás. Si ya hay una sesión, responde `SESION_EN_CURSO` y la interfaz ofrece «Mostrar reproductor».
- **Canales existentes**:
  - con rol `principal`: todos los actuales, incluidos `ventana.modoReproductor` y `ventana.evitarReposo`, que son del reproductor local;
  - `temas.*` y `biblioteca.guardarApariencia`: solo la principal (ADR 0016 §11).
- **Eventos dirigidos por rol**. `difundir(canal, carga)` pasa a `enviarA(rol, canal, carga)`:
  - la principal recibe los eventos actuales más `sesion:estado`, `sesion:posicion` (`{ sesionId, entradaId, posicionMs, duracionMs }`, como mucho 1 por segundo) y `pantallas:cambiadas`;
  - la secundaria recibe solo `sesion:comando`, `sesion:estadoSecundaria`, su `ventana:pantallaCompleta` y `sesion:preferencias` cuando cambia `config.reproductor`.
- **Límites Zod**:
  - `cancionId` con `idCancionSchema`;
  - UUID con `z.uuid()`;
  - `pantallaId` entero;
  - `posicionMs` entero en [−60 000, 24 h];
  - `revision` entero ≥ 0;
  - `tipo` de informe y `accion` como enumeraciones cerradas.
- **Códigos nuevos**: `EDICION_BLOQUEADA`, `SESION_EN_CURSO`, `SESION_NO_ACTIVA`, `GUARDADO_PENDIENTE`, `PANTALLA_NO_DISPONIBLE`, `CANCION_NO_DISPONIBLE`, `CANCION_EN_REPRODUCCION`, `ENTRADA_NO_ENCONTRADA` y `COLA_LLENA`. Los motivos de fallo (`MotivoFallo`, §5) son los que la spec 02 traduce a `cola.causa.*`. `CONFIRMACION_OBSOLETA` se reutiliza (ADR 0016).

### 12. Configuración

`config.reproductor` gana `transicion_s` y `secundaria` (preferencia de pantalla de §2), ambos con lectura tolerante por campo. Detalle en el ADR 0006, revisión de fase 4.

- `transicion_s` es un entero de **1 a 30**, con 4 por defecto. Un valor ausente, de otro tipo o fuera de rango se lee como 4.
- El selector de la spec 08 ofrece 2, 3, 4, 5, 8, 10 y 15 s. Un valor válido que no está en la lista (por ejemplo, editado a mano) se añade como opción extra y se respeta.
- Se escribe desde Ajustes con `config.actualizar`. `configParcialRendererSchema` admite enteros de 1 a 30.
- Main la lee al empezar cada cuenta, así que un cambio vale para la siguiente.

### 13. Estrategia de pruebas

**Unitarias (Vitest, sin Electron)**:

- `cola.ts`:
  - agregar delante y al final;
  - repetición con ids distintos;
  - `mover` antes de otra, al final, con referencia inexistente o activa, y a la misma posición sin cambiar la revisión;
  - quitar;
  - vaciar;
  - límite de 500;
  - candidata con entradas no disponibles.
- `maquina.ts`, con reloj y temporizador falsos:
  - fin natural a transición;
  - **`fin` duplicado** y **`fin` tardío de la entrada anterior** ignorados;
  - informe de otra sesión ignorado;
  - temporizador con `transicionId` obsoleto ignorado;
  - reordenar en la transición conservando la candidata (misma fecha límite) o cambiándola (cuenta reiniciada);
  - quitar la última candidata, que pasa a `fin_de_cola`;
  - **fin de cola** y añadir después, que arranca la cuenta (0059-3B), o pasa a `error` si la candidata ya se sabe no disponible;
  - espera sin candidata y añadir, que pasa a `espera` con candidata sin arrancar;
  - abrir con una canción, que descarta la última reproducida interrumpida;
  - «Descartar» (quitar la activa fallida) sin pendientes, que pasa a `espera` sin candidata;
  - deshacer un «Quitar» con la misma revisión (vuelve a su sitio) y con otra (va al final);
  - reanudar con la posición en el silencio previo, que empieza desde el principio;
  - `siguiente` doble con el mismo `desdeEntradaId` (también desde las dos ventanas a la vez), que da una sola cuenta;
  - `empezar` con una candidata obsoleta, que se ignora;
  - candidata no válida al empezar la cuenta, que pasa a `error` sin cuenta;
  - error que no avanza;
  - revalidación fallida al consumir (borrada mientras espera, vuelta a borrador o sin instrumental);
  - cierre con y sin pendientes;
  - congelar, cancelar y reanudar con el restante;
  - confirmar con una revisión obsoleta;
  - conservar a mitad de canción (posición extrapolada) y en transición (contexto terminado);
  - reanudar en el segundo y reiniciar;
  - caída que conserva la cola;
  - `transicion_s` cambiada, que vale para la siguiente cuenta y no para una cuenta reiniciada por cambio de candidata;
  - pantalla perdida, que no pausa ni toca la cola;
  - eliminar una canción pendiente quita sus entradas, y la de la activa se rechaza.
- `servicio.ts`: serialización con revalidación asíncrona intercalada (un `fin` y dos `siguiente` concurrentes, `cola.mover` durante la revalidación), bloqueo de edición durante todas las fases y liberación en cada salida.
- **Seguridad**:
  - la matriz de `ROLES_POR_CANAL` cubre todos los canales de `CONTRATO`;
  - la secundaria no puede llamar a canales de la principal ni la principal a los de la secundaria;
  - se rechazan un *frame* que no es el principal, una ruta de otro rol, un `webContents` desconocido y un `sesionId` ajeno;
  - eventos dirigidos: la secundaria no recibe `evento:cancion`.
- **Ventanas y pantallas con dobles de `BrowserWindow` y `screen`**:
  - creación dentro de `workArea`;
  - preferencia por id, por etiqueta y tamaño, y respaldo;
  - `display-removed`, que recoloca en ventana sin pausar y crea una incidencia, y `display-added` de la misma pantalla, con incidencia y sin mover;
  - `render-process-gone` y `unresponsive`;
  - `GestorReposo` con titulares, liberado en cierre, caída y `before-quit`;
  - silencio de la principal puesto y restaurado.
- **Renderer**:
  - el estado de la cola descarta revisiones viejas;
  - `Reproductor` en modo sesión no sale solo al terminar;
  - la cuenta de la transición sale del restante y respeta el movimiento reducido;
  - los puntos de entrada al editor y a Letra muestran `edi.bloqueo` durante la sesión y vuelven a funcionar al terminar;
  - `GUARDADO_PENDIENTE` en el diálogo de apertura.

**E2E (Playwright `_electron`, sin red, audio generado de pocos segundos y letras inventadas)**. Dobles, ignorados en la app empaquetada como los demás `SHINOBI_*`:

- `SHINOBI_PANTALLAS_SIMULADAS`: JSON con pantallas. Un puerto de pruebas en main, accesible con `electronApp.evaluate`, añade y quita pantallas;
- `SHINOBI_PANTALLA_COMPLETA_SIMULADA` (existente), ahora por ventana;
- `SHINOBI_SILENCIAR_AUDIO` (existente);
- `transicion_s` mínimo en la configuración sembrada.

Escenarios:

1. Abrir en la pantalla simulada 2: la segunda ventana tiene `window.shinobiReproductor` y no `window.shinobi`, sus límites están en esa pantalla y la pantalla completa se alterna. La principal sigue operable (navegar, buscar, encolar).
2. «Reproducir a continuación» y «Agregar al final», repetir la misma canción, reordenar con teclado y quitar: la activa no se interrumpe (su posición sigue avanzando).
3. Fin natural, cuenta y siguiente. **Fin de cola**: «Fin de la cola» sin cerrar la ventana. Añadir después arranca la cuenta (0059-3B). Con «Detener cuenta», la espera y luego «Iniciar».
4. **Eventos duplicados**: desde la secundaria se envía `fin` dos veces y un `fin` con el `entradaId` anterior. Se produce un solo avance y se comprueba el orden.
5. Reordenar durante la cuenta: con la misma candidata la cuenta sigue y con otra se reinicia.
6. Entrada en borrador mientras espera, y entrada cuyo instrumental se borra en disco: se muestra el aviso, no avanza y avanza con «Pasar a la siguiente canción».
7. Editor con cambios sin guardar y salir a la Biblioteca para abrir la sesión: los cambios están en disco antes de que suene la secundaria. Durante la sesión, Editar y Letra muestran `edi.bloqueo` y main rechaza las escrituras con `EDICION_BLOQUEADA`. Al cerrar la sesión se puede editar.
8. Cerrar con cola desde la secundaria (Ctrl/Cmd + W) y desde la principal: eliminar, conservar y cancelar. Esc no cierra. Reabrir reanuda en el segundo (±1 s) y en el mismo estado, y «Reiniciar canción» empieza desde el principio. Cierre durante la transición.
9. Caída simulada (`webContents.forcefullyCrashRenderer()` de la secundaria): la principal muestra la incidencia, la cola se conserva y se liberan el bloqueo de edición, el de reposo (comprobado con `powerSaveBlocker.isStarted` desde `evaluate`) y el silencio.
10. Desconexión simulada de la pantalla: recolocación en ventana, el audio sigue y aparece la incidencia en la principal. Reconexión: «Llevar el reproductor allí».
11. Un solo audio: la principal está silenciada durante la sesión y su reproductor local no se abre.

**Verificación manual** (informe de fase, con la app empaquetada):

- dos pantallas reales en Windows, macOS (incluidos Spaces y la transición de pantalla completa) y Linux con X11 y Wayland;
- desconectar y reconectar el cable en mitad de una canción, con la salida de audio por HDMI de esa pantalla (comprobar si Chromium sigue al nuevo dispositivo predeterminado);
- pantallas de distinta escala;
- reposo con un evento largo en pausa;
- una sesión de al menos 30 minutos con una cola de 10 canciones y una separación pesada en segundo plano, para medir cortes de audio.

## Consecuencias

- **Positivas**:
  - un solo audio y un solo reloj por sesión, en la ventana pública;
  - la sesión sobrevive a recargas de la principal;
  - main es el único árbitro del avance, así que los eventos tardíos o duplicados no producen dobles avances;
  - la secundaria solo carga y ve lo que necesita;
  - la cola y su lógica son funciones puras probables sin Electron;
  - el reproductor, el motor y el render se reutilizan sin cambiar su precisión;
  - sin dependencias nuevas.
- **Negativas / riesgos**:
  - **Wayland** (Linux, por defecto desde Electron 38.2): la aplicación no puede colocar ventanas, así que el compositor decide en qué pantalla se abre la secundaria. Se abre en ventana. `pantalla` puede quedar en `null` y la interfaz debe indicar cómo moverla y pulsar F ([0061](../preguntas/0061-reproductor-en-otra-pantalla-con-wayland.md)). Main detecta la sesión Wayland con `XDG_SESSION_TYPE` y la expone en `pantallas.listar` (`colocacion: 'libre' | 'sistema'`). No se fuerza X11 para toda la app, porque afectaría a todo el render en Linux. Se verifica en la prueba manual.
  - La desconexión de la pantalla no pausa. Si el cable vuelve en segundos, el público puede ver un momento la ventana pequeña en la pantalla del operador. Se aceptó para no cortar la música (spec 07).
  - En macOS, la pantalla completa en otra pantalla crea un Space allí y tarda unos 0,7 s. El audio no espera.
  - Si la pantalla perdida era también la salida de audio (HDMI), el sistema cambia el dispositivo predeterminado. Se verifica manualmente que el `AudioContext` lo sigue. Si no, se documenta como limitación y se reabre el selector de dispositivo de 0048.
  - Unos 20 canales y 3 eventos nuevos, y una tabla de roles que mantener. Se mitiga con el test de cobertura de la tabla.
  - Una separación u otro trabajo pesado durante el evento puede competir por CPU con el audio. No se bloquea en esta fase. Se mide en la verificación manual.
  - Memoria: la secundaria tiene hasta 2 buffers (≈ 170 MB con 4 min). La principal libera los del editor al bloquearse. No se precarga la siguiente canción: tras la cuenta, «Cargando…» dura menos de 1 s.
  - La cola en memoria se pierde si main cae, aceptado por producto (0049).
- **Legales**: la app no distribuye contenido. Reproducir canciones con copyright en un evento público puede requerir licencias de comunicación pública (entidades de gestión). Es responsabilidad de quien organiza el evento. Se puede mencionar en la ayuda, sin bloquear nada.
- **Impacto en UX** (specs [02](../ux/02-biblioteca.md), [06](../ux/06-editor.md), [07](../ux/07-reproductor.md), [08](../ux/08-ajustes-y-acerca.md) y [mapa](../ux/00-mapa-de-vistas.md)):
  - un selector de pantalla con etiqueta, resolución y la marca de la principal;
  - el panel de cola con la activa separada de las pendientes;
  - estados de sesión, incidencias y el aviso de edición bloqueada;
  - el ajuste de la duración de la cuenta.
  
  Las specs de la fase 4 ya recogen todo esto. El único hueco es Wayland, en 0061.

## Fuentes

- Electron `screen` (eventos `display-added`/`display-removed`/`display-metrics-changed`, `getAllDisplays`, `getDisplayMatching`; disponible tras `ready`) y estructura `Display` (`id`, `label`, `bounds`, `workArea`, `internal`; consultado el 2026-11-11): https://www.electronjs.org/docs/latest/api/screen , https://www.electronjs.org/docs/latest/api/structures/display
- Electron `webPreferences` (`autoplayPolicy` por defecto `no-user-gesture-required`; `backgroundThrottling` por defecto `true`): https://www.electronjs.org/docs/latest/api/structures/web-preferences
- Electron `BrowserWindow` (`setFullScreen`, transición asíncrona en macOS, `showInactive`, `setMenu`) y `webContents` (`setAudioMuted`, `render-process-gone`, `unresponsive`, `forcefullyCrashRenderer`): https://www.electronjs.org/docs/latest/api/browser-window , https://www.electronjs.org/docs/latest/api/web-contents
- Electron `powerSaveBlocker`: https://www.electronjs.org/docs/latest/api/power-save-blocker
- Electron *Tech Talk: Wayland* (Wayland por defecto desde 38.2; sin `setPosition` ni colocación por la app): https://electronjs.org/blog/tech-talk-wayland
- Ventanas más grandes que la pantalla primaria con varios monitores, alivio con `setBounds` tras crear: https://github.com/electron/electron/issues/18622
- `setFullScreen` justo tras crear muestra la ventana: https://github.com/electron/electron/issues/42165
- Electron, seguridad (validar el remitente de IPC, limitar la navegación): https://www.electronjs.org/docs/latest/tutorial/security
- Node.js `performance.now()` (reloj monotónico): https://nodejs.org/api/perf_hooks.html#performancenow
- Decisiones de producto: [0048](../preguntas/0048-escucha-editor-durante-evento.md), [0049](../preguntas/0049-politica-cola-de-reproduccion.md). Discusión: [R1](../versiones/0.2.0/discusion/r1-arquitecto.md), [R2](../versiones/0.2.0/discusion/r2-arquitecto.md), [R4](../versiones/0.2.0/discusion/r4-arquitecto.md).
