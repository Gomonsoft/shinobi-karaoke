# 04 — Progreso del pipeline (descarga, preparación y separación)

- Paso del pipeline: 1 (descarga YouTube) y 2 (Separación)
- ADRs: [0003](../adr/0003-fuente-de-audio.md), [0004](../adr/0004-separacion-voz-instrumental.md), [0006](../adr/0006-persistencia-y-modelo-de-datos.md)
- Restricciones: [arquitectura.md §6 y "Restricciones e implicaciones para UX" §2–§3](../arquitectura.md)
- Preguntas respondidas: [0013](../preguntas/0013-huecos-ux-de-la-fase-2.md) §1, §4 (cancelar la descarga, fuente pendiente, cola de descargas); [0003](../preguntas/0003-elegir-calidad-o-rapidez-separacion.md) (modo informativo + ajuste global)

## Objetivo
Que el usuario entienda que la separación **tarda minutos**, sepa **cuánto falta**, pueda **cancelar** y, sobre todo, **no tenga que esperar**: puede buscar la letra, sincronizar o volver a la biblioteca mientras tanto. Nada se pierde al salir.

Usuario/tarea principal: "He añadido una canción: ¿qué está pasando y qué puedo hacer ahora?"

Esta spec define tres piezas:
1. **Vista de progreso** (paso 2 del espacio de canción).
2. **Panel de actividad** global (barra superior).
3. **Comportamiento de cierre, interrupción y notificaciones**.
La línea de progreso de la tarjeta está en la spec 02.

## 1. Vista de progreso

### Wireframe
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ‹ Biblioteca │ «Bohemian Rhapsody» · Queen           ✎ Borrador · guardado│
│   (1)✓ Fuente ──── (2)● Separación ──── (3)○ Letra ──── (4)○ Editor       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Separando la voz de la música                                          │
│   Puedes seguir trabajando: esto continúa aunque cambies de pantalla.    │
│                                                                          │
│   ✓  Descargar de YouTube                                     5,8 MB     │
│   ✓  Preparar el audio                                                   │
│   ⟳  Separar voz e instrumental                                          │
│        Separando… 42 %                    quedan unos 3 minutos          │
│        ████████████████░░░░░░░░░░░░░░░░░░░░░░░                           │
│        Modo Rápido · ⓘ                                                   │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────────┐   │
│   │ Mientras tanto…                                                  │   │
│   │ Busca la letra y empieza a sincronizarla con la canción original.│   │
│   │ [ Buscar la letra mientras tanto ] (primario)                    │   │
│   │ [ Volver a la biblioteca ] (secundario)                          │   │
│   └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│   [ Cancelar separación ] (fantasma)                                     │
└──────────────────────────────────────────────────────────────────────────┘
```
Si la canción viene de un archivo local, la fila "Descargar de YouTube" no aparece.

**Terminado** (la vista sigue abierta al acabar)
```
│   ✓  Separar voz e instrumental                    1 min 48 s            │
│   Escucha el resultado:  [▶ Voz]  [▶ Instrumental]                       │
│   ┌──────────────────────────────────────────────────────────────────┐   │
│   │ [ Buscar la letra ] (primario)        (o "Ir al editor" si ya hay letra)│
│   └──────────────────────────────────────────────────────────────────┘   │
```

**Descarga pendiente** (YouTube, tras cancelar la descarga; o al llegar por el stepper con la fuente `pendiente` sin trabajo vivo)
```
│   Separando la voz de la música                                          │
│   ○  Descargar de YouTube                                                │
│   ○  Preparar el audio                                                   │
│   ○  Separar voz e instrumental                                          │
│   ┌──────────────────────────────────────────────────────────────────┐   │
│   │ ⓘ Falta descargar el audio.                                      │   │
│   │   Cancelaste la descarga antes de que terminara. La canción sigue│   │
│   │   en tu biblioteca como borrador.                                │   │
│   │   [ Descargar ahora ] (primario)                                 │   │
│   └──────────────────────────────────────────────────────────────────┘   │
│   [ Volver a la biblioteca ] (secundario)                                │
```
Sin bloque "Mientras tanto…" ni "Cancelar …". Para usar otro vídeo: paso 1 (wireframe E de la spec 03).

### Subpasos y fases
| Subpaso | Fases técnicas (worker) | Progreso mostrado |
|---------|-------------------------|-------------------|
| Descargar de YouTube | `descargando` | % + "X MB de Y MB" + tiempo restante |
| Preparar el audio | `importar-archivo` | indeterminado, "Preparando el audio…" (2–10 s) |
| Separar voz e instrumental | `cargando_modelo` → `separando` → `guardando` | "Preparando la separación…" (indeterminado, 5–20 s) → "Separando… N %" + tiempo → "Guardando las pistas…" (indeterminado) |
| En cola (separación) | — | `prog.cola`: "En cola: se separará cuando termine «{otra canción}»." (sin barra; posición si hay > 1: "2.ª en la cola") |
| En cola (descarga) | — | `prog.cola.descarga`: "En cola: se descargará cuando termine «{otra canción}»." Si lo que ocupa la cola `ligera` es la actualización de yt-dlp (trabajo sin canción): `prog.cola.descarga.mantenimiento`. Misma regla de posición. |
| Reintento tras bloqueo | `actualizando` | Barra indeterminada + `prog.reintento.ytdlp` en el subpaso "Descargar de YouTube" (no es error). |

### Componentes e interacciones
| Elemento | Comportamiento |
|----------|----------------|
| Lista de subpasos | Icono de estado (○ ⟳ ✓ ✕ ⚠ ⏸) + nombre + dato a la derecha (tamaño o duración real al terminar). |
| Barra de progreso | Determinada en descarga y separación; indeterminada en preparación, carga del modelo y guardado. Nunca retrocede visualmente (el main ya suaviza). |
| Tiempo restante | No se muestra durante los primeros 15 s de la fase determinada ("Calculando tiempo…"). Después: "quedan unos N minutos" (N ≥ 2, redondeado), "queda 1 minuto aprox.", "menos de 1 minuto". Si la estimación sube más de un 50 % se muestra igualmente (no se oculta), sin animar el cambio. Antes de empezar (en cola o cargando), se muestra una estimación previa basada en duración × perfil: "Tardará unos N minutos". |
| Modo · ⓘ | Texto "Modo Calidad" / "Modo Rápido". Tooltip/popover: "Shinobi Karaoke eligió este modo según tu equipo. Puedes cambiarlo en Ajustes." con enlace a Ajustes (spec 08). |
| Buscar la letra mientras tanto | Navega a la vista 05. La separación continúa. |
| Volver a la biblioteca | Navega a la Biblioteca. La separación continúa. |
| Cancelar separación | Diálogo `prog.dialogo.cancelar`, foco en "Seguir separando". Al confirmar, el paso vuelve a `pendiente` y la vista muestra el estado "Pendiente". |
| Cancelar descarga | Visible con la descarga en curso (fases `descargando`, `actualizando` o `preparando`) o en cola. En cola: retira sin diálogo. En curso: diálogo `prog.dialogo.cancelar.descarga`, foco en "Seguir descargando"; "Cancelar descarga" es destructivo. Al confirmar (o retirar de la cola), el paso `fuente` queda `pendiente`, **se conserva el borrador** con sus datos (y la letra, si ya se buscó) y la vista muestra "Descarga pendiente". No se elimina la canción: para quitarla está "Eliminar…" en la Biblioteca. El mismo diálogo se usa desde [✕] del panel de actividad y "Cancelar trabajo" del menú de la tarjeta. |
| Descargar ahora (descarga pendiente) | Encola la descarga con el mismo enlace; la vista pasa a "En cola" o "Descargando". Foco inicial en este botón. |
| Estado "Pendiente" (tras cancelar) | "La separación está pendiente." + primario "Separar ahora" + estimación previa. |
| Escuchar Voz / Instrumental | Reproductor mínimo en línea (▶/❚❚ + barra de posición). Solo uno suena a la vez. Permite comprobar el resultado antes de seguir. |
| Teclado | Foco inicial en "Buscar la letra mientras tanto" (o "Buscar la letra" al terminar). Esc = volver a la Biblioteca (no cancela). |
| Lector de pantalla | Anuncios: inicio de cada subpaso, 25/50/75 %, terminado, error. |

### Estados
| Estado | Presentación |
|--------|--------------|
| Vacío | No aplica (la vista solo existe si hay fuente). |
| En cola | Subpaso con ⏸ y texto de cola; botón "Cancelar" retira de la cola (sin diálogo). |
| Pendiente (fuente de YouTube) | Wireframe "Descarga pendiente": banner `info` (no `aviso`: lo decidió el usuario, no es un fallo). |
| Procesando | Wireframe principal. |
| Éxito | Wireframe "Terminado"; toast si el usuario está en otra vista (ver §3). |
| Error | El subpaso muestra ✕ y debajo un banner `error` con título, explicación y acciones (tabla de microcopy). Los reintentos automáticos (memoria, yt-dlp, red) **no** se muestran como error: el subpaso dice "Reintentando con un modo más ligero…" / "Actualizando el descargador y reintentando…" / "Reintentando en {n} s…". |
| Interrumpido | ⚠ + banner `aviso`: "La separación se interrumpió porque se cerró la aplicación. Hay que empezarla de nuevo." [Reintentar]. |
| Borrador | Siempre es borrador mientras se está en esta vista; la cabecera muestra "✎ Borrador · guardado". |

## 2. Panel de actividad (global)
Botón en la barra superior, visible solo si hay trabajos en curso o en cola: spinner `info` + "1 en curso" o "1 en curso · 2 en cola". Al pulsarlo se abre un panel desplegable (360 px):
```
┌──────────────────────────────────────────┐
│ Actividad                                │
│ ⟳ Bohemian Rhapsody — Separando 42 %     │
│   ███████░░░░░ quedan unos 3 min   [Ir] [✕]│
│ ⟳ La flaca — Descargando 80 %            │
│   █████████░░ menos de 1 min       [Ir] [✕]│
│ ⏸ Despacito — En cola para separar  [Ir] [✕]│
│ ⟳ Vivir mi vida — Actualizando el        │
│   descargador…  ░░▓▓▓░░░        [Ir] [✕]│
└──────────────────────────────────────────┘
```
- [Ir] abre la vista de progreso de esa canción. [✕] = cancelar (con el mismo diálogo de confirmación salvo para elementos en cola).
- Se cierra con Esc o clic fuera; el foco vuelve al botón. Navegable con flechas.
- Al terminar todos los trabajos, el botón muestra "✓ Terminado" 4 s y desaparece.

## 3. Cierre, interrupción y avisos
| Situación | Comportamiento |
|-----------|----------------|
| Un trabajo termina y el usuario está en otra vista de la app | Toast: "«{título}»: voz e instrumental separadas." [Abrir]. Si la canción ya cumple las condiciones para estar lista: "«{título}» ya se puede marcar como lista." [Abrir editor]. |
| Un trabajo termina o falla con la ventana sin foco o minimizada | **Windows y Linux**: notificación del sistema con el mismo texto que el toast (clic en ella = traer la ventana y abrir la canción) + parpadeo del botón en la barra de tareas. Si el escritorio no tiene servicio de notificaciones, solo el parpadeo. **macOS** (app sin firmar: las notificaciones nativas no funcionan): rebote del icono del Dock (una vez, informativo) + insignia numérica en el Dock con el número de avisos pendientes. En todos los SO, al volver a la ventana se muestra el toast y se borran la insignia y el parpadeo ([0005](../preguntas/0005-viabilidad-detalles-ux-fase-0.md) §9). |
| Un trabajo falla en segundo plano | Toast `error` persistente (no se cierra solo): "«{título}»: {título del error}." [Ver]. |
| Cerrar la app con trabajos activos o en cola | Diálogo modal: título "¿Cerrar Shinobi Karaoke?", texto "Hay {n} trabajo(s) sin terminar ({lista breve}). Si cierras ahora, se cancelarán y tendrás que repetirlos. Tu letra y tu estilo están guardados." [Seguir trabajando] (primario, con foco) [Cerrar de todos modos] (destructivo). |
| Reabrir tras cierre o fallo | Los pasos que estaban `en_curso` aparecen `interrumpido` en la tarjeta y en esta vista, con "Reintentar". No se reintenta automáticamente. |

## Microcopy
| Clave | Texto |
|-------|-------|
| `prog.titulo` | Separando la voz de la música |
| `prog.subtitulo` | Puedes seguir trabajando: esto continúa aunque cambies de pantalla. |
| `prog.sub.descargar` | Descargar de YouTube |
| `prog.sub.preparar` | Preparar el audio |
| `prog.sub.separar` | Separar voz e instrumental |
| `prog.fase.cargando` | Preparando la separación… |
| `prog.fase.separando` | Separando… {n} % |
| `prog.fase.guardando` | Guardando las pistas… |
| `prog.fase.descargando` | Descargando… {n} % · {x} MB de {y} MB |
| `prog.cola` | En cola: se separará cuando termine «{otra}». |
| `prog.cola.descarga` | En cola: se descargará cuando termine «{otra}». |
| `prog.cola.descarga.mantenimiento` | En cola: el descargador de YouTube se está actualizando. Empezará enseguida. |
| `prog.eta.calculando` | Calculando tiempo… |
| `prog.eta` | quedan unos {n} minutos · queda 1 minuto aprox. · menos de 1 minuto |
| `prog.eta.previa` | Tardará unos {n} minutos |
| `prog.modo.calidad` / `rapido` | Modo Calidad · Modo Rápido |
| `prog.modo.ayuda` | Shinobi Karaoke eligió este modo según tu equipo. Puedes cambiarlo en Ajustes. |
| `prog.mientras.titulo` | Mientras tanto… |
| `prog.mientras.cuerpo` | Busca la letra y empieza a sincronizarla con la canción original. |
| `prog.boton.letra` | Buscar la letra mientras tanto |
| `prog.boton.letra.fin` | Buscar la letra |
| `prog.boton.editor` | Ir al editor |
| `prog.boton.biblioteca` | Volver a la biblioteca |
| `prog.boton.cancelar` | Cancelar separación · Cancelar descarga |
| `prog.dialogo.cancelar` | ¿Cancelar la separación? Tendrás que volver a empezarla más tarde. La letra y lo que hayas sincronizado se conservan. — [Seguir separando] [Cancelar separación] |
| `prog.pendiente` | La separación está pendiente. — [Separar ahora] |
| `prog.dialogo.cancelar.descarga` | **¿Cancelar la descarga?** «{título}» se quedará en tu biblioteca como borrador, sin audio. Podrás descargarla de nuevo cuando quieras. — [Seguir descargando] [Cancelar descarga] |
| `prog.pendiente.descarga` | **Falta descargar el audio.** Cancelaste la descarga antes de que terminara. La canción sigue en tu biblioteca como borrador. — [Descargar ahora] |
| `prog.boton.descargar.ahora` | Descargar ahora |
| `prog.escuchar` | Escucha el resultado: Voz · Instrumental |
| `prog.reintento.memoria` | Reintentando con un modo más ligero… |
| `prog.reintento.ytdlp` | Actualizando el descargador de YouTube y reintentando… |
| `prog.reintento.red` | Reintentando en {n} s… |
| `prog.error.SIN_CONEXION` | **Sin conexión a internet.** La descarga se detuvo. Comprueba tu conexión. — [Reintentar] |
| `prog.error.SIN_ESPACIO` | **No queda espacio en el disco.** Libera espacio y vuelve a intentarlo. — [Reintentar] |
| `prog.error.MEMORIA_INSUFICIENTE` | **Tu equipo se quedó sin memoria.** Ya lo intentamos con un modo más ligero. Cierra otros programas y vuelve a intentarlo. — [Reintentar] |
| `prog.error.MODELO_NO_DISPONIBLE` | **Falta el modelo de separación.** Hay que descargarlo de nuevo (necesita conexión). — [Descargar y reintentar] |
| `prog.error.YOUTUBE_BLOQUEADO` | **YouTube no permite la descarga ahora mismo.** Inténtalo más tarde o usa un archivo de tu equipo. — [Reintentar] [Añadir desde un archivo] |
| `prog.error.generico` | **Algo salió mal al separar.** Vuelve a intentarlo. — [Reintentar] [Copiar detalles] |
| `prog.interrumpido` | La separación se interrumpió porque se cerró la aplicación. Hay que empezarla de nuevo. — [Reintentar] |
| `prog.toast.ok` | «{título}»: voz e instrumental separadas. — [Abrir] |
| `prog.toast.lista` | «{título}» ya se puede marcar como lista. — [Abrir editor] |
| `prog.toast.error` | «{título}»: {título del error}. — [Ver] |
| `act.boton` | {n} en curso · {m} en cola |
| `act.titulo` | Actividad |
| `act.terminado` | Terminado |
| `cierre.titulo` | ¿Cerrar Shinobi Karaoke? |
| `cierre.cuerpo` | Hay {n} trabajo(s) sin terminar ({lista}). Si cierras ahora, se cancelarán y tendrás que repetirlos. Tu letra y tu estilo están guardados. |
| `cierre.seguir` / `cierre.cerrar` | Seguir trabajando · Cerrar de todos modos |

## Criterios de aceptación
1. Tras confirmar la fuente se muestra esta vista con los subpasos aplicables (sin "Descargar de YouTube" en archivos locales) y su estado.
2. Las fases indeterminadas (preparar, cargar modelo, guardar) usan barra indeterminada con su texto; las determinadas muestran porcentaje y barra que nunca retrocede.
3. El tiempo restante muestra "Calculando tiempo…" los primeros 15 s de cada fase determinada y luego el texto redondeado de `prog.eta`; antes de empezar se muestra la estimación previa.
4. Con otra separación en marcha, la canción aparece "En cola" con el nombre de la canción que se está separando.
5. "Buscar la letra mientras tanto" y "Volver a la biblioteca" navegan sin interrumpir el trabajo; al volver a la vista, el progreso está actualizado.
6. "Cancelar" pide confirmación (salvo en cola); al confirmar, el paso queda "Pendiente" con "Separar ahora", y la letra/estilo de la canción no cambian.
7. Los reintentos automáticos se muestran como texto en el subpaso, no como error; solo el fallo definitivo muestra el banner de error con sus acciones.
8. Cada código de error (`SIN_CONEXION`, `SIN_ESPACIO`, `MEMORIA_INSUFICIENTE`, `MODELO_NO_DISPONIBLE`, `YOUTUBE_BLOQUEADO`, desconocido) muestra su texto y acciones de la tabla.
9. Al terminar, la vista muestra la duración real y permite escuchar voz e instrumental; el primario pasa a "Buscar la letra" o "Ir al editor" si ya hay letra.
10. Si el usuario está en otra vista al terminar o fallar un trabajo, aparece el toast correspondiente; los de error no se cierran solos.
10b. Con la ventana sin foco, al terminar o fallar un trabajo: en Windows/Linux se intenta la notificación del sistema y la barra de tareas parpadea; en macOS el icono del Dock rebota una vez y muestra una insignia con el número de avisos pendientes. Al volver a la ventana aparece el toast y la insignia/parpadeo desaparecen. Si la notificación falla, no se muestra ningún error al usuario.
11. El panel de actividad aparece solo con trabajos activos o en cola, lista cada trabajo con progreso, "Ir" y "Cancelar", y es navegable con teclado.
12. Cerrar la app con trabajos pendientes muestra el diálogo de cierre con el foco en "Seguir trabajando"; al reabrir, esos pasos aparecen como "Interrumpido" con "Reintentar".
13. La vista muestra el modo de separación (Calidad/Rápido) con la ayuda que enlaza a Ajustes.
14. Los lectores de pantalla reciben anuncios al iniciar cada subpaso, al 25/50/75 %, al terminar y en error.
15. "Cancelar descarga" con la descarga en curso abre `prog.dialogo.cancelar.descarga` con el foco en "Seguir descargando"; en cola retira sin diálogo. Al confirmar, la canción sigue en la Biblioteca como borrador con el paso `fuente` `pendiente`, sin audio, y la vista muestra "Descarga pendiente" con "Descargar ahora", que vuelve a encolar la descarga con el mismo enlace.
16. Una descarga que espera en la cola `ligera` muestra `prog.cola.descarga` con el título de la canción que se está descargando, o `prog.cola.descarga.mantenimiento` si espera a la actualización de yt-dlp.
17. Durante la actualización automática de yt-dlp tras un bloqueo, el subpaso "Descargar de YouTube" muestra `prog.reintento.ytdlp` con barra indeterminada, "Cancelar descarga" sigue disponible y el panel de actividad muestra "Actualizando el descargador…"; no se muestra ningún error ni se pregunta nada.
