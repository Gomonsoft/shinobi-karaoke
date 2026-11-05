# 02 — Biblioteca (vista inicial)

- Paso del pipeline: — (raíz) y 5 (estados borrador/lista)
- ADRs: [0006](../adr/0006-persistencia-y-modelo-de-datos.md), [0004](../adr/0004-separacion-voz-instrumental.md)
- Restricciones: [arquitectura.md "Restricciones e implicaciones para UX" §2–§3](../arquitectura.md)
- Sistema visual: [sistema-visual.md](sistema-visual.md)
- Preguntas: [0005](../preguntas/0005-viabilidad-detalles-ux-fase-0.md) §8 y [0006](../preguntas/0006-ajustes-specs-ux-tras-0005.md) §4 (lista incompleta; respondidas); [0007](../preguntas/0007-textos-y-comportamientos-de-ui-no-definidos-fase-1.md) (textos de la Fase 1; respondida) y [0008](../preguntas/0008-ajustes-ui-tras-revision-fase-1.md) (cambios tras la revisión visual)
- Revisión visual de la Fase 1: [revision-fase-1/](revision-fase-1/README.md) (2026-11-04)

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
| **Filtros** (control segmentado) | Todas / Listas / Borradores, con recuento. Persisten durante la sesión (la búsqueda, no: se vacía al volver a la vista). Las canciones **Dañadas** solo aparecen en *Todas* (no cuentan en Listas ni en Borradores); las listas incompletas cuentan en *Listas*. |
| **Buscar** | Filtra en vivo por título y artista (sin distinguir mayúsculas ni tildes: "cancion" encuentra "Canción"). Ctrl/Cmd+F enfoca. Esc vacía el campo. |
| **Tarjeta — clic en la portada / Intro con la tarjeta enfocada** | Lista → **Reproductor** (spec 07) directamente. Borrador → acción "Continuar". Dañada → abre el menú de recuperación. |
| **▶ Reproducir** (botón de la tarjeta Lista y botón redondo superpuesto en la portada al pasar el ratón/enfocar) | Abre el reproductor a pantalla completa y empieza a sonar sin más pasos. |
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
| Separación cargando modelo | ⟳ Preparando la separación… | barra indeterminada |
| Separando | ⟳ Separando 42 % · quedan unos 3 min | barra |

Tiempo restante en la tarjeta (`bib.eta`, forma corta): «quedan unos {n} min» (n ≥ 2) · «queda alrededor de 1 min» · «queda menos de 1 min». Sin estimación todavía no se muestra tiempo. «En cola» y los estados ⟳ (color `info`) **solo** con un trabajo vivo en el gestor; un paso `pendiente` persistido sin trabajo se muestra como «Falta …» en `texto-2` sin icono. El icono de «en cola» es `clock` (no ⏸, que sugiere una pausa del usuario).
| Error de fuente o separación | ✕ {título del error} | botón Reintentar (o "Ver" si no es reintentable) |
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
| **Éxito tras marcar como lista** | Al volver del editor, la tarjeta recibe el foco, se resalta durante 2 s (borde `exito`) y aparece el toast "«{título}» está lista para cantar. [▶ Reproducir]". |
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
| `bib.eta` | quedan unos {n} min · queda alrededor de 1 min · queda menos de 1 min |
| `bib.dialogo.eliminar` | ¿Eliminar «{título}»? Se moverá a la papelera de tu sistema, con sus pistas y su letra. Podrás recuperarla desde allí. |
| `bib.dialogo.eliminar.trabajo` | (se añade al texto de eliminar) Se cancelará la separación en curso. · Se cancelará la descarga en curso. |
| `bib.datos.titulo` | Editar datos · campos: Título · Artista · Álbum (opcional) · [Cancelar] [Guardar] |
| `bib.datos.error.titulo` | Escribe un título. |
| `bib.arrastrar.varios` | Añade las canciones de una en una. (= `add.varios`) |
| `bib.arrastrar.noadmitido` | Ese tipo de archivo no se puede usar. Prueba con un archivo de audio o de vídeo. |
| `bib.toast.errorgenerico` | {título del error de 00 §7} [Copiar detalles] |
| `bib.dialogo.borrador` | ¿Volver a borrador? «{título}» dejará de poder reproducirse hasta que la marques como lista otra vez. No se pierde nada. |
| `bib.toast.lista` | «{título}» está lista para cantar. |
| `bib.toast.eliminada` | «{título}» se movió a la papelera. |
| `bib.aria.tarjeta` | {título}, {artista}, {estado}. {línea de paso}. |
| `act.boton` | {n} en curso · {n} en curso · {m} en cola · {m} en cola (solo trabajos en cola) |
| `act.terminado` | ✓ Terminado (4 s, solo si alguno terminó bien) |

Revisión 2026-11-04 de los textos escritos en las tareas 0019/0020 sin estar en la spec: **aprobados** «No se pudo cargar tu biblioteca.» + Reintentar, «No se pudo abrir la canción.», «Escribe un título.», «Se cancelará la descarga en curso.», «{m} en cola», «✓ Terminado», no mostrar toast tras «Volver a borrador» y Dañadas solo en *Todas*. **Corregidos**: «No hay canciones que coincidan con el filtro.» → `bib.sinborradores`; «Ese archivo no es de audio ni de vídeo admitido.» → `bib.arrastrar.noadmitido`; «queda 1 min aprox.» / «menos de 1 min» → `bib.eta`; fuente en cola «En cola» → «En cola para descargar»; «En cola para separar» / «Preparando el audio…» sin trabajo vivo → «Falta separar las pistas» / «Falta preparar el audio»; etiqueta «Álbum» → «Álbum (opcional)».

## Criterios de aceptación
1. Al abrir la app con la instalación completa se muestra la Biblioteca con todas las canciones de `biblioteca/`, ordenadas por fecha de modificación descendente.
2. Cada tarjeta muestra título, artista, duración (m:ss), insignia de estado con icono y texto (Lista / Borrador / Dañada) y, en borradores, la línea de paso según la tabla (singular con n = 1; las pausas no cuentan).
2b. Una canción Lista con líneas sin inicio (indicador derivado `incompleta`) mantiene la insignia "✓ Lista", el botón "▶ Reproducir" y su sitio en el filtro *Listas*, y muestra la línea `bib.lista.incompleta` en color `aviso` con icono; al sincronizar todas las líneas la línea desaparece en vivo.
3. En una canción Lista, un único clic en la portada o en "Reproducir" abre el reproductor a pantalla completa y empieza a sonar en menos de 1 s (spec 07).
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
