# 02 — Biblioteca (vista inicial)

- Paso del pipeline: — (raíz) y 5 (estados borrador/lista)
- ADRs: [0006](../adr/0006-persistencia-y-modelo-de-datos.md), [0004](../adr/0004-separacion-voz-instrumental.md)
- Restricciones: [arquitectura.md "Restricciones e implicaciones para UX" §2–§3](../arquitectura.md)
- Sistema visual: [sistema-visual.md](sistema-visual.md)
- Preguntas: [0005](../preguntas/0005-viabilidad-detalles-ux-fase-0.md) §8 y [0006](../preguntas/0006-ajustes-specs-ux-tras-0005.md) §4 (lista incompleta; respondidas); [0007](../preguntas/0007-textos-y-comportamientos-de-ui-no-definidos-fase-1.md) (textos de la Fase 1; respondida) y [0008](../preguntas/0008-ajustes-ui-tras-revision-fase-1.md) (cambios tras la revisión visual); [0020](../preguntas/0020-huecos-ux-de-la-separacion-fase-3.md) (estados de separación de la Fase 3; respondida)
- Revisión visual de la Fase 1: [revision-fase-1/](revision-fase-1/README.md) (2026-11-04)
- 0.2.0, fase 3 (2026-11-09): agrupación por artista y álbum, búsqueda en álbum, selección múltiple con «Aplicar tema…», tema de artista y álbum y línea de tema en la tarjeta. Ver [Fase 3 · Temas y biblioteca](#fase-3-de-020--temas-y-biblioteca).
- 0.2.0, fase 4 (2026-11-11): abrir el reproductor en otra pantalla, panel «Cola de reproducción», controles de la sesión, cierre con cola y recuperación. Ver [Fase 4 de 0.2.0 — ventana secundaria y cola](#fase-4-de-020--ventana-secundaria-y-cola).

## Objetivo
Ver de un vistazo todas las canciones y su estado, **reproducir una canción lista con un clic**, retomar un borrador justo donde se quedó y empezar una canción nueva.

Usuario/tarea principal: "Quiero cantar X" (reproducir) o "Quiero terminar/crear un karaoke" (continuar / añadir).

## Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◆ Shinobi Karaoke                         [⟳ 1 en curso ▾]  [⚙]  [+ Añadir canción]│
├──────────────────────────────────────────────────────────────────────────────┤
│  Biblioteca                                                                  │
│  [ Todas 12 ] [ Listas 7 ] [ Borradores 5 ]          [🔍 Buscar título o artista ]│
│                                                                              │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐ ┌────…  │
│  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │░░░░░░░░░░░░░░░░░░░░│ │           │
│  │▓▓ Bohemian    ( ▶ )│ │▓▓  La flaca        │ │░░  Despacito       │ │           │
│  │▓▓ Rhapsody         │ │▓▓                  │ │░░                  │ │           │
│  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ │░░░░░░░░░░░░░░░░░░░░│ │           │
│  │ Bohemian Rhapsody  │ │ La flaca           │ │ Despacito          │ │           │
│  │ Queen · 5:55       │ │ Jarabe de Palo·4:31│ │ Luis Fonsi · 3:48  │ │           │
│  │ (✓ Lista)      [⋯] │ │ (✎ Borrador)   [⋯] │ │ (✎ Borrador)   [⋯] │ │           │
│  │                    │ │ ⟳ Separando 42 %   │ │ ⚠ Interrumpido     │ │           │
│  │ [▶ Reproducir]     │ │ ███████░░░ 3 min   │ │ [Reintentar]       │ │           │
│  └────────────────────┘ │ [Continuar]        │ └────────────────────┘ │           │
│                         └────────────────────┘                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```
- Rejilla de tarjetas: `repeat(auto-fill, minmax(240px, 1fr))`, separación 24 px. 4 columnas a 1280 px, 3 a 1024 px.
- Orden: **modificadas más recientemente primero** (`modificada` desc). Sin otras ordenaciones en el MVP.

### Anatomía de la tarjeta
```
┌──────────────────────────┐
│ PORTADA 16:9             │  ← fondo del estilo de la canción (sólido/degradado)
│   Título en la fuente    │     + título en su fuente y color de letra.
│   de la canción   ( ▶ )  │     Si es de YouTube y aún no tiene estilo propio:
│                          │     miniatura con velo oscuro. ( ▶ ) solo si Lista.
├──────────────────────────┤
│ Título (t-subtitulo, 1 línea, …) │
│ Artista · duración (texto-2)     │
│ [insignia estado]          [⋯]   │
│ línea de paso / progreso         │  ← Borrador; en Lista solo si está incompleta
│ [acción principal]               │
└──────────────────────────┘
```

## Componentes e interacciones

| Elemento | Comportamiento |
|----------|----------------|
| **+ Añadir canción** (primario, barra superior) | Abre la vista 03. Atajo Ctrl/Cmd+N. |
| **Filtros** (control segmentado) | Todas / Listas / Borradores, con recuento. Persisten durante la sesión (la búsqueda, no: se vacía al volver a la vista; salir del reproductor no cuenta como volver, porque la Biblioteca se queda debajo y conserva la búsqueda). Las canciones **Dañadas** solo aparecen en *Todas* (no cuentan en Listas ni en Borradores); las listas incompletas cuentan en *Listas*. |
| **Buscar** | Filtra en vivo por título y artista (sin distinguir mayúsculas ni tildes: "cancion" encuentra "Canción"). Ctrl/Cmd+F enfoca. Esc vacía el campo. |
| **Tarjeta — clic en la portada / Intro con la tarjeta enfocada** | Lista → **Reproductor** (spec 07) directamente. Borrador → acción "Continuar". Dañada → abre el menú de recuperación. |
| **▶ Reproducir** (botón de la tarjeta Lista y botón redondo superpuesto en la portada al pasar el ratón/enfocar) | Abre el reproductor a pantalla completa y empieza a sonar sin más pasos (spec 07 §"Entrada"; si la primera línea entra antes de 6 s, tras un breve silencio con la pantalla de título). La Biblioteca se queda debajo: al salir del reproductor se conservan filtro, búsqueda y desplazamiento, y el foco vuelve a la tarjeta. Lo mismo hacen *Reproducir* del menú ⋯ y [▶ Reproducir] del toast `bib.toast.lista`. |
| **Continuar** (Borrador) | Abre la vista del paso actual (tabla de [00-mapa-de-vistas §3](00-mapa-de-vistas.md)). |
| **Reintentar** (Borrador con paso en error o interrumpido) | Relanza el trabajo del paso (fuente o separación) sin salir de la biblioteca; la tarjeta pasa a "En cola"/"En curso". También hay "Continuar" en el menú ⋯. |
| **⋯ Menú de la tarjeta** | Lista: *Reproducir*, *Editar* (abre Editor), *Editar datos* (título/artista/álbum, diálogo), *Volver a borrador*, *Mostrar en la carpeta*, *Eliminar…*. Borrador: *Continuar*, *Editar datos*, *Cancelar trabajo* (si hay uno en curso o en cola), *Mostrar en la carpeta*, *Eliminar…*. Dañada: *Re-separar pistas* (si solo faltan pistas), *Mostrar en la carpeta*, *Eliminar…*. Abre también con la tecla Menú o Mayús+F10 sobre la tarjeta. |
| **Volver a borrador** | Diálogo: "¿Volver a borrador? «{título}» dejará de poder reproducirse hasta que la marques como lista otra vez. No se pierde nada." [Cancelar] [Volver a borrador]. |
| **Eliminar…** | Diálogo: "¿Eliminar «{título}»? Se moverá a la papelera de tu sistema, con sus pistas y su letra. Podrás recuperarla desde allí." [Cancelar] [Eliminar] (destructivo). Si hay un trabajo en curso, el texto añade "Se cancelará la separación en curso.". Tras eliminar: toast "«{título}» se movió a la papelera." |
| **Mostrar en la carpeta** | Abre la carpeta de la canción en el explorador del sistema. |
| **Indicador de actividad** (barra superior) | Ver spec 04 §"Panel de actividad". |
| **Teclado en la rejilla** | La rejilla es un único punto de tabulación (`role="grid"` o lista con *roving tabindex*): flechas mueven entre tarjetas; Intro = acción de la portada; Espacio = acción principal visible (Reproducir/Continuar/Reintentar); tecla Menú = ⋯; Supr = Eliminar… |
| **Actualizaciones en vivo** | Las tarjetas reflejan los eventos `cancion:cambiada` y `trabajo:progreso` sin recargar ni mover el foco. Una canción que cambia de estado **no** se reordena hasta que el usuario sale y vuelve a la vista (para no mover tarjetas bajo el cursor). |

### Línea de paso de un borrador (bajo la insignia)
Se muestra el **primer paso no completado** con prioridad para trabajos activos y problemas:
| Situación | Texto | Extra |
|-----------|-------|-------|
| Descargando de YouTube | ⟳ Descargando 63 % | barra + tiempo |
| Preparando el audio | ⟳ Preparando el audio… | barra indeterminada |
| Descargando: actualizando el descargador tras un bloqueo (fase `actualizando`) | ⟳ Actualizando el descargador… | barra indeterminada |
| Descarga en cola (trabajo vivo) | 🕒 En cola para descargar | — |
| Separación en cola (trabajo vivo) | 🕒 En cola para separar | — |
| Fuente pendiente **sin** trabajo vivo, archivo local | Falta preparar el audio | botón Continuar |
| Fuente pendiente **sin** trabajo vivo, YouTube (descarga cancelada) | Falta descargar el audio | botón Continuar (abre la spec 03, wireframe E) |
| Separación pendiente **sin** trabajo vivo | Falta separar las pistas | botón Continuar |
| Separación descargando el modelo (fase `descargando_modelo`, [0020](../preguntas/0020-huecos-ux-de-la-separacion-fase-3.md) §2) | ⟳ Descargando el modelo 34 % | barra determinada, sin tiempo |
| Separación cargando modelo | ⟳ Preparando la separación… | barra indeterminada |
| Separación: reintento automático por memoria | ⟳ Reintentando la separación… | barra indeterminada |
| Descarga de YouTube: espera antes de un reintento de red (0020 §4) | ⟳ Reintentando en {n} s… | sin barra; la cuenta atrás se actualiza cada segundo |
| Separando | ⟳ Separando 42 % · quedan unos 3 min | barra |

Tiempo restante en la tarjeta (`bib.eta`, forma corta): «quedan unos {n} min» (n ≥ 2) · «queda alrededor de 1 min» · «queda menos de 1 min». Sin estimación todavía no se muestra tiempo. «En cola» y los estados ⟳ (color `info`) **solo** con un trabajo vivo en el gestor; un paso `pendiente` persistido sin trabajo se muestra como «Falta …» en `texto-2` sin icono. El icono de «en cola» es `clock` (no ⏸, que sugiere una pausa del usuario).
| Error de fuente o separación | ✕ {título del error} | botón Reintentar (o "Ver" si no es reintentable; p. ej. `RUNTIME_NO_DISPONIBLE` siempre muestra "Ver", spec 04) |
| Interrumpido | ⚠ Interrumpido | botón Reintentar |
| Sin letra | Falta la letra | botón Continuar |
| Letra sin sincronizar del todo | Faltan {n} líneas por sincronizar | botón Continuar |
| Todo hecho salvo marcar | Lista para revisar | botón Continuar |

Si hay un trabajo activo **y** falta letra/sincronía, se muestra el trabajo activo (es lo que cambia). Con `n = 1` se usa el singular: "Falta 1 línea por sincronizar" (`bib.paso.sincronia`). Las pausas (♪) nunca cuentan en `n`.

### Lista incompleta
Una canción `lista` en la que, tras editarla, hay líneas (no pausas) sin tiempo de inicio. **Sigue siendo Lista** (el estado guardado no cambia solo; el indicador `incompleta` se deriva, ADR 0006). Si lo que falta son las pistas, no es "incompleta" sino **Dañada**.
```
│ Bohemian Rhapsody                │
│ Queen · 5:55                     │
│ (✓ Lista)                   [⋯]  │
│ ⚠ Faltan 3 líneas por sincronizar│  ← t-pequeno, color `aviso`, icono alert-triangle 16 px
│ [▶ Reproducir]                   │
```
- Insignia **"✓ Lista"** sin cambios (es lista y se puede cantar) y cuenta en el filtro *Listas*.
- Línea de aviso bajo la insignia: `bib.lista.incompleta` con icono ⚠ en `aviso` (icono + texto: no depende solo del color). Es informativa, no es un botón.
- Acción principal **"▶ Reproducir"** y botón redondo de la portada **sin cambios**: reproducir funciona (el reproductor omite esas líneas y lo avisa, spec 07).
- Para arreglarlo: *Editar* del menú ⋯ (abre el Editor, que muestra el popover de lo que falta en "Hecho", spec 06). No se añade un segundo botón a la tarjeta.
- Lectores de pantalla: `bib.aria.tarjeta` con estado "Lista" y línea de paso = texto del aviso.

## Estados

| Estado | Presentación |
|--------|--------------|
| **Vacío** (sin canciones) | Centrado en el área de contenido: icono de micrófono/shuriken 64 px en `texto-3`, título `t-display` "Tu biblioteca está vacía", texto "Añade tu primera canción desde un archivo de tu ordenador o un enlace de YouTube. Shinobi Karaoke separará la voz para que puedas cantar encima.", botón primario grande "Añadir canción" (el de la barra superior se oculta en este estado para no duplicar primarios), y nota `texto-3`: "Formatos: MP3, M4A, FLAC, WAV, OGG, y también vídeos MP4, MKV, MOV o WebM." Arrastrar un archivo sobre la ventana abre la vista 03 con ese archivo. |
| **Sin resultados** (filtro/búsqueda) | Con texto en *Todas*: `bib.sinresultados` + botón fantasma "Borrar búsqueda". Con texto en *Listas* / *Borradores*: `bib.sinresultados.listas` / `bib.sinresultados.borradores` + "Borrar búsqueda" + botón fantasma "Ver todas" (pasa a *Todas* conservando el texto). Sin texto, filtro *Listas* vacío: `bib.sinlistas`; filtro *Borradores* vacío: `bib.sinborradores`. |
| **Cargando** | Al abrir la app, el escaneo de `biblioteca/` (< 1 s esperado): 4 tarjetas esqueleto con brillo suave (estático con movimiento reducido). Si tarda > 3 s: texto "Cargando tu biblioteca…". |
| **Procesando** | Tarjetas con línea de paso y barra (tabla anterior). |
| **Error de canción** | Insignia ✕ Error en `error`, línea con el título del error y Reintentar. |
| **Interrumpido** | Insignia ✎ Borrador + línea ⚠ Interrumpido (aviso) + Reintentar. |
| **Dañada** | Portada gris `fondo-2` con icono de alerta; si `cancion.json` no se pudo leer, el título es `bib.danada.sintitulo` («Canción sin nombre»; nunca el id de la carpeta) y no hay línea de artista; insignia "✕ Dañada"; línea: "No se puede abrir esta canción" (json ilegible) o "Faltan las pistas separadas" (pistas borradas). Acciones según menú ⋯. |
| **Borrador** | Insignia `aviso` con contorno "✎ Borrador". Portada con estilo actual (o predeterminado). Botón "Continuar". |
| **Lista** | Insignia `exito` "✓ Lista". Botón "▶ Reproducir" (secundario con icono; en la portada, botón redondo 48 px). |
| **Lista incompleta** | Como Lista + línea `aviso` "⚠ Faltan {n} líneas por sincronizar" (§"Lista incompleta"). |
| **Éxito tras marcar como lista** | Al volver del editor, la tarjeta recibe el foco, se desplaza hasta quedar visible, se resalta durante 2 s (borde 2 px `exito`; sin transición con movimiento reducido) y aparece el toast "«{título}» está lista para cantar. [▶ Reproducir]". Si el filtro activo la ocultaría (*Borradores*), el filtro pasa a *Todas*. Detalle en spec 06 §"Volver a la Biblioteca". |
| **Vuelta desde el reproductor** | Filtro, búsqueda y desplazamiento como estaban; foco en la tarjeta; sin toast. Los toasts que llegaron mientras se cantaba aparecen ahora (spec 07 §"Salida"). |
| **Vuelta desde el editor** | Borrador con cambios en esa visita: toast `edi.toast.borrador` ("Borrador guardado."). "Hecho" en una Lista: tarjeta enfocada, sin resalte ni toast. Spec 06. |
| **Lista recién eliminada** | Toast con el nombre; no hay "deshacer" en la app (se recupera desde la papelera del sistema). |

## Microcopy
| Clave | Texto |
|-------|-------|
| `bib.titulo` | Biblioteca |
| `bib.boton.anadir` | Añadir canción |
| `bib.filtro` | Todas · Listas · Borradores |
| `bib.buscar` | Buscar título o artista |
| `bib.vacia.titulo` | Tu biblioteca está vacía |
| `bib.vacia.cuerpo` | Añade tu primera canción desde un archivo de tu ordenador o un enlace de YouTube. Shinobi Karaoke separará la voz para que puedas cantar encima. |
| `bib.vacia.formatos` | Formatos: MP3, M4A, FLAC, WAV, OGG, y también vídeos MP4, MKV, MOV o WebM. |
| `bib.sinresultados` | No hay canciones que coincidan con «{texto}». |
| `bib.sinresultados.listas` | No hay canciones listas que coincidan con «{texto}». |
| `bib.sinresultados.borradores` | No hay borradores que coincidan con «{texto}». |
| `bib.vertodas` | Ver todas |
| `bib.sinlistas` | Aún no tienes canciones listas. Termina un borrador y márcalo como lista para poder cantarlo aquí. |
| `bib.sinborradores` | No tienes borradores. Las canciones que añadas aparecerán aquí hasta que las marques como listas. |
| `bib.cargando` | Cargando tu biblioteca… |
| `bib.error.listar` | No se pudo cargar tu biblioteca. [Reintentar] |
| `bib.toast.noabre` | No se pudo abrir la canción. |
| `bib.estado.lista` | Lista |
| `bib.estado.borrador` | Borrador |
| `bib.estado.danada` | Dañada |
| `bib.accion.reproducir` | Reproducir |
| `bib.accion.continuar` | Continuar |
| `bib.accion.reintentar` | Reintentar |
| `bib.menu` | Reproducir · Editar · Editar datos · Volver a borrador · Cancelar trabajo · Re-separar pistas · Mostrar en la carpeta · Eliminar… |
| `bib.paso.*` | ver tabla "Línea de paso" |
| `bib.paso.sincronia` | Faltan {n} líneas por sincronizar · (n = 1) Falta 1 línea por sincronizar |
| `bib.lista.incompleta` | ⚠ Faltan {n} líneas por sincronizar · (n = 1) ⚠ Falta 1 línea por sincronizar |
| `bib.danada.json` | No se puede abrir esta canción |
| `bib.danada.pistas` | Faltan las pistas separadas |
| `bib.danada.sintitulo` | Canción sin nombre |
| `bib.paso.cola.descarga` | En cola para descargar |
| `bib.paso.cola.separacion` | En cola para separar |
| `bib.paso.falta.fuente` | Falta preparar el audio |
| `bib.paso.falta.descarga` | Falta descargar el audio |
| `bib.paso.actualizando` | Actualizando el descargador… |
| `bib.paso.falta.separacion` | Falta separar las pistas |
| `bib.paso.modelo` | Descargando el modelo {n} % |
| `bib.paso.reintento.memoria` | Reintentando la separación… |
| `bib.paso.reintento.red` | Reintentando en {n} s… |
| `bib.eta` | quedan unos {n} min · queda alrededor de 1 min · queda menos de 1 min |
| `bib.dialogo.eliminar` | ¿Eliminar «{título}»? Se moverá a la papelera de tu sistema, con sus pistas y su letra. Podrás recuperarla desde allí. |
| `bib.dialogo.eliminar.trabajo` | (se añade al texto de eliminar) Se cancelará la separación en curso. · Se cancelará la descarga en curso. |
| `bib.datos.titulo` | Editar datos · campos: Título · Artista · Álbum (opcional) · [Cancelar] [Guardar] |
| `bib.datos.error.titulo` | Escribe un título. |
| `bib.arrastrar.varios` | Añade las canciones de una en una. (= `add.varios`) |
| `bib.arrastrar.noadmitido` | Ese tipo de archivo no se puede usar. Prueba con un archivo de audio o de vídeo. |
| `bib.toast.errorgenerico` | {título del error de 00 §7} [Copiar detalles] |
| `bib.dialogo.borrador` | ¿Volver a borrador? «{título}» dejará de poder reproducirse hasta que la marques como lista otra vez. No se pierde nada. |
| `bib.toast.lista` | «{título}» está lista para cantar. — [▶ Reproducir] |
| `bib.toast.eliminada` | «{título}» se movió a la papelera. |
| `bib.aria.tarjeta` | {título}, {artista}, {estado}. {línea de paso}. |
| `act.boton` | {n} en curso · {n} en curso · {m} en cola · {m} en cola (solo trabajos en cola) |
| `act.terminado` | ✓ Terminado (4 s, solo si alguno terminó bien) |

Revisión 2026-11-04 de los textos escritos en las tareas 0019/0020 sin estar en la spec: **aprobados** «No se pudo cargar tu biblioteca.» + Reintentar, «No se pudo abrir la canción.», «Escribe un título.», «Se cancelará la descarga en curso.», «{m} en cola», «✓ Terminado», no mostrar toast tras «Volver a borrador» y Dañadas solo en *Todas*. **Corregidos**: «No hay canciones que coincidan con el filtro.» → `bib.sinborradores`; «Ese archivo no es de audio ni de vídeo admitido.» → `bib.arrastrar.noadmitido`; «queda 1 min aprox.» / «menos de 1 min» → `bib.eta`; fuente en cola «En cola» → «En cola para descargar»; «En cola para separar» / «Preparando el audio…» sin trabajo vivo → «Falta separar las pistas» / «Falta preparar el audio»; etiqueta «Álbum» → «Álbum (opcional)».

## Criterios de aceptación
1. Al abrir la app con la instalación completa se muestra la Biblioteca con todas las canciones de `biblioteca/`, ordenadas por fecha de modificación descendente.
2. Cada tarjeta muestra título, artista, duración (m:ss), insignia de estado con icono y texto (Lista / Borrador / Dañada) y, en borradores, la línea de paso según la tabla (singular con n = 1; las pausas no cuentan).
2b. Una canción Lista con líneas sin inicio (indicador derivado `incompleta`) mantiene la insignia "✓ Lista", el botón "▶ Reproducir" y su sitio en el filtro *Listas*, y muestra la línea `bib.lista.incompleta` en color `aviso` con icono; al sincronizar todas las líneas la línea desaparece en vivo.
3. En una canción Lista, un único clic en la portada, en "Reproducir" (tarjeta, menú ⋯ o toast `bib.toast.lista`) o Intro con la tarjeta enfocada abre el reproductor a pantalla completa con su pantalla de título en < 200 ms y el instrumental suena en < 1 s (más el silencio previo si la primera línea entra antes de 6 s; spec 07, criterios 1, 2 y 6). Al salir del reproductor se conservan filtro, búsqueda y desplazamiento y el foco está en la tarjeta; si el reproductor no encontró el instrumental, la tarjeta ya aparece como Dañada (spec 07, criterio 22).
4. En un borrador, "Continuar" abre la vista del paso actual según la tabla de [00-mapa-de-vistas §3](00-mapa-de-vistas.md).
5. Las tarjetas con trabajos activos actualizan porcentaje y tiempo restante en vivo (≥ 1 vez cada 2 s) sin mover el foco ni reordenarse.
6. Un borrador con un paso `error` o `interrumpido` muestra el aviso y un botón "Reintentar" que relanza el trabajo desde la propia biblioteca.
7. Una canción con `cancion.json` ilegible (y sin `.bak` válido) o sin pistas tras haberlas tenido se muestra como "Dañada" con las acciones del menú indicadas, y no rompe la carga del resto.
8. Sin canciones, se muestra el estado vacío con un único botón primario "Añadir canción" que abre la vista 03.
9. Arrastrar un archivo de audio o vídeo sobre la ventana abre la vista 03 con ese archivo ya seleccionado.
10. Filtros y búsqueda reducen las tarjetas en vivo; la búsqueda ignora mayúsculas y tildes; con 0 resultados aparece el mensaje correspondiente.
11. "Eliminar…" pide confirmación y mueve la carpeta de la canción a la papelera del sistema; si había un trabajo en curso, lo cancela antes.
12. "Volver a borrador" pide confirmación y cambia el estado a borrador sin modificar letra, estilo ni pistas.
13. Toda la vista es operable con teclado: rejilla navegable con flechas, Intro/Espacio para acciones, tecla Menú o Mayús+F10 para ⋯, Supr para eliminar; foco visible según sistema visual.
14. Cada tarjeta expone a lectores de pantalla el texto `bib.aria.tarjeta`.
15. La portada usa el estilo de la canción (fondo + fuente + color de letra) o, en canciones de YouTube sin estilo modificado (estilo igual al predeterminado de fábrica **o** al predeterminado vigente del usuario; deja de valer en cuanto se edita en el Editor), la miniatura con velo `rgba(0,0,0,0.5)` y el título en `texto-1`.
16. Un borrador de YouTube con la fuente `pendiente` y sin trabajo vivo muestra «Falta descargar el audio» en `texto-2` sin icono y "Continuar", que abre el paso 1 (spec 03, wireframe E); durante la actualización automática de yt-dlp la línea de paso es «⟳ Actualizando el descargador…» con barra indeterminada ([0013](../preguntas/0013-huecos-ux-de-la-fase-2.md) §1, §4).
17. Una canción de YouTube sin `fuente/miniatura.jpg` (o cuya miniatura no carga) usa la portada del estilo como cualquier otra canción, sin marcador ni aviso.
18. Durante la fase `descargando_modelo` de una separación, la tarjeta muestra `bib.paso.modelo` con barra determinada; durante un reintento automático por memoria, `bib.paso.reintento.memoria`; durante la espera de un reintento de red de una descarga, `bib.paso.reintento.red` con la cuenta atrás. Ninguno se muestra como error. "Re-separar pistas" sigue disponible **solo** en canciones Dañadas sin pistas: no se ofrece para canciones separadas con el modelo Rápido ([0020](../preguntas/0020-huecos-ux-de-la-separacion-fase-3.md) §3).

## Fase 3 de 0.2.0 · Temas y biblioteca

Origen: [plan, fase 3, features 5 y 6](../versiones/0.2.0/plan-2.md#fase-3--temas-y-biblioteca) y [0047](../preguntas/0047-temas-asignados-edicion-y-borrado.md). Identidad de artista y álbum, índice y resolución de temas: [ADR 0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md); detalles acordados en [0054](../preguntas/0054-detalles-de-interfaz-de-temas-y-biblioteca.md). Conceptos de tema, procedencia, diálogos de nombre, impacto y eliminación: [Editor · Fase 3](06-editor.md#fase-3-de-020--temas-y-biblioteca). Esta sección **amplía** la vista; lo no mencionado sigue igual.

**Sustituye**: la fila «Buscar» de «Componentes e interacciones», la clave `bib.buscar`, la anatomía de la tarjeta (se añade una línea), el criterio 15 (portada de YouTube) y la frase del criterio 10 «la búsqueda ignora mayúsculas y tildes» (ahora también busca en álbum).

### Barra de herramientas
```
≥ 1280 px (una fila)
│ Biblioteca                                                                                 │
│ [Todas 12|Listas 7|Borradores 5]  Agrupar por [Sin agrupar|Artista|Álbum]  [☑ Seleccionar]  [🔍 Buscar título, artista o álbum] │

< 1280 px (dos filas)
│ [Todas 12|Listas 7|Borradores 5]                     [🔍 Buscar título, artista o álbum] │
│ Agrupar por [Sin agrupar|Artista|Álbum]                                [☑ Seleccionar] │
```
| Elemento | Comportamiento |
|---|---|
| **Agrupar por** (control segmentado con etiqueta visible) | «Sin agrupar» (la rejilla actual), «Artista», «Álbum». Se **guarda como preferencia global** (sobrevive al reinicio, como los tamaños de paneles del editor) en `config.biblioteca.agrupar` (`"ninguno"` = Sin agrupar, `"artista"`, `"album"`) con `config.actualizar` al cambiarlo; por defecto, o si el valor guardado no es válido, «Sin agrupar». Si la escritura falla, la vista agrupa igual durante la sesión, sin aviso. El plegado de grupos no se guarda. Se combina con filtro y búsqueda. |
| **Buscar** | Placeholder y nombre `bib.buscar` («Buscar título, artista o álbum»). Comparación **flexible**: sin distinguir mayúsculas ni tildes, con espacios colapsados («queen   greatest» encuentra «Queen · Greatest Hits»); cada palabra de la consulta debe aparecer en título, artista o álbum (en cualquiera de los tres). Se combina con el filtro de estado y con la agrupación. Ctrl/Cmd + F y Esc como hoy. La identidad de los grupos es estricta (ver «Grupos»); la búsqueda no. |
| **Seleccionar** | Botón secundario con icono `square-check`. Entra en el modo selección (ver «Selección múltiple»). Con el modo activo se sustituye por la barra de selección. No aparece en el estado vacío. |
| **Recuento anunciado** | Tras cambiar búsqueda, filtro o agrupación, una región `role="status"` (solo lectores de pantalla) anuncia `bib.anuncio.resultados` con 500 ms de espera tras la última tecla. |

### Grupos

**Por artista**
```
│ ▾ Queen  ·  7 canciones                 Tema del artista: Neón   [Tema…]  │  h2 + controles
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                                          │
│ │ card │ │ card │ │ card │ │ card │   (rejilla igual que «Sin agrupar»)      │
│ └──────┘ └──────┘ └──────┘ └──────┘                                          │
│ ▾ Jarabe de Palo  ·  2 canciones        Sin tema de artista      [Tema…]  │
│ …                                                                          │
│ ▾ Sin artista  ·  3 canciones           Añade el artista con «Editar datos» para darles un tema. │
```

**Por álbum**
```
│ ▾ A Night at the Opera — Queen  ·  4 canciones   Tema del álbum: Noche ninja  [Tema…] │
│ ▾ Greatest Hits — ABBA  ·  3 canciones           Sin tema de álbum            [Tema…] │
│ ▾ Greatest Hits — Queen  ·  2 canciones          Sin tema de álbum            [Tema…] │  ← homónimo separado
│ ▾ Greatest Hits — Sin artista  ·  1 canción      Añade el artista para darle un tema. │
│ ▾ Sin álbum  ·  5 canciones                                                          │
```

| Aspecto | Regla |
|---|---|
| Identidad | La da main (ADR 0016): Unicode NFC, espacios recortados y colapsados y sin distinguir mayúsculas, **conservando tildes** («Canción» y «Cancion» son grupos distintos; «QUEEN» y «Queen» el mismo). El álbum pertenece a su artista: dos álbumes con el mismo nombre y distinto artista son **dos grupos**. |
| Nombre visible | La grafía de la canción del grupo modificada más recientemente (estable mientras no se edite otra; [0054](../preguntas/0054-detalles-de-interfaz-de-temas-y-biblioteca.md) §4). Para unificarla, se corrige con «Editar datos». |
| Orden de grupos | Alfabético por nombre visible (comparación del idioma, sin distinguir mayúsculas ni tildes). En «Álbum», por artista y luego por álbum. «Sin artista» y «Sin álbum» al final. |
| Orden dentro del grupo | El de siempre: modificadas más recientemente primero. |
| Metadatos ausentes | «Sin artista» (vista por artista) y «Sin álbum» (vista por álbum, un único grupo con canciones de cualquier artista; la tarjeta ya muestra el artista). Un álbum con nombre y sin artista forma su grupo «{álbum} — Sin artista». Son **agrupaciones visuales**: no admiten tema (sin botón «Tema…», con el texto `bib.grupo.sinTema.*`). |
| Encabezado | `h2` con botón plegable (chevron, `aria-expanded`, `aria-controls`) que incluye nombre y recuento; a la derecha, el tema del grupo (`bib.grupo.tema` o `bib.grupo.sinTemaPropio`) y [Tema…]. Con búsqueda o filtro activos, el recuento es «{v} de {n} canciones». |
| Plegado | Por grupo, solo durante la sesión (al reiniciar, todo desplegado). Plegar no cambia la selección. Un grupo plegado conserva su encabezado. |
| Con búsqueda o filtro | Solo aparecen los grupos con alguna coincidencia. Si no hay ninguna, el mensaje de «Sin resultados» de siempre (no hay mensajes por grupo). |
| Tema del grupo en borrado pendiente | Las asignaciones de grupo siempre apuntan a temas existentes (ADR 0016 §3). Si su tema está en borrado pendiente, el encabezado lo dice con `bib.grupo.temaBorrando` (icono ⚠, `aviso`) y [Tema…] permite elegir otro. |

### Tema de un artista o de un álbum

Se asigna desde [Tema…] del encabezado del grupo (y, con el mismo diálogo, desde «Tema del álbum…» / «Tema del artista…» del editor).

```
┌ Tema del álbum «A Night at the Opera» de Queen ───────┐
│ Tema                                                  │
│ [▣ Noche ninja                                  ▾ ]   │  primera opción: «Sin tema de álbum»
│                                                       │
│ Cambiará el aspecto de 3 de sus 4 canciones.          │  se recalcula al cambiar la opción
│ 1 no cambia porque tiene tema personalizado o         │
│ asignado.                                             │
│ [▸ Ver las canciones]                                 │
│ Las canciones que añadas a este álbum también lo      │
│ usarán.                                               │
│                                  [Cancelar] [Aplicar] │
└───────────────────────────────────────────────────────┘
```
- La primera opción es «Sin tema de álbum (usar el del artista o el predeterminado)» / «Sin tema de artista (usar el predeterminado)». Elegirla **quita** la asignación del grupo; el recuento dice cuántas cambiarán y a qué pasan («Pasarán a usar «Neón», del artista»). Cada canción vuelve a lo que le da el nivel siguiente, que puede ser distinto en cada una (su base «al azar» o «predeterminado anterior», el predeterminado o el estilo incluido; el `despues` de cada afectada en `ImpactoIpc`). Si no todas van al mismo destino, se usa la variante «destinos distintos» de `bib.grupo.impacto` y la lista revelable muestra el destino de cada una.
- **Destino `respaldo`** ([0056](../preguntas/0056-destino-respaldo-y-canciones-pendientes.md)): una canción cuya base («al azar» o «predeterminado anterior») apunta a un tema que no está en el catálogo pasará a «Tema no disponible». Su fila de la lista usa la variante «destino no disponible» de `bib.grupo.impacto` (con ⚠ en `aviso`; no se nombra ningún tema, aunque `despues.temaNombre` venga relleno). Si **todas** las afectadas van a `respaldo`, el texto principal usa la variante «quitar, todas no disponibles». Si solo van algunas, se usa el texto que toque («quitar» o «destinos distintos») y debajo se añade la línea `bib.grupo.impacto.noDisponible` con ⚠. No cambia el botón ni el foco inicial: quitar el tema del grupo sigue siendo reversible desde el mismo diálogo.
- La asignación del grupo **no** toca canciones con tema personalizado ni con tema asignado; en «Artista», tampoco las canciones cuyo álbum tiene tema. El texto de exclusión enumera la causa real (`bib.grupo.excluidas`).
- Con 0 canciones afectadas: `bib.grupo.ninguna`. El botón «Aplicar» sigue disponible (la asignación vale para canciones futuras del grupo).
- Foco inicial en el selector; «Aplicar» es el botón principal del diálogo (asignar a un grupo es reversible desde el mismo diálogo y su alcance se ve antes de confirmar). Confirmación obsoleta, error de escritura y tema inexistente: como en el editor (`tema.obsoleto`, `tema.toast.error`, `tema.error.noExiste`).
- Tras aplicar: toast `bib.grupo.toast`, el encabezado muestra el tema nuevo y las tarjetas afectadas actualizan portada y línea de tema en vivo sin moverse. Foco de vuelta en [Tema…].
- No entra en ningún historial de deshacer.

### Tarjeta: tema y portada

Anatomía con la línea nueva:
```
│ Título (t-subtitulo)             │
│ Artista · duración (texto-2)     │
│ ◐ Neón · del artista (texto-3)   │  ← línea de tema, t-pequeno, una línea con «…»
│ [insignia estado]          [⋯]   │
```
- Texto: `bib.tarjeta.tema` con el nombre del tema y su procedencia corta (`tema.origen.corta.*`); «◐ Tema personalizado»; «◐ Estilo incluido»; con tema no disponible, «⚠ Tema no disponible» (icono `aviso`, texto `texto-3`). Icono `palette` 14 px. Se añade al final de `bib.aria.tarjeta`.
- Procedencia corta (`tema.origen.corta.*`, spec 06): del álbum · del artista · predeterminado · al azar · predeterminado anterior · incluido; con tema asignado a la canción, «propio». Ejemplo: «◐ Noche ninja · predeterminado anterior». Si no cabe, se corta con «…» y el texto completo va en `title` y en el nombre accesible.
- **Portada** (sustituye al criterio 15): usa siempre el aspecto efectivo de la canción. Una canción de YouTube muestra su miniatura con velo **solo** mientras su apariencia es **neutra** (nadie eligió nada para ella, su álbum ni su artista): procedencia «Tema predeterminado», «Elegido al azar», «Tema predeterminado anterior» o «Estilo incluido». En cuanto tiene tema asignado, personalizado, o tema de álbum o artista, la portada usa el estilo; también con «Tema no disponible». Una canción de 0.1.0 personalizada cuyo estilo era igual al predeterminado de fábrica o al del usuario conserva la miniatura hasta que se edite su estilo (compatibilidad con la regla anterior). La decisión la da main en `apariencia.neutra` del resumen ([ADR 0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §3 y §9): el renderer la usa tal cual (`miniatura` presente y `neutra` → miniatura; si no, estilo resuelto) y no compara estilos ni lee `config.estilo_predeterminado`. Así, quitar el predeterminado en Ajustes no cambia ninguna portada.
- Menú ⋯ de Lista y Borrador: se añade «Aplicar tema…» tras «Editar datos». Abre el diálogo de «Aplicar tema» con esa sola canción.

### Editar datos

- El diálogo es el mismo (`bib.datos.titulo`). Al guardar un cambio de artista o álbum, la tarjeta **se mueve en ese momento** a su grupo nuevo (excepción a «no se reordena hasta salir y volver», que sigue valiendo para cambios de estado). Si el grupo destino estaba plegado, se despliega.
- Foco: vuelve a la tarjeta en su posición nueva, que se desplaza hasta quedar visible (`block: "nearest"`); se anuncia `bib.anuncio.movida`.
- Si con los datos nuevos la canción deja de coincidir con la búsqueda o el filtro, no desaparece de golpe: permanece visible en su grupo nuevo hasta el siguiente cambio de búsqueda, filtro o agrupación, con la tarjeta enfocada (evita perder el foco).
- La herencia se **reevalúa**: si cambia el tema efectivo (p. ej. el álbum nuevo tiene tema), portada y línea de tema se actualizan y aparece el toast `bib.toast.temaCambiado`. Si no cambia, no hay toast. Las canciones personalizadas o con tema asignado no cambian de aspecto.
- Vaciar el artista o el álbum lleva la tarjeta a «Sin artista» o «Sin álbum».

### Selección múltiple y «Aplicar tema…»

**Modo selección**
```
│ ☑ 3 seleccionadas · 1 fuera de la vista   [Aplicar tema…]  [Seleccionar visibles]  [Quitar selección]  [Terminar] │
│ ▾ ☐ Queen · 7 canciones  (en modo selección, casilla de grupo tri-estado)  │
│ ┌───────────┐                                                             │
│ │☑ portada  │  casilla 24 px arriba a la izquierda de la portada          │
│ │ Título    │  sin botón de acción principal ni ⋯ mientras dura el modo   │
│ └───────────┘                                                             │
```
| Elemento | Comportamiento |
|---|---|
| Entrar | «Seleccionar» (barra) o Ctrl/Cmd + A con el foco en la rejilla (entra y selecciona todas las visibles). La barra de selección sustituye a la fila de «Seleccionar» y queda fija arriba al desplazar la vista (`position: sticky`). Con «Seleccionar», el foco pasa a la tarjeta activa para empezar a marcar (con Ctrl/Cmd + A se queda donde estaba); se anuncia `bib.sel.anuncio.entrar`. |
| Tarjeta | Clic en cualquier parte, Espacio o Intro alternan su casilla. No se reproduce ni se abre nada. Casilla con nombre `bib.sel.casilla`. Las flechas siguen moviendo el foco. Mayús + clic selecciona el rango desde la última tarjeta alternada (orden visual). |
| Canciones no editables | Las **Dañadas con `cancion.json` ilegible** (y, en fases futuras, las bloqueadas por una sesión de evento) muestran la casilla `aria-disabled` con tooltip `bib.sel.noEditable`; no se pueden seleccionar. Borradores en cualquier paso, Listas y las **Dañadas solo por faltar pistas** sí (su `cancion.json` es válido y el tema se verá cuando se reparen; [0054](../preguntas/0054-detalles-de-interfaz-de-temas-y-biblioteca.md) §8). |
| Casilla de grupo | En vistas agrupadas, en el encabezado: marca o desmarca las canciones **visibles y editables** del grupo; estado mixto si hay parte. Nombre `bib.sel.grupo`. |
| Seleccionar visibles | Añade todas las visibles editables (respeta búsqueda, filtro y grupos plegados: las de grupos plegados no se añaden). |
| Quitar selección | Vacía la selección y sigue en el modo. |
| Persistencia | La selección se conserva al buscar, filtrar, agrupar o plegar. La barra dice cuántas quedan fuera de la vista (`bib.sel.fuera`). Si una seleccionada se elimina, sale de la selección sin aviso; si pasa a Dañada, sigue contada y la confirmación la excluye. |
| Terminar | Botón o **Esc** (si no hay diálogo ni menú abierto, y el foco no está en la búsqueda con texto). Sale del modo y vacía la selección. Foco al botón «Seleccionar». |
| Aplicar tema… | Inactivo (`aria-disabled`, tooltip `bib.sel.ninguna`) sin selección. Abre el diálogo. |

**Diálogo «Aplicar tema»** (ancho 560 px, máx. 90 vw)
```
┌ Aplicar tema a 4 canciones ─────────────────────────────┐
│ Tema [▣ Neón                                      ▾ ]   │
│ Se asignará «Neón» a cada canción. No cambia el tema de │
│ sus álbumes ni de sus artistas.                         │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Bohemian Rhapsody — Queen                            │ │
│ │   ⚠ Sustituye su tema personalizado                  │ │
│ │ La flaca — Jarabe de Palo                            │ │
│ │   Ahora usa «Noche ninja» (del artista)              │ │
│ │ Despacito — Luis Fonsi                               │ │
│ │   Sustituye el tema asignado «Sol»                   │ │
│ │ Lucía — Sin artista                                  │ │
│ │   Ya tiene asignado «Neón»: no cambia                │ │
│ └──────────────────────────────────────────────────────┘ │
│ ⚠ 1 canción perderá su tema personalizado.              │
│                       [Cancelar] [Aplicar a 3 canciones] │
└──────────────────────────────────────────────────────────┘
```
- Las anotaciones de cada canción las calcula main para el tema elegido y se recalculan al cambiarlo: `bib.lote.nota.*`. La lista ocupa hasta 280 px con scroll propio y está ordenada como en la Biblioteca (sin agrupar).
- Aplicar = **asignar el tema a nivel canción** (vínculo vivo), igual que elegirlo en el editor. Las personalizadas pierden su estilo propio: el aviso `bib.lote.avisoPersonalizado` lo dice antes de confirmar.
- El botón dice cuántas cambiarán (excluye las que ya lo tienen asignado). Si son 0, está inactivo con `bib.lote.nadaQueCambiar`.
- Foco inicial en el selector de tema; Esc = Cancelar.
- **Aplicando**: el botón pasa a «Aplicando… {i} de {n}» (`hechas`/`total` del evento `temas:progreso` de la ficha confirmada; antes del primer evento, «Aplicando… 0 de {n}»), el selector y la lista quedan inactivos; no se cierra con Esc hasta terminar.
- **Resultado** (el mismo diálogo, título `bib.lote.resultado`):
```
│ «Neón» se aplicó a 2 de 3 canciones.                    │
│ ✓ Bohemian Rhapsody — Aplicado                          │
│ ✕ La flaca — No se pudo guardar.     [Copiar detalles]  │
│ – Lucía — Ya lo tenía                                   │
│                     [Revisar y reintentar] [Cerrar]     │
```
  - Cada fila con icono y texto (✓ `exito`, ✕ `error`, – `texto-3`). Correspondencia con el resultado de main (ADR 0016 §7): `aplicada` → ✓ «Aplicado»; `sin_cambios` → – «Ya lo tenía»; `omitida` → – con su motivo (`bib.lote.fallo.noExiste`, `bib.lote.fallo.danada` o `bib.lote.fallo.cambio`); `error` → ✕ `bib.lote.fallo.guardar`. «Revisar y reintentar» incluye las `error` y las `omitida` por cambio; nunca las `aplicada` ni las `sin_cambios`. Si el tema dejó de existir o entró en borrado, no se aplica a ninguna y se muestra `tema.error.noExiste`. Con `CONFIRMACION_OBSOLETA` antes de empezar, la lista de confirmación se actualiza con `tema.obsoleto` y no se aplica nada.
  - Las que se aplicaron **quedan aplicadas** (no hay vuelta atrás automática). «Revisar y reintentar» vuelve a la confirmación solo con las fallidas, recalculando sus notas; nunca repite las ya aplicadas.
  - El resultado se anuncia (`role="status"`) con el resumen. El foco va a «Cerrar» si todo fue bien o a «Revisar y reintentar» si hubo fallos.
  - Al cerrar: si todo fue bien, sale del modo selección y el foco va a «Seleccionar»; con fallos, sigue en el modo con las fallidas seleccionadas y el foco en «Aplicar tema…».
- Desde el menú ⋯ de una tarjeta, el mismo diálogo con una canción («Aplicar tema a «{título}»»); al cerrar, el foco vuelve a la tarjeta.

### Foco y desplazamiento al actualizar resultados
- Escribir en la búsqueda: el foco se queda en el campo; la vista vuelve arriba en cada cambio del texto (los resultados empiezan siempre visibles).
- Cambiar filtro o agrupación: el foco se queda en el control. Si la tarjeta activa (la del *roving tabindex*) sigue visible, se desplaza para mostrarla (`block: "center"`); si no, la vista vuelve arriba y la activa pasa a ser la primera.
- **Teclado en vistas agrupadas**: las tarjetas de todos los grupos comparten un solo punto de tabulación (*roving tabindex*). ←/→ recorren en orden visual cruzando grupos; ↑/↓ van a la fila contigua, también la del grupo anterior o siguiente; Inicio/Fin, primera y última tarjeta del grupo; Ctrl/Cmd + Inicio/Fin, de toda la biblioteca. Los controles del encabezado (plegar, [Tema…], casilla) son paradas de tabulación propias, antes de su rejilla. Las tarjetas de grupos plegados no participan.
- Actualizaciones en vivo (`cancion:cambiada`, nuevas canciones) no mueven el foco ni el desplazamiento: si aparece contenido por encima, la posición se ancla a la primera tarjeta visible. Una canción nueva aparece en su grupo sin reordenar el resto hasta volver a la vista (regla de siempre).
- Si desaparece la tarjeta enfocada (eliminada aquí o en otra parte), el foco pasa a la siguiente del orden visual, si no a la anterior, si no al título de la vista. Nunca queda en `body`.
- Volver del reproductor o del editor conserva agrupación, grupos plegados, filtro, búsqueda (solo desde el reproductor, como hoy), modo selección y desplazamiento, con el foco en la tarjeta.

### Estados nuevos
| Estado | Presentación |
|---|---|
| Biblioteca vacía | Igual que hoy; sin «Agrupar por» ni «Seleccionar». |
| Sin resultados agrupando | Mensajes de siempre (`bib.sinresultados*`). |
| Todas en «Sin artista» | Un solo grupo; sin aviso especial. |
| Catálogo en solo lectura (`TEMAS_SOLO_LECTURA`) o apartado por ilegible | Las tarjetas que apuntaban a temas que ya no se pueden usar muestran su aspecto de respaldo y «⚠ Tema no disponible». En solo lectura, [Tema…] y «Aplicar tema…» quedan inactivos con `bib.temas.soloLectura`. |
| Catálogo vacío | «Aplicar tema…» y [Tema…] inactivos con el tooltip `bib.temas.vacio`. |

### Microcopy (fase 3, biblioteca)
| Clave | Texto |
|---|---|
| `bib.buscar` | Buscar título, artista o álbum |
| `bib.agrupar` | Agrupar por · Sin agrupar · Artista · Álbum |
| `bib.anuncio.resultados` | {n} canciones · (n = 1) 1 canción · (n = 0) Ninguna canción |
| `bib.grupo.recuento` | {n} canciones · 1 canción · (con búsqueda o filtro) {v} de {n} canciones |
| `bib.grupo.sinArtista` / `bib.grupo.sinAlbum` | Sin artista · Sin álbum |
| `bib.grupo.album` | {álbum} — {artista} · (sin artista) {álbum} — Sin artista |
| `bib.grupo.plegar` | Plegar {grupo} · Desplegar {grupo} |
| `bib.grupo.tema` | Tema del artista: {tema} · Tema del álbum: {tema} |
| `bib.grupo.sinTemaPropio` | Sin tema de artista · Sin tema de álbum |
| `bib.grupo.temaBorrando` | ⚠ {tema}: eliminación sin terminar |
| `bib.grupo.sinTema.artista` | Añade el artista con «Editar datos» para darles un tema. |
| `bib.grupo.sinTema.album` | Añade el álbum con «Editar datos» para darles un tema. |
| `bib.grupo.sinTema.albumSinArtista` | Añade el artista para darle un tema. |
| `bib.grupo.boton` | Tema… — nombre accesible: Tema del artista {artista}… · Tema del álbum {álbum}… |
| `bib.grupo.dialogo` | Título: Tema del artista {artista} · Tema del álbum «{álbum}» de {artista} · Opción: Sin tema de artista (usar el predeterminado) · Sin tema de álbum (usar el del artista o el predeterminado) — [Cancelar] [Aplicar] |
| `bib.grupo.impacto` | Cambiará el aspecto de {n} de sus {m} canciones. · (n = m) Cambiará el aspecto de sus {m} canciones. · (quitar) {n} canciones pasarán a usar «{tema}», {procedencia}. · (quitar, destinos distintos) {n} canciones volverán al tema que usaban sin el del {artista/álbum}; en la lista se ve cuál usará cada una. · (fila de la lista al quitar) {título} — {artista} · usará «{tema}» ({procedencia corta}) · (destino estilo incluido) {título} — {artista} · usará el estilo incluido · (destino no disponible) ⚠ {título} — {artista} · se verá con el último aspecto guardado (su tema de origen no está en tus temas) · (quitar, todas no disponibles) {n} canciones se verán con el último aspecto guardado en cada una: su tema de origen no está en tus temas. · (n = 1, no disponible) 1 canción se verá con el último aspecto guardado en ella: su tema de origen no está en tus temas. |
| `bib.grupo.impacto.noDisponible` | ⚠ {r} de ellas quedarán como «Tema no disponible» porque su tema de origen no está en tus temas. Puedes darles otro con «Aplicar tema…». · (r = 1) ⚠ 1 de ellas quedará como «Tema no disponible» porque su tema de origen no está en tus temas. Puedes darle otro con «Aplicar tema…». |
| `bib.grupo.excluidas` | {k} no cambian porque tienen tema personalizado o asignado. · (artista) {k} no cambian porque tienen tema personalizado o asignado, o su álbum tiene tema. |
| `bib.grupo.ninguna` | Ahora no cambiará ninguna canción. |
| `bib.grupo.futuras` | Las canciones que añadas a este {álbum/artista} también lo usarán. |
| `bib.grupo.toast` | {Artista/Álbum} {nombre}: tema «{tema}». · (quitar) {Artista/Álbum} {nombre}: sin tema propio. |
| `bib.tarjeta.tema` | {tema} · {procedencia corta} · Tema personalizado · Estilo incluido · Tema no disponible |
| `bib.aria.tarjeta` | {título}, {artista}, {estado}. {línea de paso}. Tema: {línea de tema}. |
| `bib.menu.aplicarTema` | Aplicar tema… |
| `bib.anuncio.movida` | «{título}» está ahora en {grupo}. |
| `bib.toast.temaCambiado` | «{título}» usa ahora el tema «{tema}», {procedencia en minúscula}. |
| `bib.sel.boton` | Seleccionar |
| `bib.sel.contador` | {n} seleccionadas · 1 seleccionada |
| `bib.sel.fuera` | {k} fuera de la vista |
| `bib.sel.visibles` | Seleccionar visibles |
| `bib.sel.quitar` | Quitar selección |
| `bib.sel.terminar` | Terminar |
| `bib.sel.casilla` | Seleccionar «{título}» |
| `bib.sel.grupo` | Seleccionar las canciones de {grupo} |
| `bib.sel.noEditable` | No se puede cambiar el tema de una canción que no se puede abrir. |
| `bib.sel.ninguna` | Selecciona al menos una canción. |
| `bib.sel.anuncio.entrar` | Modo selección. Usa Espacio para marcar canciones y Esc para terminar. |
| `bib.lote.titulo` | Aplicar tema a {n} canciones · Aplicar tema a «{título}» |
| `bib.lote.explicacion` | Se asignará «{tema}» a cada canción. No cambia el tema de sus álbumes ni de sus artistas. |
| `bib.lote.nota.personalizado` | ⚠ Sustituye su tema personalizado |
| `bib.lote.nota.asignado` | Sustituye el tema asignado «{tema}» |
| `bib.lote.nota.heredado` | Ahora usa «{tema}» ({procedencia corta}) |
| `bib.lote.nota.igual` | Ya tiene asignado «{tema}»: no cambia |
| `bib.lote.nota.noDisponible` | Sustituye un tema no disponible |
| `bib.lote.avisoPersonalizado` | ⚠ {k} canciones perderán su tema personalizado. · (k = 1) ⚠ 1 canción perderá su tema personalizado. |
| `bib.lote.aplicar` | Aplicar a {n} canciones · Aplicar a 1 canción |
| `bib.lote.nadaQueCambiar` | Todas las canciones ya tienen asignado este tema. |
| `bib.lote.aplicando` | Aplicando… {i} de {n} |
| `bib.lote.resultado` | «{tema}» se aplicó a {a} de {n} canciones. · (todas) «{tema}» se aplicó a {n} canciones. |
| `bib.lote.fila` | Aplicado · Ya lo tenía · {motivo de fallo} |
| `bib.lote.fallo.guardar` | No se pudo guardar. — [Copiar detalles] |
| `bib.lote.fallo.cambio` | Cambió mientras confirmabas. |
| `bib.lote.fallo.noExiste` | Ya no está en la biblioteca. |
| `bib.lote.fallo.danada` | Está dañada. |
| `bib.lote.reintentar` | Revisar y reintentar |
| `bib.temas.soloLectura` | Tus temas son de una versión más nueva de Shinobi Karaoke y aquí no se pueden cambiar. |
| `bib.temas.vacio` | Aún no tienes temas. Crea uno desde el editor de una canción. |

### Criterios de aceptación de la fase 3 (biblioteca)
- B1. «Agrupar por» ofrece Sin agrupar, Artista y Álbum; la elección se conserva al volver de otra vista y al reiniciar la app; «Sin agrupar» es idéntica a la rejilla anterior.
- B2. Con canciones de «Queen», «QUEEN » y «queen» se forma **un** grupo de artista; «Canción» y «Cancion» forman dos. Dos álbumes «Greatest Hits» de ABBA y de Queen aparecen como dos grupos en la vista por álbum.
- B3. Las canciones sin artista o sin álbum aparecen en «Sin artista» / «Sin álbum» al final, sin [Tema…] y con el texto `bib.grupo.sinTema.*`; un álbum sin artista forma «{álbum} — Sin artista», tampoco asignable.
- B4. La búsqueda encuentra por título, artista y álbum sin distinguir mayúsculas, tildes ni espacios repetidos, exige todas las palabras de la consulta, se combina con el filtro de estado y con la agrupación (grupos sin coincidencias ocultos, recuento «{v} de {n}») y anuncia el número de resultados una vez tras dejar de escribir.
- B5. [Tema…] de un grupo muestra el impacto recalculado al cambiar de opción, excluyendo personalizadas, asignadas y (en artista) las de álbum con tema; al aplicar, las tarjetas afectadas cambian portada y línea de tema sin moverse, el encabezado muestra el tema y el foco vuelve a [Tema…]. Quitar el tema de grupo devuelve sus canciones al siguiente nivel.
- B5b. (Destino `respaldo`, [0056](../preguntas/0056-destino-respaldo-y-canciones-pendientes.md)) Con un álbum con tema y dos canciones que lo heredan, una con base «al azar» de un tema que no está en el catálogo y otra sin base, elegir «Sin tema de álbum» muestra la variante «destinos distintos», la línea `bib.grupo.impacto.noDisponible` con r = 1 y, en la lista, la fila «destino no disponible» con ⚠ y sin nombre de tema. Si las dos tienen esa base, se usa la variante «quitar, todas no disponibles» sin la línea extra. Tras aplicar, esas tarjetas muestran «⚠ Tema no disponible».
- B6. La herencia se comprueba en los cuatro niveles con la línea de tema de la tarjeta: una canción con tema asignado ignora el del álbum; sin él, usa el del álbum; sin tema de álbum, el del artista; sin ninguno, el predeterminado.
- B7. «Editar datos» que cambia el artista mueve la tarjeta al grupo correcto en ese momento, despliega el grupo si estaba plegado, deja el foco en la tarjeta visible y anuncia `bib.anuncio.movida`; si su nuevo artista tiene tema y la canción lo hereda, portada y línea cambian y aparece `bib.toast.temaCambiado`; si estaba personalizada, no cambia su aspecto.
- B8. Modo selección: «Seleccionar» y Ctrl/Cmd + A lo activan; Espacio, Intro y clic alternan; Mayús + clic selecciona un rango; las Dañadas con `cancion.json` ilegible no se pueden marcar y explican por qué (las Dañadas por pistas sí); la casilla de grupo es tri-estado; la selección sobrevive a búsqueda, filtro y agrupación y la barra dice cuántas quedan fuera de vista; Esc y «Terminar» salen y vacían.
- B9. «Aplicar tema…» muestra la lista completa de seleccionadas con una nota por canción (personalizada, asignada, heredada, igual), el aviso de personalizadas y el número que cambiará en el botón; con todas iguales, el botón está inactivo con su motivo.
- B10. Con un fallo simulado en una de cinco canciones y otra modificada entre la confirmación y la escritura, el resultado muestra 3 aplicadas, 1 «No se pudo guardar» y 1 «Cambió mientras confirmabas»; las 3 quedan aplicadas al reabrirlas; «Revisar y reintentar» vuelve a confirmar solo las 2 fallidas.
- B11. Tras un lote correcto, se sale del modo y el foco está en «Seleccionar»; con fallos, se sigue en el modo con las fallidas seleccionadas y el foco en «Aplicar tema…». El resultado se anuncia una vez.
- B12. Escribir en la búsqueda mantiene el foco en el campo y lleva la vista arriba; cambiar agrupación mantiene visible la tarjeta activa; un evento en vivo no mueve foco ni desplazamiento; eliminar la tarjeta enfocada deja el foco en la siguiente (o anterior, o el título).
- B13. En vistas agrupadas, ←/→ y ↑/↓ cruzan grupos, Ctrl/Cmd + Inicio/Fin llevan a la primera y última tarjeta, y las de grupos plegados se saltan; plegar y desplegar se anuncian por `aria-expanded`.
- B14. La portada de una canción de YouTube muestra la miniatura solo con `apariencia.neutra` (procedencia predeterminado, al azar, predeterminado anterior o estilo incluido, o personalizada de 0.1.0 con estilo igual al predeterminado), y deja de mostrarla al asignar un tema a la canción, a su álbum o a su artista. Quitar el predeterminado en Ajustes no cambia la portada de ninguna canción; la línea de tema de las que lo seguían pasa a «… · predeterminado anterior».
- B15. Volver del reproductor conserva agrupación, grupos plegados, filtro, búsqueda, modo selección y desplazamiento, con el foco en la tarjeta.
- B16. Capturas en `docs/ux/revision-fase-3/` (ver [README](revision-fase-3/README.md)), nombre `biblioteca-{ancho}x{alto}-{escala}-{estado}.png`, a 1280 × 800 al 100 % y 1280 × 720 al 125 %: `artista`, `album` (con homónimos), `sin-metadatos`, `busqueda-album`, `seleccion` (con «fuera de la vista»), `dialogo-aplicar-tema`, `resultado-lote` (con fallos), `dialogo-tema-grupo`, `foco-tras-mover`.

## Fase 4 de 0.2.0 — ventana secundaria y cola

Origen: [plan, fase 4, features 10 y 11](../versiones/0.2.0/plan-2.md#fase-4--reproducción-en-eventos), [0048](../preguntas/0048-escucha-editor-durante-evento.md), [0049](../preguntas/0049-politica-cola-de-reproduccion.md) y [ronda 4](../versiones/0.2.0/discusion/r4-disenador-ux.md). Conceptos (sesión, cola, entrada activa, pendientes, candidata, última reproducida) y todo lo que ve el público: [07 · Fase 4](07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola). Bloqueo de edición: [06 · Fase 4](06-editor.md#fase-4-de-020--ventana-secundaria-y-cola). Contratos: [ADR 0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md). Respuesta a los puntos de interfaz del arquitecto: [0058](../preguntas/0058-interfaz-de-la-sesion-en-vivo-y-la-cola.md). Conductas ante incidencias, decididas por el usuario en [0059](../preguntas/0059-conductas-de-la-sesion-en-vivo-ante-incidencias.md) (1B, 2A, 3B, 4A). Letra bloqueada y sin volumen ni voz guía en el panel: [0060](../preguntas/0060-letra-y-controles-de-sonido-durante-la-sesion.md) (1A, 2A). Esta sección **amplía** la vista; lo no mencionado sigue igual.

La ventana principal es el **puesto del operador**: desde aquí se abre el reproductor en otra pantalla, se prepara y ordena la cola y se opera la sesión (pausa, siguiente, reiniciar, detener la cuenta, cerrar). La secundaria solo muestra.

**Sustituye**, solo mientras hay sesión: la acción principal «▶ Reproducir» de las tarjetas Lista, el botón redondo de la portada y la acción de la portada / Intro (ver «Tarjetas durante la sesión»). Sin sesión, «Reproducir» abre el reproductor local como siempre, aunque haya una cola preparada o conservada.

### Vista con el panel de cola
```
≥ 1280 px
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ◆ Shinobi Karaoke        [▶ En otra pantalla] [⟳ 1 en curso]  [⚙]  [+ Añadir canción]       │ ← indicador de sesión
├────────────────────────────────────────────────────────┬─────────────────────────────────┤
│ Biblioteca              [▣ Abrir en otra pantalla…] [☰ Cola 3] │ Cola de reproducción   [Ocultar] │
│ [Todas|Listas|Borradores] Agrupar por […]  [☑ Seleccionar] [🔍…]│ ● Pantalla 2 · DELL U2720Q       │
│ ┌──────┐ ┌──────┐ ┌──────┐                              │   Pantalla completa              │
│ │ card │ │ card │ │ card │                              │ ─────────────────────────────── │
│ └──────┘ └──────┘ └──────┘                              │ (contenido del panel, P1–P6)    │
│ …                                                      │                                 │
└────────────────────────────────────────────────────────┴─────────────────────────────────┘
```
- **Panel** a la derecha de la rejilla, de alto completo bajo la barra superior, con scroll propio: 360 px (≥ 1280 px de ancho) o 320 px (< 1280). La rejilla se adapta (`auto-fill`): a 1024 px quedan 2 columnas. No hay divisor redimensionable.
- **Cuándo se ve**: se abre solo al empezar una sesión, al añadir la primera entrada a una cola vacía y al volver con una cola conservada. [Ocultar] lo cierra (foco al botón «Cola»); [☰ Cola {n}] de la cabecera lo abre o cierra (`aria-expanded`, `aria-controls`). Se recuerda abierto/cerrado durante la sesión de la app, no entre reinicios.
- **Cabecera de la vista**: «Abrir en otra pantalla…» (`ses.abrir`, secundario, icono `monitor-up`) y «Cola {n}» (`cola.boton`, fantasma, icono `list-music`; {n} = pendientes, sin cifra si 0) a la derecha del título «Biblioteca». Durante la sesión, «Abrir en otra pantalla…» desaparece (solo hay una secundaria). No aparecen en el estado vacío de la biblioteca.

### Abrir el reproductor en otra pantalla
Desde «Abrir en otra pantalla…» de la cabecera de la vista o del panel (P5, P6), desde [Volver a abrir] tras una caída y desde **«Reproducir en otra pantalla…»** del ⋯ de una canción Lista (solo sin sesión: esa canción empieza al momento y las pendientes siguen detrás). Son las **únicas** formas de empezar una sesión, y solo existen en la Biblioteca. Diálogo ancho (560 px):
```
┌ Abrir el reproductor en otra pantalla ──────────────────────────┐
│ Pantalla                                                         │
│ ◉ Pantalla 2 · DELL U2720Q · 3840 × 2160                         │
│ ○ Pantalla 1 · Pantalla integrada · 1512 × 982                   │
│     Principal · Aquí está esta ventana                           │
│ [☑] Pantalla completa                                            │
│                                                                  │
│ ⓘ El sonido sale por la salida de audio de tu equipo, no por la  │
│   pantalla elegida.                                              │
│ Empezará con «La flaca» — Jarabe de Palo.                        │  ← `ses.empieza.*`
│ Mientras el reproductor esté abierto no se podrán editar         │
│ canciones.                                                       │
│                                   [Cancelar] [Abrir reproductor] │
└──────────────────────────────────────────────────────────────────┘
```
| Elemento | Comportamiento |
|---|---|
| Pantallas | Grupo de radio con todas las pantallas que da main, en el orden del sistema. Cada opción: «Pantalla {n} · {nombre} · {ancho} × {alto}» (resolución física; sin nombre del sistema, se omite) y, en la principal, la línea `ses.pantalla.principal`. Selección inicial: la última usada si está conectada; si no, la primera que **no** es la principal; con una sola pantalla, esa. La lista se actualiza en vivo si se conecta o desconecta una pantalla; si desaparece la elegida, se selecciona la inicial y se muestra `ses.pantalla.desaparecida` (`role="alert"`). |
| Una sola pantalla | Se añade la nota `ses.unaPantalla` (`info`). «Pantalla completa» empieza desmarcada. |
| Pantalla completa | Casilla, marcada por defecto salvo si la elegida es la principal. Se recuerda junto con la pantalla (`config.reproductor.secundaria`, ADR 0017 §2). Elegir la pantalla de la ventana principal muestra la nota `ses.completa.misma` (`info`), marcada o no la casilla; no se impide (sirve con un solo monitor y para probar). |
| Linux con Wayland (`colocacion: 'sistema'`, [0061](../preguntas/0061-reproductor-en-otra-pantalla-con-wayland.md)) | El sistema decide dónde aparece la ventana: en lugar del grupo de radio se muestra `ses.wayland` (`info`) y la casilla «Pantalla completa» no aparece. «Abrir reproductor» abre la ventana en modo ventana. En el panel, el estado de la pantalla es `cola.pantalla.desconocida` y «Cambiar de pantalla…», «Mover a…» y «Llevar el reproductor allí» se sustituyen por `ses.wayland` como texto informativo. |
| Audio | Nota fija `ses.audio`. No hay selector de dispositivo (mejora futura de prioridad baja, 0048). |
| Empezará con | `ses.empieza.*` según la cola: vacía, con pendientes, con una última reproducida interrumpida o terminada (07 §"Reabrir con la cola conservada"). |
| Abrir reproductor | Primario. Pasa a «Abriendo…» (cargando). Éxito: el diálogo se cierra, el foco va al panel de la cola (encabezado «En reproducción» o la acción principal del estado), el panel se abre y el indicador de sesión aparece. Fallo: el diálogo sigue abierto con la selección intacta y un banner `error` en línea: `ses.error.abrir` con [Reintentar] (también con `PANTALLA_NO_DISPONIBLE`, que además actualiza la lista), `ses.error.guardando` con `GUARDADO_PENDIENTE` y `ses.error.noDisponible` si la canción elegida ya no se puede reproducir (`CANCION_NO_DISPONIBLE`). Con `SESION_EN_CURSO` (otra apertura ganó la carrera) el diálogo se cierra y el panel muestra la sesión. |
| Teclado | Foco inicial en la opción seleccionada; ↑/↓ cambian de pantalla; Esc = Cancelar. |

### Contenido del panel

**P1 — Sesión, reproduciendo**
```
│ Cola de reproducción                  [Ocultar] │
│ ● Pantalla 2 · DELL U2720Q                      │  estado de la pantalla (t-pequeno)
│   Pantalla completa                             │
│ [⛶ Ver en una ventana] [⋯] [✕ Cerrar reproductor] │  ⋯ = Mostrar · Cambiar de pantalla…
│ ─────────────────────────────────────────────── │
│ EN REPRODUCCIÓN                                  │  h3
│ ┌─────────────────────────────────────────────┐ │
│ │ Bohemian Rhapsody                       [⋯] │ │  fondo-2
│ │ Queen                                       │ │
│ │ ⚠ Faltan 3 líneas por sincronizar           │ │  solo si incompleta
│ │ 01:12 ━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━ 05:55   │ │  progreso de solo lectura
│ │ [❚❚ Pausa]  [⏭ Siguiente]  [↺ Reiniciar]     │ │
│ └─────────────────────────────────────────────┘ │
│ A CONTINUACIÓN (3)                    [Vaciar…] │  h3
│ 1  ⠿  La flaca — Jarabe de Palo   4:31   [⋯]    │
│ 2  ⠿  Despacito — Luis Fonsi      3:48   [⋯]    │
│ 3  ⠿  Bohemian Rhapsody — Queen   5:55   [⋯]    │  repetida: entrada distinta
```

**P2 — Cuenta entre canciones**
```
│ EN REPRODUCCIÓN                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Terminó «Bohemian Rhapsody»                 │ │
│ │ Empieza en 3 s: «La flaca»                  │ │  t-cuerpo-fuerte; se actualiza cada segundo (no se anuncia cada segundo)
│ │ [▶ Empezar ya]  [❚❚ Detener cuenta]          │ │
│ └─────────────────────────────────────────────┘ │
│ A CONTINUACIÓN (3)                               │
│ 1  ⠿  La flaca — Jarabe de Palo  · Siguiente     │  la candidata lleva «Siguiente»
```

**P3 — Fallo de una entrada**
```
│ ┌─────────────────────────────────────────────┐ │
│ │ ✕ No se puede reproducir «La flaca»          │ │  banner error, role="alert"
│ │   Faltan sus pistas separadas.              │ │
│ │   [Pasar a la siguiente canción] [Copiar detalles] │  sin pendientes: [Descartar]
│ └─────────────────────────────────────────────┘ │
```

**P4 — En espera / fin de la cola**
```
│ ┌─────────────────────────────────────────────┐ │  │ ┌─────────────────────────────────────────────┐ │
│ │ En espera                                   │ │  │ │ La cola terminó.                            │ │
│ │ [▶ Iniciar «La flaca»]                       │ │  │ │ Si añades una canción, empezará tras la     │ │
│ └─────────────────────────────────────────────┘ │  │ │ cuenta. O cierra el reproductor.            │ │
│                                                 │  │ │ Última: Bohemian Rhapsody — Queen [↻ Otra vez] │
│                                                 │  │ └─────────────────────────────────────────────┘ │
```
Sin candidata, en espera: `cola.espera.vacia` en lugar del botón. En **fin de la cola**, añadir una canción (tarjeta, ⋯ o toast) **empieza la cuenta** hacia ella ([0059](../preguntas/0059-conductas-de-la-sesion-en-vivo-ante-incidencias.md) §3 B): el bloque pasa a P2 con [▶ Empezar ya] y [❚❚ Detener cuenta]. En **espera**, añadir no arranca nada: aparece [▶ Iniciar «{título}»].

**P5 — Sin sesión, cola conservada**
```
│ Cola de reproducción                  [Ocultar] │
│ Reproductor cerrado                             │
│ [▣ Abrir en otra pantalla…]   [Eliminar cola…]  │
│ ─────────────────────────────────────────────── │
│ ÚLTIMA REPRODUCIDA                               │  (fila de contexto, seleccionada)
│ Bohemian Rhapsody — Queen                       │
│ Se detuvo en 02:13. Al abrir el reproductor,    │
│ seguirá desde ahí.                              │
│ A CONTINUACIÓN (2)                    [Vaciar…] │
│ 1  ⠿  La flaca — Jarabe de Palo   4:31   [⋯]    │
│ 2  ⠿  Despacito — Luis Fonsi      3:48   [⋯]    │
```

**P6 — Sin sesión, preparando la cola** (sin última reproducida): como P5 sin el bloque «Última reproducida»; con 0 pendientes, `cola.vacia.sinSesion`. «Eliminar cola…» solo aparece si hay algo que eliminar.

### Componentes e interacciones del panel
| Elemento | Comportamiento |
|---|---|
| Estado de la pantalla | `cola.pantalla` + `cola.modo` (pantalla completa / en una ventana). Punto `exito` + texto (el color no es la única señal). |
| [⛶ Pantalla completa] / [⛶ Ver en una ventana] | Alterna la secundaria; el texto refleja el estado real (también si se cambia con F en la secundaria). |
| ⋯ › Mostrar | `ses.mostrar`: trae la secundaria al frente (y la restaura si estaba minimizada). No le pasa el foco del teclado. |
| ⋯ › Cambiar de pantalla… | En el ⋯ de la cabecera del panel (nombre `ses.menu`, «Más opciones del reproductor»). Abre el mismo diálogo de pantallas sin la parte de «Empezará con»; al aceptar, main mueve la ventana sin cortar el audio. |
| [✕ Cerrar reproductor] | Termina la sesión: con pendientes, diálogo `ses.cierre`; sin pendientes, cierra al momento. |
| Sin volumen ni voz guía | El panel no tiene volumen general ni nivel de voz guía (decisión del usuario en [0060](../preguntas/0060-letra-y-controles-de-sonido-durante-la-sesion.md) §2 A): se ajustan en el propio reproductor (spec 07) o con el volumen del sistema. |
| Progreso de la activa | Barra de 6 px **de solo lectura** (`role="progressbar"`, `aria-valuetext` «1 minuto 12 segundos de 5 minutos 55») y tiempos `t-tiempo`, actualizados al menos una vez por segundo. Para buscar se usa la secundaria. |
| [❚❚ Pausa] / [▶ Reanudar] | Pausa o reanuda la secundaria. |
| [⏭ Siguiente] | Interrumpe la activa y empieza la cuenta de la candidata (07 S1), como un fin natural; [▶ Empezar ya] la salta. Sin pendientes: `aria-disabled` con tooltip `cola.siguiente.no`. Sin confirmación; un doble clic produce un único avance (ADR 0017 §7). |
| [↺ Reiniciar] | `cola.reiniciar`: vuelve al principio de la activa con título y silencio previo. |
| ⋯ de la activa | «Agregar otra vez al final». |
| [▶ Empezar ya] / [❚❚ Detener cuenta] | Durante la cuenta (P2). Detener → en espera (P4) con la misma candidata. |
| [▶ Iniciar «{título}»] | En espera con candidata (P4; en fin de la cola no hace falta, porque añadir ya empieza la cuenta): empieza la candidata al momento, con su pantalla de título. Es la acción principal del panel en ese estado. |
| [↻ Otra vez] | En fin de la cola sin candidata: vuelve a poner la última al frente («Reproducir a continuación») y la empieza. |
| Fallo (P3) | Banner `error` con `cola.fallo.titulo` y la causa (`cola.causa.*`). [Pasar a la siguiente canción] descarta la entrada fallida y empieza la cuenta de la siguiente. Sin pendientes no aparece: se añade `cola.fallo.sinSiguiente` y el botón es [Descartar] (`cola.descartar`), que deja la sesión en espera sin candidata. [Copiar detalles] copia el código. Foco al botón primero al aparecer el fallo **solo si el foco estaba en el panel**; si no, se anuncia y el indicador de sesión pasa a «Requiere atención». |
| Lista «A continuación» | `role="list"` con nombre `cola.pendientes`. Fila de 48 px: posición, asa ⠿, «título — artista», duración, ⋯. La candidata lleva la etiqueta `cola.etiqueta.siguiente` durante la cuenta y en espera. Una pendiente que ya se sabe que no se puede reproducir muestra debajo `cola.noDisponible` (icono ⚠ `aviso`) y sigue en su sitio hasta que se quite o llegue su turno (entonces, P3). Una canción Lista **incompleta** muestra `bib.lista.incompleta` debajo, como aviso informativo. |
| ⋯ de una pendiente | «Reproducir a continuación» (no en la primera) · «Subir» (no en la primera) · «Bajar» (no en la última) · «Mover al final» (no en la última) · «Agregar otra vez al final» · separador · «Quitar de la cola». |
| Reordenar con ratón | Arrastrar desde el asa ⠿ (cursor `grab`). Una línea de 2 px `acento-texto` marca el hueco de destino; la fila arrastrada queda semitransparente en su sitio. Al soltar, se mueve; Esc durante el arrastre cancela. Arrastrar cerca de los bordes del panel lo desplaza. Nunca se puede arrastrar la activa ni soltar por encima de ella. |
| Reordenar con teclado | Con una fila enfocada: **Alt + ↑ / ↓** sube / baja una posición; **Alt + Inicio / Fin** la llevan al principio / al final. El foco sigue a la fila movida y se anuncia `cola.anuncio.movida`. Equivalentes en el ⋯. |
| Navegación | La lista es una sola parada de tabulación (*roving tabindex*): ↑/↓ entre filas, Inicio/Fin; Tab siguiente va al ⋯ de la fila activa. Tecla Menú o Mayús + F10 abre el ⋯. **Supr** quita la fila. |
| Quitar | Sin confirmación. Toast `cola.toast.quitada` con [Deshacer] (la vuelve a su posición si la cola no cambió entretanto; si cambió, al final). El foco pasa a la fila siguiente, si no a la anterior, si no al encabezado «A continuación» (`tabindex="-1"`). |
| [Vaciar…] | Visible con ≥ 2 pendientes. Diálogo `cola.dialogo.vaciar` (foco en «Cancelar»). No interrumpe la activa. |
| [Eliminar cola…] | Solo sin sesión (P5, P6). Diálogo `cola.dialogo.eliminar`: quita pendientes y última reproducida. |
| Cambios hechos por otros | Si la secundaria avanza, una entrada se descarta o main recalcula la candidata, la lista se actualiza sin mover el foco; si desaparece la fila enfocada, rige la regla de «Quitar». |

### Tarjetas y menú durante la sesión
| Elemento | Sin sesión (con o sin cola) | Con sesión |
|---|---|---|
| Acción principal de una Lista | «▶ Reproducir» (reproductor local, como hoy) | **«A la cola»** (`bib.cola.boton`, icono `list-plus`) = «Agregar al final» |
| Botón redondo de la portada, clic en la portada, Intro | Reproducir (local) | Agregar al final |
| ⋯ de una Lista | Reproducir · **Reproducir en otra pantalla…** · **Reproducir a continuación** · **Agregar al final** · Editar · Editar datos · Aplicar tema… · Volver a borrador · Mostrar en la carpeta · Eliminar… | Reproducir a continuación · Agregar al final · Editar (bloqueado) · Editar datos · Aplicar tema… · Volver a borrador · Mostrar en la carpeta · Eliminar… (sin «Reproducir») |
| ⋯ de un Borrador | Continuar · … (como hoy) | Igual; «Continuar» hacia Letra o Editor muestra el bloqueo (spec 06) |
| Línea de cola en la tarjeta | Si está pendiente: `bib.cola.enCola` | Activa: `bib.cola.sonando`; pendiente: `bib.cola.enCola` |
- Solo las canciones **Lista** (incluidas las incompletas) se pueden poner en cola. Borradores y Dañadas no ofrecen las opciones. Con la cola llena (500 pendientes, `COLA_LLENA`) se muestra el toast `cola.llena` y no se añade nada.
- **Reproducir en otra pantalla…** abre el diálogo de pantallas con `ses.empieza` en su variante «con canción». Si había una última reproducida interrumpida, la variante lo dice (no se retomará).
- **Reproducir a continuación** coloca la entrada **al frente de las pendientes** (nunca interrumpe la activa). **Agregar al final**, al final. Repetir una canción ya en cola crea otra entrada. Cada vez: toast `cola.toast.siguiente` / `cola.toast.final` con [Deshacer] (quita esa entrada); en espera sin candidata, el toast añade [▶ Iniciar ahora]; en fin de la cola, el toast usa la variante `cola.toast.cuenta` (la cuenta ya ha empezado). Se anuncia el toast como siempre (`aria-live`).
- **Editar** (y «Continuar» hacia Letra o Editor, el toast «Abrir editor» de spec 04, el stepper hacia Letra o Editor) muestran el diálogo de bloqueo `edi.bloqueo` (spec 06). Se pintan con `aria-disabled="true"` y un icono `lock` 14 px; siguen enfocables.
- Siguen disponibles durante la sesión: Añadir canción, Editar datos (la cola muestra el título nuevo), Aplicar tema y [Tema…] de grupo (la activa conserva su aspecto; las pendientes usan el nuevo al empezar), selección múltiple (ninguna canción queda excluida por la sesión; sustituye la nota de «Canciones no editables» de la fase 3), Mostrar en la carpeta y Ajustes.
- **Eliminar…** y **Volver a borrador** de la canción de la **entrada activa**: `aria-disabled` con tooltip `bib.cola.activaBloqueada`. De una canción **pendiente**: permitidos, con una frase más en su diálogo (`bib.cola.dialogo.eliminar` / `bib.cola.dialogo.borrador`). Eliminar quita también sus entradas de la cola; Volver a borrador las deja marcadas `cola.noDisponible`.
- El reproductor local (incluido el toast `bib.toast.lista` con [▶ Reproducir]) no se puede abrir durante la sesión: un solo transporte audible.

### Indicador de sesión (barra superior)
- Botón en la barra superior, a la izquierda del indicador de actividad, en todas las vistas que tienen barra superior. Visible con sesión o con una cola no vacía.
- Textos (`ses.ind.*`) con icono: «▶ En otra pantalla» (`info`), «❚❚ En pausa», «Siguiente en {n} s», «En espera», «⚠ Requiere atención» (`aviso`: fallo, pantalla desconectada, cierre inesperado o sin respuesta), y sin sesión «Cola {n}». Nombre accesible `ses.ind.aria`.
- Clic: lleva a la Biblioteca (desde otra vista, con la salida normal de esa vista), abre el panel y pone el foco en su primer control. Es el camino para operar la sesión desde Ajustes o desde una vista del espacio de canción.

### Cerrar el reproductor
**Con pendientes** — diálogo `ses.cierre` (480 px) en la ventana **donde se pidió el cierre** (07 §"Cerrar el reproductor con cola"); si fue en la secundaria, el panel de la principal muestra `ses.cierre.esperando` (`role="status"`) y sus controles de sesión quedan inactivos hasta que se responda:
```
┌ Hay canciones en cola ─────────────────────────────────────────┐
│ Quedan 3 canciones pendientes. Si conservas la cola, podrás    │
│ seguir donde lo dejaste al volver a abrir el reproductor. La   │
│ cola se pierde al salir de Shinobi Karaoke.                     │
│                                                                │
│ [Cancelar] [Cerrar y eliminar cola] [Cerrar y conservar cola]  │
└────────────────────────────────────────────────────────────────┘
```
- Foco inicial en «Cancelar»; Esc = Cancelar. «Cerrar y conservar cola» es el primario; «Cerrar y eliminar cola», destructivo.
- Mientras está abierto, la canción sigue sonando y una cuenta en curso queda congelada en la secundaria. Si al confirmar main responde `CONFIRMACION_OBSOLETA` (la cola cambió entretanto, p. ej. terminó la canción), el diálogo actualiza el número de pendientes, muestra `ses.cierre.obsoleto` (`role="alert"`) y pide confirmar otra vez. Si al pedir el cierre ya no quedan pendientes, se cierra sin diálogo.
- Tras conservar: panel en P5 con la última reproducida seleccionada como contexto y el foco en «Abrir en otra pantalla…»; anuncio `ses.anuncio.conservada`. Tras eliminar: panel cerrado, toast `ses.toast.eliminada`, foco en el botón «Cola». Sin pendientes: panel en P6 vacío o cerrado si no hay nada, foco en «Abrir en otra pantalla…».

**Salir de la app con sesión o cola** — diálogo `ses.salir` desde la principal (cerrar la ventana, Ctrl/Cmd + Q, menú). Si además hay trabajos en curso, un solo diálogo: el de spec 04 (`cierre.*`) con la frase `ses.salir.extra` añadida. Foco en «Cancelar». Al confirmar, la secundaria se cierra sin el diálogo de cola. En macOS, cerrar la ventana principal **no** sale de la app: se usa la variante «macOS, cerrar ventana» (la secundaria se cierra y la cola se conserva, como en una caída); Cmd + Q usa la variante normal.

### Recuperación (lado de la principal)
Avisos en banner dentro del panel (bajo el estado de la pantalla), con el indicador en «⚠ Requiere atención»; si el panel está oculto, se abre sin mover el foco y se anuncia.

| Situación | Banner | Acciones |
|---|---|---|
| Se desconecta la pantalla de la secundaria (sigue sonando, en ventana, en la pantalla primaria; decisión del usuario en 0059 §1) | `aviso` `ses.rec.monitor` | [Mover a…] (menú con las pantallas; mueve y restaura pantalla completa) |
| Vuelve a estar conectada | `info` `ses.rec.vuelve` | [Llevar el reproductor allí] · ✕ |
| La secundaria se cerró o se cayó | `error` `ses.rec.caida`; panel en P5 | [Volver a abrir] (abre el diálogo de pantallas con la última elegida) · ✕ |
| La secundaria no responde | `aviso` `ses.rec.noResponde`; desaparece solo si vuelve a responder | [Esperar] (oculta el aviso; vuelve si sigue sin responder 10 s más) · [Cerrar y volver a abrir] (cierre forzado que conserva la cola como en una caída y abre el diálogo de pantallas) |
| Linux con Wayland | Sin banner de pantalla: las acciones que moverían la ventana se sustituyen por `ses.wayland` como información | — |
| La entrada conservada no se pudo reanudar | P3 dentro de la sesión recién abierta | [Pasar a la siguiente canción] / [Descartar] |
| No se pudo abrir | En el diálogo, `ses.error.*` | [Reintentar] |

Se usan banners en el panel y no toasts: el panel es el puesto del operador, los avisos no se apilan ni caducan y el indicador de la barra superior lleva hasta ellos desde cualquier vista.

### Estados nuevos
| Estado | Presentación |
|---|---|
| Sin sesión, sin cola | Como hoy, con «Abrir en otra pantalla…» y «Cola» (sin cifra). Panel cerrado. |
| Sin sesión, cola preparada | P6; tarjetas con `bib.cola.enCola`; «Reproducir» local disponible. |
| Abriendo | Diálogo con «Abriendo…». |
| Sesión: reproduciendo / pausa / cuenta / espera / fin / fallo | P1–P4; indicador con su texto. |
| Confirmando cierre en la secundaria | `ses.cierre.esperando` en el panel; controles de sesión inactivos. |
| Sin sesión, cola conservada | P5. |
| Biblioteca vacía | Sin «Abrir en otra pantalla…» ni «Cola» (nada que poner en cola). |

### Accesibilidad
- Panel `role="complementary"` con nombre `cola.titulo`; `h2` «Cola de reproducción», `h3` «En reproducción», «A continuación ({n})» y «Última reproducida».
- Anuncios `aria-live="polite"` en hitos: sesión abierta y cerrada, entrada que empieza («Suena «{título}».»), inicio de la cuenta y cambio de candidata (los mismos textos de 07), en espera, fin de la cola, cola conservada, reanudación, movimientos y altas en la cola. Nunca cada segundo de la cuenta ni del progreso. Fallos y caídas, `role="alert"`.
- Ninguna acción de la sesión tiene atajo de una sola tecla en la principal (evita pulsaciones accidentales durante un evento); todas son botones alcanzables con Tab.
- Las filas tienen nombre `cola.aria.fila`; el asa es decorativa (`aria-hidden`) y el arrastre siempre tiene equivalente de teclado y de menú.
- Foco: nunca queda en `body` cuando desaparece una fila, el bloque de la activa cambia de estado o se cierra el panel.

### Microcopy (fase 4, biblioteca)
| Clave | Texto |
|---|---|
| `ses.abrir` | Abrir en otra pantalla… (nombre accesible: Abrir el reproductor en otra pantalla…) |
| `ses.dialogo.titulo` | Abrir el reproductor en otra pantalla |
| `ses.dialogo.pantalla` | Pantalla |
| `ses.pantalla.opcion` | Pantalla {n} · {nombre} · {ancho} × {alto} · (sin nombre) Pantalla {n} · {ancho} × {alto} |
| `ses.pantalla.principal` | Principal · Aquí está esta ventana |
| `ses.pantalla.desaparecida` | La pantalla que habías elegido se desconectó. Elige otra. |
| `ses.unaPantalla` | Solo hay una pantalla conectada. El reproductor se abrirá en una ventana aparte; si conectas otra pantalla, aparecerá en esta lista. |
| `ses.completa` | Pantalla completa |
| `ses.completa.misma` | Cubrirá esta ventana. Para volver a ella usa Alt + Tab (Cmd + Tab en macOS), o pulsa F en el reproductor para verlo en una ventana. |
| `ses.audio` | El sonido sale por la salida de audio de tu equipo, no por la pantalla elegida. |
| `ses.empieza` | Empezará con «{título}» — {artista}. · (vacía) La cola está vacía. Añade canciones con «A la cola» y empieza cuando quieras. · (interrumpida) Seguirá «{título}» desde {mm:ss}. · (terminada) La última fue «{título}». Podrás empezar «{siguiente}» cuando quieras. · (terminada, sin pendientes) La última fue «{título}». La cola está vacía. · (con canción) Empezará con «{título}» — {artista}.[ Después seguirán las {n} canciones de la cola.][ «{interrumpida}» ya no seguirá desde {mm:ss}.] |
| `ses.wayland` | En este escritorio el sistema decide dónde se abre el reproductor. Arrástralo a la pantalla del público y pulsa F para verlo a pantalla completa. |
| `cola.pantalla.desconocida` | En otra ventana |
| `ses.error.guardando` | Aún se están guardando cambios de una canción. Espera un momento y vuelve a intentarlo. — [Reintentar] |
| `ses.error.noDisponible` | «{título}» ya no se puede reproducir. Elige otra canción. |
| `bib.menu.otraPantalla` | Reproducir en otra pantalla… |
| `ses.mover` | Mover a… (menú con las pantallas: Pantalla {n} · {nombre}) |
| `ses.bloqueo.nota` | Mientras el reproductor esté abierto no se podrán editar canciones. |
| `ses.boton.abrir` | Cancelar · Abrir reproductor · (cargando) Abriendo… |
| `ses.error.abrir` | No se pudo abrir el reproductor en esa pantalla. Vuelve a intentarlo o elige otra. — [Reintentar] |
| `ses.mostrar` | Mostrar |
| `ses.menu` | Más opciones del reproductor |
| `ses.cambiar` | Cambiar de pantalla… |
| `ses.ventana` | Pantalla completa · Ver en una ventana |
| `ses.cerrar` | Cerrar reproductor |
| `ses.ind` | En otra pantalla · En pausa · Siguiente en {n} s · En espera · Requiere atención · (sin sesión) Cola {n} |
| `ses.ind.aria` | Reproductor en otra pantalla: {estado}. Ir a la cola. · (sin sesión) Cola: {n} pendientes. Ir a la cola. |
| `ses.cierre` | Título: Hay canciones en cola · Cuerpo: Quedan {n} canciones pendientes. Si conservas la cola, podrás seguir donde lo dejaste al volver a abrir el reproductor. La cola se pierde al salir de Shinobi Karaoke. · (n = 1) Queda 1 canción pendiente. … — [Cancelar] [Cerrar y eliminar cola] [Cerrar y conservar cola] |
| `ses.cierre.esperando` | Esperando tu respuesta en la otra pantalla para cerrar el reproductor… |
| `ses.cierre.obsoleto` | La cola cambió mientras confirmabas. Revisa cuántas canciones quedan y elige otra vez. |
| `ses.anuncio.conservada` | Reproductor cerrado. La cola se ha conservado. |
| `ses.toast.eliminada` | Reproductor cerrado. Cola eliminada. |
| `ses.salir` | Título: ¿Salir de Shinobi Karaoke? · Cuerpo: El reproductor de la otra pantalla se cerrará y la cola se perderá. · (sin sesión, con cola) La cola se perderá. — [Cancelar] [Salir] · (macOS, cerrar ventana) Título: ¿Cerrar la ventana? · Cuerpo: El reproductor de la otra pantalla se cerrará. La cola se conservará mientras Shinobi Karaoke siga abierto. — [Cancelar] [Cerrar] |
| `ses.salir.extra` | (se añade a `cierre.cuerpo`) El reproductor de la otra pantalla se cerrará y la cola se perderá. |
| `ses.rec.monitor` | Se desconectó «{pantalla}». El reproductor sigue sonando en una ventana en «{pantalla nueva}». — [Mover a…] |
| `ses.rec.vuelve` | «{pantalla}» vuelve a estar conectada. — [Llevar el reproductor allí] |
| `ses.rec.caida` | El reproductor se cerró de forma inesperada. Se conservó la cola. · (con interrumpida) El reproductor se cerró de forma inesperada. Se conservó la cola y «{título}» seguirá desde {mm:ss}. — [Volver a abrir] |
| `ses.rec.noResponde` | El reproductor no responde. Si lo cierras, la cola se conserva. — [Esperar] [Cerrar y volver a abrir] |
| `cola.titulo` | Cola de reproducción |
| `cola.boton` | Cola {n} · (0) Cola — nombre accesible: Mostrar la cola ({n} pendientes) · Ocultar la cola |
| `cola.ocultar` | Ocultar |
| `cola.pantalla` | {Pantalla n} · {nombre} |
| `cola.modo` | Pantalla completa · En una ventana |
| `cola.activa` | En reproducción |
| `cola.pendientes` | A continuación ({n}) |
| `cola.ultima` | Última reproducida |
| `cola.ultima.interrumpida` | Se detuvo en {mm:ss}. Al abrir el reproductor, seguirá desde ahí. |
| `cola.ultima.terminada` | Terminó. Al abrir el reproductor podrás empezar la siguiente. |
| `cola.cerrado` | Reproductor cerrado |
| `cola.pausa` | Pausa · Reanudar |
| `cola.siguiente` | Siguiente |
| `cola.siguiente.no` | No hay canciones a continuación. |
| `cola.reiniciar` | Reiniciar canción |
| `cola.otraVez` | Agregar otra vez al final |
| `cola.termino` | Terminó «{título}» |
| `cola.cuenta` | Empieza en {n} s: «{título}» |
| `cola.empezarYa` | Empezar ya |
| `cola.detener` | Detener cuenta |
| `cola.espera` | En espera |
| `cola.iniciar` | Iniciar «{título}» |
| `cola.espera.vacia` | Añade una canción con «A la cola» para empezar. |
| `cola.fin` | La cola terminó. Si añades una canción, empezará tras la cuenta. O cierra el reproductor. · Última: {título} — {artista} — [Otra vez] |
| `cola.etiqueta.siguiente` | Siguiente |
| `cola.fallo.titulo` | No se puede reproducir «{título}» |
| `cola.causa` | (`no_encontrada`) Ya no está en la biblioteca. · (`no_lista`) Ya no está lista: volvió a borrador. · (`danada`, faltan pistas) Faltan sus pistas separadas. · (`danada`, no se puede leer `cancion.json`) No se puede abrir la canción. · (`lectura`, `decodificacion`) No se ha podido leer su audio. · (otro) Algo salió mal. |
| `cola.fallo.sinSiguiente` | No hay más canciones en la cola. |
| `cola.pasar` | Pasar a la siguiente canción |
| `cola.descartar` | Descartar |
| `cola.quitar` | Quitar de la cola |
| `cola.llena` | La cola está llena. Quita alguna canción para añadir más. |
| `cola.noDisponible` | ⚠ No disponible: {causa en minúscula} |
| `cola.menu` | Reproducir a continuación · Subir · Bajar · Mover al final · Agregar otra vez al final · Quitar de la cola |
| `cola.vaciar` | Vaciar… (nombre accesible: Vaciar las pendientes…) |
| `cola.dialogo.vaciar` | Título: ¿Quitar las {n} canciones pendientes? · Cuerpo: La canción que suena no se interrumpe. — [Cancelar] [Quitar pendientes] |
| `cola.eliminar` | Eliminar cola… |
| `cola.dialogo.eliminar` | Título: ¿Eliminar la cola? · Cuerpo: Se quitarán las {n} canciones pendientes[ y ya no se podrá seguir «{título}» desde {mm:ss}]. — [Cancelar] [Eliminar cola] |
| `cola.vacia` | No hay canciones pendientes. Usa «A la cola» en una canción lista para añadirla. |
| `cola.vacia.sinSesion` | La cola está vacía. Puedes prepararla antes de abrir el reproductor: usa «Agregar al final» en el menú ⋯ de una canción lista. |
| `cola.toast.final` | «{título}» se agregó al final de la cola (posición {p}). — [Deshacer] · (en espera sin candidata) — [▶ Iniciar ahora] [Deshacer] |
| `cola.toast.siguiente` | «{título}» sonará a continuación. — [Deshacer] |
| `cola.toast.cuenta` | (fin de la cola) «{título}» empieza en {n} s. — [Detener cuenta] |
| `cola.toast.quitada` | «{título}» se quitó de la cola. — [Deshacer] |
| `cola.anuncio.movida` | «{título}», posición {p} de {n}. |
| `cola.anuncio.empieza` | Suena «{título}», de {artista}. |
| `cola.aria.fila` | {p} de {n}: {título}, de {artista}, {duración}[, siguiente][, no disponible: {causa}] |
| `bib.cola.boton` | A la cola — nombre accesible: Agregar «{título}» al final de la cola |
| `bib.menu.cola` | Reproducir a continuación · Agregar al final |
| `bib.cola.sonando` | ▶ Sonando en la otra pantalla |
| `bib.cola.enCola` | En la cola |
| `bib.cola.activaBloqueada` | Se está reproduciendo en la otra pantalla. |
| `bib.cola.dialogo.eliminar` | (se añade al texto de eliminar) También se quitará de la cola. |
| `bib.cola.dialogo.borrador` | (se añade al texto de volver a borrador) Está en la cola: no se podrá reproducir hasta que la marques como lista otra vez. |

### Criterios de aceptación de la fase 4 (biblioteca)
- S1. «Abrir en otra pantalla…» lista todas las pantallas con número, nombre (si lo hay), resolución y la marca «Principal · Aquí está esta ventana»; preselecciona la última usada o la primera no principal; con una sola pantalla muestra `ses.unaPantalla` y «Pantalla completa» desmarcada. Desconectar la pantalla elegida con el diálogo abierto cambia la selección y lo anuncia. La elección y la casilla se recuerdan al reiniciar.
- S2. Si la secundaria no se puede abrir, el diálogo sigue abierto con la selección, muestra `ses.error.abrir` y [Reintentar] lo vuelve a intentar.
- S3. Con la sesión abierta, el panel muestra P1 con la canción activa, progreso de solo lectura actualizado ≥ 1 vez por segundo y [Pausa] [Siguiente] [Reiniciar]; la secundaria responde a cada uno sin que la principal suene.
- S4. «Reproducir a continuación» coloca la entrada en la posición 1 de pendientes y «Agregar al final» en la última, sin interrumpir la activa; la misma canción añadida dos veces aparece como dos filas; [Deshacer] del toast quita solo esa entrada.
- S5. Reordenar por arrastre y por teclado (Alt + ↑/↓, Alt + Inicio/Fin) y desde el ⋯ produce el mismo orden, mantiene el foco en la fila movida, anuncia `cola.anuncio.movida` y no interrumpe la activa. Esc durante el arrastre lo cancela.
- S6. Quitar una pendiente (⋯, Supr) la quita sin confirmación, deja el foco en la fila siguiente (o anterior, o el encabezado) y [Deshacer] la devuelve a su posición.
- S7. Durante la cuenta, el panel muestra P2 con la candidata y el número sincronizado con la secundaria (± 1 s); «Detener cuenta» pasa a P4 y la secundaria a S2; «Empezar ya» la empieza al momento.
- S8. En espera, añadir una canción no la empieza: aparece [▶ Iniciar «{título}»] en el panel y en el toast; pulsarlo la empieza con su pantalla de título. En fin de la cola, añadir una canción empieza la cuenta configurada: el panel pasa a P2 y el toast es `cola.toast.cuenta`; [Detener cuenta] (panel o toast) lleva a espera y [Empezar ya] la empieza al momento.
- S9. Con una entrada fallida, P3 muestra el título y la causa correcta para cada caso (borrada, vuelta a borrador, sin pistas, audio ilegible); nada avanza hasta [Pasar a la siguiente canción] (que empieza la cuenta de la siguiente) o, sin pendientes, [Descartar]. Una pendiente vuelta a borrador muestra `cola.noDisponible` en su fila antes de llegar su turno.
- S10. Durante la sesión, las tarjetas Lista muestran «A la cola» en lugar de «Reproducir» y su portada agrega al final; «Editar» y «Continuar» hacia Letra o Editor muestran el diálogo de bloqueo; Eliminar y Volver a borrador de la canción activa están `aria-disabled` con `bib.cola.activaBloqueada`; Editar datos, Aplicar tema y Añadir canción funcionan.
- S11. Eliminar una canción pendiente avisa con `bib.cola.dialogo.eliminar` y quita todas sus entradas de la cola.
- S12. Cerrar con pendientes desde la principal o la secundaria muestra una sola vez `ses.cierre` en la ventana donde se pidió, con el foco en «Cancelar» (pedido en la secundaria, la principal muestra `ses.cierre.esperando`); si la cola cambia antes de confirmar, aparece `ses.cierre.obsoleto` y hay que confirmar otra vez; «Cerrar y conservar cola» deja P5 con la última reproducida y su segundo, y el foco en «Abrir en otra pantalla…»; «Cerrar y eliminar cola» vacía la cola y cierra el panel; sin pendientes, cerrar no pide confirmación.
- S13. Salir de la app con sesión o con cola pide `ses.salir` (o el diálogo de trabajos con `ses.salir.extra`); al volver a abrir la app la cola está vacía.
- S14. El indicador de sesión aparece con sesión o cola, muestra el estado correcto en cada caso y lleva a la Biblioteca con el panel abierto y el foco dentro, desde Ajustes y desde una vista del espacio de canción.
- S15. Recuperación: desconectar la pantalla de la secundaria muestra `ses.rec.monitor` sin cortar el audio, y [Mover a…] la lleva a otra pantalla; reconectarla, `ses.rec.vuelve` con [Llevar el reproductor allí]; terminar el proceso de la secundaria muestra `ses.rec.caida` con la cola conservada y [Volver a abrir], y libera el bloqueo de edición; con la secundaria sin responder (simulada), `ses.rec.noResponde`; [Cerrar y volver a abrir] la cierra conservando la cola y abre el diálogo de pantallas.
- S15b. «Reproducir en otra pantalla…» del ⋯ de una Lista abre el diálogo con la variante «con canción» de `ses.empieza`; al abrir, esa canción suena primero y las pendientes siguen detrás. En Linux con Wayland el diálogo muestra `ses.wayland` sin lista de pantallas.
- S16. Todo el panel es operable solo con teclado y ninguna acción de sesión tiene atajo de una tecla en la principal; el foco nunca queda en `body`.
- S17. A 1024 × 576 (1280 × 720 al 125 %) con el panel abierto, la rejilla muestra 2 columnas, el panel tiene scroll propio y no hay scroll horizontal.
- S18. Capturas en `docs/ux/revision-fase-4/` con nombre `biblioteca-{ancho}x{alto}-{escala}-{estado}.png` a 1280 × 800 al 100 % y 1280 × 720 al 125 %: `dialogo-pantalla`, `dialogo-una-pantalla`, `sesion`, `cuenta`, `fallo`, `espera`, `fin-cola`, `cola-conservada`, `dialogo-cierre`, `monitor-desconectado`, `caida`, `tarjetas-sesion`.
