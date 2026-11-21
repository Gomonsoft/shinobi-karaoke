# 10 — Exportar a video

- Paso del pipeline: 6 (salida), a partir de una canción con pistas separadas y letra sincronizada
- Origen: [plan 0.2.0, fase 6, feature 7](../versiones/0.2.0/plan-2.md#fase-6--exportación), [0050](../preguntas/0050-perfiles-y-concurrencia-exportacion.md) (formato libre con OBS como referencia, 4:3 hasta 2880 × 2160, 16:9 hasta 3840 × 2160, 24/30/60 FPS, exportar durante un evento solo si se puede en paralelo), rondas [R1 UX](../versiones/0.2.0/discusion/r1-disenador-ux.md#7-exportar-a-video), [R2 UX](../versiones/0.2.0/discusion/r2-disenador-ux.md), [R4 UX](../versiones/0.2.0/discusion/r4-disenador-ux.md#0050--exportación) y [R4 arquitectura](../versiones/0.2.0/discusion/r4-arquitecto.md#0050--exportación-libre-y-perfiles)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) (exportación de video, **aceptado**: formatos, catálogo de perfiles, estimaciones, destino y códigos de error), [0005](../adr/0005-letras-y-formato-de-sincronia.md) (`finEfectivo`, desplazamiento), [0006](../adr/0006-persistencia-y-modelo-de-datos.md), [0008](../adr/0008-seguridad-de-electron-y-protocolos-propios.md) (destino elegido en main), [0011](../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md) (render compartido), [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) (sesión en vivo), [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) (degradados en movimiento, comodines, «Letra lista»)
- Specs relacionadas: [04 · Progreso](04-progreso-pipeline.md) (modelo de trabajo largo con cancelación, panel de actividad, cierre con trabajos), [02 · Biblioteca](02-biblioteca.md#fase-6-de-020--exportación) y [06 · Editor](06-editor.md#fase-6-de-020--exportación) (puntos de entrada), [07 · Reproductor](07-reproductor.md) (qué se ve), [sistema visual](sistema-visual.md#020--exportación-de-video-fase-6)
- Preguntas: [0130](../preguntas/0130-decisiones-de-producto-de-la-exportacion.md) (usuario, provisional tomada; su punto 4 queda sin efecto), [0131](../preguntas/0131-contratos-tecnicos-de-la-exportacion.md) (arquitecto, respondida en el ADR 0019)
- Fecha: 2026-11-20 · Revisión: 2026-11-20, alineada con el ADR 0019 (ver «Cambios de esta revisión» al final)

## Objetivo
Convertir una canción en un **archivo de video** que se pueda reproducir fuera de Shinobi Karaoke (otro equipo, una tele con un USB, OBS, un reproductor de video), con la letra, el estilo y los tiempos **idénticos** a los del reproductor, sin tener que esperar mirando la pantalla.

Usuario/tarea principal: «Quiero llevarme este karaoke en un video». Secundaria: «Quiero saber cuánto va a tardar y ocupar, y poder seguir trabajando mientras tanto».

Qué **no** hace (0.2.0): no exporta varias canciones a la vez en una sola acción ([propuesta 006](../propuestas/006-exportar-varias-canciones-a-video.md)), no permite quitar ni personalizar la marca de agua, no recorta la canción ni cambia su velocidad, no sube el video a ningún sitio, no exporta LRC, no ofrece MP4/H.264 ([propuesta 008](../propuestas/008-formato-de-video-de-maxima-compatibilidad.md)).

## Conceptos
| Concepto | Definición |
|---|---|
| **Formato** | Tipo de archivo del video. Dos, los dos libres (ADR 0019 §5): **MKV (AV1 + Opus)**, por defecto, y **WebM (VP9 + Opus)**, más compatible y algo más grande. Llevan la misma imagen y el mismo sonido. |
| **Perfil** | Combinación de proporción (4:3 o 16:9), resolución exacta (ancho × alto) y FPS (24, 30 o 60). Catálogo del ADR 0019 §5: 16:9 → 1280 × 720, 1920 × 1080, 2560 × 1440, 3840 × 2160; 4:3 → 640 × 480, 1024 × 768, 1600 × 1200, 2880 × 2160; cada una a 24, 30 y 60 FPS, en los dos formatos (48 combinaciones). |
| **Perfil no soportado** | Una combinación de perfil y formato que **este equipo no puede producir nunca**: falta el codificador o no admite esa resolución (`motivo: codificador`), el equipo tiene menos memoria de la necesaria (las de 2160 líneas piden 8 GB de RAM, `motivo: memoria`) o no se pudo comprobar (`motivo: no_comprobado`). Es **permanente**: no cambia aunque el usuario cierre cosas. Se informa **al elegirlo**, en el propio selector. Ningún perfil se descarta por ser lento: la exportación no es en tiempo real. |
| **Sesión en otra pantalla** | Exportar y una sesión del reproductor en otra pantalla **pueden convivir** (ADR 0019 §9): no hay bloqueo ni candado, solo la nota informativa `exp.nota.sesion` en el diálogo. |
| **Instantánea** | Copia de lo **guardado** de la canción (letra, desplazamiento, estilo efectivo, tema resuelto, modalidad «Letra lista», pistas) tomada al pulsar «Exportar». Lo que se edite después no cambia el video en marcha. Un borrador se exporta siempre con barrido (la modalidad «Letra lista» solo cuenta en canciones Lista). |
| **Temporal** | Archivo oculto de trabajo que se escribe **en la carpeta de destino** mientras se exporta. Solo al terminar bien pasa a ser el archivo de destino. Si existía un archivo con ese nombre, **se conserva intacto hasta el éxito**. Cancelar o fallar borra el temporal. |

## Qué contiene el video
- **Lo mismo que el reproductor a pantalla completa** en cada instante (spec 07, sistema-visual §10): fondo del estilo (incluidos degradados y su movimiento de la fase 5), línea actual y siguiente, barrido (o, en «Letra lista», cambio de línea sin barrido ni color de resaltado), indicador de entrada `●●●`, comodines de espera de la fase 5, pantalla de título antes de la primera línea. Las proporciones de §10 se calculan sobre el **alto del video**.
- **Sin** controles, cursor, franjas, indicador breve, avisos (`rep.incompleta`), etiqueta `rep.original` ni pantalla final con botones.
- **Duración** = duración del audio de la canción. Empieza en 00:00 y termina en el último fotograma del audio. **Sin silencio previo** (opción provisional, [0130](../preguntas/0130-decisiones-de-producto-de-la-exportacion.md) §3): la pantalla de título y `●●●` funcionan como en la vista previa del editor, que tampoco lo añade.
- **Desplazamiento** (`letra.offset_ms`) aplicado. Líneas sin inicio omitidas. Pausas no dibujadas.
- **Movimiento reducido del equipo no se aplica al video**: el video es el contenido, no la interfaz. Los degradados con movimiento se mueven y la siguiente línea sube en 200 ms, como en un equipo sin esa preferencia.
- **Audio**: «Solo instrumental» o «Instrumental y voz» (la voz al **100 %**, es decir, la canción reconstruida; opción provisional, [0130](../preguntas/0130-decisiones-de-producto-de-la-exportacion.md) §2). Se aplica la ganancia de la canción (`fuente.ganancia_db`); **no** se aplican el volumen general ni el nivel de voz guía del reproductor (son de la sala, no de la canción). Si la mezcla saturaría, se baja entera lo justo (sin recortes). Opus estéreo a 48 kHz en los dos formatos.
- **Marca de agua** «Shinobi Karaoke» durante todo el video (§"Marca de agua").

### Marca de agua
| Aspecto | Valor |
|---|---|
| Texto | `Shinobi Karaoke` (literal, sin traducir, sin rombo). No configurable ni desactivable. |
| Posición | Esquina **inferior derecha**. Margen derecho e inferior = **3 % del alto** del video (el mismo en 4:3 y 16:9). Queda siempre por debajo del 90 % del alto: nunca toca la franja de la letra. |
| Tamaño | Cuerpo `máx(14 px, 2,2 % del alto)`: 16 px en 720p, 24 px en 1080p, 32 px en 1440p, 48 px en 2160p, 14 px en 480p. Atkinson Hyperlegible Next 700. |
| Forma | Píldora `rgba(0,0,0,0.5)`, radio completo, relleno 0,35 em × 0,7 em; texto `#FFFFFF`. |
| Opacidad | Todo el grupo (píldora + texto) al **85 %**. |
| Contraste | Peor caso (fondo blanco puro): texto `#FFFFFF` contra la píldora resultante `≈ #939393` = **3,1:1** (≥ 3:1, texto grande en negrita). Sobre fondos oscuros, > 10:1. No depende del estilo. |
| Determinismo | Misma posición y tamaño en todos los fotogramas; no parpadea ni se anima. |
| Licencia | Es una atribución del programa; **no** concede derechos sobre el audio ni la letra (plan, riesgo de la feature 7). No se dice nada de esto en el video. |

## Puntos de entrada
| Desde | Elemento | Disponible cuando |
|---|---|---|
| Biblioteca | ⋯ de una tarjeta **Lista** (incluidas «Letra lista» y las incompletas): «Exportar video…» | Siempre que la canción no sea Dañada, **también durante una sesión en otra pantalla**. Si esa canción ya se está exportando o espera en cola, el ítem cambia a «Ver exportación» (abre el diálogo en su estado actual). |
| Editor | ⋯ de la cabecera: «Exportar video…» y **Ctrl/Cmd + E** | Separación completada (existe el instrumental), ≥ 1 línea con inicio, fuera del modo «Sincronizar al ritmo» y sin «Error de audio». También en **borradores** (opción provisional, [0130](../preguntas/0130-decisiones-de-producto-de-la-exportacion.md) §1). |
| Panel de actividad | [Ir] de una fila de exportación | Con la exportación en curso o en cola. |
| Toasts | [Ver] de `exp.toast.error`, [Mostrar en la carpeta] de `exp.toast.ok` | — |

Detalle de cada entrada en [02 · Fase 6](02-biblioteca.md#fase-6-de-020--exportación) y [06 · Fase 6](06-editor.md#fase-6-de-020--exportación).

**No disponible** (sigue la regla de sistema-visual §6: `aria-disabled`, enfocable, explica el motivo):
| Motivo | Presentación |
|---|---|
| Editor: separación no completada | Tooltip `exp.motivo.sinPistas`. |
| Editor: ninguna línea con inicio | Tooltip `exp.motivo.sinLineas`. |
| Editor: modo sincronizar / error de audio | Inactivo como el resto del editor en esos estados. |
| El equipo no puede exportar ningún perfil | El ítem **sí** se puede activar: abre el diálogo en el estado «Sin perfiles» (wireframe F), que explica la causa. No se usa candado (no es temporal). |

Una sesión en otra pantalla **no** es motivo de «no disponible»: no hay candado de exportación en ningún punto de entrada.

## Wireframes

### A — Diálogo «Exportar video» (formulario)
Diálogo de exportación (sistema-visual, fase 6): 720 px de ancho (máx. 90 vw), alto máx. 90 vh con scroll en el cuerpo; cabecera y fila de acciones fijas.
```
┌ Exportar video ──────────────────────────────────────────────────────────────┐
│ «Bohemian Rhapsody» · Queen · 5:55                                            │
├──────────────────────────────────────────┬───────────────────────────────────┤
│ Audio                                    │ Muestra                           │
│ [Solo instrumental|Instrumental y voz]   │ ┌───────────────────────────────┐ │
│                                          │ │                               │ │
│ Proporción                               │ │    Is this the real life?     │ │
│ [16:9 · Panorámica|4:3 · Clásica]        │ │    ▔▔▔▔▔▔▔▔▔                  │ │
│                                          │ │     Is this just fantasy?     │ │
│ Resolución                               │ │                               │ │
│ [1920 × 1080 · Full HD             ▾]    │ │             (Shinobi Karaoke) │ │
│                                          │ └───────────────────────────────┘ │
│ Fotogramas por segundo                   │ 1920 × 1080 · 30 FPS · MKV        │
│ [24|30|60]                               │ El video lleva la marca           │
│                                          │ «Shinobi Karaoke» en esta esquina.│
│ Formato                              ⓘ   │                                   │
│ [MKV (AV1 + Opus)|WebM (VP9 + Opus)]     │                                   │
│ Recomendado. Ocupa menos y es el formato │                                   │
│ de OBS. Si tu reproductor no lo abre,    │                                   │
│ usa VLC.                                 │                                   │
│                                          │                                   │
│ Guardar como                             │                                   │
│ [/Users/ana/Movies/Bohemian Rh…(karaoke).mkv] [Cambiar…]                     │
│                                          │                                   │
│ Ocupará unos 40 MB · tardará unos 8 minutos                                  │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ ⓘ notas que apliquen (tabla «Notas del formulario»)                       │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                     [Cancelar]  [Exportar]   │
└──────────────────────────────────────────────────────────────────────────────┘
```
- Dos columnas: formulario (flexible, mín. 360 px) y muestra (256 px de ancho). Por debajo de 760 px de ancho de diálogo, la muestra pasa debajo del título, a 100 % de ancho y máx. 160 px de alto.
- «Formato» es un **control segmentado** de dos opciones con un botón ⓘ junto a la etiqueta y, debajo, la pista `exp.formato.pista` de la opción elegida (ADR 0019 §5, respuesta a [0131](../preguntas/0131-contratos-tecnicos-de-la-exportacion.md) §1).

### B — Exportando
El mismo diálogo cambia de contenido (no se abre otro). Título `exp.progreso.titulo`.
```
┌ Exportando video ─────────────────────────────────────────────────┐
│ «Bohemian Rhapsody» · Queen                                        │
│ 1920 × 1080 · 30 FPS · Solo instrumental · MKV                     │
│                                                                    │
│ ✓  Preparar la canción                                             │
│ ⟳  Crear el video                                                  │
│      Creando el video… 42 %               quedan unos 5 minutos    │
│      ██████████████░░░░░░░░░░░░░░░░░░░░░                           │
│      02:29 de 05:55                                                │
│ ○  Terminar el archivo                                             │
│                                                                    │
│ Puedes cerrar este cuadro y seguir usando Shinobi Karaoke: la      │
│ exportación continúa. Lo que cambies a partir de ahora no entrará  │
│ en este video.                                                     │
├────────────────────────────────────────────────────────────────────┤
│ [Cancelar exportación]                  [Seguir en segundo plano]  │
└────────────────────────────────────────────────────────────────────┘
```
- 560 px (diálogo ancho de sistema-visual, fase 3). «Cancelar exportación» es fantasma a la izquierda; «Seguir en segundo plano» es el primario.

**B2 — En cola**
```
│ 🕒 En cola: empezará cuando termine la exportación de «La flaca».   │
│ ○  Preparar la canción · ○ Crear el video · ○ Terminar el archivo   │
│ [Quitar de la cola]                     [Seguir en segundo plano]  │
```
**B3 — Confirmar cancelación** (en línea, sustituye a la fila de acciones y al texto de ayuda)
```
│ ¿Cancelar la exportación? Se borrará lo que lleva hecho.           │
│ El archivo que ya había con ese nombre no se toca.  ← solo si existía │
│                            [Seguir exportando] [Cancelar exportación] │
```
**B4 — Cancelando**: subpaso actual con barra indeterminada y `exp.cancelando`; botones inactivos. Al terminar, el diálogo se cierra, toast `exp.toast.cancelada` y el foco vuelve al disparador original (o a la superficie de la vista si ya no existe).

### C — Éxito
```
┌ Video exportado ───────────────────────────────────────────┐
│ ✓ «Bohemian Rhapsody» · Queen                              │
│   Bohemian Rhapsody — Queen (karaoke).mkv                  │
│   1920 × 1080 · 30 FPS · MKV · 5:55 · 38 MB                │
│   Tardó 7 min 12 s.                                        │
│   En /Users/ana/Movies                                     │
├────────────────────────────────────────────────────────────┤
│                         [Cerrar] [Mostrar en la carpeta]   │
└────────────────────────────────────────────────────────────┘
```

### D — Fallo
```
┌ No se pudo exportar el video ──────────────────────────────┐
│ ┌────────────────────────────────────────────────────────┐ │
│ │ ✕ No queda espacio en el disco.                        │ │  banner error, role="alert"
│ │   Libera espacio o guarda el video en otra carpeta.    │ │
│ │   El archivo que ya había con ese nombre no se ha      │ │  solo si existía
│ │   tocado.                                              │ │
│ └────────────────────────────────────────────────────────┘ │
│ 1920 × 1080 · 30 FPS · Solo instrumental · MKV             │
│ Se detuvo en 03:12 de 05:55.                                │
├────────────────────────────────────────────────────────────┤
│ [Copiar detalles]          [Cambiar opciones] [Reintentar] │
└────────────────────────────────────────────────────────────┘
```

### E — Archivo existente (variante de A)
```
│ Guardar como                                                       │
│ [/Users/ana/Movies/Bohemian Rhapsody — Queen (karaoke).mkv] [Cambiar…] │
│ ⚠ Ya hay un archivo con este nombre. Se sustituirá solo cuando el  │
│   video nuevo esté terminado; si cancelas o falla, se conserva.    │
│                                       [Cancelar] [Exportar y sustituir] │
```

### F — Sin perfiles (el equipo no puede exportar)
Se muestra cuando **ninguna** combinación de perfil y formato está soportada.
```
┌ Exportar video ─────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✕ Este equipo no puede crear videos.                    │ │
│ │   Falta el codificador de video en el motor de audio.   │ │  causa según motivo / código
│ │   [Reparar el motor de audio]   ← solo con RUNTIME_NO_DISPONIBLE │
│ └─────────────────────────────────────────────────────────┘ │
│                                    [Copiar detalles] [Cerrar] │
└─────────────────────────────────────────────────────────────┘
```
- Causa: todos `motivo: codificador` → `SIN_CODIFICADOR`; todos `no_comprobado` con el motor de audio sin instalar o dañado → `RUNTIME_NO_DISPONIBLE` (con [Reparar el motor de audio]); otro `no_comprobado` → `exp.sinPerfiles.noComprobado`.

## Componentes e interacciones

### Formulario (A)
| Elemento | Comportamiento |
|---|---|
| Cabecera | «{título}» · {artista} · {duración}. Sin artista, se omite su parte. |
| **Audio** | Control segmentado `exp.audio`: «Solo instrumental» (por defecto la primera vez) · «Instrumental y voz». Si la voz no está disponible (falta o no se lee `voz.flac`), la segunda opción está `aria-disabled` con tooltip `exp.audio.sinVoz` y se fuerza «Solo instrumental». |
| **Proporción** | Control segmentado `exp.proporcion`: «16:9 · Panorámica» (por defecto) · «4:3 · Clásica». Cambiarla cambia la lista de resoluciones y la muestra; se elige la resolución equivalente de la otra proporción (misma altura si existe; si no, la más cercana por debajo; si no hay ninguna por debajo, la menor) y se anuncia `exp.anuncio.resolucion`. Equivalencias: de 16:9 a 4:3, 1280 × 720 → 640 × 480, 1920 × 1080 → 1024 × 768, 2560 × 1440 → 1600 × 1200, 3840 × 2160 → 2880 × 2160; de 4:3 a 16:9, 640 × 480 → 1280 × 720, 1024 × 768 → 1280 × 720, 1600 × 1200 → 1920 × 1080, 2880 × 2160 → 3840 × 2160 (si la equivalente no está soportada, la soportada más alta por debajo). |
| **Resolución** | Lista desplegable (como el selector de fuente de sistema-visual §6) con las cuatro resoluciones de esa proporción (catálogo de «Conceptos»), de menor a mayor. Cada opción: «{ancho} × {alto} · {nombre}» (`exp.resolucion.*`); nunca solo el nombre (R4 UX: mostrar la resolución exacta). Una resolución se marca como no soportada si no lo está **a ningún FPS** con el formato elegido (ver «Perfil no soportado»). Por defecto: 1920 × 1080 en 16:9 y 1024 × 768 en 4:3 (o la más alta soportada por debajo). |
| **Fotogramas por segundo** | Control segmentado «24 · 30 · 60», por defecto 30. Nombre accesible `exp.fps.aria`. Las opciones no soportadas **con la resolución y el formato elegidos** se marcan como tales (ver abajo). |
| **Formato** | Control segmentado `exp.formato`: «MKV (AV1 + Opus)» (por defecto) · «WebM (VP9 + Opus)». Debajo, `exp.formato.pista` de la opción elegida (`t-pequeno` `texto-2`, `aria-describedby` del grupo). Botón ⓘ junto a la etiqueta con el popover `exp.formato.ayuda` (clic, Intro o Espacio; Esc lo cierra y devuelve el foco). Si un formato no está soportado con **ningún** perfil, su opción está `aria-disabled` con tooltip `exp.formato.noDisponible` y se elige el otro. Cambiar de formato: cambia la extensión del nombre propuesto, vuelve a calcular la estimación y, si el perfil elegido deja de estar soportado, se aplican las reglas de «Perfil no soportado». |
| **Guardar como** | Campo de solo lectura con la ruta completa (recorte por el centro con «…» si no cabe; ruta entera en `title` y en el nombre accesible) + botón secundario [Cambiar…], que abre el **diálogo «Guardar» del sistema** desde main con la carpeta y el nombre actuales y el filtro de la extensión del formato. Si el usuario escribe otra extensión, main pone la del formato. Cancelar ese diálogo no cambia nada. |
| Destino al cambiar el formato | Main da el destino por formato (ADR 0019 §6, `destinoPropuesto({ cancionId, formato })`). Si el destino era el propuesto, se sustituye por el propuesto del nuevo formato sin aviso (solo cambia la extensión). Si el usuario lo había elegido con [Cambiar…], también se vuelve al propuesto y se anuncia 4 s junto al campo `exp.anuncio.destino` (`role="status"`). Por eso «Formato» va antes que «Guardar como». |
| Nombre propuesto | `exp.nombre`: «{título} — {artista} (karaoke).{ext}» (`.mkv` o `.webm`), sin artista «{título} (karaoke).{ext}». Se sustituyen `/ \ : * ? " < > |` y caracteres de control por «-», se recortan espacios y puntos finales y se limita a 120 caracteres antes de la extensión. |
| Carpeta propuesta | La última usada para exportar si existe y se puede escribir; si no, la carpeta de vídeos del sistema; si tampoco, la carpeta personal. Si la recordada ya no existe, se usa la siguiente y se muestra la nota `exp.nota.carpetaNoDisponible`. No se puede guardar dentro de la carpeta de datos de Shinobi Karaoke (`DESTINO_NO_DISPONIBLE`). |
| **Estimación** | `exp.estimacion` («Ocupará unos {tamaño} · tardará unos {n} minutos»), recalculada al cambiar formato, audio, resolución o FPS (ADR 0019 §11: depende del formato, el perfil, la duración y de si el fondo se mueve, y el tiempo se corrige con lo que tardaron las exportaciones anteriores en este equipo). Es orientativa (± 50 %); la palabra «unos» basta, no se añade otra advertencia. Si main solo da una de las dos cifras, se muestra esa; si ninguna, la fila no aparece. Tamaño en MB < 1 GB y en GB con una cifra decimal a partir de 1 GB («1,4 GB»); tiempo según `exp.estimacion` («menos de 1 minuto» por debajo de 1 min; en horas y minutos desde 60 min: «tardará unos 1 h 20 min»). |
| **Notas** | Bloque de avisos en línea (sistema-visual §6) con las notas que apliquen, en el orden de la tabla «Notas del formulario». |
| **Muestra** | Fotograma fijo en la proporción elegida (sistema-visual, fase 6): fondo del estilo, la primera línea con inicio a medio barrer y la siguiente debajo (como la vista previa del editor en pausa); en «Letra lista», la línea en el color de letra, sin barrido. **Marca de agua** dibujada con sus valores reales escalados al alto de la muestra. Debajo, la resolución, FPS y formato corto elegidos y `exp.muestra.marca`. Decorativa (`aria-hidden`) con descripción `exp.muestra.aria`. El formato no cambia la muestra. |
| **Cancelar** | Secundario. Cierra sin exportar. Esc equivale. |
| **Exportar** | Primario. Texto `exp.boton.exportar` o, con archivo existente, `exp.boton.sustituir`. Al pulsarlo: main valida el perfil, el formato, el destino y la canción, toma la instantánea y el diálogo pasa a B (o B2 si hay otra exportación). Mientras valida: «Exportando…» con spinner (≤ 2 s esperado). Si falla la validación, el diálogo sigue en A con el error en línea junto al campo afectado (tabla de errores). |
| Recordar opciones | Al pulsar «Exportar», se recuerdan formato, audio, proporción, resolución, FPS y carpeta para la próxima vez (no el nombre). Opción provisional, [0130](../preguntas/0130-decisiones-de-producto-de-la-exportacion.md) §5. Si una opción recordada ya no está soportada, se aplica la regla de «Perfil no soportado» sin aviso. |

### Perfil no soportado frente a sesión en otra pantalla
Son dos situaciones **distintas en lugar, forma y texto** (plan, aceptación de la feature 7). Con el ADR 0019 §9 la sesión no bloquea, así que el usuario nunca ve un candado de exportación:

| | Perfil no soportado | Sesión en otra pantalla |
|---|---|---|
| Qué significa | Este equipo no puede producir ese perfil con ese formato | Hay un reproductor en otra pantalla; exportar a la vez se puede, pero usa más recursos |
| Cuándo se ve | Al abrir la lista de resoluciones o recorrer FPS y formatos, **dentro del diálogo** | Dentro del diálogo, en el bloque de notas |
| Forma | Opción en `texto-desactivado` con sufijo `exp.perfil.noDisponible`, **sin candado**; al enfocarla o pasar el ratón, tooltip `exp.perfil.noSoportado` con el motivo | Nota `info` `exp.nota.sesion`; «Exportar» sigue disponible |
| Acción | Elegir otro perfil o formato | Ninguna obligatoria; si hay cortes en la sesión, cancelar la exportación |
| ¿Cambia solo? | No | Sí: la nota aparece o desaparece al momento si la sesión empieza o termina con A abierto |

- Las opciones no soportadas **son enfocables** con las flechas y no se pueden seleccionar (Intro no hace nada; el tooltip se lee con `aria-describedby`).
- Si al cambiar la proporción, la resolución o el formato el FPS elegido deja de estar soportado, se pasa al FPS soportado más alto que no supere al elegido (o al más bajo soportado) y se muestra 4 s, junto al control, `exp.anuncio.fps` (`role="status"`). Si al cambiar el formato la resolución elegida deja de estar soportada a cualquier FPS, se pasa a la soportada más alta por debajo (o a la más baja soportada) y se anuncia `exp.anuncio.resolucion`.
- Si **ninguna** resolución de una proporción está soportada con el formato elegido, esa opción de «Proporción» está `aria-disabled` con `exp.proporcion.noDisponible`.
- **Perfil costoso**: si la estimación supera 30 minutos o 4 GB, o el perfil es de 2160 líneas a 60 FPS, nota `info` `exp.nota.costoso`. No bloquea.

### Notas del formulario
| Orden | Condición | Nivel | Texto |
|---|---|---|---|
| 1 | El destino ya existe | `aviso` (bajo «Guardar como») | `exp.aviso.existe` |
| 2 | Tamaño estimado > espacio libre del disco de destino (ambos conocidos) | `aviso` | `exp.aviso.espacio` |
| 3 | Hay una sesión del reproductor en otra pantalla | `info` | `exp.nota.sesion` |
| 4 | Perfil costoso | `info` | `exp.nota.costoso` |
| 5 | Canción «Letra lista» | `info` | `exp.nota.letraLista` |
| 6 | Lista incompleta (líneas sin inicio) | `aviso` | `exp.nota.incompleta` |
| 7 | Borrador (solo desde el editor) | `info` | `exp.nota.borrador` |
| 8 | La carpeta recordada ya no existe | `info` | `exp.nota.carpetaNoDisponible` |
Ninguna nota bloquea la exportación. El espacio libre lo da main al proponer o elegir el destino; se vuelve a comparar al cambiar destino, formato, audio, resolución o FPS.

### Progreso (B)
| Elemento | Comportamiento |
|---|---|
| Resumen | `exp.resumen`: «{ancho} × {alto} · {fps} FPS · {audio} · {formato corto}» («MKV» o «WebM»). |
| Subpasos | Mismo componente que spec 04 (icono ○ ⟳ ✓ ✕ + nombre + dato). Corresponden a las fases del ADR 0019 §11: **Preparar la canción** (`preparando`: instantánea, fuentes y audio; barra indeterminada, `exp.fase.preparando`) → **Crear el video** (`codificando`: determinada, `exp.fase.creando` con %, tiempo restante y `exp.fase.posicion` «{mm:ss} de {mm:ss}» en `t-tiempo`, calculados a partir de los fotogramas ya escritos) → **Terminar el archivo** (`finalizando`: indeterminada, `exp.fase.terminando`). |
| Barra | Barra de progreso de 12 px (sistema-visual §6). Nunca retrocede. Se actualiza al menos cada 2 s. |
| Tiempo restante | Reglas de spec 04: «Calculando tiempo…» los primeros 15 s, luego `prog.eta` («quedan unos {n} minutos» · «queda 1 minuto aprox.» · «menos de 1 minuto»). |
| Seguir en segundo plano | Primario y **foco inicial**. Cierra el diálogo sin cancelar; el foco vuelve al disparador. **Esc** equivale (nunca cancela). |
| Cancelar exportación | Fantasma. Muestra B3 en línea con el foco en «Seguir exportando». «Cancelar exportación» de B3 es destructivo; pasa a B4. |
| Quitar de la cola (B2) | Retira sin confirmación (no hay nada hecho). Toast `exp.toast.quitada`. |
| Reabrir | [Ir] del panel de actividad, «Ver exportación» del ⋯ de la tarjeta o [Ver] de un toast abren el diálogo en el estado actual (B, B2, C o D). |

### Al terminar
| Situación | Comportamiento |
|---|---|
| Éxito con el diálogo abierto | Pasa a C. Foco en «Mostrar en la carpeta» (primario). Anuncio `exp.anuncio.ok`. |
| Éxito con el diálogo cerrado | Toast `exp.toast.ok` con [Mostrar en la carpeta] (con acción: no se cierra solo). Con la ventana sin foco: notificación del sistema / Dock como en spec 04 §3. El diálogo C queda disponible desde el toast hasta que se cierre el toast. |
| Mostrar en la carpeta | Abre el explorador del sistema en la carpeta del video. En **Windows y macOS** el archivo queda **seleccionado**; en **Linux** se abre la carpeta y la selección depende del gestor de archivos (puede no seleccionarlo). No se muestra ningún aviso por ello. Si el archivo ya no existe, toast `exp.toast.noExiste`. |
| Fallo con el diálogo abierto | Pasa a D, `role="alert"`, foco en «Reintentar» (o en la acción principal del error). |
| Fallo con el diálogo cerrado | Toast `error` persistente `exp.toast.error` con [Ver] (abre D). Notificación como en spec 04 §3. |
| Reintentar (D) | Vuelve a exportar con las mismas opciones y una **instantánea nueva** (la canción puede haber cambiado). |
| Cambiar opciones (D) | Vuelve a A con las opciones anteriores. |
| Copiar detalles | Copia código, mensaje técnico, perfil, formato, posición alcanzada y versión de la app; toast «Detalles copiados.» (el de las demás specs). |

### Varias exportaciones
- **Una exportación a la vez**, en una cola propia de la exportación; las demás esperan en cola (B2, `exp.cola`).
- La exportación **no** comparte cola con la separación: una canción recién añadida se separa aunque haya una exportación en marcha, y las dos avanzan a la vez (la exportación cede recursos).
- Una canción solo puede tener **una** exportación en curso o en cola: su punto de entrada pasa a «Ver exportación».
- Si el destino coincide con el de otra exportación en curso o en cola, «Exportar» muestra `exp.error.destinoOcupado` junto al campo.

### Interacción con otras acciones
| Acción durante la exportación | Comportamiento |
|---|---|
| Editar letra, estilo, tema, datos de esa canción | Permitido. No cambia el video en marcha (instantánea). |
| Volver a borrador esa canción | Permitido; la exportación sigue. |
| **Eliminar…** esa canción | El diálogo de eliminar añade `exp.eliminar.extra`; al confirmar se cancela la exportación (con limpieza) antes de mover a la papelera. |
| Abrir el reproductor local | Permitido. Si el equipo no da abasto puede haber tirones: la exportación no se pausa sola. |
| Abrir una sesión en otra pantalla | Permitido: el diálogo de pantallas (spec 02 · Fase 4) no cambia, la sesión se abre normalmente y la exportación (y las de la cola) sigue. La exportación nunca se pausa ni se cancela por la sesión. |
| Exportar con una sesión ya abierta | Permitido, con la nota `exp.nota.sesion` en A. |
| Reparar el motor de audio (spec 04) | La exportación cuenta como un trabajo más en `prog.dialogo.reparar`: se cancela con limpieza. |
| El equipo se suspende | Mientras haya una exportación en curso, la app pide al sistema que **no se suspenda**; la pantalla sí puede apagarse. |

### Cerrar la app durante una exportación
- **Diálogo de cierre de spec 04 §3**: la exportación (en curso o en cola) cuenta como trabajo en `{n}` y en `{lista breve}` con el texto `exp.cierre.item` («exportar «{título}»»). Al cuerpo `cierre.cuerpo` se añade `exp.cierre.extra`. Foco en «Seguir trabajando» como siempre. Si además hay sesión o cola, un solo diálogo (regla de spec 02 · Fase 4).
- «Cerrar de todos modos»: se cancela la exportación, se borra el temporal y el archivo que ya existía queda intacto. Al volver a abrir la app **no** se muestra nada (el usuario ya lo sabía).
- **Cierre inesperado** (caída, apagado): al volver a abrir, main borra los restos de la exportación sin terminar y muestra **una vez** el toast `aviso` `exp.toast.interrumpida` con [Exportar video…] (abre A con las opciones recordadas). Si el temporal no se pudo borrar, `exp.toast.limpieza`.
- **macOS, cerrar la ventana principal**: la app sigue abierta (spec 02 · Fase 4) y la exportación continúa; al volver a mostrar la ventana, el panel de actividad la sigue mostrando. Cmd + Q usa el diálogo normal.

## Teclado y accesibilidad
- Diálogo modal estándar: atrapa el foco, `aria-labelledby` = título del estado actual, `aria-describedby` = cabecera de la canción. Foco inicial: A → «Audio» (opción seleccionada); B/B2 → «Seguir en segundo plano»; B3 → «Seguir exportando»; C → «Mostrar en la carpeta»; D → «Reintentar»; F → «Cerrar» (o «Reparar el motor de audio»).
- Esc: A cancela (con un popover abierto, primero cierra el popover); B/B2 cierra sin cancelar; B3 vuelve a B; C y D cierran; F cierra. Al cerrar, el foco vuelve al disparador; si ya no existe (p. ej. se abrió desde un toast), a la superficie de la vista.
- Orden de tabulación en A: Audio → Proporción → Resolución → FPS → ⓘ formato → Formato → [Cambiar…] → enlaces de notas (si los hay) → Cancelar → Exportar. La muestra no recibe foco.
- Controles segmentados (también «Formato») con `role="radiogroup"` y flechas; la lista de resoluciones con `role="listbox"`, flechas, Inicio/Fin y búsqueda por tecleo de cifras.
- Cada control tiene etiqueta visible asociada. «Guardar como» se lee como «Guardar como, {ruta completa}». El grupo «Formato» se describe con `exp.formato.pista`.
- Anuncios (`aria-live="polite"`, solo en hitos, sistema-visual §7): inicio (`exp.anuncio.inicio`), cada subpaso, 25/50/75 % de «Crear el video», éxito, cancelación. Errores con `role="alert"`. Nunca cada actualización de porcentaje ni el tiempo.
- Ctrl/Cmd + E solo en el editor (spec 06); en la Biblioteca la entrada es el ⋯ (tecla Menú o Mayús + F10 sobre la tarjeta).
- Contraste: todos los textos del diálogo usan `texto-1/2/3` sobre `fondo-1/2` (≥ 5,4:1). La marca de agua cumple ≥ 3:1 sobre cualquier fondo (§"Marca de agua"). El contraste de la letra del video es el del estilo: si el editor muestra un aviso de contraste, el diálogo **no** lo repite (no se bloquea la exportación por ello).
- A 1024 × 576 el diálogo cabe con scroll en el cuerpo, la cabecera y los botones quedan visibles y no hay scroll horizontal.

## Estados
| Estado | Presentación |
|---|---|
| Vacío | No aplica: solo se abre desde una canción. |
| Cargando perfiles | La **primera apertura** del diálogo en cada arranque de la app comprueba qué puede exportar el equipo (~1–2 s, ADR 0019 §5); las siguientes responden al momento. Si main tarda > 300 ms en dar perfiles: controles en esqueleto y «Exportar» inactivo con «Comprobando qué puede exportar tu equipo…» (`exp.cargando`). Esc y «Cancelar» siguen activos. |
| Formulario | A (E si el destino existe). |
| Validando | «Exportando…» en el primario, controles inactivos. |
| En cola | B2. Tarjeta: `bib.exp.cola`. Panel de actividad: fila con 🕒. |
| Procesando | B. Tarjeta y panel con porcentaje. |
| Cancelando | B4. |
| Éxito | C o toast. |
| Error | D o toast persistente. |
| Sin perfiles | F. |
| Interrumpido por cierre inesperado | Toast `exp.toast.interrumpida` al reabrir. |
| Borrador | Solo cambia la nota `exp.nota.borrador`; exportar no cambia el estado de la canción. |

## Errores
Códigos finales del ADR 0019 §10. Los de validación se muestran en A junto al campo; los de ejecución, en D. Todo error de ejecución informa de la posición alcanzada: D muestra siempre `exp.error.posicion` (o su variante si falló antes del primer fotograma). Main traduce `ENTRADA_INCOMPLETA` y `PROCESO_TERMINADO`: la cancelación propia no es un error (B4), una caída llega como `ERROR_INTERNO` y un proceso cerrado por el sistema por falta de memoria, como `MEMORIA_INSUFICIENTE`. No existe `EXPORTACION_BLOQUEADA`.

| Código | Dónde | Título | Explicación y acciones |
|---|---|---|---|
| `SIN_ESPACIO` | D | No queda espacio en el disco. | Libera espacio o guarda el video en otra carpeta. — [Cambiar opciones] [Reintentar] |
| `DESTINO_NO_DISPONIBLE` | A (junto a «Guardar como») o D | No se puede guardar en esa carpeta. | Puede que no tengas permiso, que el disco se haya desconectado o que el archivo esté abierto en otro programa. Elige otra carpeta o cierra ese programa. — [Cambiar…] / [Cambiar opciones] [Reintentar] |
| `DESTINO_OCUPADO` | A | Ya se está exportando un video a ese archivo. | Elige otro nombre o espera a que termine. — [Cambiar…] |
| `CANCION_NO_DISPONIBLE` | A o D | No se encuentran las pistas de esta canción. | Puede que se hayan borrado. Revisa la canción en la biblioteca. — [Cerrar] |
| `PERFIL_NO_SOPORTADO` | A o D | Tu equipo no puede crear el video con estas opciones. | Prueba con otra resolución, menos fotogramas por segundo u otro formato. — [Cambiar opciones] |
| `MEMORIA_INSUFICIENTE` | D | Tu equipo se quedó sin memoria. | Cierra otros programas o elige una resolución menor. — [Cambiar opciones] [Reintentar] |
| `RUNTIME_NO_DISPONIBLE` | F o D | Hay que reparar el motor de audio. | Falta una parte del motor que crea el video. — [Reparar el motor de audio] (spec 04) [Copiar detalles] |
| `SIN_CODIFICADOR` | F, o D si ocurre al exportar | Este equipo no puede crear videos en este formato. | Falta el codificador de video. Prueba con el otro formato. — en D: [Cambiar opciones] [Copiar detalles]; en F (ningún formato): `exp.sinPerfiles.titulo` con [Copiar detalles] [Cerrar] |
| `LIMPIEZA_FALLIDA` | Toast `aviso` tras cancelar, fallar o reabrir tras una caída | No se pudo borrar un archivo temporal. | Puedes borrarlo a mano. — [Mostrar en la carpeta] |
| `ERROR_INTERNO` | D (o F si falla la comprobación inicial) | Algo salió mal al crear el video. | Vuelve a intentarlo. — [Copiar detalles] [Reintentar] |
En D, si existía un archivo con el nombre de destino, siempre se añade `exp.error.conservado`.

## Microcopy
| Clave | Texto |
|---|---|
| `exp.menu` | Exportar video… · (en curso o en cola) Ver exportación |
| `exp.titulo` | Exportar video |
| `exp.audio` | Audio: Solo instrumental · Instrumental y voz |
| `exp.audio.sinVoz` | La voz de esta canción no está disponible. |
| `exp.proporcion` | Proporción: 16:9 · Panorámica · 4:3 · Clásica |
| `exp.proporcion.noDisponible` | Tu equipo no puede crear videos en esta proporción con este formato. |
| `exp.resolucion` | Resolución |
| `exp.resolucion.*` | 16:9: 1280 × 720 · HD · 1920 × 1080 · Full HD · 2560 × 1440 · QHD · 3840 × 2160 · 4K UHD — 4:3: 640 × 480 · SD · 1024 × 768 · XGA · 1600 × 1200 · UXGA · 2880 × 2160 · 4:3 máxima |
| `exp.fps` | Fotogramas por segundo |
| `exp.fps.aria` | Fotogramas por segundo: {n} |
| `exp.formato` | Formato: MKV (AV1 + Opus) · WebM (VP9 + Opus) · (formato corto) MKV · WebM |
| `exp.formato.pista` | (MKV) Recomendado. Ocupa menos y es el formato de OBS. Si tu reproductor no lo abre, usa VLC. · (WebM) Se abre en más sitios: navegadores (también Safari), Windows y Android. Ocupa algo más. |
| `exp.formato.ayuda` | Título: Qué formato elegir · Los dos son formatos libres y llevan la misma imagen y el mismo sonido; cambian el tamaño del archivo y los programas que lo abren. · **MKV (AV1 + Opus)**: ocupa menos. Lo abren VLC, OBS, Chrome y Firefox. En Windows, el Reproductor multimedia necesita la «Extensión de video AV1», gratuita en Microsoft Store. En ordenadores de antes de 2020, un video 4K a 60 FPS puede verse a tirones. · **WebM (VP9 + Opus)**: se abre en más sitios: todos los navegadores (también Safari), el Reproductor multimedia de Windows, Android, VLC y OBS. Ocupa algo más. · Ninguno de los dos se abre con QuickTime (Mac): usa VLC o IINA. Algunos televisores no admiten ninguno: si no se ve, reprodúcelo desde el ordenador. |
| `exp.formato.noDisponible` | Tu equipo no puede crear videos en este formato. |
| `exp.perfil.noDisponible` | (sufijo) — no disponible en este equipo |
| `exp.perfil.noSoportado` | {ancho} × {alto} a {fps} FPS en {formato corto} no está disponible en este equipo: {motivo}. · Motivos: (`codificador`) el formato elegido no admite esta resolución en tu equipo · (`memoria`) hace falta un equipo con al menos 8 GB de memoria · (`no_comprobado`) no se pudo comprobar |
| `exp.anuncio.fps` | Tu equipo no admite {fps anterior} FPS con estas opciones. Se ha elegido {fps nuevo}. |
| `exp.anuncio.resolucion` | Resolución: {ancho} × {alto}. |
| `exp.anuncio.destino` | Al cambiar el formato se ha vuelto a proponer el nombre: {nombre}. Usa «Cambiar…» para elegir otro. |
| `exp.destino` | Guardar como |
| `exp.destino.cambiar` | Cambiar… |
| `exp.nombre` | {título} — {artista} (karaoke).{mkv\|webm} · (sin artista) {título} (karaoke).{mkv\|webm} |
| `exp.estimacion` | Ocupará unos {tamaño} · tardará unos {n} minutos · (≥ 60 min) tardará unos {h} h {m} min · (< 1 min) tardará menos de 1 minuto |
| `exp.muestra` | Muestra |
| `exp.muestra.marca` | El video lleva la marca «Shinobi Karaoke» en esta esquina. |
| `exp.muestra.aria` | Muestra del video: la letra con el estilo de la canción y la marca «Shinobi Karaoke» abajo a la derecha. |
| `exp.aviso.existe` | Ya hay un archivo con este nombre. Se sustituirá solo cuando el video nuevo esté terminado; si cancelas o falla, se conserva. |
| `exp.aviso.espacio` | Puede que no haya espacio: el video ocuparía unos {tamaño} y quedan {libre} libres en ese disco. |
| `exp.nota.sesion` | El reproductor está abierto en otra pantalla. Exportar a la vez usa más recursos del equipo: si notas cortes en la canción, cancela la exportación. |
| `exp.nota.costoso` | Con estas opciones el video tardará bastante y ocupará mucho. Para una prueba rápida, elige una resolución menor. |
| `exp.nota.letraLista` | Letra lista: en el video la letra cambiará línea a línea, sin barrido, igual que en el reproductor. |
| `exp.nota.incompleta` | Faltan {n} líneas por sincronizar: no se verán en el video. · (n = 1) Falta 1 línea por sincronizar: no se verá en el video. |
| `exp.nota.borrador` | Esta canción aún es un borrador. El video se hará con lo que tiene ahora, con barrido. |
| `exp.nota.carpetaNoDisponible` | La carpeta que usaste la última vez ya no está disponible. Se guardará en {carpeta}. |
| `exp.cargando` | Comprobando qué puede exportar tu equipo… |
| `exp.boton.cancelar` | Cancelar |
| `exp.boton.exportar` | Exportar · (validando) Exportando… |
| `exp.boton.sustituir` | Exportar y sustituir |
| `exp.progreso.titulo` | Exportando video |
| `exp.resumen` | {ancho} × {alto} · {fps} FPS · {Solo instrumental / Instrumental y voz} · {MKV / WebM} |
| `exp.sub.preparar` | Preparar la canción |
| `exp.sub.crear` | Crear el video |
| `exp.sub.terminar` | Terminar el archivo |
| `exp.fase.preparando` | Preparando la canción… |
| `exp.fase.creando` | Creando el video… {n} % |
| `exp.fase.posicion` | {mm:ss} de {mm:ss} |
| `exp.fase.terminando` | Terminando el archivo… |
| `exp.ayuda.segundoPlano` | Puedes cerrar este cuadro y seguir usando Shinobi Karaoke: la exportación continúa. Lo que cambies a partir de ahora no entrará en este video. |
| `exp.boton.segundoPlano` | Seguir en segundo plano |
| `exp.boton.cancelarExp` | Cancelar exportación |
| `exp.cola` | En cola: empezará cuando termine la exportación de «{otra}». · (posición > 1) {p}.ª en la cola. |
| `exp.boton.quitarCola` | Quitar de la cola |
| `exp.dialogo.cancelar` | ¿Cancelar la exportación? Se borrará lo que lleva hecho. · (si existía) El archivo que ya había con ese nombre no se toca. — [Seguir exportando] [Cancelar exportación] |
| `exp.cancelando` | Cancelando y borrando el archivo temporal… |
| `exp.ok.titulo` | Video exportado |
| `exp.ok.detalle` | {nombre del archivo} · {ancho} × {alto} · {fps} FPS · {formato corto} · {duración} · {tamaño} · Tardó {duración del trabajo}. · En {carpeta} |
| `exp.boton.mostrar` | Mostrar en la carpeta |
| `exp.boton.cerrar` | Cerrar |
| `exp.error.titulo` | No se pudo exportar el video |
| `exp.error.posicion` | Se detuvo en {mm:ss} de {mm:ss}. · (antes del primer fotograma) Se detuvo mientras preparaba la canción. |
| `exp.error.conservado` | El archivo que ya había con ese nombre no se ha tocado. |
| `exp.error.*` | Ver tabla «Errores» (título en negrita + explicación). |
| `exp.boton.reintentar` | Reintentar |
| `exp.boton.opciones` | Cambiar opciones |
| `exp.boton.copiar` | Copiar detalles |
| `exp.sinPerfiles.titulo` | Este equipo no puede crear videos. |
| `exp.sinPerfiles.noComprobado` | No se pudo comprobar qué videos puede crear tu equipo. Cierra este cuadro y vuelve a intentarlo; si sigue igual, reinicia Shinobi Karaoke. |
| `exp.motivo.sinPistas` | Podrás exportar cuando termine la separación. |
| `exp.motivo.sinLineas` | Sincroniza al menos una línea para exportar. |
| `exp.eliminar.extra` | (se añade al texto de eliminar) Se cancelará la exportación de video en curso. |
| `exp.cierre.item` | exportar «{título}» |
| `exp.cierre.extra` | (se añade a `cierre.cuerpo`) Los videos a medio exportar no se guardarán; los archivos que ya existían no se tocan. |
| `exp.toast.ok` | «{título}»: video exportado. — [Mostrar en la carpeta] |
| `exp.toast.error` | «{título}»: no se pudo exportar el video. — [Ver] |
| `exp.toast.cancelada` | Exportación cancelada. |
| `exp.toast.quitada` | «{título}» ya no está en la cola de exportación. |
| `exp.toast.noExiste` | El video ya no está en esa carpeta. |
| `exp.toast.interrumpida` | La exportación de «{título}» no terminó porque Shinobi Karaoke se cerró. — [Exportar video…] |
| `exp.toast.limpieza` | No se pudo borrar un archivo temporal. Puedes borrarlo a mano. — [Mostrar en la carpeta] |
| `exp.anuncio.inicio` | Exportando «{título}». |
| `exp.anuncio.ok` | Video exportado. |
| `act.exp` | (panel de actividad) {título} — Exportando video {n} % · {título} — En cola para exportar · {título} — Preparando el video… · {título} — Terminando el video… |
| `bib.exp.linea` | ⟳ Exportando video {n} % · quedan unos {n} min |
| `bib.exp.cola` | 🕒 En cola para exportar |
Formato: «×» con espacios finos o normales a ambos lados (`1920 × 1080`), FPS en mayúsculas, coma decimal («1,4 GB»), tiempos `mm:ss` (`h:mm:ss` desde 1 h).

Retiradas en la revisión del 2026-11-20 (no se implementan): `exp.bloqueo.titulo`, `exp.bloqueo.cuerpo`, `exp.bloqueo.aria`, `ses.exportando`, `ses.exportando.boton`, `exp.cola.separacion` y `exp.cola.sesion`.

## Criterios de aceptación
**Entrada**
- V1. El ⋯ de una tarjeta Lista (también «Letra lista» e incompleta) ofrece «Exportar video…», también con una sesión abierta en otra pantalla; el de un borrador o una canción Dañada, no. Con esa canción exportándose o en cola, el ítem es «Ver exportación» y abre el diálogo en su estado.
- V2. En el editor, «Exportar video…» del ⋯ y Ctrl/Cmd + E abren el diálogo tras vaciar el guardado pendiente; con la separación sin completar o sin líneas con inicio, el ítem está `aria-disabled` con `exp.motivo.sinPistas` / `exp.motivo.sinLineas` y Ctrl/Cmd + E no hace nada; en el modo sincronizar no hace nada.

**Formulario**
- V3. El diálogo muestra Audio, Proporción, Resolución (cada opción con «ancho × alto»), FPS 24/30/60, Formato (control de dos opciones con «MKV (AV1 + Opus)» elegido por defecto la primera vez), Guardar como con [Cambiar…], estimación, notas y la muestra con la marca de agua; el foco inicial está en Audio y Esc lo cierra sin exportar.
- V4. Con 16:9 la lista de resoluciones es exactamente 1280 × 720 · HD, 1920 × 1080 · Full HD, 2560 × 1440 · QHD y 3840 × 2160 · 4K UHD; con 4:3, 640 × 480 · SD, 1024 × 768 · XGA, 1600 × 1200 · UXGA y 2880 × 2160 · 4:3 máxima. Cambiar de proporción cambia la muestra a esa proporción y elige la resolución equivalente de la tabla de «Proporción».
- V5. Con una combinación marcada como no soportada por main (doble de prueba con cada `motivo`: `codificador`, `memoria`, `no_comprobado`), su opción aparece con `exp.perfil.noDisponible`, sin candado, enfocable con flechas, no seleccionable y con el texto del motivo en el tooltip; si al cambiar de resolución o de formato el FPS elegido deja de estar soportado, se cambia al soportado más alto que no lo supere y se muestra `exp.anuncio.fps`. En un equipo doble con menos de 8 GB, las resoluciones de 2160 líneas aparecen no disponibles con el motivo de memoria.
- V6. Sin voz disponible, «Instrumental y voz» está `aria-disabled` con `exp.audio.sinVoz` y se exporta solo el instrumental.
- V7. [Cambiar…] abre el diálogo «Guardar» del sistema con la carpeta y el nombre propuestos (`exp.nombre`, con caracteres no válidos sustituidos y la extensión del formato); cancelarlo no cambia el destino.
- V8. Si el destino existe, se muestra `exp.aviso.existe` y el primario dice «Exportar y sustituir».
- V9. Las notas aparecen según su condición y en el orden de la tabla; ninguna impide exportar. Con un doble de main que devuelve un tamaño estimado mayor que `libreBytes`, aparece `exp.aviso.espacio`; con cualquiera de los dos a `null`, no.
- V10. Al exportar, las opciones (formato incluido, no el nombre) se recuerdan y la siguiente apertura las propone.

**Progreso, cancelación y limpieza**
- V11. Tras «Exportar», el diálogo muestra B con los tres subpasos, porcentaje que no retrocede, posición «mm:ss de mm:ss» y tiempo restante según spec 04; «Seguir en segundo plano» y Esc lo cierran sin cancelar, y la exportación sigue en el panel de actividad y en la tarjeta (`bib.exp.linea`).
- V12. Una segunda exportación espera en cola (B2, `bib.exp.cola`, fila con 🕒 en el panel) y empieza sola al terminar la primera; «Quitar de la cola» la retira sin confirmación. Una separación lanzada durante una exportación avanza sin esperar a que termine.
- V13. «Cancelar exportación» (diálogo, ✕ del panel de actividad o ⋯ de la tarjeta) pide confirmación con el foco en «Seguir exportando»; al confirmar, el temporal desaparece del disco, **no** queda archivo de destino nuevo y un archivo previo con ese nombre conserva su contenido y fecha (comprobado por hash).
- V14. Editar la letra, el estilo o el tema de la canción durante la exportación no cambia el video resultante (instantánea): el video coincide con el estado guardado en el momento de pulsar «Exportar».

**Resultado**
- V15. Al terminar, C muestra nombre, resolución, FPS, formato, duración, tamaño y tiempo empleado; «Mostrar en la carpeta» abre el explorador en la carpeta del video, con el archivo seleccionado en Windows y macOS (en Linux basta con que abra la carpeta). Con el diálogo cerrado aparece `exp.toast.ok` con esa acción.
- V16. El archivo tiene la resolución, los FPS (constantes), el formato elegido (`.mkv` con AV1 + Opus o `.webm` con VP9 + Opus) y la duración (± 1 fotograma), y audio estéreo con el instrumental (o instrumental + voz al 100 %) con la ganancia de la canción (comprobado con un analizador de medios en el test de integración, en los dos formatos).
- V17. Con letra y audio generados con tiempos conocidos, el modelo de fotograma que pinta el render de exportación para el fotograma `n` es **idéntico** al que produce el render compartido para el tiempo `n / FPS` (línea actual, siguiente, barrido, `●●●`, título y desplazamiento aplicados); sobre el video decodificado, las sondas de color en zonas planas difieren ≤ 16 niveles por canal (ADR 0019 §2).
- V18. Una canción «Letra lista» se exporta con la línea activa en color de letra uniforme, sin barrido ni color de resaltado, con los mismos tiempos; un borrador se exporta siempre con barrido.
- V19. La marca de agua aparece en todos los fotogramas, abajo a la derecha con margen del 3 % del alto, cuerpo `máx(14 px, 2,2 % del alto)`, píldora `rgba(0,0,0,0.5)` y opacidad 85 %, en 4:3 y en 16:9, y nunca se superpone a la letra.

**Fallos**
- V20. Cada código de la tabla «Errores» (`SIN_ESPACIO`, `DESTINO_NO_DISPONIBLE`, `DESTINO_OCUPADO`, `CANCION_NO_DISPONIBLE`, `PERFIL_NO_SOPORTADO`, `MEMORIA_INSUFICIENTE`, `RUNTIME_NO_DISPONIBLE`, `SIN_CODIFICADOR`, `LIMPIEZA_FALLIDA`, `ERROR_INTERNO`) muestra su título, explicación y acciones (doble de prueba por código); en los de ejecución, D muestra `exp.error.posicion`, el temporal se borra y un archivo previo se conserva, con `exp.error.conservado`. «Reintentar» toma una instantánea nueva; «Cambiar opciones» vuelve a A con las opciones anteriores; «Copiar detalles» copia el código.
- V21. Un fallo con el diálogo cerrado muestra `exp.toast.error` persistente con [Ver], que abre D.
- V22. Si la limpieza falla, aparece `exp.toast.limpieza` con «Mostrar en la carpeta».

**Sesión en otra pantalla**
- V23. Con una sesión abierta, «Exportar video…» está disponible sin candado, A muestra `exp.nota.sesion` y «Exportar» sigue activo; si la sesión empieza o termina con A abierto, la nota aparece o desaparece sin cerrar el diálogo. Abrir una sesión con una exportación en curso no cambia el diálogo de pantallas y la exportación sigue; la sesión no se interrumpe. En ningún caso aparece un candado ni el texto de un bloqueo, y «no disponible en este equipo» solo se usa para perfiles no soportados.
- V24. *(Retirado en la revisión del 2026-11-20: exportar y la sesión conviven, ADR 0019 §9. Se conserva el número para no desplazar los demás.)*

**Cierre de la app**
- V25. Cerrar la app con una exportación en curso o en cola muestra el diálogo de spec 04 con `exp.cierre.item` en la lista y `exp.cierre.extra`; «Seguir trabajando» no cambia nada; «Cerrar de todos modos» borra el temporal y conserva un archivo previo. Al reabrir no aparece ningún aviso.
- V26. Tras matar el proceso durante una exportación, al reabrir se borran los restos (temporal en la carpeta de destino) y aparece una sola vez `exp.toast.interrumpida` con el título de la canción.

**Accesibilidad y layout**
- V27. Todo el diálogo es operable con teclado en todos sus estados, con los focos iniciales y el comportamiento de Esc de §"Teclado y accesibilidad"; el foco vuelve al disparador al cerrar y nunca queda en `body`.
- V28. Los lectores de pantalla reciben solo los hitos (inicio, subpasos, 25/50/75 %, éxito, cancelación) y los errores como `alert`.
- V29. A 1024 × 576 y a 1280 × 800 el diálogo cabe sin scroll horizontal y con cabecera y botones visibles. Capturas en `docs/ux/revision-fase-6/` con nombre `exportacion-{ancho}x{alto}-{escala}-{estado}.png` a 1280 × 800 al 100 % y 1280 × 720 al 125 %: `formulario`, `formulario-4x3`, `formulario-webm`, `ayuda-formato`, `perfil-no-soportado`, `archivo-existe`, `nota-sesion`, `exportando`, `en-cola`, `confirmar-cancelar`, `exito`, `fallo`, `sin-perfiles`, `tarjeta-exportando`.

**Formato**
- V30. Elegir «WebM (VP9 + Opus)» cambia la pista bajo el control a la de WebM, la extensión del destino propuesto a `.webm`, el formato corto de la muestra y del resumen, y la estimación; con un destino elegido con [Cambiar…], cambiar de formato conserva la carpeta y el nombre y cambia solo la extensión, sin anuncio; `exp.anuncio.destino` solo se anuncia si main tiene que volver al destino propuesto ([0124](../preguntas/0124-destino-conservado-al-cambiar-de-formato.md)). El popover ⓘ muestra `exp.formato.ayuda`, se abre con Intro o Espacio y Esc lo cierra devolviendo el foco. Con un formato sin soporte en ningún perfil (doble), su opción está `aria-disabled` con `exp.formato.noDisponible` y se elige el otro; sin ninguno, el diálogo muestra F.

## Verificación manual
Para la guía de la fase en `docs/Test-manuales/0.2.0/` (la escribe `qa`). No son tareas de agente ([pruebas](../pruebas.md), regla 5).
- M1. **Calidad visual** del video en los dos formatos en 720p, 1080p, 1440p y 2160p (16:9) y 1024 × 768 y 2880 × 2160 (4:3): letra nítida, sin bandas visibles en los degradados, sin bloques de compresión molestos en el barrido, marca de agua legible y discreta sobre un fondo claro y uno oscuro.
- M2. **Sincronía percibida**: cantar o escuchar con voz una canción real sincronizada a mano; el barrido coincide con la voz como en el reproductor de la app, de principio a fin (sin deriva en una canción de ≥ 6 min).
- M3. **Reproductores externos**, con un MKV y un WebM: se abren y se ven con sonido en VLC, OBS (como fuente multimedia), Firefox y Chrome (también Safari con el WebM), y el reproductor por defecto de Windows (MKV: con y sin la extensión AV1), macOS y Linux; anotar los que no los abren y contrastarlo con `exp.formato.ayuda` y `exp.formato.pista`. Si es posible, un televisor con USB.
- M4. **Perfil modesto y 4K/60** en un equipo modesto: tiempo, tamaño, memoria y que la app sigue usable mientras exporta; la estimación queda dentro de ± 50 % (anotar si la primera exportación del equipo se queda corta y si la segunda mejora).
- M5. **Exportar durante un evento** en dos pantallas reales: sin cortes de audio ni tirones perceptibles en la secundaria con un perfil modesto y con 4K/60; abrir la sesión con la exportación ya en marcha y al revés.
- M6. **Sustitución**: exportar sobre un archivo existente, cancelar a mitad y comprobar que el original se sigue reproduciendo; después dejar terminar y comprobar que se ha sustituido. En Windows, repetir con el archivo previo abierto en un reproductor: el error es `DESTINO_NO_DISPONIBLE` y el original sigue intacto.
- M7. **Cerrar la app** a mitad de exportación (confirmando) y matar el proceso: no quedan temporales visibles en la carpeta de destino y, tras matarlo, aparece `exp.toast.interrumpida` una vez.
- M8. «Mostrar en la carpeta» abre la carpeta del video en los tres sistemas y selecciona el archivo en Windows y macOS; en Linux, anotar qué gestor de archivos se usó y si lo selecciona.
- M9. **Suspensión**: con una exportación larga y el equipo sin tocar, la pantalla se puede apagar pero el equipo no se suspende hasta que termina.

## Cambios de esta revisión
2026-11-20, alineada con el [ADR 0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) y la respuesta a [0131](../preguntas/0131-contratos-tecnicos-de-la-exportacion.md):
- **Formato**: pasa de texto a control segmentado MKV (AV1 + Opus, por defecto) · WebM (VP9 + Opus), con `exp.formato.pista`, `exp.formato.ayuda` final, `exp.formato.noDisponible` y `exp.anuncio.destino`. Se recuerda con las demás opciones.
- **Catálogo**: se añade 2560 × 1440 · QHD en 16:9; motivos de no soporte cerrados (`codificador`, `memoria` con 8 GB para 2160 líneas, `no_comprobado`); el soporte es por perfil **y** formato.
- **Sesión**: exportar y la sesión conviven. Se retiran el concepto «Bloqueo por evento», el candado de los puntos de entrada, `exp.bloqueo*`, `ses.exportando*`, `exp.cola.sesion` y `exp.cola.separacion`; V23 queda con una sola rama y V24 se retira.
- **Errores**: códigos finales del ADR §10 (`ERROR_INTERNO` sustituye a «desconocido», sin `EXPORTACION_BLOQUEADA`); posición siempre disponible.
- **Estimación y espacio** según ADR §11; **cierre inesperado** y **suspensión** dejan de estar condicionados; «Mostrar en la carpeta» en Linux abre la carpeta sin garantizar la selección.
- Criterios: cambian V1, V3–V5, V7, V9, V10, V12, V14–V18, V20, V23, V26 y V29; V24 retirado; V30 nuevo. Verificación manual: M1, M3–M8 actualizados y M9 nuevo.
