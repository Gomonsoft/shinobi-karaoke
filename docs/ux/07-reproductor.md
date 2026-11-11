# 07 — Reproductor a pantalla completa

- Paso del pipeline: 6 (Reproductor)
- ADRs: [0005](../adr/0005-letras-y-formato-de-sincronia.md) (`finEfectivo`, desplazamiento), [0006](../adr/0006-persistencia-y-modelo-de-datos.md) (`cancion.json`, `incompleta`, `config.reproductor`), [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md) (reloj, `PantallaLetra`, render compartido), [0011](../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md) (`MotorReproductor`, pantalla completa, reposo)
- Restricciones: [arquitectura.md §7 y "Restricciones e implicaciones para UX" §2, §5](../arquitectura.md)
- Valores fijos de render: [sistema-visual.md §10](sistema-visual.md)
- Preguntas: [0005](../preguntas/0005-viabilidad-detalles-ux-fase-0.md) §6, §8, §11, §12 y [0006](../preguntas/0006-ajustes-specs-ux-tras-0005.md) §4 (respondidas); [0025](../preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) §1 y §8 (respondida: el reproductor llega en la Fase 6, un solo volumen); [0030](../preguntas/0030-voz-original-en-el-reproductor.md) (usuario, respondida 2026-11-06: **voz guía** = `voz.flac` mezclada sobre el instrumental con volumen propio, tecla para silenciarla y nivel recordado; no se usa la mezcla original); [0031](../preguntas/0031-detalles-tecnicos-del-reproductor-fase-6.md) (arquitecto: pantalla completa, motor con dos pistas a la vez, silencio previo, pistas que faltan, pantalla encendida, configuración de la voz guía; abierta, opción provisional tomada)
- Revisión: 2026-11-06, puesta al día para la Fase 6 (ver "Cambios de esta revisión" al final).
- 0.2.0, fase 4 (2026-11-11): reproductor en otra pantalla (ventana secundaria), transición con cuenta entre canciones de la cola, en espera, fin de la cola, fallo de una entrada, reanudación y recuperación. Ver [Fase 4 de 0.2.0 — ventana secundaria y cola](#fase-4-de-020--ventana-secundaria-y-cola). Preguntas: [0048](../preguntas/0048-escucha-editor-durante-evento.md) y [0049](../preguntas/0049-politica-cola-de-reproduccion.md) (respondidas), [0058](../preguntas/0058-interfaz-de-la-sesion-en-vivo-y-la-cola.md) (arquitecto → UX, respondida), [0059](../preguntas/0059-conductas-de-la-sesion-en-vivo-ante-incidencias.md) (usuario, respondida: 1B, 2A, 3B, 4A), [0060](../preguntas/0060-letra-y-controles-de-sonido-durante-la-sesion.md) (usuario, respondida: 1A, 2A) y [0061](../preguntas/0061-reproductor-en-otra-pantalla-con-wayland.md) (arquitecto → UX, respondida).

## Objetivo
Cantar: instrumental + letra sincronizada con el estilo de la canción, **a pantalla completa, sin distracciones y legible a unos 5 m** (salón, televisor de 55", proyector). Empieza al instante y se sale con una tecla.

Usuario/tarea principal: "Ponme esta canción para cantarla ya". Secundaria (desde el editor): "Quiero ver cómo queda de verdad antes de darla por lista".

Qué **no** hace el reproductor (MVP): no hay listas de reproducción ni "siguiente canción", no cambia la velocidad ni el tono (siempre 1×), no edita la letra ni el estilo, no tiene puntuación ni micrófono.

## Datos que usa (resumen para implementar)
- **Canción**: `biblioteca.obtener(id)` (desde la Biblioteca) o la instantánea en memoria del editor (desde "Probar a pantalla completa"; incluye cambios aún no guardados). Usa `metadatos.titulo`, `metadatos.artista`, `metadatos.duracion_ms`, `letra` (`lineas[]`, `offset_ms`), `estilo`, `fuente.ganancia_db` y `pistas.instrumental`. La duración real para la barra y el final es la del `AudioBuffer` decodificado.
- **Audio**: `MotorReproductor` (`karaoke/motorReproductor.ts`, [ADR 0011](../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md) §3), siempre a 1×; no es el `MotorAudio` del editor, que al abrir "Probar" libera sus buffers (`liberarAudio()`). Modo `karaoke`: suenan **a la vez y sincronizadas** dos pistas, `instrumental` (siempre) y `voz` (voz guía, §"Voz guía"); si la voz falla, suena solo el instrumental. Modo `original`: solo en la vista previa del editor sin pistas separadas suena `original` (`fuente/mezcla.flac`), sola y sin voz guía. Nunca se usa la original como guía.
- **Ganancias**: general = `10^(ganancia_db/20) × volumen` (0 si `silenciado`), aplicada a todo; instrumental × 1; voz × `voz_guia` (0 si `voz_guia_silenciada`).
- **Volumen general**: `config.reproductor.volumen` (0–1) y `silenciado`, el **único volumen general de la app**, compartido con el editor ([0025](../preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) §8). Se lee al entrar y se escribe con `config.actualizar`, como mucho una vez cada 500 ms mientras cambia.
- **Voz guía**: campos nuevos `config.reproductor.voz_guia` (0–1, por defecto 0,3) y `voz_guia_silenciada` (por defecto `true`: la primera vez se canta sin voz). Mismo ritmo de escritura. Solo los usa el reproductor (el editor tiene su propio selector de pista). Contrato en [0031](../preguntas/0031-detalles-tecnicos-del-reproductor-fase-6.md) §6.
- **Render**: `PantallaLetra` (ADR 0010 §4) con tamaño de contenedor = pantalla completa. Tiempo de letra = tiempo de canción − `offset_ms`. Líneas sin inicio omitidas, pausas no dibujadas, fin de línea con `finEfectivo`.
- **Lista incompleta**: indicador derivado `incompleta` y `lineasSinSincronizar` del resumen de la canción (spec 02).

## Wireframes

### A — Reproduciendo, controles ocultos (estado normal)
```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                      (fondo: sólido o degradado del estilo)              │
│                                                                          │
│                 ███████████████░░░░░░░░░░░░░░░                           │
│                 Is this the real life? Is this just                      │ ← línea actual (centro al 45 % del alto)
│                                                                          │    barrido en color de resaltado
│                     Caught in a landslide                                │ ← siguiente (70 % del tamaño)
│                                                                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```
Sin cursor, sin controles, sin ningún texto de interfaz.

### B — Controles visibles
```
┌──────────────────────────────────────────────────────────────────────────┐
│ [✕ Salir]                                    Bohemian Rhapsody · Queen   │ ← franja superior (0–12 % del alto)
│                                              ⚠ Faltan 3 líneas por sinc… │   (solo si incompleta, t-pequeno)
│                                                                          │
│                    (letra igual que en A)                                │ ← zona 25 %–75 %: nunca hay controles
│                                                                          │
│ 01:12 ━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 05:55   │ ← franja inferior (82–100 % del alto)
│ [⏮]  [ ❚❚ ]  [↺5]  [5↻]       [🎤 Voz ━━●━━━ 30 %]  [🔊 ━━━━●━]  [⌨]  [⛶] │
└──────────────────────────────────────────────────────────────────────────┘
```
Voz guía silenciada (estado por defecto):
```
│                               [🎤̸ Voz ━━○━━━ 30 %]                       │ ← icono mic-off, deslizador y cifra en texto-2 (atenuados), nivel conservado
```
- Franja superior: degradado negro `rgba(0,0,0,0.6)` sólido bajo los controles (alto de la fila + 16 px) que se desvanece a 0 por debajo. Izquierda: [✕ Salir]. Derecha: «título · artista» en `t-cuerpo-fuerte` `#FFFFFF`, una línea con "…"; debajo, solo en una lista incompleta, `rep.incompleta` en `t-pequeno` con el icono ⚠ en `aviso`. El centro queda libre para la etiqueta `rep.original` (§"Estados").
- Franja inferior: degradado negro, `rgba(0,0,0,0.7)` sólido bajo las dos filas de controles, que se desvanece a 0 por encima. Fila 1: tiempo actual, barra de tiempo, duración (`t-tiempo`, `#FFFFFF`). Fila 2 izquierda: ⏮, ▶/❚❚, ↺5, 5↻. Derecha: **control de voz guía** (botón 🎤 + etiqueta "Voz" + deslizador de 96 px + porcentaje `t-tiempo`; §"Voz guía"), volumen general (botón silenciar + deslizador de 120 px), ⌨ Atajos, ⛶. Entre el control de voz y el general, 24 px de separación para que no se confundan.
- En la vista previa del editor sin pistas separadas el control de voz guía no aparece y su hueco se cierra.

### C — Pantalla de título (inicio)
```
│                                                                          │
│                         Bohemian Rhapsody                                │ ← título, tamaño de línea actual
│                              Queen                                       │ ← artista, 50 %
│                                                                          │
│            ┌────────────────────────────────────────────────┐            │
│            │ ⚠ Faltan 3 líneas por sincronizar: no se verán. │            │ ← solo en lista incompleta
│            └────────────────────────────────────────────────┘            │
```
Seguida de la entrada de la primera línea:
```
│                               ●●●                                        │ ← indicador de entrada (color de resaltado)
│                     Is this the real life?                               │ ← primera línea, como "siguiente"
```

### D — Pantalla final
```
│                         Bohemian Rhapsody                                │
│                              Queen                                       │
│                                                                          │
│            [ ↻ Otra vez ]   [ ✕ Volver a la biblioteca ] (foco)          │
│                       Se cerrará en 10 s…                                │
```
Fondo y fuente del estilo; título y artista como en C. Botones grandes (44 px) con el estilo de los controles (fondo `rgba(0,0,0,0.6)`, texto `#FFFFFF`, radio `r-m`). Desde el editor, el segundo botón es "Volver al editor".

### E — Error
```
┌──────────────────────────────────────────────────────────────────────────┐
│                          (fondo fondo-0)                                 │
│                                                                          │
│                ⚠  No se puede reproducir esta canción.                  │ ← t-subtitulo, texto-1
│      Falta su pista instrumental. Puedes volver a separarla desde la     │ ← t-cuerpo, texto-2
│      biblioteca: menú ⋯ › Re-separar pistas.                             │
│                                                                          │
│          [Copiar detalles]   [Volver a la biblioteca] (primario, foco)   │
└──────────────────────────────────────────────────────────────────────────┘
```

## Componentes e interacciones

### Entrada
| Desde | Comportamiento |
|-------|----------------|
| Biblioteca: botón "▶ Reproducir" de la tarjeta, botón redondo de la portada, clic en la portada o Intro con la tarjeta enfocada, "Reproducir" del menú ⋯ (solo canciones Lista, spec 02) | Se abre el reproductor encima de la Biblioteca (que se queda montada, con su filtro, búsqueda y desplazamiento), la ventana pasa a pantalla completa y se muestra al instante el fondo del estilo con la pantalla de título. En cuanto el instrumental y la voz están decodificados (en paralelo, < 1 s en una canción de 4 min) empieza desde 0 con el silencio previo si hace falta (§"Inicio y silencio previo"). |
| Toast `bib.toast.lista` → [▶ Reproducir] | Igual que el botón de la tarjeta. El toast se cierra al pulsarlo. |
| Editor: "Probar a pantalla completa" o **F** (spec 06) | Tras vaciar el guardado pendiente del editor (spec 06 §"Guardado"), se abre encima del editor (que se queda montado, con su historial de deshacer, selección y pista) usando la instantánea en memoria del editor (letra, estilo y desplazamiento actuales). Empieza en `máx(0, tiempo mostrado de la línea seleccionada − 3 s)`; si la línea no tiene inicio, en la posición actual del editor. El audio del editor se pausa antes. |
| En los dos casos | Los controles se muestran 3 s y se ocultan (§"Ocultar controles"). El foco va a la superficie del reproductor (`tabindex="-1"`), para que los atajos funcionen sin hacer clic. |

### Inicio y silencio previo
El cantante siempre tiene una pantalla de título y una cuenta de entrada antes de la primera línea, aunque la voz empiece en el primer segundo de la canción.
- Sea `t1` el tiempo mostrado (`inicio_ms + offset_ms`) de la primera línea con inicio. Si `t1 < 6 s`, antes del audio hay un **silencio previo** de `6 s − t1` en el que el tiempo avanza desde `−(6 s − t1)` hasta 0. Así la secuencia es siempre, como mínimo: título 2 s → primera línea visible como "siguiente" 1 s → `●●●` 3 s (un punto menos por segundo) → la línea empieza.
- Con `t1 ≥ 6 s` no hay silencio previo: el título dura hasta `t1 − 4 s` (sistema-visual §10).
- El silencio previo solo se aplica al **empezar desde el principio**: al entrar en 0 (Biblioteca, o editor con inicio calculado 0), con ⏮ / Inicio / 0 y con "Otra vez". Buscar con la barra, ← o J hasta 0 no lo aplica.
- Durante el silencio previo: la barra de tiempo marca 00:00; Espacio lo pausa y lo reanuda donde estaba; buscar con la barra o con →/L lo cancela y suena desde el punto elegido; ⏮ lo reinicia.
- La primera línea **siempre** es una entrada: muestra `●●●` en los 3 s previos aunque el hueco desde 0 sea < 4 s (cambio en `render.ts`; afecta igual a la vista previa del editor, que debe coincidir con el reproductor).
- Sin ninguna línea con inicio (lista incompleta extrema): la pantalla de título dura toda la canción, sin silencio previo.

### Letra
| Elemento | Comportamiento |
|----------|----------------|
| Línea actual + siguiente | Centradas, tamaños, posición y sombra de sistema-visual §10, con la fuente, el color de letra y el color de resaltado del estilo. Máximo 2 líneas a la vez. |
| Resaltado | Por palabra si la línea trae tiempos de palabra (◆); si no, barrido lineal entre el inicio y el fin efectivo (`finEfectivo`). |
| Cambio de línea | La siguiente sube a la posición actual en 200 ms (instantáneo con movimiento reducido). |
| Huecos | Al llegar al fin efectivo, la línea actual desaparece y queda solo la siguiente. **Indicador de entrada `●●●`** (3 puntos en `color_resaltado`, encima de la siguiente línea, uno menos por segundo en los 3 s previos) antes de: la primera línea, y toda línea cuyo hueco desde el fin efectivo de la anterior es ≥ 4 s. Entre líneas seguidas (hueco < 4 s) no hay indicador. |
| Pausas (♪) | No se dibujan; solo cuentan como hueco. |
| Líneas sin inicio | Se omiten: su hueco se comporta como cualquier otro (si es ≥ 4 s, sale `●●●` antes de la siguiente). Ningún aviso mientras se canta. |
| En pausa | La letra se **congela** en el fotograma de ese instante (mismo barrido, mismas líneas). No se usa el modo estático del editor (línea seleccionada a medias). |

### Controles
| Elemento | Comportamiento |
|----------|----------------|
| ✕ Salir | Sale del reproductor (§"Salida"). Tooltip `rep.tooltip.salir`. |
| Barra de tiempo | Clic o arrastre para buscar; al soltar, suena desde ahí si estaba sonando. `role="slider"`, `aria-valuetext` como en el editor ("1 minuto 12 segundos de 5 minutos 55"); con el foco, ←/→ ±5 s. Sin marcas de líneas. |
| ⏮ | Vuelve al principio con pantalla de título y silencio previo. Mantiene el estado (sonando o en pausa). |
| ▶ / ❚❚ | Reproduce / pausa. En pausa, el botón muestra ▶ y la franja inferior añade `rep.pausa` "❚❚ En pausa" a la derecha de 5↻. |
| ↺5 / 5↻ | −5 s / +5 s (acotado a 0 y a la duración; +5 s en los últimos 5 s lleva al final). |
| 🎤 Voz + deslizador | Botón que silencia / reactiva la voz guía y deslizador de su nivel (§"Voz guía"). |
| Volumen general | Botón silenciar/activar + deslizador 0–100 % (paso 1 %; con el foco, flechas ±10 %). Mover el volumen con el sonido silenciado lo activa. Se aplica después de la igualación `ganancia_db`, al instrumental y a la voz guía. |
| ⌨ Atajos | Abre el diálogo de atajos (como F1). |
| ⛶ | Alterna pantalla completa / ventana sin salir del reproductor (para usarlo en una ventana, p. ej. en un segundo monitor). Icono y tooltip según el estado: `rep.tooltip.ventana` / `rep.tooltip.completa`. |
| Estilo de los botones | Botones icono de 44 × 44 px, iconos de 28 px, `#FFFFFF` sobre las franjas oscuras, sin fondo propio; hover: fondo `rgba(255,255,255,0.12)`, `r-m`. Foco: anillo doble (sistema-visual §7). Tooltip con nombre + atajo. |

### Ocultar controles
- Las franjas y el cursor se ocultan a los **3 s** sin actividad (fundido de 200 ms; instantáneo con movimiento reducido).
- Actividad que los muestra y reinicia la cuenta: mover el ratón, hacer clic en la superficie (el clic **no** pausa), Tab o Mayús+Tab.
- Los **atajos** (tabla siguiente) no muestran las franjas: solo el indicador breve (§"Indicador breve"). Excepción: Espacio/K al pausar (las franjas aparecen porque en pausa siempre se ven).
- No se ocultan: en pausa, durante la pantalla final, en el estado de error, con el puntero encima de una franja, con un diálogo o un tooltip abiertos, ni mientras se arrastra la barra o el volumen.
- Si al ocultarse el foco estaba en un control, vuelve a la superficie del reproductor (nunca queda un foco invisible).
- Durante el silencio previo y la pantalla de título rigen las mismas reglas.

### Voz guía
Decisión del usuario en [0030](../preguntas/0030-voz-original-en-el-reproductor.md): la voz separada (`voz.flac`) suena **encima** del instrumental, con un nivel propio, para elegir mucha, poca o ninguna guía. El instrumental suena siempre.
- **Mezcla**: voz e instrumental arrancan, se pausan, buscan y terminan **juntas** (mismo instante de `start()`, sin desfase audible entre ellas). La voz pasa por su propia ganancia (`voz_guia`) y después por el volumen general, así que M y el volumen general afectan a las dos.
- **Control** (franja inferior, wireframe B): botón icono 🎤 de 44 px + etiqueta "Voz" (`t-pequeno`, `#FFFFFF`) + deslizador de 96 px (0–100 %, paso 1 %; con el foco, flechas ±10 %) + porcentaje (`t-tiempo`, ancho fijo para "100 %").
  - Botón 🎤: silencia / reactiva la voz guía (`aria-pressed="true"` cuando suena). Silenciada: icono `mic-off`, deslizador y cifra en `texto-2` (siguen operables) y el nivel **no cambia**.
  - Mover el deslizador con la voz silenciada la reactiva. Llevarlo a 0 % equivale a "sin guía" pero **no** la marca como silenciada.
  - Reactivar con el nivel en 0 % lo sube a 30 % (si no, la tecla parecería no hacer nada).
- **Teclas**: **V** silencia / reactiva la voz guía. **Mayús + ↑ / ↓** sube / baja su nivel ±10 % (y la reactiva si estaba silenciada). Se eligió V por "voz" y porque no choca con ningún atajo de la app; las flechas con Mayús siguen el patrón de ↑/↓ del volumen general.
- **Se recuerda**: nivel (`voz_guia`) y silencio (`voz_guia_silenciada`) persisten entre canciones y reinicios, como el volumen general. Por defecto: 30 % y **silenciada**, de modo que quien no la toca canta sin voz y la primera V da una guía suave.
- **Carga**: al entrar se decodifican las dos pistas en paralelo y el audio empieza cuando las dos están listas (< 1 s en 4 min). Si la voz no se puede cargar, se canta igual con el instrumental: el control de voz queda `aria-disabled` con el tooltip `rep.voz.nodisponible`, V no hace nada y la canción se comprueba como en el error de pista que falta (al volver aparece "Dañada"; [0031](../preguntas/0031-detalles-tecnicos-del-reproductor-fase-6.md) §4).
- **Indicador breve**: `rep.ind.voz` "Voz {n} %" al cambiar el nivel o reactivarla; `rep.ind.vozsilenciada` "Voz silenciada" al silenciarla. No hay etiqueta permanente en pantalla: la guía la elige quien canta.
- **Desde el editor**: con pistas separadas, el mismo control y los mismos valores recordados. Sin pistas separadas (suena `original`), el control no aparece y V / Mayús + ↑↓ no hacen nada.

### Atajos de teclado
Activos con el foco en la superficie del reproductor o en cualquier control, salvo donde se indica. Todos llaman a `preventDefault`.

| Tecla | Acción |
|-------|--------|
| Espacio / K | Reproducir / pausa (con el foco en un botón, Espacio e Intro activan ese botón, como en el resto de la app) |
| ← / → | −5 s / +5 s |
| J / L | −10 s / +10 s |
| ↑ / ↓ | Volumen +10 % / −10 % |
| M | Silenciar / activar sonido |
| V | Silenciar / reactivar la voz guía (conserva su nivel) |
| Mayús + ↑ / ↓ | Voz guía +10 % / −10 % |
| Inicio / 0 | Volver al principio (con título y silencio previo) |
| F | Pantalla completa / ventana |
| Esc | Cierra el diálogo o tooltip abierto; si no hay ninguno, **sale del reproductor con una sola pulsación**, también en pantalla completa |
| , / . | **Solo desde el editor**: desplazamiento de toda la letra −/+ 100 ms (§"Prueba desde el editor") |
| F1 / ? | Diálogo "Atajos de teclado" (pausa la reproducción; al cerrarlo sigue en pausa) |

No funcionan en el reproductor: Ctrl/Cmd + N, Ctrl/Cmd + , y el zoom de la interfaz (Ctrl/Cmd + + / − / 0), como dice spec 00 §6. El menú de la aplicación y F11 / Ctrl+Cmd+F siguen funcionando y equivalen a ⛶.

### Indicador breve
- Cada atajo (y cada clic en ⏮, ↺5, 5↻, 🎤, silenciar; no al arrastrar deslizadores, que ya muestran su valor) muestra un indicador de **600 ms** (1 s para el desplazamiento): píldora `rgba(0,0,0,0.6)` con texto `#FFFFFF` de `máx(20 px, 3 % del alto)`, centrada en horizontal con su centro al **12 % del alto** (nunca en la franja central). Un nuevo indicador sustituye al anterior.
- Textos: `rep.ind.*` (▶, ❚❚, −5 s, +5 s, −10 s, +10 s, Volumen 60 %, Silenciado, Al principio, Voz 30 %, Voz silenciada, desplazamiento).

### Salida
| Vía | Comportamiento |
|-----|----------------|
| Esc, ✕ Salir, "Volver a la biblioteca" / "Volver al editor" de la pantalla final o del error, fin de la cuenta atrás de la pantalla final | Se detiene el audio, se libera el motor del reproductor y se vuelve a la vista de origen. La ventana recupera el estado que tenía **antes** de entrar (si ya estaba a pantalla completa, sigue así; si era una ventana normal o maximizada, vuelve a serlo). |
| Vuelta a la Biblioteca | Mismo filtro, búsqueda y desplazamiento; foco en la tarjeta de la canción (también si se entró desde el toast). Sin toast. |
| Vuelta al editor | Ver §"Prueba desde el editor". |
| Toasts retenidos | Los toasts de la app que lleguen mientras el reproductor está abierto (p. ej. una separación que termina) no se muestran encima de la letra: se retienen y aparecen al salir (como máximo los 3 más recientes). Las notificaciones del sistema siguen sus reglas (spec 04): con el reproductor en primer plano la ventana tiene el foco, así que no salen. |

### Pantalla final
- Cuando el audio llega al final: se muestra el wireframe D, las franjas se ocultan y el cursor se ve. Foco en "Volver a la biblioteca" / "Volver al editor".
- Cuenta atrás `rep.cierre` de 10 s, actualizada cada segundo; al llegar a 0 sale sola (§"Salida"). Cualquier actividad (mover el ratón, una tecla, Tab) **detiene** la cuenta atrás: el texto desaparece y la pantalla espera.
- "Otra vez" (o Espacio/K con el foco en la superficie): vuelve al principio con pantalla de título y silencio previo, y suena.
- ←, J o la barra de tiempo (las franjas se ven al mover el ratón) vuelven a un punto anterior y siguen sonando: la pantalla final se cierra.

### Prueba desde el editor ("Probar a pantalla completa")
- **Pista**: instrumental + voz guía si la separación está completada; si no, la original sola con la etiqueta `rep.original` arriba en el centro, siempre visible (también con los controles ocultos), y sin el control de voz guía.
- **Desplazamiento** con **,** / **.**: −/+ 100 ms, en el rango −30,00 s … +30,00 s (en el tope no cambia y el indicador añade `edi.offset.rango`). Se aplica al instante a la letra. Indicador 1 s con el valor **total**: `rep.offset` ("Desplazamiento: +0,25 s"). El reproductor no escribe en disco: cada cambio pasa al estado del editor, que lo autoguarda como cualquier cambio suyo (también si se cierra la ventana con el reproductor abierto), y todos los cambios de una misma prueba forman **un solo paso** de deshacer.
- **Pantalla final**: "Otra vez" + "Volver al editor".
- **Al volver al editor** (Esc, ✕, pantalla final): el editor queda **en pausa** con el cabezal en la posición en que estaba el reproductor; la línea seleccionada pasa a ser la que sonaba (o la última que había empezado) en ese instante, y la lista se desplaza hasta ella; si aún no había empezado ninguna, la selección no cambia. Se restauran la pista de escucha y la velocidad que tenía el editor. El foco vuelve al botón "Probar a pantalla completa". El historial de deshacer se conserva (más el paso del desplazamiento, si lo hubo).
- No se muestra `rep.incompleta` (el editor ya lo indica).

### Legibilidad a distancia
- **Referencia**: televisor de 55" 16:9 (≈ 68,5 cm de alto de imagen) visto a 5 m.
- Línea actual: `máx(32 px, 7,5 % del alto)` (sistema-visual §10) = ≈ 5,1 cm de cuerpo; altura de mayúscula ≈ 0,7 em ≈ 3,6 cm. Regla orientativa: mayúscula ≥ 1/150 de la distancia (3,3 cm a 5 m) → **cumple**. Línea siguiente (70 %): ≈ 2,5 cm, legible a 5 m (≈ 1/200) para anticipar. Una línea larga reducida al mínimo del 75 % queda en ≈ 2,7 cm (≈ 1/185).
- **Sin tope en píxeles**: el tamaño depende solo del alto de la pantalla, para que una TV 4K con escalado 100 % (2160 px CSS de alto) no lo reduzca (antes `clamp(…, 140px)` lo dejaba en el 6,5 %; se quita en sistema-visual §10).
- Máximo 2 líneas visibles (actual + siguiente) para que el ojo no busque.
- Mientras se canta, la franja central 25 %–75 % del alto no tiene ningún elemento de interfaz (ni controles, ni indicador, ni avisos, ni etiquetas).
- Sombra fija de §10 para separar la letra de los degradados; el contraste del estilo se revisa en el editor (spec 06, sistema-visual §9).
- La letra no se mueve durante el barrido (sin escala ni rebote).
- Los textos que sí deben leerse de lejos y aparecen sobre el fondo del estilo (píldora `rep.incompleta` de la pantalla de título, indicador breve, etiquetas de pista) usan `máx(t-cuerpo, 2,2 % del alto)` (≈ 24 px en 1080p). Los controles de las franjas son para quien maneja el equipo: tamaños fijos del sistema visual.
- Mientras suena, la pantalla no se apaga ni salta el salvapantallas ([0031](../preguntas/0031-detalles-tecnicos-del-reproductor-fase-6.md) §5).

## Estados
| Estado | Presentación |
|--------|--------------|
| Vacío | No aplica: solo se abre con canciones Lista (Biblioteca) o desde el editor. |
| Cargando | Fondo del estilo + pantalla de título (sin `●●●`). Si tarda > 1 s, spinner de 24 px + `rep.cargando` bajo el artista, en `#FFFFFF` sobre la píldora de §10. Los controles funcionan salvo los de reproducción (inactivos); Esc sale. |
| Silencio previo / pantalla de título | Wireframe C. |
| Reproduciendo | Wireframe A (o B con actividad). |
| En pausa | Wireframe B con `rep.pausa`, letra congelada, cursor visible. |
| Final | Wireframe D con cuenta atrás de 10 s. |
| Error: falta la pista (instrumental, o la original en la vista previa) | Wireframe E con `rep.error.titulo` + `rep.error.pistas` (o `rep.error.mezcla`), [Copiar detalles] y [Volver a la biblioteca] / [Volver al editor] (primario, foco). Desde la Biblioteca, la canción pasa a "Dañada" ("Faltan las pistas separadas", spec 02) sin reiniciar la app ([0031](../preguntas/0031-detalles-tecnicos-del-reproductor-fase-6.md) §4). `role="alert"`. |
| Error: el archivo existe pero no se puede leer (decodificación) | Igual con `rep.error.audio`. La canción no se marca Dañada. |
| Voz guía silenciada / sonando | Solo cambia el control de la franja inferior (icono `mic-off` y atenuado / icono `mic` y `#FFFFFF`). Nada sobre la letra. |
| Voz guía no disponible (falta o no se lee `voz.flac`) | Suena el instrumental; control `aria-disabled` con `rep.voz.nodisponible`. |
| Vista previa sin instrumental | Etiqueta `rep.original` arriba en el centro, siempre visible. |
| Lista incompleta | `rep.incompleta` en la pantalla de título (píldora, wireframe C) y en la franja superior con los controles visibles; nada mientras se canta. Se anuncia una vez a lectores de pantalla al empezar. No aplica desde el editor. |
| Fuente no disponible | No aplica en el MVP (solo fuentes incluidas). Por robustez: si la familia no carga, se usa Atkinson Hyperlegible Next sin aviso. |
| Ventana sin foco / minimizada | La reproducción continúa; al volver, la letra está en su sitio. Los controles siguen sus reglas. |
| Modo ventana (⛶ / F) | Mismo reproductor ocupando toda la ventana de la app (sin barra superior). Las proporciones de §10 se calculan sobre el alto de la ventana. |

## Accesibilidad
- Región `role="region"` con nombre `rep.aria.region`; la letra (`PantallaLetra`) es `aria-hidden` (se lee cantando, no con lector de pantalla).
- Anuncios `aria-live="polite"` solo en hitos: al empezar (`rep.aria.inicio`, más `rep.incompleta` una vez si aplica), pausa / reanudación, cambios de volumen y voz (el texto del indicador breve), `rep.aria.fin` y la cuenta atrás de la pantalla final solo al aparecer. Los errores, con `role="alert"`. Nunca cada línea ni el tiempo.
- Todo es operable con teclado: atajos de la tabla, Tab recorre [✕ Salir] → barra de tiempo → ⏮ → ▶/❚❚ → ↺5 → 5↻ → 🎤 → nivel de voz → silenciar → volumen → ⌨ → ⛶ (orden visual). Los dos deslizadores tienen nombres distintos (`rep.aria.vozguia`, `rep.aria.volumen`) y `aria-valuetext` "30 %" (con "silenciada" si lo está). Los botones tienen nombre accesible (`rep.tooltip.*` sin el atajo y con `aria-keyshortcuts`).
- Foco visible con el **anillo doble** (sistema-visual §7) sobre cualquier fondo; nunca queda un foco en un control oculto.
- Contraste: los controles y sus textos son `#FFFFFF` sobre ≥ 60 % de negro, lo que da ≥ 5,7:1 incluso sobre un fondo de estilo blanco (`#FFFFFF` sobre `#666666`); la píldora de §10 igual. El contraste de la letra depende del estilo y lo avisa el editor.
- Movimiento reducido: sin fundidos de las franjas ni transición entre líneas.
- Diálogo de atajos: el componente de diálogo del sistema visual, con la tabla de esta spec (las filas que no aplican, como , / . desde la Biblioteca o V sin pistas separadas, no aparecen).

## Microcopy
| Clave | Texto |
|-------|-------|
| `rep.salir` | Salir |
| `rep.pausa` | ❚❚ En pausa |
| `rep.cargando` | Cargando… |
| `rep.otravez` | Otra vez |
| `rep.volver.biblioteca` | Volver a la biblioteca |
| `rep.volver.editor` | Volver al editor |
| `rep.cierre` | Se cerrará en {n} s… |
| `rep.original` | Vista previa con la canción original: aún no hay pista instrumental. |
| `rep.voz` | Voz |
| `rep.ind.voz` | Voz {n} % |
| `rep.ind.vozsilenciada` | Voz silenciada |
| `rep.voz.nodisponible` | La voz guía no está disponible en esta canción. |
| `rep.aria.vozguia` | Volumen de la voz guía |
| `rep.aria.volumen` | Volumen general |
| `rep.incompleta` | ⚠ Faltan {n} líneas por sincronizar: no se verán. · (n = 1) ⚠ Falta 1 línea por sincronizar: no se verá. |
| `rep.offset` | Desplazamiento: {+/−n,nn} s |
| `rep.ind.*` | ▶ · ❚❚ · −5 s · +5 s · −10 s · +10 s · Volumen {n} % · Silenciado · Al principio |
| `rep.error.titulo` | No se puede reproducir esta canción. |
| `rep.error.pistas` | Falta su pista instrumental. Puedes volver a separarla desde la biblioteca: menú ⋯ › Re-separar pistas. |
| `rep.error.mezcla` | Falta el audio de la canción. |
| `rep.error.audio` | No se ha podido leer su audio. Si vuelve a pasar, copia los detalles para pedir ayuda. |
| `rep.copiar` | Copiar detalles |
| `rep.tooltip.*` | Salir (Esc) · Reproducir (Espacio) · Pausa (Espacio) · Al principio (Inicio) · Retroceder 5 s (←) · Avanzar 5 s (→) · Silenciar la voz guía (V) · Activar la voz guía (V) · Voz guía (Mayús + ↑ ↓) · Silenciar (M) · Activar sonido (M) · Volumen (↑ ↓) · Atajos de teclado (F1) · Pantalla completa (F) · Ver en una ventana (F) |
| `rep.atajos.titulo` | Atajos de teclado |
| `rep.aria.region` | Reproductor de «{título}» |
| `rep.aria.inicio` | Reproduciendo «{título}», de {artista}. |
| `rep.aria.fin` | Fin de la canción. |

Formato: tiempos de la barra `mm:ss` (`h:mm:ss` desde 1 h), coma decimal en el desplazamiento ("+0,25 s"), signo siempre visible (también "+0,00 s").

## Criterios de aceptación

**Entrada y salida**
1. Desde la Biblioteca, en una canción Lista, un clic en "▶ Reproducir", en el botón redondo o en la portada, Intro con la tarjeta enfocada o "Reproducir" del menú ⋯ abre el reproductor: la ventana pasa a pantalla completa y el fondo del estilo con la pantalla de título se ve en < 200 ms; con la primera línea a ≥ 6 s, el instrumental suena en < 1 s (canción de 4 min).
2. [▶ Reproducir] del toast `bib.toast.lista` abre el reproductor igual que el botón de la tarjeta y cierra el toast.
3. Esc sale del reproductor con **una** pulsación, también en pantalla completa (si hay un diálogo abierto, la primera pulsación lo cierra). ✕ Salir hace lo mismo.
4. Al salir, la ventana vuelve al estado que tenía antes de entrar (ventana, maximizada o pantalla completa); en la Biblioteca se conservan filtro, búsqueda y desplazamiento, y el foco está en la tarjeta de la canción.
5. F y ⛶ alternan pantalla completa y ventana sin salir del reproductor ni cortar el audio; el icono y el tooltip reflejan el estado, también si se cambia con el menú, F11 o el botón verde de macOS.

**Inicio, letra y sincronía**
6. Con la primera línea en `t1 < 6 s`, al empezar desde el principio hay un silencio previo de `6 s − t1`; en todos los casos se ve el título ≥ 2 s, la primera línea como siguiente y `●●●` que se apaga uno por segundo en los 3 s previos (test del modelo de render con `t1` = 0,5 s, 3 s, 5,9 s y 20 s).
7. El silencio previo se aplica al entrar en 0, con ⏮ / Inicio / 0 y con "Otra vez"; no al buscar hasta 0; Espacio lo pausa y una búsqueda lo cancela.
8. Se ven como máximo la línea actual y la siguiente, con los tamaños, posición y sombra de sistema-visual §10 (sin tope en píxeles: 162 px de cuerpo con 2160 px CSS de alto) y con la fuente y los colores del estilo de la canción.
9. La línea actual se resalta por palabra si tiene tiempos de palabra y, si no, con barrido lineal entre su inicio y su fin efectivo; el desfase visual respecto al audio es ≤ 50 ms (con `outputLatency` y `offset_ms` aplicados).
10. `●●●` aparece antes de la primera línea y antes de cada línea precedida por un hueco ≥ 4 s (desde el fin efectivo anterior, contando pausas y líneas omitidas), y no aparece con huecos < 4 s.
11. En pausa la letra se queda congelada en el fotograma de ese instante (no muestra la línea "a medias" del modo estático del editor).
12. El audio suena siempre a 1×, con ganancia `10^(ganancia_db/20) × volumen`.

**Controles y teclado**
13. Las franjas y el cursor se ocultan a los 3 s sin actividad y reaparecen al mover el ratón, hacer clic o pulsar Tab; no se ocultan en pausa, con el puntero sobre una franja, con un diálogo abierto ni arrastrando; al ocultarse, el foco vuelve a la superficie; los controles nunca ocupan la franja central 25 %–75 % del alto.
14. Todos los atajos de la tabla funcionan (también con el foco en un control, salvo Espacio/Intro sobre un botón, que lo activan) y muestran el indicador breve de 600 ms (1 s el desplazamiento) centrado al 12 % del alto, sin mostrar las franjas.
15. ←/→ ±5 s, J/L ±10 s, ⏮ y la barra de tiempo buscan con el audio acotado a [0, duración]; la barra es un `slider` con `aria-valuetext` en palabras.
16. El volumen es el de `config.reproductor` (el mismo del editor): ↑/↓ ±10 %, M silencia, mover el volumen silenciado activa el sonido, y el valor persiste entre canciones y reinicios (escritura como mucho cada 500 ms).
17. Ctrl/Cmd + N, Ctrl/Cmd + , y el zoom de la interfaz no hacen nada en el reproductor.
18. F1, ? o ⌨ abren el diálogo de atajos y pausan; al cerrarlo sigue en pausa.

**Voz guía** ([0030](../preguntas/0030-voz-original-en-el-reproductor.md))
19. Con pistas separadas suenan a la vez el instrumental y `voz.flac`, arrancando, pausando y buscando juntas (mismo `start()`; test con el doble de `AudioContext`); la voz se oye con ganancia `voz_guia` × la general, y M y el volumen general afectan a las dos; nunca suena `mezcla.flac` salvo en la vista previa sin pistas.
19b. V y 🎤 silencian y reactivan la voz guía sin cambiar su nivel; Mayús + ↑/↓ y el deslizador cambian el nivel ±10 % / 1 % y la reactivan; reactivar con 0 % la pone en 30 %; cada cambio muestra `rep.ind.voz` o `rep.ind.vozsilenciada`.
19c. El nivel y el silencio de la voz guía persisten en `config.reproductor.voz_guia` / `voz_guia_silenciada` entre canciones y reinicios (como mucho una escritura cada 500 ms); sin configuración previa valen 30 % y silenciada.
19d. Si `voz.flac` no se puede cargar, la canción se canta con el instrumental, el control de voz es `aria-disabled` con `rep.voz.nodisponible` y la canción aparece "Dañada" al volver a la Biblioteca; en la vista previa sin pistas separadas el control no aparece.

**Final**
20. Al terminar el audio aparece la pantalla final con el foco en "Volver a la biblioteca" (o "Volver al editor") y la cuenta atrás de 10 s; sin actividad sale sola a los 10 s; cualquier actividad detiene la cuenta atrás; "Otra vez" reinicia con título y silencio previo.

**Estados y errores**
21. Mientras carga se ve el fondo del estilo con la pantalla de título; a partir de 1 s, además `rep.cargando` con spinner; Esc funciona durante la carga.
22. Si falta el instrumental, se muestra el wireframe E con `rep.error.pistas` y el foco en "Volver a la biblioteca", y al volver la tarjeta aparece como "Dañada" con "Faltan las pistas separadas" sin reiniciar la app (test E2E borrando `pistas/instrumental.flac` de una canción de la semilla).
23. Si el archivo existe pero no se puede decodificar, se muestra `rep.error.audio` con [Copiar detalles] y la canción no cambia de estado.
24. En una canción Lista incompleta el reproductor funciona con normalidad, omite las líneas sin inicio, muestra `rep.incompleta` (singular con n = 1) en la pantalla de título y en la franja superior con los controles visibles, lo anuncia una vez a lectores de pantalla y no muestra ningún aviso en la zona de la letra mientras se canta.
25. Los toasts que llegan con el reproductor abierto no se muestran sobre él y aparecen al salir (como máximo los 3 más recientes).
26. Mientras suena, la pantalla del equipo no se apaga ni salta el salvapantallas; en pausa o al salir vuelve a hacerlo según el sistema.

**Desde el editor**
27. "Probar a pantalla completa" o F (spec 06) abre el reproductor tras vaciar el guardado, desde `máx(0, línea seleccionada − 3 s)` (o la posición actual si la línea no tiene inicio), con la letra, el estilo y el desplazamiento del editor aunque aún no estuvieran guardados.
28. Sin pistas separadas suena la original con `rep.original` siempre visible y sin control de voz guía; con pistas, suenan instrumental y voz guía con los valores recordados.
29. , / . cambian el desplazamiento ±100 ms dentro de ±30 s con el indicador `rep.offset` (valor total); al volver, el editor muestra el nuevo desplazamiento, lo autoguarda y un solo Ctrl/Cmd + Z deshace todos los cambios de desplazamiento de esa prueba.
30. Al volver al editor (Esc, ✕ o pantalla final), el editor está en pausa con el cabezal en la posición del reproductor, la línea que sonaba seleccionada y visible, la misma pista y velocidad de antes, el historial de deshacer intacto y el foco en "Probar a pantalla completa"; `rep.incompleta` nunca se muestra en este caso.

**Accesibilidad y legibilidad**
31. Los controles tienen contraste ≥ 4,5:1 sobre sus franjas con cualquier fondo de estilo (prueba con un estilo sólido `#FFFFFF`) y foco visible con el anillo doble; ningún control enfocado queda oculto.
32. Los anuncios a lectores de pantalla se limitan a los hitos de §"Accesibilidad"; la letra es `aria-hidden`.
33. Con 1920 × 1080 y con 3840 × 2160 (escalado 100 % y 200 %), la línea actual mide el 7,5 % del alto y ningún elemento de interfaz se dibuja entre el 25 % y el 75 % del alto mientras suena una línea (captura E2E con los controles visibles).

## Cambios de esta revisión (2026-11-06)
Respecto a la versión de la Fase 0, sin cambiar el alcance:
- Base técnica: `MotorAudio` y `PantallaLetra` de la Fase 5 (ADR 0010); datos que usa; un solo volumen compartido con el editor.
- Inicio: silencio previo cuando la primera línea entra antes de 6 s y `●●●` siempre antes de la primera línea (cambio en `render.ts` y en sistema-visual §10).
- Letra congelada en pausa (no el modo estático del editor). Audio siempre a 1×.
- Legibilidad: sin tope de 140 px; cálculo para una TV de 55" a 5 m; tamaños relativos para la píldora, el indicador y las etiquetas.
- Controles: reglas exactas de ocultación y foco, botón de atajos, indicador breve al 12 % del alto (antes "central", que invadía la letra), pantalla final con cuenta atrás que se detiene con cualquier actividad.
- Voz guía (decisión de [0030](../preguntas/0030-voz-original-en-el-reproductor.md)): `voz.flac` sobre el instrumental, nivel propio recordado, V para silenciarla y Mayús + ↑/↓ para su nivel. Sustituye a la opción provisional de cambiar a la canción original.
- Salida: restaura el estado previo de la ventana; foco en la tarjeta; toasts retenidos.
- Desde el editor: instantánea en memoria, desplazamiento como un paso de deshacer, vuelta con cabezal y selección en la línea que sonaba.
- Errores separados (falta la pista / no se puede leer), con la canción marcada Dañada al momento ([0031](../preguntas/0031-detalles-tecnicos-del-reproductor-fase-6.md)).
- Pantalla encendida mientras suena.
- Criterios renumerados (1–33).

## Primera fase de 0.2.0 — Fin de línea y barrido

- El intervalo activo incluye su inicio y excluye su fin. Con líneas 00:12.40–00:15.80 y 00:17.10–00:20.30, en 00:15.80 desaparece la actual y la siguiente queda visible en su posición de espera, sin resaltado. En 00:17.10 esa línea pasa a activa. Buscar dentro del hueco reconstruye el mismo estado. Aplicar el desplazamiento global por igual a ambos extremos. Los indicadores existentes de primera entrada y huecos largos conservan sus reglas.
- El barrido de una línea partida recorre los renglones visuales en orden de lectura. Para anchos de 120 y 60 px, al 50 % se pintan 90 px del primer renglón y 0 px del segundo. Al 75 % se pintan 120 y 15 px. Los tiempos de palabras importadas se mantienen aunque sus fragmentos se distribuyan entre varios renglones.
- Redimensionar durante la reproducción recalcula los renglones en la nueva disposición y pinta el avance del reloj actual. La capa de resaltado es decorativa y el texto tiene una sola representación accesible.
- Verificar el reparto de anchos y fronteras con Vitest, y con un E2E de ventana angosta verificar orden de pintado y redimensión durante reproducción. Probar también la vista previa del editor, que usa el mismo render.

## Fase 4 de 0.2.0 — ventana secundaria y cola

Origen: [plan, fase 4, features 10 y 11](../versiones/0.2.0/plan-2.md#fase-4--reproducción-en-eventos), decisiones del usuario en [0048](../preguntas/0048-escucha-editor-durante-evento.md) y [0049](../preguntas/0049-politica-cola-de-reproduccion.md) y acuerdos de la [ronda 4](../versiones/0.2.0/discusion/r4-disenador-ux.md). Contratos (sesión, fases, revisión, ids de entrada, IPC por rol, pantallas, reposo): [ADR 0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md). Correspondencia de estados de esta spec con las fases de main: S1 = `transicion`; S2 = `espera`; S3 = `fin_de_cola` (al añadir una canción pasa a `transicion`, S1, según [0059](../preguntas/0059-conductas-de-la-sesion-en-vivo-ante-incidencias.md) §3 B); S4 = `error`; reproduciendo / en pausa / cargando = `reproduciendo` / `pausada` / `cargando`. La cola y los controles de operación de la ventana principal están en [02 · Fase 4](02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola); el bloqueo de edición en [06 · Fase 4](06-editor.md#fase-4-de-020--ventana-secundaria-y-cola); la duración de la cuenta en [08 · Fase 4](08-ajustes-y-acerca.md#fase-4-de-020--ventana-secundaria-y-cola). Esta sección **amplía** la spec: el reproductor local (desde la Biblioteca sin sesión y «Probar a pantalla completa» del editor) **no cambia**.

### Conceptos

| Término | Definición |
|---|---|
| **Reproductor en otra pantalla** (ventana secundaria) | Una segunda ventana, de rol fijo, que solo muestra el reproductor. Hay como máximo una. Es la **única** que suena durante la sesión (un solo motor de audio). La pantalla elegida decide dónde se ve; el sonido sale siempre por la salida de audio habitual del sistema. |
| **Sesión** | Desde que se abre la ventana secundaria hasta que se cierra (por el usuario, por caída o al salir de la app). Mientras dura, el editor y la vista Letra están bloqueados (spec 06). |
| **Cola** | Una **entrada activa** (la que suena, está en pausa, terminó o falló en la secundaria) y una lista ordenada de **pendientes**. Cada entrada tiene su propio id: la misma canción puede estar varias veces. Vive en memoria mientras la app esté abierta; puede existir sin sesión (preparada antes de abrir o conservada al cerrar). |
| **Candidata** | La primera pendiente. Es la que anuncian la cuenta y la tarjeta «A continuación». La calcula main tras cada cambio de la cola. |
| **Última reproducida** | Tras «Cerrar y conservar cola», la entrada que llegó a sonar en último lugar, con su segundo si se interrumpió o marcada como terminada. Es contexto para reabrir; no es una pendiente. |

### Estados de la ventana secundaria

| Estado | Qué ve el público | Se llega por |
|---|---|---|
| Reproduciendo / en pausa | Wireframes A–C de esta spec con las diferencias de «Diferencias con el reproductor local» | Inicio de una entrada, reanudación |
| **Cuenta entre canciones** (transición) | Wireframe S1 | Fin natural de la activa con candidata; «Siguiente»; «Pasar a la siguiente canción»; **añadir una canción con S3 en pantalla**. («Iniciar» en espera y «Empezar ya» en la cuenta empiezan la candidata al momento, con su pantalla de título) |
| **En espera** | Wireframe S2 | Sesión abierta con la cola vacía; «Detener cuenta»; reabrir tras una canción terminada; «Descartar» un fallo sin pendientes |
| **Fin de la cola** | Wireframe S3 | Fin natural de la activa sin pendientes |
| **Fallo de una entrada** | Wireframe S4 | La activa o la candidata no se puede reproducir al consumirla |
| Cargando | Fondo del estilo + pantalla de título (como hoy, §"Estados") | Toda entrada que empieza |

### Wireframes

**S1 — Cuenta entre canciones** (4 s por defecto, configurable en Ajustes)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ (fondo del estilo de la CANDIDATA)                                       │
│                                                                          │
│                              ╭─────────╮                                 │
│                            ╭─┤         ├─╮   ← anillo que se vacía       │
│                            │ │    3    │ │     (centro al 45 % del alto) │
│                            ╰─┤         ├─╯                               │
│                              ╰─────────╯                                 │
│                          Siguiente canción                               │
│                                                                          │
│                                          ┌──────────────────────────────┐│
│                                          │ A CONTINUACIÓN               ││ ← tarjeta inferior derecha
│                                          │ La flaca                     ││
│                                          │ Jarabe de Palo               ││
│                                          └──────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────┘
```

**S2 — En espera** (con candidata / sin candidata)
```
┌──────────────────────────────────────┐   ┌──────────────────────────────────────┐
│ (fondo del estilo de la candidata)   │   │ (fondo-0)                            │
│                                      │   │                                      │
│                                      │   │          ◆ Shinobi Karaoke           │
│                                      │   │   Enseguida empieza la siguiente     │
│                                      │   │              canción                 │
│               ┌────────────────────┐ │   │                                      │
│               │ A CONTINUACIÓN     │ │   │                                      │
│               │ La flaca           │ │   │                                      │
│               │ Jarabe de Palo     │ │   │                                      │
│               └────────────────────┘ │   │                                      │
└──────────────────────────────────────┘   └──────────────────────────────────────┘
```

**S3 — Fin de la cola**
```
│                         Bohemian Rhapsody                                │ ← como la pantalla final D
│                              Queen                                       │
│                  ┌──────────────────────────┐                            │
│                  │      Fin de la cola       │                           │ ← píldora §10
│                  └──────────────────────────┘                            │
│            [ ↻ Otra vez ]   [ ✕ Cerrar reproductor ]                     │ ← solo con actividad (ratón, Tab)
```
Sin cuenta atrás de cierre: la ventana **no se cierra sola** (cerrarla dejaría el escritorio a la vista del público). Si se añade una canción a la cola, **empieza la cuenta** configurada hacia ella (S1), igual que al terminar una canción con cola, con «Detener cuenta» y «Empezar ya» (decisión del usuario en [0059](../preguntas/0059-conductas-de-la-sesion-en-vivo-ante-incidencias.md) §3, opción B).

**S4 — Fallo de una entrada** (mensaje breve para el público; la causa está en la principal)
```
┌──────────────────────────────────────────────────────────────────────────┐
│                          (fondo-0)                                       │
│                                                                          │
│              ⚠  Esta canción no se puede reproducir ahora.               │ ← máx(24 px, 3,2 % del alto), #FFFFFF
│                           «La flaca»                                     │ ← máx(t-cuerpo, 2,2 % del alto), texto-2
│                                                                          │
│     [ ⏭ Pasar a la siguiente canción ]   [ ✕ Cerrar reproductor ]       │ ← solo con actividad
└──────────────────────────────────────────────────────────────────────────┘
```
Sin pendientes, el primer botón no aparece y el texto añade `rep.cola.fallo.fin`.

### Apertura y foco
- La abre la principal (diálogo «Abrir el reproductor en otra pantalla», spec 02). La ventana aparece en la pantalla elegida, a pantalla completa si se marcó, **sin quitar el foco a la principal** (el operador sigue en la Biblioteca). Si la pantalla elegida es la principal y se marcó «Pantalla completa», sí la cubre y recibe el foco.
- Sin barra superior, sin menú de la app propio y sin zoom de la interfaz. Título de la ventana: `rep.cola.ventana` (lo ve el sistema operativo y Alt + Tab).
- Inicios posibles (ADR 0017 §11, `sesion.abrir`): **con una canción** («Reproducir en otra pantalla…» del menú de una Lista, spec 02): esa canción empieza al momento y las pendientes que hubiera siguen detrás; **con la cola**: con pendientes y sin última reproducida, empieza la primera al momento (pantalla de título y silencio previo); con la cola vacía, S2 sin candidata; **reanudar**: con una última reproducida, ver §"Reabrir con la cola conservada".
- **Linux con Wayland** (`colocacion: 'sistema'`, [0061](../preguntas/0061-reproductor-en-otra-pantalla-con-wayland.md)): la ventana se abre donde decide el sistema, en ventana; el operador la lleva a la pantalla del público y pulsa F (texto `ses.wayland` en el diálogo de la principal).
- Pantalla encendida **durante toda la sesión**, también en pausa, en cuenta, en espera, en el fin de la cola y en un fallo: una pantalla de evento no debe apagarse. Se libera al terminar la sesión por cualquier causa (ADR 0017 §4; decisión del usuario en [0059](../preguntas/0059-conductas-de-la-sesion-en-vivo-ante-incidencias.md) §2).

### Diferencias con el reproductor local
Todo lo de esta spec vale en la secundaria salvo:

| Aspecto | En la ventana secundaria |
|---|---|
| Franja superior | Izquierda: [✕ Cerrar reproductor] (`rep.cola.cerrar`). Derecha: «título · artista». **No** se muestra `rep.incompleta` (ni en la franja ni en la pantalla de título): el público no lo necesita; el aviso está en la entrada de la cola de la principal. |
| Franja inferior | Igual, con [⏭] tras 5↻ (`rep.cola.siguiente`; inactivo sin pendientes, tooltip `rep.cola.siguiente.no`). ⏮ es «Reiniciar canción» (mismo comportamiento: principio con título y silencio previo). En S1 y S2 la franja inferior solo tiene [▶ Empezar ya] / [▶ Iniciar «{título}»], [❚❚ Detener cuenta] (solo en S1), volumen, voz guía, ⌨ y ⛶. |
| Pantalla final | No existe. Con candidata → S1. Sin pendientes → S3. |
| Error de pista o de audio (wireframe E) | Lo sustituye S4. La canción se marca Dañada igual que hoy si faltan pistas (criterio 22). |
| Salida | No hay «Volver a la biblioteca». Cerrar = terminar la sesión (§"Cerrar el reproductor con cola"). |
| Esc | Cierra un diálogo o tooltip; si no hay, **en pantalla completa pasa a ventana**; en ventana no hace nada. Nunca pide el cierre de la sesión (un Esc accidental en un evento no debe dejar la pantalla vacía). |
| Toasts | La secundaria nunca muestra toasts; los de la app salen en la principal como siempre (no se retienen). |
| Desplazamiento `,` `.` | No aplica (solo desde el editor). |
| Tema | La entrada usa el estilo resuelto **al empezar** (instantánea, [ADR 0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md)); un cambio de tema durante la canción se ve en la siguiente entrada. |

Atajos añadidos o distintos (se añaden al diálogo de atajos solo en la secundaria):

| Tecla | Acción |
|---|---|
| Espacio / K | Reproducir / pausa. En S1: «Empezar ya». En S2 con candidata: «Iniciar». |
| Mayús + N | Siguiente: interrumpe la activa y empieza la cuenta de la candidata (sin pendientes no hace nada y muestra `rep.cola.siguiente.no` como indicador breve). Con Mayús para evitar pulsaciones accidentales. |
| Esc | Ver tabla anterior. |
| Ctrl/Cmd + W | Cerrar reproductor (con la confirmación de cola si hay pendientes). También el botón de cerrar de la ventana y Alt + F4. |
| F | Pantalla completa / ventana (igual que hoy). |

### Cuenta entre canciones (S1)
- **Cuándo**: al terminar de forma natural la activa con una candidata disponible; con «Siguiente» (principal o secundaria) con «Pasar a la siguiente canción» (ADR 0017 §7: `sesion.siguiente` empieza la cuenta como un fin natural) y al **añadir una canción mientras se ve S3** («Fin de la cola»; [0059](../preguntas/0059-conductas-de-la-sesion-en-vivo-ante-incidencias.md) §3 B). Así el público siempre ve qué viene. Nunca tras un fallo sin acción explícita.
- **Duración**: la de Ajustes (`aj.rep.cuenta`, `config.reproductor.transicion_s`, 4 s por defecto). El número empieza en esa cifra y baja uno por segundo; al pasar de 1 la candidata se convierte en la activa y empieza con su pantalla de título y su silencio previo. La fecha límite es de main (ADR 0017): la secundaria solo la dibuja.
- **Fondo**: el del estilo de la **candidata** (anticipa la canción). Si aún no se ha resuelto, `fondo-0`.
- **Número**: centrado con su centro al 45 % del alto (donde estará la letra), `máx(64 px, 18 % del alto)`, `#FFFFFF` 700 con la sombra de §10, sobre un disco `rgba(0,0,0,0.6)` de 1,6 × el alto del número. No usa el color de letra del estilo: así el contraste es ≥ 5,7:1 con cualquier fondo. Debajo, `rep.cola.cuenta` («Siguiente canción») en `máx(t-cuerpo, 2,2 % del alto)`.
- **Animación**: anillo de 0,6 % del alto alrededor del disco (pista `rgba(255,255,255,0.35)`, relleno `#FFFFFF`) que se vacía de forma continua en sentido horario durante toda la cuenta; cada número entra con una escala de 0,9 → 1 y fundido en 200 ms. **Movimiento reducido**: sin anillo ni escala; el número cambia de golpe una vez por segundo.
- **Tarjeta «A continuación»**: abajo a la derecha (margen 4 % del ancho y 6 % del alto), máx. 40 % del ancho, fondo `rgba(0,0,0,0.6)`, radio `r-l`, relleno 1 × 1,25 em. Etiqueta `rep.cola.aContinuacion` en mayúsculas `máx(t-pequeno, 1,8 % del alto)` 600; título `máx(20 px, 3,2 % del alto)` 600, una línea con «…»; artista `máx(t-cuerpo, 2,2 % del alto)`. Todo `#FFFFFF`.
- **Cambia la candidata durante la cuenta** (reordenar, quitar, «Reproducir a continuación» en la principal): la tarjeta y el fondo pasan a la nueva (fundido 200 ms; inmediato con movimiento reducido) y la cuenta **vuelve a empezar** desde la duración completa. Si el id de la candidata no cambia (p. ej. se reordenan pendientes posteriores), nada cambia y la cuenta sigue.
- **Se quedan sin pendientes durante la cuenta**: la cuenta se cancela y se pasa a S3 con la entrada que terminó.
- **«Detener cuenta»** (principal o franja de S1): pasa a S2 con la candidata. **«Empezar ya»** (o Espacio): la candidata empieza al momento.
- **Congelada** mientras se confirma el cierre (§"Cerrar el reproductor con cola"): el número y el anillo se quedan quietos; nada cambia en pantalla. Con «Cancelar», sigue **desde donde se detuvo**.
- **Revalidación**: al terminar la activa, si la primera pendiente ya se sabe no disponible (borrada, vuelta a borrador o dañada), no hay cuenta: S4. Al consumirla, main comprueba de nuevo canción, estado Lista y pistas; si falla, S4 en lugar de su pantalla de título.

### En espera (S2)
- Con candidata: fondo de su estilo y solo la tarjeta «A continuación»; nada en el centro. Con actividad, la franja inferior ofrece [▶ Iniciar «{título}»] (`rep.cola.iniciar`).
- Sin candidata: `fondo-0`, «◆ Shinobi Karaoke» en `texto-3` a `máx(32 px, 6 % del alto)` y `rep.cola.espera` debajo en `texto-2`.
- **Añadir a la cola en espera (S2) no arranca solo**: la nueva candidata se ve en la tarjeta y la empieza el operador («Iniciar» en la principal, en el toast de la principal o en la secundaria). Es distinto de S3, donde añadir sí empieza la cuenta: a S2 se llega por una decisión explícita del operador (detener la cuenta, descartar un fallo, abrir con la cola vacía o tras una canción terminada). Excepción: abrir la sesión con pendientes y sin última reproducida empieza la primera (§"Apertura y foco").

### Fin de la cola (S3)
- Al terminar la activa sin pendientes. Mismo fondo, título y artista que la pantalla final D, con la píldora `rep.cola.fin`. «Otra vez» repite la misma entrada desde el principio; «Cerrar reproductor» termina la sesión (sin pendientes, sin confirmación).
- Si llega una pendiente (añadida desde la principal), pasa a **S1** con ella como candidata y la cuenta completa configurada; «Detener cuenta» lleva a S2 y «Empezar ya» la empieza al momento. Si se añaden varias seguidas, la candidata es la primera y la cuenta no se reinicia mientras su id no cambie (regla general de S1).

### Fallo de una entrada (S4)
- **Cuándo**: al consumir una entrada (empezar, reanudar, avanzar) main o la secundaria detectan que no se puede reproducir, o al terminar la activa la primera pendiente ya está marcada no disponible. Causas que distingue la principal (`cola.causa.*`, spec 02, a partir de `MotivoNoDisponible` y del error del motor): ya no está en la biblioteca, ya no está lista, faltan las pistas, no se puede leer el audio.
- **No avanza solo**: el avance requiere «Pasar a la siguiente canción» (principal, o la secundaria con actividad), que **descarta la entrada fallida** y empieza la cuenta de la siguiente. Sin pendientes, el botón es «Descartar» (`cola.descartar`) y lleva a S2 sin candidata.
- `role="alert"` con `rep.cola.fallo` y el título. Los controles de reproducción no se muestran.

### Reabrir con la cola conservada
Tras «Cerrar y conservar cola» (o una caída), la principal guarda la última reproducida. Al volver a abrir el reproductor (spec 02):
- **Interrumpida a mitad** (la canción no había terminado): empieza **en el mismo segundo**, sin pantalla de título ni silencio previo, y en el mismo estado en que se cerró (si estaba en pausa, abre en pausa en ese segundo; ADR 0017 §8). Indicador breve `rep.cola.reanudada` durante 2 s (al 12 % del alto) y anuncio `rep.cola.aria.reanudada`. «Reiniciar canción» (⏮ en la secundaria, ↺ en la principal) vuelve al principio con título y silencio previo **sin tocar el orden de pendientes**. Si se cerró durante el silencio previo o la pantalla de título, empieza desde el principio.
- **Terminada** (se cerró en la cuenta o en S3): abre en S2 con la primera pendiente como candidata (o S2 sin candidata si no quedan) y el operador la inicia. La última reproducida se muestra como contexto en la principal.
- **Ya no disponible** al reabrir: S4 con su causa y «Pasar a la siguiente canción».
- La posición pertenece a la **entrada**: si la misma canción está dos veces, solo se reanuda la que se interrumpió.

### Cerrar el reproductor con cola
- **Vías**: [✕ Cerrar reproductor] de la secundaria o de la principal, Ctrl/Cmd + W en la secundaria, botón de cierre de su ventana, Alt + F4 (Esc no, ver «Diferencias»). Todas pasan por **la misma confirmación**, una sola vez.
- **Sin pendientes**: cierra al momento, sin diálogo; la cola queda vacía y no hay última reproducida.
- **Con pendientes**: diálogo `ses.cierre` (texto en spec 02) en la ventana **donde se pidió el cierre**: quien pulsó lo ve donde está mirando (en la secundaria, con el componente de diálogo y el anillo doble, sobre el fondo de la canción). La otra ventana lo indica: la principal muestra `ses.cierre.esperando` en el panel y desactiva sus controles de sesión; la secundaria no muestra nada al público. Mientras está abierto: la canción que suena **sigue sonando**; una cuenta en curso queda congelada; si la canción termina, **no** empieza la cuenta (queda como «terminada») y el diálogo no cambia.
- **«Cerrar y conservar cola»**: main guarda la última reproducida (entrada, segundo y estado, o «terminada») y los pendientes en su orden, y cierra. **«Cerrar y eliminar cola»**: vacía la cola y cierra. **«Cancelar»**: vuelve la sesión tal como estaba (cuenta descongelada).
- Una caída o la desconexión del último monitor **nunca** eliminan la cola (§"Recuperación").

### Recuperación (lado de la secundaria)
| Situación | Comportamiento |
|---|---|
| Se desconecta la pantalla de la secundaria | Main la lleva a la pantalla primaria **en ventana** (80 % del área útil, centrada, sin robar el foco) para no tapar al operador. **El audio sigue sonando** y la cola no cambia (decisión del usuario en [0059](../preguntas/0059-conductas-de-la-sesion-en-vivo-ante-incidencias.md) §1, ADR 0017 §3). La principal muestra `ses.rec.monitor` (spec 02) con [Mover a…]. |
| Vuelve a conectarse esa pantalla | No se mueve sola. La principal ofrece `ses.rec.vuelve` con [Llevar el reproductor allí] (`sesion.moverAPantalla`), que la devuelve y restaura pantalla completa si la tenía. |
| La secundaria se cierra o su contenido se cae | Termina la sesión **conservando la cola** (sin diálogo): la última reproducida queda «interrumpida» en el último segundo conocido por main. Se libera el bloqueo de edición y el de reposo. No se reabre sola. La principal muestra `ses.rec.caida` con [Volver a abrir]. |
| La secundaria deja de responder | La principal muestra `ses.rec.noResponde` con [Esperar] y [Cerrar y volver a abrir] (cierre forzado que conserva la cola como en una caída, y abre el diálogo de pantallas). Si vuelve a responder, el aviso desaparece solo. |
| Linux con Wayland (`colocacion: 'sistema'`) | Main no puede mover la ventana: «Mover a…», «Cambiar de pantalla…» y «Llevar el reproductor allí» se sustituyen por la instrucción `ses.wayland` como información ([0061](../preguntas/0061-reproductor-en-otra-pantalla-con-wayland.md)). |
| Se cierra la app | Confirmación de la principal (`ses.salir`, spec 02; decisión del usuario en 0059 §4). En Windows y Linux la app sale y la cola se pierde; en macOS, cerrar la ventana principal no sale de la app: la secundaria se cierra y la cola se conserva. |

### Accesibilidad (secundaria)
- La región conserva `rep.aria.region`. Anuncios `aria-live="polite"` solo en hitos: inicio de cada entrada (`rep.aria.inicio`), **inicio de la cuenta** (`rep.cola.aria.cuenta`, una vez, nunca cada segundo), **cambio de candidata** durante la cuenta (`rep.cola.aria.cambio`, una vez por cambio), en espera, fin de la cola, reanudación. Los fallos, `role="alert"`.
- El número de la cuenta y la tarjeta son `aria-hidden` (lo dice el anuncio).
- Orden de tabulación de la franja inferior: el de hoy con [⏭] tras 5↻; en S1/S2/S3/S4, los botones visibles en orden visual. Foco visible con el anillo doble.
- Movimiento reducido: sin anillo ni escala en la cuenta, sin fundido de la tarjeta ni de las franjas.
- Contraste: número, etiqueta y tarjeta en `#FFFFFF` sobre `rgba(0,0,0,0.6)` (≥ 5,7:1 con cualquier fondo, como los controles).

### Microcopy (fase 4, reproductor)
| Clave | Texto |
|---|---|
| `rep.cola.ventana` | Shinobi Karaoke · Reproductor |
| `rep.cola.cerrar` | Cerrar reproductor (tooltip: Cerrar reproductor (Ctrl/Cmd + W)) |
| `rep.cola.siguiente` | Siguiente (tooltip: Siguiente canción (Mayús + N)) |
| `rep.cola.siguiente.no` | No hay canciones a continuación. |
| `rep.cola.reiniciar` | Reiniciar canción (tooltip de ⏮: Reiniciar canción (Inicio)) |
| `rep.cola.cuenta` | Siguiente canción |
| `rep.cola.aContinuacion` | A continuación |
| `rep.cola.empezarYa` | Empezar ya |
| `rep.cola.detener` | Detener cuenta |
| `rep.cola.iniciar` | Iniciar «{título}» |
| `rep.cola.espera` | Enseguida empieza la siguiente canción |
| `rep.cola.fin` | Fin de la cola |
| `rep.cola.fallo` | Esta canción no se puede reproducir ahora. |
| `rep.cola.fallo.fin` | No hay más canciones en la cola. |
| `rep.cola.pasar` | Pasar a la siguiente canción |
| `rep.cola.reanudada` | Reanudada en {mm:ss} |
| `rep.cola.aria.cuenta` | A continuación: «{título}», de {artista}. Empieza en {n} segundos. |
| `rep.cola.aria.cambio` | Cambió la siguiente canción: «{título}», de {artista}. Empieza en {n} segundos. |
| `rep.cola.aria.espera` | En espera. · (con candidata) En espera. A continuación: «{título}». |
| `rep.cola.aria.fin` | Fin de la cola. |
| `rep.cola.aria.reanudada` | Reproducción reanudada en {mm:ss}. |

### Criterios de aceptación de la fase 4 (reproductor)
- P1. Con dos pantallas, abrir el reproductor en la segunda con «Pantalla completa» lo muestra a pantalla completa allí, sin barra superior ni menú propio, y el foco del teclado sigue en la ventana principal. Sin «Pantalla completa», se abre en una ventana en esa pantalla. F y ⛶ alternan sin cortar el audio.
- P2. Durante la sesión suena **un solo** motor: la principal no reproduce audio (comprobación en E2E de que solo la secundaria crea `AudioContext` con fuentes activas). El sonido sale por la salida predeterminada del sistema aunque la imagen esté en otra pantalla.
- P3. Al terminar una canción con pendientes aparece S1 con el fondo de la candidata, el número de la duración configurada (4 por defecto) bajando uno por segundo, el anillo vaciándose y la tarjeta «A continuación» abajo a la derecha con título y artista; al pasar de 1, la candidata empieza con su pantalla de título. Con 3 s y con 10 s configurados, la cuenta dura eso.
- P4. Con movimiento reducido, S1 no tiene anillo ni escala y el número cambia de golpe cada segundo; la tarjeta cambia sin fundido.
- P5. Reordenar durante la cuenta de modo que cambie la candidata actualiza tarjeta y fondo y reinicia la cuenta a la duración completa, con un único anuncio `rep.cola.aria.cambio`; reordenar pendientes posteriores no reinicia ni anuncia nada. Quitar la única pendiente durante la cuenta lleva a S3.
- P6. Eventos duplicados o tardíos (dos «fin» de la misma entrada, un «fin» de una entrada ya sustituida) no producen doble avance ni saltan una pendiente (E2E con eventos inyectados).
- P7. Sin pendientes, al terminar la canción se ve S3 con «Fin de la cola», sin cuenta atrás de cierre; la ventana sigue abierta; añadir una canción empieza S1 con ella como candidata y la duración configurada (4 s por defecto), con un único anuncio `rep.cola.aria.cuenta`; «Detener cuenta» pasa a S2 y «Empezar ya» la empieza al momento; añadir otra durante esa cuenta no la reinicia. En S2 (p. ej. tras «Detener cuenta»), añadir una canción no empieza la cuenta.
- P8. Si la candidata se borra o pierde sus pistas antes de consumirse, no hay cuenta ni avance: S4 con `rep.cola.fallo` y el título; la principal muestra la causa; solo «Pasar a la siguiente canción» avanza, descartando la entrada fallida y empezando la cuenta de la siguiente.
- P9. Con pendientes, cerrar la secundaria por cualquiera de sus vías muestra una sola vez el diálogo de cierre en la ventana donde se pidió (la principal muestra entonces `ses.cierre.esperando`); mientras está abierto la canción sigue sonando y una cuenta en curso queda congelada (el número no cambia en 5 s); «Cancelar» la reanuda desde el mismo número.
- P10. Tras «Cerrar y conservar cola» a mitad de una canción en 02:13, reabrir empieza esa entrada en 02:13 (± 1 s) y en el mismo estado (sonando o en pausa), sin pantalla de título, con el indicador `rep.cola.reanudada`; «Reiniciar canción» la lleva al principio con título y silencio previo y el orden de pendientes no cambia. Con la misma canción dos veces en la cola, solo se reanuda la entrada interrumpida.
- P11. Tras cerrar y conservar durante la cuenta, reabrir muestra S2 con la candidata que se anunciaba y no empieza hasta «Iniciar».
- P12. Esc en la secundaria a pantalla completa la pasa a ventana y nunca cierra la sesión; Ctrl/Cmd + W cierra (con diálogo si hay pendientes).
- P13. Desconectar la pantalla de la secundaria la recoloca en ventana en la pantalla primaria sin cortar el audio ni cambiar la cola; cerrar la secundaria a la fuerza (proceso del renderer terminado) termina la sesión conservando la cola y libera el bloqueo de reposo y el de edición.
- P14. La pantalla del equipo no se apaga en ningún estado de la sesión (incluidos S2 y S3) y vuelve a apagarse según el sistema al terminar la sesión.
- P15. La secundaria no muestra `rep.incompleta` ni toasts; la principal sí recibe sus toasts durante la sesión.
- P16. Capturas en `docs/ux/revision-fase-4/` con nombre `reproductor-{ancho}x{alto}-{estado}.png` a 1920 × 1080 y 1280 × 720: `cuenta`, `cuenta-reducido`, `espera`, `espera-vacia`, `fin-cola`, `fallo`, `reanudada`.
