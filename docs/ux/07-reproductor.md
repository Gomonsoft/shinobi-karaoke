# 07 — Reproductor a pantalla completa

- Paso del pipeline: 6 (Reproductor)
- ADRs: [0005](../adr/0005-letras-y-formato-de-sincronia.md), [0006](../adr/0006-persistencia-y-modelo-de-datos.md)
- Restricciones: [arquitectura.md §7 y "Restricciones e implicaciones para UX" §2, §5](../arquitectura.md)
- Valores fijos de render: [sistema-visual.md §10](sistema-visual.md)
- Preguntas: [0005](../preguntas/0005-viabilidad-detalles-ux-fase-0.md) §6, §8, §11, §12 y [0006](../preguntas/0006-ajustes-specs-ux-tras-0005.md) §4 (respondidas)

## Objetivo
Cantar: instrumental + letra sincronizada con el estilo de la canción, **a pantalla completa, sin distracciones y legible a varios metros** (salón, televisor, proyector). Empieza al instante y se sale con una tecla.

Usuario/tarea principal: "Ponme esta canción para cantarla ya".

## Wireframes

**Reproduciendo, controles ocultos** (estado normal)
```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│                      (fondo: sólido o degradado del estilo)              │
│                                                                          │
│                 ███████████████░░░░░░░░░░░░░░░                           │
│                 Is this the real life? Is this just                      │ ← línea actual (45 % alto)
│                                                                          │    barrido en color de resaltado
│                     Caught in a landslide                                │ ← siguiente (70 %)
│                                                                          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Controles visibles** (al mover el ratón o pulsar una tecla que no sea atajo)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ [✕ Salir]                                    Bohemian Rhapsody · Queen   │ ← franja superior, degradado negro 60 %→0
│                                                                          │
│                    (letra igual que arriba)                              │
│                                                                          │
│ 01:12 ━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 05:55   │
│ [⏮]  [ ❚❚ ]  [↺5]  [5↻]                              [🔊 ━━━━●━]  [⛶]     │ ← franja inferior, degradado negro 0→70 %
└──────────────────────────────────────────────────────────────────────────┘
```

**Inicio**: pantalla de título (título + artista) hasta 4 s antes de la primera línea, con indicador de entrada `●●●` (sistema-visual §10).

**Final**
```
│                         Bohemian Rhapsody                                │
│                              Queen                                       │
│                                                                          │
│              [ ↻ Otra vez ]   [ ✕ Volver a la biblioteca ] (foco)          │
│                Se cerrará en 10 s…                                       │
```
Al terminar el audio: pantalla final; a los 10 s sin interacción vuelve sola a la vista de origen.

**Lista incompleta** (canción Lista con líneas sin inicio, spec 02): el reproductor **omite** esas líneas (no puede situarlas en el tiempo) y avisa solo donde no estorba al cantar:
```
│                         Bohemian Rhapsody                                │
│                              Queen                                       │
│                                                                          │
│            ┌────────────────────────────────────────────────┐            │
│            │ ⚠ Faltan 3 líneas por sincronizar: no se verán. │            │  ← píldora, solo en la pantalla de título
│            └────────────────────────────────────────────────┘            │
│                               ●●●                                        │
```
- Píldora `rep.incompleta` bajo título/artista en la **pantalla de título** (fondo `rgba(0,0,0,0.6)`, texto `#FFFFFF` `t-cuerpo`, icono ⚠ en `aviso`, radio completo): contraste garantizado sobre cualquier fondo de estilo. Desaparece con la pantalla de título.
- Se repite en la franja superior, junto a título · artista, mientras los controles están visibles (incluida la pausa), en `t-pequeno`.
- Durante el canto **no hay aviso**: el hueco de una línea omitida se comporta como cualquier hueco entre líneas (la línea anterior usa su fin efectivo y, si el hueco es ≥ 4 s, aparece `●●●` antes de la siguiente).
- Lectores de pantalla: se anuncia una vez al empezar.
- Desde la vista previa del editor no se muestra (el editor ya lo indica).

## Componentes e interacciones
| Elemento | Comportamiento |
|----------|----------------|
| Entrada | Desde la biblioteca: la ventana pasa a pantalla completa y el audio arranca de inmediato (decodificación < 1 s; mientras, fondo del estilo + título). Desde el editor: empieza en la posición indicada por la spec 06. |
| Audio | Solo **instrumental** (con `ganancia_db`), salvo vista previa desde el editor sin pistas: suena la mezcla de la canción (`fuente/mezcla.flac`, la copia que guarda la app de la canción original) con la etiqueta discreta arriba a la izquierda, siempre visible. |
| Letra | Línea actual + siguiente, centradas, tamaño y posición fijos (sistema-visual §10). Resaltado por palabra si hay tiempos de palabra; si no, barrido progresivo hasta el fin efectivo (`finEfectivo`, ADR 0005). Las pausas (♪) no se dibujan. Huecos ≥ 4 s: la línea anterior se desvanece al terminar, y aparece el indicador `●●●` antes de la siguiente. Las líneas sin inicio se omiten (lista incompleta). |
| Ocultar controles | Se ocultan a los 3 s sin movimiento del ratón ni teclas (y el cursor también). En pausa permanecen visibles. |
| Barra de tiempo | Clic/arrastre para buscar. |
| ⏮ | Volver al principio (con pantalla de título). |
| ❚❚ / ▶ | Pausa/reanuda. En pausa, letra estática y overlay "❚❚ En pausa" pequeño en la franja inferior. |
| ↺5 / 5↻ | −5 s / +5 s. |
| Volumen | Deslizador + silenciar. Persistente entre canciones y sesiones (`config.reproductor.volumen` y `silenciado`); se aplica después de la igualación `ganancia_db`. |
| ⛶ | Alterna pantalla completa / ventana (por si se usa en una ventana en otra pantalla). |
| ✕ Salir | Sale del reproductor (pantalla completa off) y vuelve a la vista de origen (Biblioteca o Editor). |
| Controles | Botones icono 44 px, iconos 28 px, color `#FFFFFF` sobre franjas oscuras (contraste ≥ 4,5:1 independiente del fondo del estilo gracias al degradado negro). Tooltips con nombre + atajo. |

### Atajos de teclado
| Tecla | Acción |
|-------|--------|
| Espacio / K | Reproducir / pausa |
| ← / → | −5 s / +5 s |
| J / L | −10 s / +10 s |
| ↑ / ↓ | Volumen +/− 10 % |
| M | Silenciar |
| Inicio / 0 | Volver al principio |
| F | Pantalla completa / ventana |
| Esc | Salir del reproductor (si está en pantalla completa, sale directamente; no hace falta pulsar dos veces) |
| , / . | (Solo vista previa desde el editor) desplazamiento global −/+ 100 ms, con aviso "Desplazamiento: +0,1 s" 1 s — útil para afinar mientras se prueba; se guarda en la canción |
| F1 / ? | Atajos de teclado (pausa la reproducción) |
Cualquier atajo muestra brevemente un indicador central (p. ej. "❚❚", "−5 s", "Volumen 60 %") de 600 ms, sin mostrar las franjas completas.

### Legibilidad a distancia
- Tamaño de línea actual ≈ 7,5 % del alto de pantalla (≈ 81 px en 1080p). Regla orientativa: texto con altura de mayúscula ≥ 1/150 de la distancia de lectura es legible; en un televisor de 55" (68 cm de alto) la mayúscula mide ≈ 3,6 cm → legible hasta ~5 m.
- Máximo 2 líneas visibles (actual + siguiente) para que el ojo no busque.
- Sin elementos de interfaz encima de la letra mientras se canta; la zona central (25 %–75 % del alto) queda siempre libre de controles.
- Sombra fija para separar la letra de degradados; contraste revisado en el editor (spec 06).
- La letra no se mueve durante el barrido (sin animaciones de escala ni rebote).

## Estados
| Estado | Presentación |
|--------|--------------|
| Vacío | No aplica: solo se abre con canciones listas (o vista previa del editor). |
| Cargando | Fondo del estilo + título/artista; si tarda > 1 s, spinner discreto bajo el título "Cargando…". |
| Reproduciendo | Wireframe principal. |
| En pausa | Controles visibles, indicador "En pausa". |
| Final | Pantalla final con cuenta atrás de 10 s. |
| Error (no se puede cargar el instrumental, p. ej. pistas borradas) | Pantalla con fondo `fondo-0`: "**No se puede reproducir esta canción.** Faltan sus pistas de audio. Puedes volver a separarla desde la biblioteca." [Volver a la biblioteca] (foco). La canción aparece "Dañada" en la biblioteca. |
| Fuente no disponible | No aplica en el MVP (solo fuentes incluidas). Por robustez: si la familia no carga, se usa Atkinson Hyperlegible Next sin aviso en el reproductor. |
| Pérdida de foco / ventana minimizada | La reproducción continúa (es audio); al volver, la letra está en su sitio. |

## Microcopy
| Clave | Texto |
|-------|-------|
| `rep.salir` | Salir |
| `rep.pausa` | En pausa |
| `rep.cargando` | Cargando… |
| `rep.otravez` | Otra vez |
| `rep.volver` | Volver a la biblioteca · Volver al editor |
| `rep.cierre` | Se cerrará en {n} s… |
| `rep.original` | Vista previa con la canción original |
| `rep.incompleta` | ⚠ Faltan {n} líneas por sincronizar: no se verán. · (n = 1) ⚠ Falta 1 línea por sincronizar: no se verá. |
| `rep.offset` | Desplazamiento: {+/-n} s |
| `rep.volumen` | Volumen {n} % · Silenciado |
| `rep.error` | **No se puede reproducir esta canción.** Faltan sus pistas de audio. Puedes volver a separarla desde la biblioteca. |
| `rep.tooltip.*` | Reproducir (Espacio) · Pausa (Espacio) · Retroceder 5 s (←) · Avanzar 5 s (→) · Volumen (↑ ↓) · Silenciar (M) · Pantalla completa (F) · Salir (Esc) |

## Criterios de aceptación
1. Desde la biblioteca, un clic en Reproducir pone la ventana en pantalla completa y el instrumental empieza a sonar en < 1 s, con la pantalla de título hasta 4 s antes de la primera línea.
2. Se muestran solo la línea actual y la siguiente con los tamaños, posición y sombra de sistema-visual §10, y la fuente y colores del estilo de la canción.
3. La línea actual se resalta por palabra si tiene tiempos de palabra y, si no, con barrido progresivo lineal entre su inicio y fin; el desfase visual respecto al audio es ≤ 50 ms (con `outputLatency` y `offset_ms` aplicados).
4. Antes de una línea precedida por una pausa ≥ 4 s se muestra el indicador `●●●` que se apaga uno por segundo.
5. Los controles y el cursor se ocultan a los 3 s sin actividad (no en pausa) y reaparecen al mover el ratón; nunca ocupan la franja central 25 %–75 % del alto.
6. Todos los atajos de la tabla funcionan y muestran el indicador central de 600 ms.
7. Esc sale del reproductor con una sola pulsación y devuelve a la vista de origen; desde el editor, a la misma posición.
8. Al terminar la canción se muestra la pantalla final, y sin interacción vuelve sola a la vista de origen a los 10 s.
9. El volumen se iguala entre canciones (`ganancia_db`) y el nivel elegido por el usuario persiste entre reproducciones.
10. Si faltan las pistas, se muestra el error con "Volver a la biblioteca" y la canción queda marcada como Dañada.
11. En la vista previa desde el editor sin instrumental, suena la mezcla original y la etiqueta "Vista previa con la canción original" está visible todo el tiempo.
12. Los controles tienen contraste ≥ 4,5:1 sobre sus franjas con cualquier estilo de fondo, y foco visible con el anillo doble del sistema visual.
13. En una canción Lista incompleta, el reproductor funciona con normalidad, omite las líneas sin inicio, muestra `rep.incompleta` en la pantalla de título (y en la franja superior con controles visibles), lo anuncia una vez a lectores de pantalla y no muestra ningún aviso sobre la zona de la letra mientras se canta.
