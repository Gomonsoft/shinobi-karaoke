# 07 — Reproductor a pantalla completa

- Paso del pipeline: 6 (Reproductor)
- ADRs: [0005](../adr/0005-letras-y-formato-de-sincronia.md) (`finEfectivo`, desplazamiento), [0006](../adr/0006-persistencia-y-modelo-de-datos.md) (`cancion.json`, `incompleta`, `config.reproductor`), [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md) (reloj, `PantallaLetra`, render compartido), [0011](../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md) (`MotorReproductor`, pantalla completa, reposo)
- Restricciones: [arquitectura.md §7 y "Restricciones e implicaciones para UX" §2, §5](../arquitectura.md)
- Valores fijos de render: [sistema-visual.md §10](sistema-visual.md)
- Preguntas: [0005](../preguntas/0005-viabilidad-detalles-ux-fase-0.md) §6, §8, §11, §12 y [0006](../preguntas/0006-ajustes-specs-ux-tras-0005.md) §4 (respondidas); [0025](../preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) §1 y §8 (respondida: el reproductor llega en la Fase 6, un solo volumen); [0030](../preguntas/0030-voz-original-en-el-reproductor.md) (usuario, respondida 2026-11-06: **voz guía** = `voz.flac` mezclada sobre el instrumental con volumen propio, tecla para silenciarla y nivel recordado; no se usa la mezcla original); [0031](../preguntas/0031-detalles-tecnicos-del-reproductor-fase-6.md) (arquitecto: pantalla completa, motor con dos pistas a la vez, silencio previo, pistas que faltan, pantalla encendida, configuración de la voz guía; abierta, opción provisional tomada)
- Revisión: 2026-11-06, puesta al día para la Fase 6 (ver "Cambios de esta revisión" al final).

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
