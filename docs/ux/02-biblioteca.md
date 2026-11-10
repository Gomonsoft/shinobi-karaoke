# 02 — Biblioteca (vista inicial)

- Paso del pipeline: — (raíz) y 5 (estados borrador/lista)
- ADRs: [0006](../adr/0006-persistencia-y-modelo-de-datos.md), [0004](../adr/0004-separacion-voz-instrumental.md)
- Restricciones: [arquitectura.md "Restricciones e implicaciones para UX" §2–§3](../arquitectura.md)
- Sistema visual: [sistema-visual.md](sistema-visual.md)
- Preguntas: [0005](../preguntas/0005-viabilidad-detalles-ux-fase-0.md) §8 y [0006](../preguntas/0006-ajustes-specs-ux-tras-0005.md) §4 (lista incompleta; respondidas); [0007](../preguntas/0007-textos-y-comportamientos-de-ui-no-definidos-fase-1.md) (textos de la Fase 1; respondida) y [0008](../preguntas/0008-ajustes-ui-tras-revision-fase-1.md) (cambios tras la revisión visual); [0020](../preguntas/0020-huecos-ux-de-la-separacion-fase-3.md) (estados de separación de la Fase 3; respondida)
- Revisión visual de la Fase 1: [revision-fase-1/](revision-fase-1/README.md) (2026-11-04)
- 0.2.0, fase 3 (2026-11-09): agrupación por artista y álbum, búsqueda en álbum, selección múltiple con «Aplicar tema…», tema de artista y álbum y línea de tema en la tarjeta. Ver [Fase 3 · Temas y biblioteca](#fase-3-de-020--temas-y-biblioteca).

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
