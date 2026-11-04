# 06 — Editor (sincronía + estilo + vista previa)

- Paso del pipeline: 4 (Editor) y 5 (Guardado: borrador / lista)
- ADRs: [0005](../adr/0005-letras-y-formato-de-sincronia.md), [0006](../adr/0006-persistencia-y-modelo-de-datos.md)
- Restricciones: [arquitectura.md §7 y "Restricciones e implicaciones para UX" §5–§6](../arquitectura.md)
- Sistema visual: [sistema-visual.md §8–§10](sistema-visual.md) (estilo predeterminado, reglas de contraste, valores fijos de render)
- Preguntas: [0002](../preguntas/0002-sincronia-por-palabra-en-mvp.md) (decidida por el usuario: **sincronía solo por línea** en el MVP), [0004](../preguntas/0004-fuentes-tipograficas-incluidas-y-del-sistema.md), [0005](../preguntas/0005-viabilidad-detalles-ux-fase-0.md) y [0006](../preguntas/0006-ajustes-specs-ux-tras-0005.md) (respondidas)

## Objetivo
Dejar la letra **a tiempo** con la música y darle un **estilo** propio con las opciones mínimas del MVP (fondo, color de letra, color de resaltado, fuente), viendo el resultado en todo momento, y marcar la canción como **lista**.

Usuario/tarea principal: "Sincronizar la letra en una pasada, retocar lo que quede mal, ponerla bonita y legible, y dejarla lista para cantar".

## Wireframe (≥ 1280 px)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ‹ Biblioteca │ «Bohemian Rhapsody» · Queen        ✎ Borrador · guardado ✓  [⟲][⟳]│
│   (1)✓ Fuente ── (2)⟳ Separación 42 % ── (3)✓ Letra ── (4)● Editor               │
├───────────────────────────┬────────────────────────────────┬───────────────────┤
│ LÍNEAS            48/52 ✓ │   VISTA PREVIA (16:9)           │ [Sincronía][Estilo]│
│ ┌───────────────────────┐ │ ┌────────────────────────────┐ │                   │
│ │ 00:00.50 Is this the  │ │ │                            │ │ (panel derecho,   │
│ │          real life?   │ │ │   Is this the real life?   │ │  ver abajo)       │
│ │▶00:04.20 Is this just │ │ │   ▔▔▔▔▔▔▔▔▔▔ (barrido)     │ │                   │
│ │          fantasy?     │ │ │                            │ │                   │
│ │ ♪ pausa               │ │ │   Is this just fantasy?    │ │                   │
│ │ --:--.-- Caught in a  │ │ │                            │ │                   │
│ │          landslide    │ │ └────────────────────────────┘ │                   │
│ │ …                     │ │ [⛶ Probar a pantalla completa] │                   │
│ └───────────────────────┘ │                                │                   │
├───────────────────────────┴────────────────────────────────┴───────────────────┤
│ TRANSPORTE                                                                     │
│ [⏮][ ▶ ] 01:12.4 / 05:55  ━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│ Escuchar: [Original][Voz][Instrumental]   Velocidad: [0,5×][0,75×][1×]   🔊━━   │
│                                                                                │
│ [ ● Sincronizar al ritmo ]                          [ Marcar como lista ] (prim.)│
└────────────────────────────────────────────────────────────────────────────────┘
```
- Columnas: Líneas 320 px · Vista previa flexible · Panel derecho 320 px.
- **< 1280 px**: el panel derecho se convierte en pestañas sobre la columna de líneas ("Líneas · Estilo"); la vista previa conserva el ancho restante.
- La línea de tiempo del transporte marca con ticks finos el inicio de cada línea sincronizada (ayuda a ver huecos).

### Panel derecho — pestaña "Sincronía" (línea seleccionada)
```
│ Línea 2 de 52                         │
│ «Is this just fantasy?»               │
│ Inicio   04.20   [−0,1][−0,01][+0,01][+0,1] │
│ Fin      07.85   [−0,1][−0,01][+0,01][+0,1] │
│          (automático: inicio de la siguiente) [Fijar fin aquí] │
│ [▶ Escuchar desde esta línea]         │
│ [Borrar tiempos de esta línea]        │
│ ─────────────────────────────────     │
│ Desplazamiento de toda la letra       │
│ [−0,1 s] [ +0,00 s ] [+0,1 s]  [Restablecer] │
│ Úsalo si toda la letra va adelantada  │
│ o atrasada respecto a la música.      │
```

### Panel derecho — pestaña "Estilo"
```
│ Fondo                                 │
│ [ Sólido | Degradado ]                │
│ (Degradado) Ángulo [135°] ◐ (dial)    │
│ Colores  [■#1B1033] [■#5A1E6E] [+ Añadir color]  (2–4) │
│          (cada color: muestra + hex + [✕] si hay > 2) │
│ Sugeridos ■■■■■■■■                    │
│ ─────────────────────────────────     │
│ Letra                                 │
│ Fuente  [ Atkinson Hyperlegible Next ▾]│
│ Color de la letra       [■ #FFFFFF]   │
│ Color de lo ya cantado  [■ #FFD400]   │
│ Sugeridos ■■■■■■■■                    │
│ ─────────────────────────────────     │
│ ✓ Buen contraste                      │
│   (o ⚠ Difícil de leer: la letra y el │
│    fondo se parecen demasiado.        │
│    [Usar letra blanca] [Usar letra negra]) │
│ ─────────────────────────────────     │
│ [Restablecer estilo predeterminado]   │
│ [Usar este estilo en canciones nuevas]│
```

## Componentes e interacciones

### Lista de líneas
| Elemento | Comportamiento |
|----------|----------------|
| Fila | Tiempo de inicio (`mm:ss.cc`, tabular) + texto. Sin tiempo: `--:--.--` en `texto-3` e icono de "falta" pequeño. Fila **actual** (la que suena) con marcador ▶ y fondo `fondo-2`; fila **seleccionada** con borde izquierdo `acento-texto`. Las filas con tiempos por palabra (venidos de LRCLIB o de un LRC mejorado) muestran un pequeño ◆ ("por palabra", tooltip `edi.palabras.tooltip`): esos tiempos se conservan y se ven en la vista previa, pero no se editan. Si se mueve el inicio de una línea con palabras (marca o ajuste fino), sus palabras se desplazan lo mismo; "Borrar tiempos de esta línea" borra también los de sus palabras. |
| Separador "♪ pausa" | Elemento `tipo: "pausa"` (renglones vacíos de la letra, ya normalizados: nunca hay dos seguidas ni al principio/final). No se sincroniza desde el editor en el MVP, no se cuenta y no se puede seleccionar para ajustar (↑/↓ la salta). Fila en `texto-3`, sin tiempo; si la pausa trae tiempo de un LRC, se muestra ese tiempo en `texto-3` (solo lectura, tooltip `edi.pausa.tiempo`). Efecto en la línea anterior: ver fin automático. |
| Contador | "48/52 ✓" = líneas con inicio / total. Clic → selecciona la primera sin sincronizar. |
| Clic en fila | Selecciona la línea (panel Sincronía muestra sus datos). **Doble clic** = escuchar desde 2 s antes de su inicio. |
| Seguimiento | Durante la reproducción la lista se desplaza para mantener visible la línea actual, salvo si el usuario ha desplazado la lista manualmente en los últimos 5 s. |
| Edición de texto | No se edita texto aquí (se hace en Letra, spec 05). Enlace al pie de la lista: "Corregir la letra" → paso 3. |

### Transporte y audio
| Elemento | Comportamiento |
|----------|----------------|
| ▶/❚❚ | Reproduce/pausa. Atajo **Espacio**. |
| ⏮ | Ir al principio. Atajo **Inicio**. |
| Barra de tiempo | Clic/arrastre para buscar. ←/→ con el foco en ella: ±5 s. |
| Escuchar: Original / Voz / Instrumental | Control segmentado. Por defecto **Voz** si existe, si no **Original**. "Voz" e "Instrumental" no disponibles mientras se separa: tooltip "Disponible cuando termine la separación (42 %)". Cambiar de pista mantiene la posición. |
| Velocidad 0,5× / 0,75× / 1× | Afecta a la reproducción y al modo "Sincronizar al ritmo" (los tiempos se guardan siempre en tiempo real de la canción). Por defecto 1×. En el MVP, a 0,5× y 0,75× **el tono también baja** (como un disco más lento): tooltip del control `edi.velocidad.tooltip`. No hace falta aviso adicional. |
| Volumen | Deslizador; ↑/↓ con el foco en él. |

### Modo "Sincronizar al ritmo" (toque por línea)
Estado especial del editor para marcar los inicios en una pasada.
```
┌ Sincronizando al ritmo ─────────────────────────────────────────────────┐
│ Pulsa  [Intro]  cuando empiece cada línea.  Mantenla pulsada mientras    │
│ se canta si quieres marcar también el final.                            │
│ Siguiente:  «Caught in a landslide»                       línea 3 de 52 │
│ [↶ Deshacer (Retroceso)]  [❚❚ Pausa (Espacio)]  [Terminar (Esc)]          │
└──────────────────────────────────────────────────────────────────────────┘
```
| Acción | Comportamiento |
|--------|----------------|
| Entrar | Botón "● Sincronizar al ritmo" o tecla **S**. Empieza desde la línea seleccionada (o la primera sin sincronizar si no hay selección): la reproducción arranca 3 s antes del inicio de la línea anterior (o desde 0 si no la hay), con cuenta atrás visual "3·2·1" en la vista previa. |
| **Intro** (pulsar) | Marca `inicio_ms` de la "Siguiente" con el instante de la pulsación (compensando la latencia de salida, ADR/arquitectura §7) y avanza a la siguiente línea. También el botón grande "Marcar" que aparece en el banner, para quien use ratón. |
| **Intro** (mantener ≥ 300 ms) | Al soltar, fija `fin_ms` de esa línea. Si se suelta antes de 300 ms, el fin queda **automático**. |
| **Retroceso** | Deshace la última marca: borra el inicio de la línea marcada, vuelve a ella y rebobina 3 s antes de la marca anterior. |
| **Espacio** | Pausa/reanuda sin salir del modo. |
| **Esc** / Terminar | Sale del modo y pausa. Lo marcado se queda (autoguardado). |
| Fin de la letra | Al marcar la última línea, el modo sigue hasta que el usuario pulse Esc o termine la canción; mensaje "¡Todas las líneas tienen tiempo! Revisa con ▶ y ajusta lo que haga falta." |
| Líneas ya sincronizadas | Si la línea "Siguiente" ya tenía tiempo, se sobrescribe con la nueva marca (y queda registrado para Deshacer). |
| Durante el modo | La vista previa muestra la letra con resaltado en vivo; la lista resalta la "Siguiente" en `acento-texto`. Los paneles de estilo quedan inactivos. |

**Fin automático de una línea** (`fin_ms: null`; se calcula al dibujar con la función compartida `finEfectivo`, ADR 0005), en este orden: si la línea tiene palabras con tiempo → fin de la última palabra; si le sigue una pausa con tiempo → inicio de esa pausa; si le sigue una línea con inicio y el hueco es ≤ 8 s → inicio de la siguiente; si le sigue una pausa sin tiempo o el hueco es > 8 s → `inicio + min(hueco, máx(2 s, 0,4 s × nº de palabras))`; última línea (o sin siguiente sincronizada) → +5 s sin pasar del final de la canción. En el panel, el fin automático se muestra en `texto-2` con "(automático)"; un fin fijado (a mano o traído por la letra) se muestra en `texto-1` sin esa etiqueta y con el botón "Usar fin automático" para volver a `null`. Un fin fijado cumple `inicio < fin ≤ inicio de la siguiente`.

### Ajuste fino
| Acción | Ratón | Teclado (con la lista enfocada) |
|--------|-------|-------------------------------|
| Seleccionar línea | Clic | ↑ / ↓ |
| Inicio ±10 ms / ±100 ms | Botones del panel | Alt + ← / → (±10 ms) · Alt + Mayús + ← / → (±100 ms) |
| Fin ±10 ms / ±100 ms | Botones del panel | Ctrl/Cmd + Alt + ← / → · + Mayús para ±100 ms |
| Fijar inicio en la posición actual | — | **I** |
| Fijar fin en la posición actual | "Fijar fin aquí" | **O** |
| Escuchar desde la línea | "Escuchar desde esta línea" / doble clic | **L** |
| Borrar tiempos de la línea | Botón | Supr |
| Desplazamiento global ±100 ms | Botones | **[** / **]** |
| Deshacer / Rehacer | ⟲ ⟳ en la cabecera | Ctrl/Cmd + Z / Ctrl/Cmd + Mayús + Z |

- Un inicio no puede ser anterior al inicio de la línea previa ni posterior al de la siguiente: el ajuste se detiene en el límite y muestra un tooltip breve "No puede pasar a la línea anterior/siguiente".
- Tras cada ajuste fino, si la reproducción está en pausa, se reproduce automáticamente desde 1 s antes del nuevo inicio hasta 2 s después (escucha de comprobación). Se puede desactivar con la casilla "Escuchar al ajustar" (activada por defecto).
- El desplazamiento global se aplica a toda la letra (`letra.offset_ms`), se muestra con signo (+0,25 s = la letra aparece más tarde) y tiene "Restablecer".
- Deshacer cubre marcas, ajustes, desplazamiento y cambios de estilo de la sesión actual del editor (no persiste entre sesiones).

### Estilo
| Elemento | Comportamiento |
|----------|----------------|
| Sólido / Degradado | Control segmentado. Cambiar a degradado parte del color sólido actual + un segundo color derivado (el mismo con 30 % más de luminosidad); cambiar a sólido usa el primer color del degradado. |
| Ángulo | Campo numérico 0–359 ° + dial circular arrastrable; ←/→ ±15° con el dial enfocado. |
| Colores del degradado | 2 a 4 paradas distribuidas uniformemente (posiciones no editables en el MVP: 0, 1/3, 2/3, 1…). "+ Añadir color" (hasta 4) y ✕ (mínimo 2). |
| Selector de color | Componente del sistema visual: muestra + hex editable + selector nativo + 8 sugeridos. |
| Fuente | Selector con cada familia mostrada en su propia fuente con "¿Cantamos? Ñandú". Solo fuentes incluidas (respuesta a 0004). |
| Vista previa | Siempre muestra el estilo actual con los valores fijos de [sistema-visual §10](sistema-visual.md). En pausa muestra la línea seleccionada (o la primera) con la mitad resaltada, para juzgar ambos colores. Se actualiza en < 100 ms tras cada cambio. |
| Aviso de contraste | Reglas de [sistema-visual §9](sistema-visual.md). Se evalúa en cada cambio. Mensajes en la tabla de microcopy. Acciones rápidas: "Usar letra blanca" / "Usar letra negra" (la que dé más contraste con el fondo; la otra no se ofrece si no supera 3:1) y, para el resaltado, "Sugerir un color de resaltado" (elige entre los sugeridos el de mayor contraste con el fondo con ΔE ≥ 25 respecto a la letra). **No bloquea** ni impide marcar como lista. |
| Restablecer estilo predeterminado | Aplica `config.estilo_predeterminado` (deshacible). |
| Usar este estilo en canciones nuevas | Guarda el estilo actual como `estilo_predeterminado`. Toast "Las canciones nuevas usarán este estilo." |

### Guardado, borrador y lista
| Elemento | Comportamiento |
|----------|----------------|
| Indicador "guardado ✓" | Autoguardado con *debounce* de ~1 s (ADR 0006). Mientras hay cambios pendientes: "Guardando…"; si falla la escritura: "⚠ No se pudo guardar" (`error`) + reintento automático cada 5 s y toast con "Copiar detalles". |
| ‹ Biblioteca (= "Guardar borrador y salir") | No pide confirmación: todo está guardado. Si la canción es borrador, toast en la biblioteca: "Borrador guardado.". |
| **Marcar como lista** | Si se cumplen las condiciones (ambas pistas + todas las líneas con inicio, ADR 0006): estado → `lista`, navega a la Biblioteca con la tarjeta enfocada y toast "«{título}» está lista para cantar. [▶ Reproducir]". |
| Marcar como lista no disponible | `aria-disabled`; al pulsar o enfocar, popover "Para marcarla como lista falta:" con la lista de motivos y una acción por motivo: "• La separación de pistas (42 %, quedan unos 3 min)" / "• Separar las pistas → [Ir a Separación]" (si pendiente/error) / "• Sincronizar {n} líneas → [Ir a la primera]". |
| Canción ya Lista | El botón primario dice "Hecho" (vuelve a la biblioteca). El menú ⋯ de la cabecera ofrece "Volver a borrador" (diálogo de spec 02). Si una edición deja líneas sin inicio (p. ej. borrar tiempos), la canción **sigue Lista** pero queda **incompleta**: la insignia de la cabecera añade "· ⚠ Faltan {n} líneas" (`edi.lista.incompleta`), y al pulsar "Hecho" se muestra una sola vez el popover `edi.hecho.incompleta` con [Sincronizar ahora] (va a la primera línea sin inicio) y [Salir igualmente] (vuelve a la biblioteca, donde la tarjeta muestra el aviso de spec 02). |
| Probar a pantalla completa | Abre el reproductor (spec 07) desde la línea seleccionada − 3 s, con el estilo actual. Usa el instrumental si existe; si no, la mezcla original con la etiqueta "Vista previa con la canción original (la separación aún no ha terminado)". Esc vuelve al editor en la misma posición. |

### Atajos del editor (diálogo "Atajos de teclado", F1 o ?)
| Tecla | Acción |
|-------|--------|
| Espacio | Reproducir / pausa |
| Inicio | Ir al principio |
| S | Entrar en "Sincronizar al ritmo" |
| Intro | (En modo sincronizar) marcar inicio; mantener = marcar fin |
| Retroceso | (En modo sincronizar) deshacer última marca |
| Esc | Salir del modo sincronizar / cerrar diálogo / volver a la Biblioteca |
| ↑ / ↓ | Línea anterior / siguiente |
| Alt + ← / → | Inicio −/+ 10 ms (con Mayús: 100 ms) |
| Ctrl/Cmd + Alt + ← / → | Fin −/+ 10 ms (con Mayús: 100 ms) |
| I / O | Fijar inicio / fin en la posición actual |
| L | Escuchar desde la línea seleccionada |
| Supr | Borrar tiempos de la línea |
| [ / ] | Desplazamiento global −/+ 100 ms |
| 1 / 2 / 3 | Escuchar Original / Voz / Instrumental |
| Ctrl/Cmd + Z / + Mayús | Deshacer / Rehacer |
| F | Probar a pantalla completa |

## Estados
| Estado | Presentación |
|--------|--------------|
| Vacío (sin letra) | No se puede entrar (stepper no navegable). Si se llega por enlace: mensaje "Esta canción aún no tiene letra." + [Buscar la letra]. |
| Sin sincronizar (letra pegada) | Todas las filas `--:--.--`; banner `info` sobre la lista: "Empieza por sincronizar: pulsa ● Sincronizar al ritmo (o la tecla S) y marca cada línea al oírla." con foco en ese botón. |
| Ya sincronizada (LRCLIB) | Banner `info` la primera vez: "Esta letra ya viene sincronizada. Escúchala y, si va adelantada o atrasada, usa el desplazamiento de toda la letra." |
| Cargando audio | Transporte desactivado con "Cargando audio…" (< 1 s esperado; > 3 s → barra indeterminada). |
| Separación en curso | Stepper con %, "Voz"/"Instrumental" no disponibles, popover de "Marcar como lista" lo explica. Toast al terminar (spec 04). |
| Error de audio | Banner `error`: "No se puede reproducir el audio de esta canción." + [Ver en Biblioteca]. |
| Error de guardado | Indicador "⚠ No se pudo guardar" (ver arriba). |
| Borrador | Insignia "✎ Borrador" en la cabecera. |
| Lista | Insignia "✓ Lista" en la cabecera; primario "Hecho". |
| Lista incompleta | Insignia "✓ Lista · ⚠ Faltan {n} líneas" (la parte de aviso en `aviso`); "Hecho" muestra el popover `edi.hecho.incompleta`. |
| Salida de audio Bluetooth (ayuda) | Al salir del modo "Sincronizar al ritmo" por primera vez en la sesión, nota `info` discreta bajo el desplazamiento global: `edi.ayuda.bluetooth` (se cierra con ✕ y no vuelve a salir tras cerrarla; se guarda en la sesión). |
| Contraste bajo | Aviso en el panel Estilo + punto `aviso` sobre la pestaña "Estilo" para que se vea desde la pestaña Sincronía. |

## Microcopy
| Clave | Texto |
|-------|-------|
| `edi.lineas` | Líneas |
| `edi.contador` | {a}/{b} sincronizadas |
| `edi.pausa` | ♪ pausa |
| `edi.pausa.tiempo` | Esta pausa viene con tiempo en la letra importada. |
| `edi.palabras.tooltip` | Esta línea trae tiempos por palabra: se resaltará palabra a palabra. Si mueves la línea, sus palabras se mueven con ella. |
| `edi.velocidad.tooltip` | A menor velocidad, el tono también baja. Los tiempos que marques valen igual a cualquier velocidad. |
| `edi.ayuda.bluetooth` | ¿Usas auriculares o altavoces Bluetooth? Si toda la letra queda atrasada, usa el desplazamiento de toda la letra. |
| `edi.lista.incompleta` | Lista · ⚠ Faltan {n} líneas · (n = 1) Lista · ⚠ Falta 1 línea |
| `edi.hecho.incompleta` | Esta canción está lista, pero faltan {n} líneas por sincronizar. Al cantarla no aparecerán. — [Sincronizar ahora] [Salir igualmente] |
| `edi.fin.usarauto` | Usar fin automático |
| `edi.corregir` | Corregir la letra |
| `edi.escuchar` | Escuchar: Original · Voz · Instrumental |
| `edi.no.disponible.pista` | Disponible cuando termine la separación ({n} %) |
| `edi.velocidad` | Velocidad |
| `edi.boton.sync` | Sincronizar al ritmo |
| `edi.sync.titulo` | Sincronizando al ritmo |
| `edi.sync.ayuda` | Pulsa Intro cuando empiece cada línea. Mantenla pulsada mientras se canta si quieres marcar también el final. |
| `edi.sync.siguiente` | Siguiente: «{texto}» · línea {n} de {total} |
| `edi.sync.marcar` | Marcar |
| `edi.sync.deshacer` | Deshacer (Retroceso) |
| `edi.sync.terminar` | Terminar (Esc) |
| `edi.sync.fin` | ¡Todas las líneas tienen tiempo! Revisa con ▶ y ajusta lo que haga falta. |
| `edi.banner.sinsync` | Empieza por sincronizar: pulsa Sincronizar al ritmo (o la tecla S) y marca cada línea al oírla. |
| `edi.banner.yasync` | Esta letra ya viene sincronizada. Escúchala y, si va adelantada o atrasada, usa el desplazamiento de toda la letra. |
| `edi.linea.n` | Línea {n} de {total} |
| `edi.inicio` / `fin` | Inicio · Fin |
| `edi.fin.auto` | (automático) |
| `edi.boton.fijarfin` | Fijar fin aquí |
| `edi.boton.escucharlinea` | Escuchar desde esta línea |
| `edi.boton.borrartiempos` | Borrar tiempos de esta línea |
| `edi.limite` | No puede pasar a la línea anterior · No puede pasar a la línea siguiente |
| `edi.escuchar.ajustar` | Escuchar al ajustar |
| `edi.offset.titulo` | Desplazamiento de toda la letra |
| `edi.offset.ayuda` | Úsalo si toda la letra va adelantada o atrasada respecto a la música. |
| `edi.boton.restablecer` | Restablecer |
| `edi.estilo.fondo` | Fondo |
| `edi.estilo.tipo` | Sólido · Degradado |
| `edi.estilo.angulo` | Ángulo |
| `edi.estilo.colores` | Colores |
| `edi.estilo.anadircolor` | Añadir color |
| `edi.estilo.letra` | Letra |
| `edi.estilo.fuente` | Fuente |
| `edi.estilo.color` | Color de la letra |
| `edi.estilo.resaltado` | Color de lo ya cantado |
| `edi.estilo.sugeridos` | Sugeridos |
| `edi.estilo.muestra` | ¿Cantamos? Ñandú |
| `edi.contraste.ok` | Buen contraste |
| `edi.contraste.justo` | Legible en pantallas grandes; puede costar en proyectores o con mucha luz. |
| `edi.contraste.letra` | Difícil de leer: la letra y el fondo se parecen demasiado. |
| `edi.contraste.resaltado` | Difícil de leer: lo ya cantado se confunde con el fondo. |
| `edi.contraste.diferencia` | El resaltado apenas se distingue de la letra: no se notará qué parte ya se ha cantado. |
| `edi.contraste.blanca` / `negra` | Usar letra blanca · Usar letra negra |
| `edi.contraste.sugerir` | Sugerir un color de resaltado |
| `edi.estilo.reset` | Restablecer estilo predeterminado |
| `edi.estilo.predet` | Usar este estilo en canciones nuevas |
| `edi.estilo.predet.toast` | Las canciones nuevas usarán este estilo. |
| `edi.guardado` | guardado · Guardando… · No se pudo guardar |
| `edi.boton.lista` | Marcar como lista |
| `edi.boton.hecho` | Hecho |
| `edi.falta.titulo` | Para marcarla como lista falta: |
| `edi.falta.separando` | La separación de pistas ({n} %, quedan unos {m} min) |
| `edi.falta.separar` | Separar las pistas — [Ir a Separación] |
| `edi.falta.lineas` | Sincronizar {n} líneas — [Ir a la primera] |
| `edi.boton.probar` | Probar a pantalla completa |
| `edi.probar.original` | Vista previa con la canción original (la separación aún no ha terminado) |
| `edi.toast.borrador` | Borrador guardado. |
| `edi.error.audio` | No se puede reproducir el audio de esta canción. |
| `edi.sinletra` | Esta canción aún no tiene letra. — [Buscar la letra] |

## Criterios de aceptación
1. El editor muestra lista de líneas con su tiempo de inicio (o `--:--.--`), vista previa con el estilo actual, panel Sincronía/Estilo y transporte; en < 1280 px el panel derecho pasa a pestañas.
2. Espacio reproduce/pausa; la línea que suena se marca en la lista y la lista la sigue salvo desplazamiento manual en los últimos 5 s.
3. "Escuchar" permite Original, Voz e Instrumental; Voz e Instrumental no están disponibles hasta que termine la separación y su tooltip indica el porcentaje.
4. La velocidad 0,5×/0,75×/1× cambia la reproducción; los tiempos marcados se guardan en tiempo real de la canción (marcar a 0,5× produce los mismos ms que a 1× para el mismo punto del audio).
5. En "Sincronizar al ritmo", cada pulsación de Intro fija el `inicio_ms` de la línea "Siguiente" con un error del sistema ≤ 20 ms respecto al instante de la pulsación (usando la marca de tiempo del evento y compensando la latencia de salida), **con salida de audio por cable o por los altavoces del equipo**, a 0,5×, 0,75× y 1×; se verifica con un test automático (marcas de tiempo simuladas) y una prueba manual con una pista de clics. Las repeticiones automáticas del teclado se ignoran. Mantener ≥ 300 ms fija el `fin_ms` al soltar. Con Bluetooth no se exige precisión: el desfase se corrige con el desplazamiento global y se muestra `edi.ayuda.bluetooth`.
6. Retroceso deshace la última marca y rebobina 3 s antes de la marca anterior; Esc sale del modo conservando lo marcado.
7. Las pausas "♪ pausa" se muestran (con su tiempo en `texto-3` solo si lo traen), no se pueden seleccionar ni sincronizar, no cuentan para el total ni bloquean "Marcar como lista".
7b. El fin automático sigue la regla de `finEfectivo` y se distingue visualmente del fijado ("(automático)" en `texto-2`); "Usar fin automático" devuelve un fin fijado a automático.
7c. El control de velocidad tiene el tooltip `edi.velocidad.tooltip`; a 0,5× y 0,75× el tono baja (aceptado en el MVP).
7d. Mover el inicio de una línea con tiempos por palabra desplaza sus palabras lo mismo; borrar sus tiempos borra también los de sus palabras.
8. Los ajustes ±10/±100 ms de inicio y fin funcionan con botones y con los atajos indicados, respetan los límites entre líneas y, con "Escuchar al ajustar", reproducen el fragmento de comprobación.
9. El desplazamiento global se ajusta en pasos de 100 ms ([ / ]), se aplica a toda la letra en la vista previa al instante y se puede restablecer.
10. Ctrl/Cmd+Z y Ctrl/Cmd+Mayús+Z deshacen y rehacen marcas, ajustes, desplazamiento y cambios de estilo de la sesión.
11. El estilo permite: fondo sólido o degradado lineal (ángulo 0–359°, 2–4 colores), color de letra, color de resaltado y fuente de la lista incluida; cada cambio se ve en la vista previa en < 100 ms.
12. El aviso de contraste aplica las reglas de sistema-visual §9: con letra o resaltado < 3:1 frente al peor punto del fondo, o resaltado con ΔE < 25 respecto a la letra, se muestra el aviso correspondiente con sus acciones rápidas; con ≥ 4,5:1 se muestra "Buen contraste". El aviso nunca impide guardar ni marcar como lista.
13. Todo cambio se autoguarda en ≤ 2 s y el indicador pasa por "Guardando…" a "guardado"; salir con ‹ Biblioteca nunca pide confirmación ni pierde cambios.
14. "Marcar como lista" solo cambia el estado si existen ambas pistas y todas las líneas (no separadores) tienen inicio; si no, muestra el popover con cada motivo y su acción.
15. Al marcar como lista se vuelve a la Biblioteca con la tarjeta enfocada y el toast con "Reproducir".
15b. Si una canción Lista queda con líneas sin inicio, sigue Lista: la cabecera muestra `edi.lista.incompleta` y "Hecho" muestra `edi.hecho.incompleta` con sus dos acciones; el estado guardado no cambia.
16. "Probar a pantalla completa" (o F) abre el reproductor desde la línea seleccionada − 3 s con el estilo actual, usando el instrumental o, si no existe, la mezcla original con la etiqueta indicada; Esc vuelve al editor.
17. Todas las acciones del editor son accesibles con teclado; F1 o ? abre el diálogo de atajos.
18. "Usar este estilo en canciones nuevas" guarda el estilo en `config.estilo_predeterminado`; "Restablecer estilo predeterminado" lo aplica a la canción.

## Fuera del MVP — ampliación futura: sincronía por palabra
Decisión del usuario ([0002](../preguntas/0002-sincronia-por-palabra-en-mvp.md)): el MVP solo ofrece herramientas **por línea**; las palabras con tiempos que lleguen de LRCLIB o de un LRC mejorado se **muestran** (◆ en la fila, resaltado por palabra en la vista previa) y se **conservan**, pero no se editan. Esta sección **no se implementa en el MVP**; describe cómo ampliar el diseño en una versión posterior sin rehacer la vista:

1. **Segunda pasada opcional**: en la lista, cada línea sincronizada ofrece "Sincronizar palabras" (tecla **W**). Se entra en el modo "Sincronizar al ritmo" **acotado a esa línea**: suena desde 1 s antes de su inicio, a 0,75× por defecto, y cada **Intro** marca el inicio de la siguiente palabra (la primera palabra hereda el inicio de la línea; el fin de cada palabra = inicio de la siguiente; la última termina en el fin de la línea). Retroceso deshace, Esc sale.
2. **Modo de toda la canción por palabras** (opcional, avanzado): el mismo modo "Sincronizar al ritmo" con un conmutador "Por línea / Por palabra"; en "Por palabra" la "Siguiente" muestra la línea con la palabra siguiente subrayada.
3. **Ajuste fino**: en el panel Sincronía, bajo Inicio/Fin de la línea, una fila de "fichas" de palabras; seleccionar una ficha permite ±10/±100 ms con los mismos atajos (Tab/Mayús+Tab cambia de ficha).
4. **Línea de tiempo**: al seleccionar una línea con palabras, la barra del transporte hace *zoom* a esa línea y muestra cada palabra como segmento arrastrable.
5. **Borrar**: "Borrar tiempos de palabras" vuelve la línea al barrido progresivo.
6. **Criterio de "Lista"**: no cambia (basta el inicio de cada línea); las palabras son una mejora opcional.
7. Riesgo de UX a validar: sincronizar por palabra multiplica el esfuerzo (una pulsación por palabra, varias pasadas); por eso se ofrece siempre **después** de la sincronía por línea y nunca como requisito.
