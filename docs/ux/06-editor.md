# 06 — Editor (sincronía + estilo + vista previa)

- Paso del pipeline: 4 (Editor) y 5 (Guardado: borrador / lista)
- ADRs: [0005](../adr/0005-letras-y-formato-de-sincronia.md) (formato, `finEfectivo`, toque al ritmo), [0006](../adr/0006-persistencia-y-modelo-de-datos.md) (`cancion.json`, estados, invariantes de la letra, `moverInicioLinea` / `borrarTiemposLinea`, formato del estilo), [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md) (motor de audio, reloj, `marcarInicioLinea`, API de guardado)
- Restricciones: [arquitectura.md §7 y "Restricciones e implicaciones para UX" §5–§6](../arquitectura.md)
- Sistema visual: [sistema-visual.md §6–§10](sistema-visual.md) (componentes, foco, estilo predeterminado, reglas de contraste, valores fijos de render)
- Preguntas: [0002](../preguntas/0002-sincronia-por-palabra-en-mvp.md) (usuario: **sincronía solo por línea** en el MVP), [0004](../preguntas/0004-fuentes-tipograficas-incluidas-y-del-sistema.md) (solo fuentes incluidas), [0005](../preguntas/0005-viabilidad-detalles-ux-fase-0.md) y [0006](../preguntas/0006-ajustes-specs-ux-tras-0005.md) (pausas, fin automático, precisión del toque, lista incompleta), [0024](../preguntas/0024-stepper-letra-actual-y-volver-a-letra-desde-el-editor.md) (stepper y volver a Letra), [0025](../preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) (detalles técnicos de la Fase 5; respondida: pantalla completa en la Fase 6, desplazamiento ±30 s, el tono baja con la velocidad, un solo volumen, API de guardado), [0026](../preguntas/0026-textos-pendientes-del-editor-fase-5.md) (letra recargada y regla de "color más claro"; respondida)
- Revisión: 2026-11-05, puesta al día para la Fase 5; 2026-11-06, "Probar a pantalla completa" para la Fase 6 (ver "Cambios de esta revisión" al final); 2026-11-08, layout adaptable y paneles de la [subfase 2.1 de 0.2.0](#subfase-21--layout-adaptable-y-paneles); 2026-11-09, temas en el panel Estilo de la [fase 3 de 0.2.0](#fase-3-de-020--temas-y-biblioteca).

## Objetivo
Dejar la letra **a tiempo** con la música y darle un **estilo** propio con las opciones mínimas del MVP (fondo, color de letra, color de lo ya cantado, fuente), viendo el resultado en todo momento, y marcar la canción como **lista**.

Usuario/tarea principal: "Sincronizar la letra en una pasada, retocar lo que quede mal, ponerla bonita y legible, y dejarla lista para cantar".

Qué **no** hace el editor (MVP): no edita el texto de la letra (eso es la vista Letra, spec 05), no sincroniza palabra a palabra ([0002](../preguntas/0002-sincronia-por-palabra-en-mvp.md)), no cambia tamaño, posición, sombra ni contorno de la letra (valores fijos de [sistema-visual §10](sistema-visual.md)), no arrastra tiempos sobre la línea de tiempo.

## Datos que usa (resumen para implementar)
- Todo vive en `cancion.json` (ADR 0006): `letra.lineas[]` (elementos `tipo: "linea"` o `"pausa"`, `inicio_ms`, `fin_ms`, `palabras`), `letra.offset_ms`, `estilo`, `estado`, `pasos`. No existe `letra.json`.
- **Tiempo mostrado** = `inicio_ms + offset_ms` (mínimo 0): la lista, el panel y la vista previa enseñan *cuándo suena* cada línea con el desplazamiento aplicado. Al marcar o fijar un tiempo en la posición `t` del audio se guarda `t − offset_ms` (mínimo 0). Así "lo que ves es lo que oyes" con cualquier desplazamiento.
- Fin de cada línea: `finEfectivo` (ADR 0005). `fin_ms: null` = **automático**; número = **fijado**.
- Mover un inicio usa siempre `moverInicioLinea` (sus palabras se mueven con ella; las que no caben se descartan; los fines fijados que dejan de ser válidos pasan a automáticos). Borrar tiempos usa `borrarTiemposLinea` (borra también las palabras).
- Límites de un inicio: **estrictamente** posterior al del elemento anterior con tiempo y anterior al del siguiente con tiempo, **contando las pausas con tiempo** (invariantes de ADR 0006). Las líneas sin tiempo intermedias no limitan.

## Wireframes

> Desde la subfase 2.1 de 0.2.0, la distribución, los anchos de columna y el comportamiento en ventanas pequeñas de A y B los define [Subfase 2.1 · Layout adaptable y paneles](#subfase-21--layout-adaptable-y-paneles). A y B se conservan como referencia del contenido de cada zona; B solo se usa por debajo del mínimo de diseño.

### A — Editor (≥ 1280 px)
```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ‹ Biblioteca │ «Bohemian Rhapsody» · Queen   [✎ Borrador] ✓ Guardado  [⟲][⟳][⋯] │
│   (1)✓ Fuente ── (2)⟳ Separación 42 % ── (3)✓ Letra ── (4)● Editor              │
│                                                          ▔▔▔▔▔▔ (paso actual)   │
├───────────────────────────┬────────────────────────────────┬───────────────────┤
│ LÍNEAS   48/52 sincronizadas│   VISTA PREVIA (16:9)          │[Sincronía][Estilo•]│
│ ┌───────────────────────┐ │ ┌────────────────────────────┐ │                   │
│ │ 00:00.50 Is this the  │ │ │                            │ │ (panel derecho,   │
│ │          real life? ◆ │ │ │   Is this the real life?   │ │  ver C y D)       │
│ │▶00:04.20 Is this just │ │ │   ▔▔▔▔▔▔▔▔▔▔ (barrido)     │ │                   │
│ │          fantasy?     │ │ │                            │ │                   │
│ │ ♪ pausa               │ │ │   Is this just fantasy?    │ │                   │
│ │ --:--.-- Caught in a ⓘ│ │ │                            │ │                   │
│ │          landslide    │ │ └────────────────────────────┘ │                   │
│ │ …                     │ │ [⛶ Probar a pantalla completa] │                   │
│ └───────────────────────┘ │                                │                   │
│ Corregir la letra         │                                │                   │
├───────────────────────────┴────────────────────────────────┴───────────────────┤
│ [⏮][ ▶ ] 01:12.4 / 05:55  ━━━━━━━●━━┃━━━┃━━━━━┃━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│ Escuchar: [Original][Voz][Instrumental]   Velocidad: [0,5×][0,75×][1×]  🔊━━━   │
│ [ ◉ Sincronizar al ritmo (S) ]                         [ Marcar como lista ]    │
└────────────────────────────────────────────────────────────────────────────────┘
```
- Columnas: Líneas 320 px · Vista previa flexible · Panel derecho 320 px. El transporte es una franja fija al pie (`fondo-1`, borde superior `borde`).
- Ticks ┃ finos en la barra de tiempo (1 px, `texto-3`) en el tiempo mostrado de cada línea con inicio: dejan ver huecos y zonas sin sincronizar.
- ● en la pestaña "Estilo•" = punto `aviso` cuando hay un aviso de contraste (visible desde la pestaña Sincronía).
- `ⓘ` en la fila = icono "falta" (`circle-dashed` 16 px, `texto-3`) de una línea sin inicio; ◆ = línea con tiempos por palabra.

### B — Editor (< 1280 px, mínimo 1024 × 640)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ (cabecera igual que en A)                                                │
├───────────────────────────────────┬──────────────────────────────────────┤
│ [Sincronía] [Estilo•]             │   VISTA PREVIA (16:9)                │
│ LÍNEAS     48/52 sincronizadas    │ ┌──────────────────────────────────┐ │
│ ┌───────────────────────────────┐ │ │                                  │ │
│ │ (lista, ocupa el alto libre)  │ │ │                                  │ │
│ └───────────────────────────────┘ │ └──────────────────────────────────┘ │
│ Corregir la letra                 │ [⛶ Probar a pantalla completa]       │
│ ───────────────────────────────── │                                      │
│ (detalle de la línea seleccionada │                                      │
│  y desplazamiento global, C)      │                                      │
├───────────────────────────────────┴──────────────────────────────────────┤
│ (transporte igual que en A, en dos filas)                                │
└──────────────────────────────────────────────────────────────────────────┘
```
- Una sola columna izquierda de 360 px con pestañas **Sincronía / Estilo**. En "Sincronía": la lista arriba (alto flexible, mínimo 5 filas) y debajo el detalle de C (sin el título "Línea n de total" repetido). En "Estilo": el panel D completo con desplazamiento vertical.
- En modo "Sincronizar al ritmo" la pestaña Estilo no se puede abrir (ver E).

### C — Panel "Sincronía" (línea seleccionada)
```
│ Línea 2 de 52                                   │
│ «Is this just fantasy?»                ◆ por palabra │
│ Inicio [ 00:04.20 ] [−0,1][−0,01][+0,01][+0,1]  │
│        [Fijar inicio aquí (I)]                   │
│ Fin    [ 00:07.85 ] (automático)                 │
│        [−0,1][−0,01][+0,01][+0,1]                │
│        [Fijar fin aquí (O)]  (fijado: [Usar fin automático]) │
│ [▶ Escuchar desde esta línea (L)]                │
│ [Borrar tiempos de esta línea (Supr)]            │
│ ☑ Escuchar al ajustar                            │
│ ───────────────────────────────────────          │
│ Desplazamiento de toda la letra                  │
│ [−0,1 s] [ +0,00 s ] [+0,1 s]  [Restablecer]     │
│ Úsalo si toda la letra va adelantada o atrasada  │
│ respecto a la música. (+ = la letra sale más tarde) │
│ (ⓘ nota Bluetooth, cerrable, ver Estados)        │
```
Línea sin inicio: Inicio `[ --:--.-- ]`, botones ± inactivos, "Fijar inicio aquí (I)" activo; la sección Fin queda inactiva con la ayuda `edi.fin.sininicio`. Sin línea seleccionada (no ocurre al entrar; ver "Foco inicial"): texto `edi.sinseleccion`.

### D — Panel "Estilo"
> Desde la fase 3 de 0.2.0, el panel empieza por la sección «Tema» y los dos botones finales de este wireframe se retiran. Ver [Fase 3 · Temas y biblioteca](#fase-3-de-020--temas-y-biblioteca).

```
│ Fondo                                          │
│ [ Sólido | Degradado ]                         │
│ (Degradado) Ángulo [135] ° ◐ (dial)            │
│ Colores  [■ #1B1033] [■ #5A1E6E] [✕]           │
│          [+ Añadir color]          (2 a 4)     │
│ Sugeridos ■■■■■■■■                             │
│ (Sólido) Color [■ #1B1033]  Sugeridos ■■■■■■■■ │
│ ─────────────────────────────────────          │
│ Letra                                          │
│ Fuente  [ Atkinson Hyperlegible Next      ▾ ]  │
│         (cada opción: «¿Cantamos? Ñandú» en su fuente) │
│ Color de la letra        [■ #FFFFFF]           │
│ Color de lo ya cantado   [■ #FFD400]           │
│ Sugeridos ■■■■■■■■ (bajo cada selector)        │
│ ─────────────────────────────────────          │
│ ✓ Buen contraste                               │
│ (o ⚠ Difícil de leer: la letra y el fondo se   │
│  parecen demasiado. [Usar letra blanca])       │
│ ─────────────────────────────────────          │
│ [Restablecer estilo predeterminado]            │
│ [Usar este estilo en canciones nuevas]         │
```

### E — Banner del modo "Sincronizar al ritmo"
Sustituye a la tercera fila del transporte mientras dura el modo:
```
┌ ◉ Sincronizando al ritmo ───────────────────────────────────────────────┐
│ Pulsa Intro cuando empiece cada línea. Mantenla pulsada mientras se     │
│ canta si quieres marcar también el final.                               │
│ Siguiente: «Caught in a landslide» · línea 3 de 52                      │
│ [ MARCAR (Intro) ]  [↶ Deshacer (Retroceso)] [❚❚ Pausa (Espacio)] [Terminar (Esc)] │
└──────────────────────────────────────────────────────────────────────────┘
```
Antes de empezar a sonar, la vista previa muestra la cuenta atrás "3 · 2 · 1" (números `t-display` × 2 en `letra.color` sobre el fondo del estilo, con la sombra de §10).

## Componentes e interacciones

### Entrada y foco inicial
| Caso | Comportamiento |
|------|----------------|
| Se llega desde | "Ir al editor" (Letra), stepper, "Continuar" (borrador con letra), "Editar" del menú ⋯ (Lista), toast "Abrir editor" (spec 04). |
| Requisitos | Fuente completada (existe `fuente/mezcla.flac`) y ≥ 1 línea. Si no, el paso no es navegable (motivos `paso.motivo.*`, spec 00 §2). Si aun así se llega (estado cambiado entre medias): sin letra → `edi.sinletra` con [Buscar la letra] (abre Letra); sin audio → estado "Error de audio". |
| Línea seleccionada al entrar | La primera línea sin inicio; si todas tienen, la primera línea. La lista se desplaza hasta ella. |
| Foco inicial | Sin ninguna línea sincronizada: el botón "Sincronizar al ritmo" (con el banner `edi.banner.sinsync`). Con alguna: la lista de líneas (en la seleccionada). |
| Posición del audio | 0, en pausa. La pista de escucha por defecto: **Voz** si existe, si no **Original**. |

### Cabecera
| Elemento | Comportamiento |
|----------|----------------|
| ‹ Biblioteca | Vuelve a la Biblioteca tras vaciar el guardado pendiente (§"Guardado"). Nunca pide confirmación salvo si el último guardado ha fallado. |
| Título · artista | Como en el resto del espacio de canción. |
| Insignia de estado | "✎ Borrador" (`aviso`) · "✓ Lista" (`exito`) · "✓ Lista · ⚠ Faltan {n} líneas" (`edi.lista.incompleta`; la parte de aviso en `aviso`). Se actualiza en vivo. |
| Indicador de guardado | Separado de la insignia, `role="status"`: "✓ Guardado" (`texto-2`) · "Guardando…" (`texto-2`, spinner 14 px) · "⚠ No se pudo guardar" (`error`). |
| ⟲ ⟳ | Botones icono Deshacer / Rehacer, con tooltip con atajo (`edi.deshacer` / `edi.rehacer`). `disabled` si la pila está vacía. |
| ⋯ | Menú: "Atajos de teclado (F1)" siempre; "Volver a borrador…" solo si es Lista (diálogo `bib.dialogo.borrador` de spec 02; al confirmar se queda en el editor, la insignia pasa a Borrador y el primario a "Marcar como lista"). |
| Stepper | El de spec 00 §2: Editor ● (o ✓ si la canción es Lista), Letra ✓ navegable; Separación con su estado en vivo. Ir a otro paso vacía antes el guardado pendiente. |

### Lista de líneas
| Elemento | Comportamiento |
|----------|----------------|
| Fila de línea | Tiempo mostrado (`mm:ss.cc`, `t-tiempo` tabular) + texto (`t-cuerpo`, hasta 2 renglones, luego "…" con el texto completo en `title`). Sin inicio: `--:--.--` en `texto-3` + icono "falta". Fila **actual** (la que suena): marcador ▶ y fondo `fondo-2`. Fila **seleccionada**: borde izquierdo 3 px `acento-texto` + fondo `fondo-2`. Con tiempos por palabra: ◆ 14 px `texto-2` al final, tooltip `edi.palabras.tooltip`. Con fin fijado: nada en la fila (se ve en el panel). |
| Fila "♪ pausa" | Elemento `tipo: "pausa"` (ya normalizado: nunca dos seguidas ni al principio/final). En `texto-3`, sin tiempo; si trae tiempo (LRC), se muestra en `texto-3`, solo lectura, con tooltip `edi.pausa.tiempo`. No se selecciona, no se sincroniza desde el editor, no cuenta en el contador ni bloquea "Marcar como lista"; ↑/↓ la saltan. |
| Contador | `edi.contador` "{a}/{b} sincronizadas" (solo líneas, nunca pausas); con todas: "{b}/{b} sincronizadas ✓" en `exito`. Es un botón si falta alguna: clic → selecciona la primera sin inicio y la desplaza a la vista. |
| Clic en fila | Selecciona la línea (panel C con sus datos). **Doble clic** = escuchar desde 2 s antes de su tiempo mostrado. |
| Seguimiento | Durante la reproducción, la lista se desplaza para mantener visible la línea actual, salvo si el usuario ha desplazado la lista a mano en los últimos 5 s. La selección **no** sigue a la reproducción (solo el marcador ▶), salvo en el modo de E. |
| Pie: "Corregir la letra" | Enlace (`acento-texto`) que abre la vista Letra en C (spec 05) tras vaciar el guardado. Al volver, las líneas no modificadas conservan tiempos y palabras (diff de spec 05). |
| Rendimiento | La lista admite hasta 5000 elementos (límite de la letra) con desplazamiento fluido (virtualizada si hace falta). |

### Transporte y audio
| Elemento | Comportamiento |
|----------|----------------|
| ▶ / ❚❚ | Reproduce / pausa. **Espacio**. |
| ⏮ | Ir al principio. **Inicio**. |
| Tiempo | "01:12.4 / 05:55" (posición con décimas / duración), tabular. |
| Barra de tiempo | Clic o arrastre para buscar. Con el foco en ella: ←/→ ±5 s. `role="slider"` con `aria-valuetext` "1 minuto 12 segundos de 5 minutos 55". |
| Escuchar: Original / Voz / Instrumental | Control segmentado. "Original" = `fuente/mezcla.flac` (siempre disponible). "Voz"/"Instrumental" solo con la separación completada; si no, opción no disponible con tooltip: en curso `edi.no.disponible.pista` ("Disponible cuando termine la separación ({n} %)"), en cola `edi.no.disponible.cola`, pendiente/error/interrumpida `edi.no.disponible.separar`. Cambiar de pista **mantiene la posición** y el estado de reproducción; si la pista aún se está cargando, su opción muestra un spinner y sigue sonando la anterior hasta que esté lista. Si la separación termina mientras se está en el editor, las opciones se activan en vivo (sin cambiar lo que suena) y sale el toast de spec 04. La elección dura lo que la visita (no se guarda). |
| Velocidad 0,5× / 0,75× / 1× | Control segmentado, por defecto 1×. Afecta a la reproducción y al modo de E; los tiempos se guardan siempre en tiempo real de la canción. Por debajo de 1× el tono también baja (no se conserva el tono en el MVP; [0025](../preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) §5); el tooltip `edi.velocidad.tooltip` lo avisa. Dura lo que la visita. |
| Volumen | Deslizador + botón silenciar; ↑/↓ ±5 % con el foco en él. Es **el único volumen de la app** (`config.reproductor.volumen` / `silenciado`, el mismo que el reproductor; [0025](../preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) §8): el editor parte de él y lo guarda (como mucho una escritura cada 500 ms mientras se arrastra). |

### Modo "Sincronizar al ritmo" (toque por línea)
Estado especial del editor para marcar los inicios en una pasada (wireframe E).

| Acción | Comportamiento |
|--------|----------------|
| Entrar | Botón "Sincronizar al ritmo" o **S**. "Siguiente" = la línea seleccionada (o la primera sin inicio). Cuenta atrás visual "3 · 2 · 1" (3 s, en silencio; Esc la cancela) y después suena desde `máx(0, tiempo mostrado del elemento anterior con tiempo − 2 s)`, o desde 0 si no lo hay. Anuncio a lectores de pantalla: `edi.sync.titulo` + `edi.sync.siguiente`. |
| **Intro** (pulsar) | Marca el inicio de "Siguiente" en el instante de la pulsación (marca de tiempo del evento, compensando la latencia de salida; ADR 0005) y "Siguiente" avanza a la próxima línea (saltando pausas). Botón grande "MARCAR" equivalente para ratón (marca en el `pointerdown`). Repeticiones automáticas del teclado: ignoradas. |
| Reglas de una marca en `t` | 1) Si `t` ≤ tiempo del elemento anterior con tiempo (se pulsó antes de que empiece la línea previa): **no se marca**, la línea sigue como "Siguiente" y se muestra 2 s en el banner `edi.sync.pronto`. 2) Los elementos **posteriores** a "Siguiente" cuyo tiempo sea ≤ `t` pierden su tiempo (líneas: `borrarTiemposLinea`, también sus palabras; pausas: su inicio pasa a vacío): la pasada manda y esas líneas se volverán a marcar al llegar a ellas. 3) Se aplica la marca con la regla de `moverInicioLinea` (palabras que se mueven o se descartan; fines fijados que pasan a automáticos). 4) Cada marca, con todo lo anterior, es **un** paso de deshacer. Detalle técnico: función pura `marcarInicioLinea` ([0025](../preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) §2, ADR 0010); una pausa que pierde su tiempo pierde inicio y fin. |
| Línea ya sincronizada | Se sobrescribe con la nueva marca (regla anterior). |
| **Intro** (mantener ≥ 300 ms) | Al soltar, fija el fin de la línea marcada en ese instante, limitado al tiempo del siguiente elemento con tiempo. Si se suelta antes de 300 ms, el fin queda **automático**. |
| **Retroceso** / "Deshacer" | Deshace la última marca de esta pasada (y lo que borró la regla 2): "Siguiente" vuelve a esa línea y la reproducción salta a 3 s antes del instante de la marca deshecha (mínimo 0) y sigue sonando. Sin marcas en la pasada: el botón está `disabled` y la tecla no hace nada. |
| **Espacio** | Pausa / reanuda sin salir del modo. |
| Clic en una fila | Esa línea pasa a ser "Siguiente" y la reproducción salta como al entrar (sin cuenta atrás). |
| Barra de tiempo, 1/2/3, velocidad, volumen | Siguen funcionando; "Siguiente" no cambia. |
| La ventana pierde el foco | Pausa automática (las pulsaciones ya no llegarían); al volver, sigue en pausa dentro del modo. |
| **Esc** / "Terminar" | Sale del modo y pausa. Lo marcado se queda (autoguardado). Queda seleccionada la línea que era "Siguiente". |
| Fin de la letra | Al marcar la última línea, el banner muestra `edi.sync.fin` y el modo sigue (para fijar el fin manteniendo Intro) hasta Esc o el final de la canción, donde sale solo. |
| Durante el modo | La vista previa muestra la letra con resaltado en vivo; la lista resalta "Siguiente" (borde `acento-texto`) y la sigue. La pestaña y el panel Estilo, el ajuste fino (C), Supr, I/O/L, ↑/↓, Alt/Ctrl+flechas y "Probar a pantalla completa" quedan inactivos. |

### Fin automático de una línea
`fin_ms: null`, calculado al dibujar con `finEfectivo` (ADR 0005), en este orden: palabras con tiempo → fin de la última palabra; le sigue una pausa con tiempo → inicio de esa pausa; le sigue una línea con inicio a ≤ 8 s → inicio de la siguiente; pausa sin tiempo o hueco > 8 s → `inicio + mín(hueco, máx(2 s, 0,4 s × nº de palabras))`; última línea (o sin siguiente con tiempo) → +5 s sin pasar del final de la canción.
- En el panel C, el fin automático se muestra en `texto-2` seguido de "(automático)"; un fin fijado (a mano o traído por la letra) en `texto-1`, sin etiqueta, con el botón "Usar fin automático" (vuelve a `null`).
- Un fin fijado cumple `inicio < fin ≤ tiempo del siguiente elemento con tiempo` (y ≤ duración en la última línea).

### Ajuste fino (panel C)
| Acción | Ratón | Teclado (fuera de campos de texto) |
|--------|-------|------------------------------------|
| Seleccionar línea | Clic | ↑ / ↓ (saltan pausas) |
| Inicio −/+ 10 ms · 100 ms | [−0,01][+0,01] · [−0,1][+0,1] | Alt + ← / → · Alt + Mayús + ← / → |
| Fin −/+ 10 ms · 100 ms | Ídem en Fin | Ctrl/Cmd + ← / → · Ctrl/Cmd + Mayús + ← / → |
| Escribir un tiempo | Campos Inicio / Fin (`mm:ss.cc`; Intro o salir del campo aplica; Esc lo restaura) | — |
| Fijar inicio en la posición actual | "Fijar inicio aquí" | **I** |
| Fijar fin en la posición actual | "Fijar fin aquí" | **O** |
| Escuchar desde la línea | "Escuchar desde esta línea" / doble clic | **L** (desde 2 s antes de su tiempo; sin inicio, desde el elemento anterior con tiempo, o desde 0) |
| Borrar tiempos de la línea | Botón | **Supr** o **Retroceso** |
| Usar fin automático | Botón (solo con fin fijado) | — |

- **Límites**: un inicio no puede igualar ni pasar el del elemento anterior o siguiente con tiempo (pausas con tiempo incluidas). El ajuste se detiene en el último valor válido y muestra 2 s un tooltip junto al campo: `edi.limite.anterior` / `edi.limite.siguiente` (con "pausa" en lugar de "línea" si el vecino es una pausa). I, un tiempo escrito o "Fijar inicio aquí" fuera de límites no cambian nada y muestran el mismo tooltip. Un fin fuera de `inicio < fin ≤ siguiente` se trata igual (`edi.limite.fin.inicio` / `edi.limite.fin.siguiente`).
- Ajustar el **fin automático** con ± lo fija partiendo de su valor efectivo.
- **Consecuencias de mover un inicio** (`moverInicioLinea`): si se descartan palabras o un fin fijado pasa a automático, toast `edi.toast.palabras` y/o `edi.toast.finauto` con [Deshacer]. Ningún aviso si no ocurre nada de eso.
- **Escucha de comprobación**: con la reproducción en pausa y "Escuchar al ajustar" activada (por defecto; dura la visita), tras cada ajuste de inicio suena desde 1 s antes del nuevo tiempo hasta 2 s después; tras un ajuste de fin, desde 2 s antes hasta 1 s después. Ajustes seguidos (< 400 ms entre ellos) reinician una sola escucha. Al terminar vuelve a la posición previa, en pausa.
- **Borrar tiempos** deja la línea sin inicio, sin fin fijado y sin palabras. En una canción Lista la deja **incompleta** (insignia en vivo).

### Desplazamiento de toda la letra (`letra.offset_ms`)
- Botones −0,1 s / +0,1 s, campo editable en segundos con signo y dos decimales ("+0,25") y "Restablecer" (a 0; inactivo si ya es 0). Teclas **,** / **.** (−/+ 100 ms), las mismas que en la vista previa del reproductor (spec 07).
- Rango −30,00 s … +30,00 s (confirmado en [0025](../preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) §3; el main lo valida al guardar); fuera de rango el valor se limita y el campo muestra `edi.offset.rango`.
- Signo: **+** = la letra sale **más tarde**. Se aplica al instante a la lista (tiempos mostrados), a los ticks y a la vista previa.
- Las letras importadas llegan con `offset_ms: 0` (el `[offset:]` de un LRC ya se aplicó a los tiempos, ADR 0005).

### Deshacer y rehacer
- Cubre, en la visita actual: marcas, ajustes de inicio y fin, fijar/usar fin automático, borrar tiempos, desplazamiento global y cambios de estilo. No cubre "Usar este estilo en canciones nuevas" (es de la configuración) ni "Volver a borrador" (tiene su propio diálogo).
- Un arrastre (selector de color nativo, dial de ángulo) o una ráfaga de ajustes sobre el mismo valor en < 1 s cuenta como un paso. Hasta 200 pasos.
- Atajos: Ctrl/Cmd + Z y Ctrl/Cmd + Mayús + Z (también Ctrl + Y en Windows y Linux). Dentro de un campo de texto, deshacen el texto del campo, no el editor.
- La pila se vacía al salir del editor (no persiste). Cada deshacer/rehacer se autoguarda.

### Estilo (panel D)
| Elemento | Comportamiento |
|----------|----------------|
| Sólido / Degradado | Control segmentado. Pasar a degradado parte del color sólido + un segundo color, la **variante de luminosidad** del primero (ver "Variante de luminosidad" bajo esta tabla); pasar a sólido usa el primer color del degradado. Un solo paso de deshacer. |
| Ángulo | Campo numérico 0–359 (fuera de rango se ajusta: 360 → 0) + dial circular arrastrable; ←/→ ±15° con el dial enfocado (Mayús: ±1°). |
| Colores del degradado | 2 a 4 paradas, **siempre ordenadas** y repartidas por igual (0 · 1; 0 · ½ · 1; 0 · ⅓ · ⅔ · 1). "+ Añadir color" (hasta 4) añade al final la variante de luminosidad del último color; ✕ (solo con > 2) quita esa parada. Las posiciones se recalculan. |
| Selector de color | Componente de sistema visual §6: muestra 32 px + hex editable (`#RRGGBB`; con un valor no válido, borde `error` y "Usa el formato #RRGGBB", sin aplicar) + selector nativo + 8 sugeridos de §8 (de fondo o de letra según el selector). |
| Fuente | Selector con las 8 familias incluidas (Atkinson Hyperlegible Next, Nunito, Montserrat, Oswald, Lora, Playfair Display, Bangers, Noto Sans); cada opción con su nombre y "¿Cantamos? Ñandú" en su propia fuente. Las fuentes van con la app: no hay carga ni red. Los caracteres que una fuente no tenga se ven con la fuente de respaldo (sin aviso en el MVP). |
| Aviso de contraste | Reglas de [sistema-visual §9](sistema-visual.md), evaluadas en cada cambio (y al entrar). Ver tabla siguiente. **Nunca bloquea** ni impide marcar como lista. `role="status"`; se anuncia solo cuando cambia de nivel. Punto `aviso` en la pestaña "Estilo" mientras haya algún ⚠. |
| Restablecer estilo predeterminado | Aplica `config.estilo_predeterminado` a la canción (deshacible). |
| Usar este estilo en canciones nuevas | Guarda el estilo actual como `config.estilo_predeterminado`. Toast `edi.estilo.predet.toast`. Inactivo si el estilo ya es igual al predeterminado. |
| Portada en la Biblioteca | Consecuencia, sin aviso: una canción de YouTube deja de mostrar su miniatura en cuanto su estilo difiere del predeterminado (de fábrica o del usuario) (spec 02, criterio 15). |

**Variante de luminosidad** (segundo color al pasar a degradado y color de "+ Añadir color"; [0026](../preguntas/0026-textos-pendientes-del-editor-fase-5.md) §2): en HSL se conservan tono (H) y saturación (S) y se cambia la luminosidad (L, 0–100) en **30 puntos**: si L ≤ 70, **L + 30** (más claro); si L > 70, **L − 30** (más oscuro), para que la nueva parada siempre se distinga y nunca acabe en un blanco igual al anterior. Se calcula sin redondear L y se redondea cada canal al entero más próximo. Ejemplos (±1 por canal): `#1B1033` → `#5935A7`; `#000000` → `#4D4D4D`; `#FFFFFF` → `#B3B3B3`. El aviso de contraste se reevalúa con el nuevo degradado como con cualquier otro cambio.

**Niveles del aviso de contraste** (peor caso sobre 11 muestras del degradado):
| Condición | Se muestra | Acciones rápidas |
|-----------|-----------|------------------|
| Letra < 3:1 | ⚠ `edi.contraste.letra` (`aviso`) | "Usar letra blanca" (`#FFFFFF`) y/o "Usar letra negra" (`#111111`): se ofrece la que dé más contraste y la otra solo si supera 3:1. Si ninguna supera 3:1, se ofrecen ambas y se añade `edi.contraste.fondo`. |
| Resaltado < 3:1 | ⚠ `edi.contraste.resaltado` | "Sugerir un color de resaltado": el sugerido de §8 con mayor contraste con el fondo entre los que tienen ΔE ≥ 25 respecto a la letra (si ninguno, el de mayor contraste). |
| Resaltado vs letra ΔE < 25 | ⚠ `edi.contraste.diferencia` | "Sugerir un color de resaltado" (misma regla). |
| Letra o resaltado entre 3:1 y 4,5:1 (sin ningún ⚠) | ⓘ `edi.contraste.justo` (`info`) | — |
| Todo ≥ 4,5:1 y ΔE ≥ 25 | ✓ `edi.contraste.ok` (`exito`) | — |
Si hay varios ⚠ se muestran todos, en el orden de la tabla. Cada acción rápida es un paso de deshacer.

### Vista previa
- Área 16:9 con el motor de render compartido con el reproductor y los valores fijos de [sistema-visual §10](sistema-visual.md) escalados a su alto; fondo y fuente del estilo actual. Se actualiza en < 100 ms tras cada cambio de estilo, tiempo o desplazamiento.
- **Reproduciendo**: dibuja lo que vería el reproductor en esa posición (línea actual y siguiente, barrido o resaltado por palabra, indicador de entrada `●●●`, pantalla de título antes de la primera línea; `●●●` siempre antes de la primera línea, desde la Fase 6, sistema-visual §10). Sin el silencio previo del reproductor, que solo existe a pantalla completa. Las líneas sin inicio se omiten; las pausas no se dibujan. No muestra el aviso `rep.incompleta`.
- **En pausa**: muestra la línea seleccionada (aunque no tenga tiempo) con la **mitad resaltada** y la siguiente línea debajo, para juzgar ambos colores. Si no hay selección, la primera línea.
- Es decorativa para lectores de pantalla (`aria-hidden`), con una descripción `edi.previa.aria` en la región.

### Guardado, borrador y lista
| Elemento | Comportamiento |
|----------|----------------|
| Autoguardado | Cada cambio se guarda tras ~1 s sin cambios (como máximo 2 s desde el cambio) mediante el proceso principal: tiempos y desplazamiento con `letras.guardarTiempos`, estilo con `biblioteca.guardarEstilo` ([0025](../preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) §4, ADR 0010). Indicador: "Guardando…" mientras hay cambios pendientes o en vuelo; "✓ Guardado" al terminar. |
| Fallo al guardar | Indicador "⚠ No se pudo guardar" + reintento automático cada 5 s + un toast por racha de fallos: `edi.toast.errorguardar` con [Copiar detalles]. Al recuperarse, vuelve a "✓ Guardado" sin toast. |
| Letra cambiada fuera del editor | Red de seguridad: si el main rechaza el guardado de tiempos con `LETRA_DESACTUALIZADA` (la letra guardada ya no tiene las mismas líneas), el editor recarga la canción desde disco y descarta los tiempos pendientes y el historial de deshacer/rehacer (⟲ ⟳ quedan `disabled`). Conserva la selección si la línea sigue existiendo (si no, la primera sin inicio), la pista, la velocidad y la posición, en pausa (y sale del modo sincronizar si estaba en él). Toast `aviso` persistente `edi.toast.recargada`. No es un fallo de guardado: no reintenta ni muestra "⚠ No se pudo guardar"; el indicador pasa a "✓ Guardado". El estilo se guarda aparte y no se ve afectado. |
| Salir del editor | ‹ Biblioteca, logotipo, Esc, otro paso del stepper, "Corregir la letra", Ctrl/Cmd + N, Ctrl/Cmd + , y (desde la Fase 6) "Probar a pantalla completa": primero se vacía el guardado pendiente (sin esperar el *debounce*) y luego se navega. Si ese guardado falla, diálogo `edi.dialogo.salir` [Quedarme en el editor] (foco inicial) [Salir sin guardarlos] (destructivo). Es la **única** confirmación de salida. Cerrar la ventana también vacía el guardado (tope de 2 s; si hay trabajos en curso, antes sale el diálogo de cierre de la tarea 0073) ([0025](../preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) §4). |
| Volver a la Biblioteca siendo borrador | Si en esta visita hubo algún cambio guardado, la Biblioteca muestra el toast `edi.toast.borrador`. Sin cambios, ningún toast. |
| **Marcar como lista** (primario, solo en borrador) | Disponible si la separación está completada (existen voz e instrumental), hay ≥ 1 línea y **todas** las líneas (no pausas) tienen inicio (ADR 0006). Al pulsar: vacía el guardado, cambia `estado` a `lista` y vuelve a la Biblioteca (ver "Volver a la Biblioteca"). |
| Marcar como lista no disponible | Botón con `aria-disabled="true"` (sigue enfocable). Al pulsarlo o enfocarlo con teclado, popover `edi.falta.titulo` con un renglón por motivo y su acción: separación en curso `edi.falta.separando` (sin acción) · en cola `edi.falta.cola` (sin acción) · pendiente/error/interrumpida `edi.falta.separar` [Ir a Separación] · líneas sin inicio `edi.falta.lineas` [Ir a la primera] (selecciona la primera sin inicio, la desplaza a la vista y pone el foco en la lista). El popover se actualiza en vivo y se cierra con Esc o al hacer clic fuera (el foco vuelve al botón). |
| Canción Lista: "Hecho" (primario) | Vuelve a la Biblioteca con la tarjeta enfocada, sin resalte ni toast. Si está **incompleta**, la primera pulsación de la visita muestra el popover `edi.hecho.incompleta` con [Sincronizar ahora] (cierra el popover y selecciona la primera línea sin inicio) y [Salir igualmente]; la segunda pulsación sale directamente. El estado guardado no cambia. |
| Volver a borrador | Menú ⋯ de la cabecera (solo Lista), ver "Cabecera". |

### Volver a la Biblioteca tras "Marcar como lista"
1. La Biblioteca se abre con el filtro de la sesión; si es *Borradores* (ocultaría la canción), pasa a *Todas*. La búsqueda ya está vacía (spec 02).
2. La tarjeta de la canción se desplaza hasta quedar visible, recibe el foco y se resalta 2 s con borde 2 px `exito` (aparece y desaparece con 200 ms de fundido; sin fundido con movimiento reducido).
3. Toast `bib.toast.lista` "«{título}» está lista para cantar." con [▶ Reproducir], que abre el reproductor (spec 07) como el botón de la tarjeta y cierra el toast (desde la Fase 6; en la Fase 5 salía sin acción, [0025](../preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) §1). Como tiene acción, no desaparece solo a los 6 s (sistema-visual §6).

### Probar a pantalla completa
Llega con la Fase 6 ([0025](../preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) §1). Detalle del lado del reproductor en spec 07 §"Prueba desde el editor".
- Botón secundario con icono ⛶ bajo la vista previa (ancho de la vista previa en A, alineado a la izquierda en B) o **F**. Vacía el guardado pendiente (como al salir; si falla, `edi.dialogo.salir` con "Quedarme en el editor" y "Salir sin guardarlos" = abrir igualmente) y abre el reproductor **encima** del editor, que se queda montado: no se pierden el historial de deshacer, la selección, la pista ni la velocidad.
- Usa la letra, el estilo y el desplazamiento **en memoria** del editor. Empieza en `máx(0, tiempo mostrado de la línea seleccionada − 3 s)`, o en la posición actual si la línea no tiene inicio. Siempre a 1×.
- Suena el instrumental si la separación está completada; si no, la mezcla original con la etiqueta `rep.original` siempre visible.
- **Disponibilidad**: inactivo (como el resto) durante el modo sincronizar y en el estado "Error de audio". Sin ninguna línea con inicio: `aria-disabled="true"`, sigue enfocable y muestra el tooltip `edi.probar.sinlineas`; F no hace nada. Mientras carga el audio del editor sí se puede pulsar (el reproductor muestra su propio "Cargando…").
- **, / .** en el reproductor cambian el desplazamiento; cada cambio pasa al estado del editor (se autoguarda igual) y todos los de una misma prueba son **un** paso de deshacer.
- **Al volver** (Esc, ✕ o pantalla final del reproductor): en pausa, con el cabezal en la posición en que estaba el reproductor; la línea seleccionada pasa a ser la que sonaba (o la última que había empezado) y la lista se desplaza hasta ella (si no había empezado ninguna, la selección no cambia); misma pista y velocidad que antes; foco en "Probar a pantalla completa".

## Atajos de teclado
Diálogo "Atajos de teclado" con **F1** o **?** (y desde ⋯). Los atajos de una tecla no actúan con el foco en un campo de texto (tiempos, hex, ángulo, desplazamiento). Las flechas **sin modificador** las usa el control enfocado si las necesita (barra de tiempo, volumen, dial, controles segmentados, selector de fuente); con Alt, Ctrl/Cmd o Mayús son siempre del editor salvo en campos de texto. Todos llaman a `preventDefault` para que el sistema no los use (p. ej. Alt + ← no navega).

| Tecla | Acción |
|-------|--------|
| Espacio | Reproducir / pausa (también en el modo sincronizar) |
| Inicio | Ir al principio |
| ← / → (en la barra de tiempo) | −/+ 5 s |
| S | Entrar en "Sincronizar al ritmo" |
| Intro | (Modo sincronizar) marcar inicio; mantener ≥ 300 ms = marcar también el fin |
| Retroceso | (Modo sincronizar) deshacer la última marca · (fuera del modo) borrar tiempos de la línea |
| Supr | Borrar tiempos de la línea seleccionada |
| Esc | Cancelar la cuenta atrás / salir del modo sincronizar / cerrar popover o diálogo / volver a la Biblioteca |
| ↑ / ↓ | Línea anterior / siguiente (saltan pausas) |
| Alt + ← / → | Inicio −/+ 10 ms (con Mayús: 100 ms) |
| Ctrl/Cmd + ← / → | Fin −/+ 10 ms (con Mayús: 100 ms) |
| I / O | Fijar inicio / fin en la posición actual |
| L | Escuchar desde la línea seleccionada |
| , / . | Desplazamiento de toda la letra −/+ 100 ms |
| 1 / 2 / 3 | Escuchar Original / Voz / Instrumental |
| Ctrl/Cmd + Z · Ctrl/Cmd + Mayús + Z (Ctrl + Y) | Deshacer · Rehacer |
| F | Probar a pantalla completa |
| F1 / ? | Atajos de teclado |

Notas: el fin usa Ctrl/Cmd y no Ctrl + Alt porque Ctrl + Alt + flechas gira la pantalla con algunos controladores gráficos de Windows. Los corchetes `[ ]` de la versión anterior se sustituyen por `, .` porque en el teclado español exigen AltGr.

## Estados
| Estado | Presentación |
|--------|--------------|
| Sin letra | No se puede entrar (stepper no navegable). Si se llega igualmente: `edi.sinletra` + [Buscar la letra] (abre Letra). |
| Sin sincronizar (ninguna línea con inicio) | Todas las filas `--:--.--`; banner `info` sobre la lista `edi.banner.sinsync`, foco en "Sincronizar al ritmo". El banner desaparece con la primera marca. |
| Sincronizada en parte | Sin banner; el contador indica lo que falta. |
| Ya sincronizada al entrar (todas con inicio, canción en borrador) | Banner `info` cerrable `edi.banner.yasync`. Se cierra con ✕ o con el primer cambio de tiempos; no se guarda (en otra visita vuelve a salir mientras siga en borrador). |
| Cargando audio | Transporte inactivo con "Cargando audio…"; normal < 1 s; si pasa de 3 s, barra indeterminada. La lista, el estilo y la vista previa en pausa ya funcionan. |
| Separación en curso / en cola | Stepper en vivo; Voz e Instrumental no disponibles con su tooltip; "Marcar como lista" no disponible con el motivo. Toast al terminar (spec 04). |
| Separación pendiente, con error o interrumpida | Igual, con el motivo `edi.falta.separar` y [Ir a Separación]. |
| Error de audio (no se puede leer `mezcla.flac`) | Banner `error` `edi.error.audio` + [Ver en Biblioteca]; transporte y modo sincronizar inactivos; el estilo se puede seguir editando. |
| Guardando / guardado / error de guardado | Indicador de la cabecera (§"Guardado"). |
| Borrador | Insignia "✎ Borrador"; primario "Marcar como lista". |
| Lista | Insignia "✓ Lista"; primario "Hecho"; ⋯ con "Volver a borrador…". |
| Lista incompleta | Insignia `edi.lista.incompleta`; "Hecho" muestra `edi.hecho.incompleta` una vez por visita. |
| Modo sincronizar | Banner E, cuenta atrás al entrar, controles inactivos según la tabla del modo. |
| Ayuda Bluetooth | Al salir del modo sincronizar por primera vez en la sesión de la app, nota `info` cerrable bajo el desplazamiento: `edi.ayuda.bluetooth`. Cerrada, no vuelve a salir en la sesión. |
| Contraste bajo | Aviso en el panel Estilo + punto `aviso` en la pestaña "Estilo". |

## Accesibilidad
- *Landmarks*: cabecera `banner`; lista y panel C en una región "Sincronía"; panel D `complementary` "Estilo"; vista previa región "Vista previa"; transporte región "Reproducción". Enlace "Saltar al contenido" (a la lista).
- Lista con `role="listbox"` y *roving tabindex*; cada línea es una opción con nombre accesible `edi.aria.linea` ("Línea 2, 00:04.20, Is this just fantasy?" o "…, sin sincronizar"); las pausas son `role="separator"` con nombre "pausa". La línea que suena lleva `aria-current="true"`.
- Anuncios (`aria-live="polite"`), solo en hitos: entrar y salir del modo, deshacer una marca, `edi.sync.fin`, cambio de nivel de contraste, error de guardado, popovers. No se anuncia cada marca ni el tiempo que avanza.
- Anillo de foco doble (§7) sobre la vista previa y el banner del modo.
- El estado nunca depende solo del color: ◆, iconos "falta", ✓/⚠ e insignias llevan icono y texto o nombre accesible.
- Todos los objetivos ≥ 32 × 32 px; el botón "MARCAR" del modo, 44 px de alto como mínimo.
- Funciona a 1024 × 640 y con zoom de la interfaz hasta 150 % (a partir de ahí, desplazamiento vertical del panel, nunca contenido cortado). *Sustituido en 0.2.0 por la [subfase 2.1](#subfase-21--layout-adaptable-y-paneles): mínimo de diseño 1024 × 576 px CSS sin scroll de página; por debajo, solo scroll vertical de página.*

## Microcopy
| Clave | Texto |
|-------|-------|
| `edi.lineas` | Líneas |
| `edi.contador` | {a}/{b} sincronizadas |
| `edi.pausa` | ♪ pausa |
| `edi.pausa.tiempo` | Esta pausa viene con tiempo en la letra importada. |
| `edi.palabras.tooltip` | Esta línea trae tiempos por palabra: se resaltará palabra a palabra. Si mueves la línea, sus palabras se mueven con ella. |
| `edi.falta.tooltip` | Sin sincronizar |
| `edi.corregir` | Corregir la letra |
| `edi.sinseleccion` | Elige una línea de la lista para ajustar sus tiempos. |
| `edi.escuchar` | Escuchar: Original · Voz · Instrumental |
| `edi.no.disponible.pista` | Disponible cuando termine la separación ({n} %) |
| `edi.no.disponible.cola` | Disponible cuando termine la separación (en cola) |
| `edi.no.disponible.separar` | Disponible cuando se separen las pistas |
| `edi.velocidad` | Velocidad |
| `edi.velocidad.tooltip` | A menor velocidad, el tono también baja. Los tiempos que marques valen igual a cualquier velocidad. |
| `edi.volumen` | Volumen · Silenciar · Activar sonido |
| `edi.cargando` | Cargando audio… |
| `edi.boton.sync` | Sincronizar al ritmo |
| `edi.sync.titulo` | Sincronizando al ritmo |
| `edi.sync.ayuda` | Pulsa Intro cuando empiece cada línea. Mantenla pulsada mientras se canta si quieres marcar también el final. |
| `edi.sync.siguiente` | Siguiente: «{texto}» · línea {n} de {total} |
| `edi.sync.marcar` | Marcar (Intro) |
| `edi.sync.deshacer` | Deshacer (Retroceso) |
| `edi.sync.pausa` | Pausa (Espacio) · Seguir (Espacio) |
| `edi.sync.terminar` | Terminar (Esc) |
| `edi.sync.pronto` | Demasiado pronto: aún no ha empezado la línea anterior. |
| `edi.sync.fin` | ¡Todas las líneas tienen tiempo! Revisa con ▶ y ajusta lo que haga falta. |
| `edi.banner.sinsync` | Empieza por sincronizar: pulsa Sincronizar al ritmo (o la tecla S) y marca cada línea al oírla. |
| `edi.banner.yasync` | Esta letra ya viene sincronizada. Escúchala y, si va adelantada o atrasada, usa el desplazamiento de toda la letra. |
| `edi.linea.n` | Línea {n} de {total} |
| `edi.palabras.etiqueta` | por palabra |
| `edi.inicio` / `edi.fin` | Inicio · Fin |
| `edi.fin.auto` | (automático) |
| `edi.fin.usarauto` | Usar fin automático |
| `edi.fin.sininicio` | Primero fija el inicio de esta línea. |
| `edi.tiempo.formato` | Usa el formato mm:ss.cc, por ejemplo 01:04.20. |
| `edi.boton.fijarinicio` | Fijar inicio aquí |
| `edi.boton.fijarfin` | Fijar fin aquí |
| `edi.boton.escucharlinea` | Escuchar desde esta línea |
| `edi.boton.borrartiempos` | Borrar tiempos de esta línea |
| `edi.limite.anterior` | No puede ir antes de la línea anterior · (vecino pausa) No puede ir antes de la pausa anterior |
| `edi.limite.siguiente` | No puede pasar de la línea siguiente · (vecino pausa) No puede pasar de la pausa siguiente |
| `edi.limite.fin.inicio` | El fin tiene que ir después del inicio. |
| `edi.limite.fin.siguiente` | El fin no puede pasar del inicio de la línea siguiente. |
| `edi.escuchar.ajustar` | Escuchar al ajustar |
| `edi.toast.palabras` | La línea {n} ya no se resaltará palabra a palabra: sus tiempos no cabían. — [Deshacer] |
| `edi.toast.finauto` | El fin de la línea {n} vuelve a ser automático. — [Deshacer] |
| `edi.offset.titulo` | Desplazamiento de toda la letra |
| `edi.offset.ayuda` | Úsalo si toda la letra va adelantada o atrasada respecto a la música. Con + la letra sale más tarde. |
| `edi.offset.rango` | Máximo 30 segundos hacia cada lado. |
| `edi.boton.restablecer` | Restablecer |
| `edi.ayuda.bluetooth` | ¿Usas auriculares o altavoces Bluetooth? Si toda la letra queda atrasada, usa el desplazamiento de toda la letra. |
| `edi.estilo.fondo` | Fondo |
| `edi.estilo.tipo` | Sólido · Degradado |
| `edi.estilo.angulo` | Ángulo |
| `edi.estilo.color` | Color |
| `edi.estilo.colores` | Colores |
| `edi.estilo.anadircolor` | Añadir color |
| `edi.estilo.quitarcolor` | Quitar este color |
| `edi.estilo.hex.error` | Usa el formato #RRGGBB. |
| `edi.estilo.letra` | Letra |
| `edi.estilo.fuente` | Fuente |
| `edi.estilo.colorletra` | Color de la letra |
| `edi.estilo.resaltado` | Color de lo ya cantado |
| `edi.estilo.sugeridos` | Sugeridos |
| `edi.estilo.muestra` | ¿Cantamos? Ñandú |
| `edi.contraste.ok` | Buen contraste |
| `edi.contraste.justo` | Legible en pantallas grandes; puede costar en proyectores o con mucha luz. |
| `edi.contraste.letra` | Difícil de leer: la letra y el fondo se parecen demasiado. |
| `edi.contraste.resaltado` | Difícil de leer: lo ya cantado se confunde con el fondo. |
| `edi.contraste.diferencia` | El resaltado apenas se distingue de la letra: no se notará qué parte ya se ha cantado. |
| `edi.contraste.fondo` | Prueba también con un fondo más oscuro o más claro. |
| `edi.contraste.blanca` / `edi.contraste.negra` | Usar letra blanca · Usar letra negra |
| `edi.contraste.sugerir` | Sugerir un color de resaltado |
| `edi.estilo.reset` | Restablecer estilo predeterminado |
| `edi.estilo.predet` | Usar este estilo en canciones nuevas |
| `edi.estilo.predet.toast` | Las canciones nuevas usarán este estilo. |
| `edi.previa` | Vista previa |
| `edi.previa.aria` | Vista previa de la letra con el estilo actual. |
| `edi.deshacer` / `edi.rehacer` | Deshacer (Ctrl+Z / ⌘Z) · Rehacer (Ctrl+Mayús+Z / ⌘⇧Z) |
| `edi.menu.atajos` | Atajos de teclado (F1) |
| `edi.menu.borrador` | Volver a borrador… |
| `edi.guardado` | Guardado · Guardando… · No se pudo guardar |
| `edi.toast.errorguardar` | No se pudieron guardar los cambios de «{título}». Lo seguimos intentando. — [Copiar detalles] |
| `edi.dialogo.salir` | Título: No se pudieron guardar los últimos cambios. Texto: Si sales ahora, perderás lo que has cambiado en los últimos segundos. — [Quedarme en el editor] [Salir sin guardarlos] |
| `edi.toast.recargada` | La letra ha cambiado fuera del editor y la hemos vuelto a cargar. Puede que tus últimos ajustes de tiempos no se hayan guardado: revísalos. |
| `edi.toast.borrador` | Borrador guardado. |
| `edi.boton.lista` | Marcar como lista |
| `edi.boton.hecho` | Hecho |
| `edi.falta.titulo` | Para marcarla como lista falta: |
| `edi.falta.separando` | La separación de pistas ({n} %, quedan unos {m} min) · (sin estimación) La separación de pistas ({n} %) |
| `edi.falta.cola` | La separación de pistas (en cola) |
| `edi.falta.separar` | Separar las pistas — [Ir a Separación] |
| `edi.falta.lineas` | Sincronizar {n} líneas — [Ir a la primera] · (n = 1) Sincronizar 1 línea — [Ir a ella] |
| `edi.lista.incompleta` | Lista · ⚠ Faltan {n} líneas · (n = 1) Lista · ⚠ Falta 1 línea |
| `edi.hecho.incompleta` | Esta canción está lista, pero faltan {n} líneas por sincronizar. Al cantarla no aparecerán. — [Sincronizar ahora] [Salir igualmente] · (n = 1) …pero falta 1 línea por sincronizar. Al cantarla no aparecerá. |
| `edi.boton.probar` | Probar a pantalla completa |
| `edi.probar.original` | Sustituida por `rep.original` (spec 07): «Vista previa con la canción original: aún no hay pista instrumental.» |
| `edi.probar.sinlineas` | Sincroniza al menos una línea para probarla. |
| `edi.probar.tooltip` | Probar a pantalla completa (F) |
| `edi.error.audio` | No se puede reproducir el audio de esta canción. — [Ver en Biblioteca] |
| `edi.sinletra` | Esta canción aún no tiene letra. — [Buscar la letra] |
| `edi.aria.linea` | Línea {n}, {tiempo}, {texto} · (sin inicio) Línea {n}, sin sincronizar, {texto} |
| `edi.atajos.titulo` | Atajos de teclado |

Formato de números: coma decimal ("0,5×", "+0,25 s"), tiempos `mm:ss.cc` con punto (convención de karaoke/LRC, igual que en la vista Letra).

## Criterios de aceptación

**Estructura y navegación**
1. El editor muestra la cabecera del espacio de canción (‹ Biblioteca, título · artista, insignia, indicador de guardado, ⟲ ⟳, ⋯ y stepper), la lista de líneas, la vista previa, el panel Sincronía/Estilo y el transporte; en < 1280 px usa el wireframe B y nada queda cortado a 1024 × 640.
2. En el stepper, Editor muestra ● en un borrador y ✓ en una canción Lista, con el subrayado del paso actual; Letra muestra ✓ y es navegable ([0024](../preguntas/0024-stepper-letra-actual-y-volver-a-letra-desde-el-editor.md)).
3. "Corregir la letra" abre la vista Letra en C; al volver, las líneas no modificadas conservan inicio, fin y palabras.
4. Al entrar se selecciona la primera línea sin inicio (o la primera línea), el audio está en 0 y en pausa, la pista es Voz si existe (si no, Original) y el foco está en "Sincronizar al ritmo" si ninguna línea tiene inicio, o en la lista si alguna lo tiene.

**Lista y transporte**
5. Cada fila muestra el tiempo mostrado (`inicio_ms + offset_ms`, mínimo 0) o `--:--.--` con el icono de "falta"; las filas con palabras muestran ◆ con su tooltip; las pausas se muestran como "♪ pausa" (con su tiempo en `texto-3` solo si lo traen), no se pueden seleccionar, ↑/↓ las saltan y no cuentan en el contador.
6. El contador muestra "{a}/{b} sincronizadas" contando solo líneas; al pulsarlo con líneas pendientes se selecciona la primera sin inicio.
7. Espacio reproduce/pausa; la línea que suena lleva ▶ y la lista la sigue salvo desplazamiento manual en los últimos 5 s; la selección no cambia sola fuera del modo sincronizar.
8. "Escuchar" cambia entre Original, Voz e Instrumental manteniendo la posición; Voz e Instrumental no están disponibles sin la separación completada y su tooltip dice el motivo (con el porcentaje en curso); si la separación termina con el editor abierto, se activan sin recargar.
9. La velocidad 0,5×/0,75×/1× cambia la reproducción y marcar el mismo punto del audio a 0,5× y a 1× guarda los mismos ms (test con marcas de tiempo simuladas).
10. La barra de tiempo muestra un tick por cada línea con inicio, en su tiempo mostrado, y se actualiza al marcar, ajustar o cambiar el desplazamiento.

**Modo "Sincronizar al ritmo"**
11. S o el botón entran en el modo con "Siguiente" = línea seleccionada (o primera sin inicio), cuenta atrás de 3 s en silencio y reproducción desde 2 s antes del elemento anterior con tiempo (o desde 0); Esc durante la cuenta atrás la cancela sin marcar nada.
12. Cada pulsación de Intro (o del botón "Marcar") fija el inicio de "Siguiente" con un error del sistema ≤ 20 ms respecto al instante de la pulsación con salida por cable o altavoces del equipo, a 0,5×, 0,75× y 1×, verificado con un test automático (marcas de tiempo simuladas) y una prueba manual con una pista de clics; las repeticiones del teclado se ignoran; "Siguiente" avanza saltando pausas.
13. Una pulsación en un instante ≤ al tiempo del elemento anterior con tiempo no marca nada y muestra `edi.sync.pronto`.
14. Marcar una línea en `t` borra el tiempo de los elementos posteriores con tiempo ≤ `t` (líneas con sus palabras; pausas, solo su inicio), y todo ello se deshace en un solo paso.
15. Mantener Intro ≥ 300 ms fija el fin de esa línea al soltar (limitado al siguiente elemento con tiempo); soltar antes deja el fin automático.
16. Retroceso deshace la última marca de la pasada, devuelve "Siguiente" a esa línea y salta a 3 s antes de la marca deshecha; sin marcas no hace nada.
17. Clic en una fila durante el modo la convierte en "Siguiente"; perder el foco de la ventana pausa; Esc sale conservando lo marcado y deja seleccionada la línea que era "Siguiente"; al final de la canción el modo termina solo.
18. Durante el modo, el panel Estilo, el ajuste fino, Supr, I/O/L, ↑/↓, "Probar a pantalla completa" y F no responden, y la vista previa resalta en vivo.
19. Con salida Bluetooth no se exige precisión: al salir del modo por primera vez en la sesión aparece `edi.ayuda.bluetooth`, cerrable y que no vuelve a salir en la sesión.

**Ajuste fino, fin y desplazamiento**
20. Los ajustes ±10/±100 ms de inicio y de fin funcionan con los botones y con Alt(+Mayús)+←/→ y Ctrl/Cmd(+Mayús)+←/→; los campos aceptan `mm:ss.cc` y rechazan otro formato con `edi.tiempo.formato`.
21. Ningún ajuste, tiempo escrito, I o "Fijar inicio aquí" deja un inicio igual o fuera de los inicios vecinos con tiempo (pausas incluidas): se detiene en el último valor válido y muestra el tooltip de límite correspondiente; lo mismo para el fin con `inicio < fin ≤ siguiente`.
22. El fin automático sigue `finEfectivo`, se muestra en `texto-2` con "(automático)"; ajustarlo lo fija; "Usar fin automático" lo devuelve a `null`.
23. Mover el inicio de una línea con palabras desplaza sus palabras lo mismo; si alguna línea pierde sus palabras o un fin fijado pasa a automático, aparece `edi.toast.palabras` / `edi.toast.finauto` con [Deshacer], que lo restaura todo.
24. Supr (o Retroceso fuera del modo) borra inicio, fin y palabras de la línea seleccionada; en una canción Lista la insignia pasa en vivo a `edi.lista.incompleta`.
25. Con "Escuchar al ajustar" activa y en pausa, cada ajuste reproduce el fragmento de comprobación indicado y vuelve a la posición previa.
26. El desplazamiento global cambia en pasos de 100 ms con los botones y con , / ., admite valores escritos entre −30 y +30 s, se ve con signo y coma decimal, mueve al instante tiempos mostrados, ticks y vista previa, y "Restablecer" lo deja en 0. Con un desplazamiento distinto de 0, marcar o pulsar I en la posición `t` guarda `t − offset_ms`.

**Deshacer**
27. Ctrl/Cmd+Z y Ctrl/Cmd+Mayús+Z (y Ctrl+Y en Windows/Linux) y los botones ⟲ ⟳ deshacen y rehacen marcas, ajustes, fines, borrados, desplazamiento y cambios de estilo de la visita; un arrastre de color o de ángulo es un solo paso; dentro de un campo de texto, Ctrl/Cmd+Z deshace el campo.

**Estilo y contraste**
28. El estilo permite fondo sólido o degradado lineal (ángulo 0–359°, 2–4 colores ordenados y repartidos por igual), color de letra, color de lo ya cantado y una de las 8 fuentes incluidas, mostradas cada una en su fuente con "¿Cantamos? Ñandú"; cada cambio se ve en la vista previa en < 100 ms.
29. Un hex no válido muestra "Usa el formato #RRGGBB." y no se aplica.
30. El aviso de contraste aplica sistema-visual §9 con el peor caso de 11 muestras del degradado: con letra o resaltado < 3:1, o ΔE < 25, muestra el ⚠ correspondiente con sus acciones rápidas; entre 3:1 y 4,5:1, el ⓘ; con todo ≥ 4,5:1 y ΔE ≥ 25, "Buen contraste". Ejemplos de prueba: estilo predeterminado → ✓; letra `#5A1E6E` sobre el predeterminado → ⚠ letra con "Usar letra blanca"; resaltado `#F2F3F7` con letra `#FFFFFF` → ⚠ diferencia.
31. Mientras haya un ⚠, la pestaña "Estilo" lleva el punto `aviso`; el aviso nunca impide guardar ni marcar como lista.
32. "Usar este estilo en canciones nuevas" guarda el estilo en `config.estilo_predeterminado` con su toast; "Restablecer estilo predeterminado" lo aplica a la canción y se puede deshacer.

**Vista previa**
33. En reproducción, la vista previa coincide con el render del reproductor en esa posición (mismo motor y valores de §10, escalados), omite líneas sin inicio y no muestra `rep.incompleta`; en pausa, muestra la línea seleccionada con la mitad resaltada y la siguiente debajo.

**Guardado y estados**
34. Todo cambio se escribe en `cancion.json` en ≤ 2 s; el indicador pasa por "Guardando…" a "✓ Guardado"; con un fallo de escritura muestra "⚠ No se pudo guardar", reintenta cada 5 s y saca un único toast por racha.
35. Salir del editor por cualquier vía vacía el guardado pendiente antes de navegar y no pide confirmación; solo si ese guardado falla aparece `edi.dialogo.salir`, con el foco en "Quedarme en el editor".
36. Al volver a la Biblioteca desde un borrador con cambios en la visita aparece `edi.toast.borrador`; sin cambios, ninguno.
37. "Marcar como lista" solo cambia el estado si la separación está completada, hay ≥ 1 línea y todas las líneas tienen inicio; si no, es `aria-disabled` y al pulsarlo o enfocarlo muestra el popover con cada motivo (en curso con %, en cola, separar con [Ir a Separación], líneas con [Ir a la primera]), actualizado en vivo.
38. Tras marcar como lista, la Biblioteca enfoca la tarjeta, la desplaza a la vista, la resalta 2 s con borde `exito`, pasa el filtro a *Todas* si era *Borradores* y muestra `bib.toast.lista` con [▶ Reproducir], que abre el reproductor (en la Fase 5 salía sin acción).
39. En una Lista, "Hecho" vuelve a la Biblioteca con la tarjeta enfocada; si está incompleta, la primera pulsación muestra `edi.hecho.incompleta` con sus dos acciones y el estado guardado no cambia.
40. "Volver a borrador…" del menú ⋯ (solo en Lista) pide la confirmación de spec 02 y deja la canción en borrador sin salir del editor ni cambiar letra o estilo.
41. Los estados de la tabla (sin sincronizar, ya sincronizada, cargando audio, separación en curso/pendiente, error de audio) se muestran con sus textos; el banner `edi.banner.yasync` se cierra con ✕ o con el primer cambio de tiempos.

**Pantalla completa y teclado**
42. (Fase 6.) "Probar a pantalla completa" (o F) vacía el guardado y abre el reproductor desde `máx(0, línea seleccionada − 3 s)` con la letra, el estilo y el desplazamiento en memoria, con el instrumental o la mezcla y la etiqueta `rep.original`; sin ninguna línea con inicio es `aria-disabled` con `edi.probar.sinlineas`; Esc vuelve al editor en pausa, con el cabezal en la posición del reproductor, la línea que sonaba seleccionada, la misma pista, velocidad e historial, y el foco en el botón; los cambios de , / . hechos en el reproductor se ven, se autoguardan y se deshacen en un paso (spec 07, criterios 27–30).
43. Todas las acciones son operables con teclado; F1 o ? abren el diálogo de atajos con la tabla de esta spec; los atajos de una tecla no actúan en campos de texto y Alt + ← no provoca navegación.
44. La lista expone a lectores de pantalla `edi.aria.linea` por línea, las pausas como separadores y solo se anuncian los hitos indicados en "Accesibilidad".
45. Con una letra de 1000 líneas la lista se desplaza con fluidez y marcar una línea actualiza fila, contador y vista previa sin retraso perceptible (< 100 ms).

**Añadidos tras 0025 y 0026**
46. Si `letras.guardarTiempos` responde `LETRA_DESACTUALIZADA`, el editor recarga la canción, vacía deshacer/rehacer (⟲ ⟳ `disabled`), queda en pausa en la misma posición (fuera del modo sincronizar), conserva la selección si la línea existe, muestra el toast `aviso` persistente `edi.toast.recargada` y el indicador queda en "✓ Guardado" sin reintentos (test con el error simulado).
47. "Sólido → Degradado" y "+ Añadir color" usan la variante de luminosidad (HSL, L ± 30 según L ≤ 70 o > 70, mismo H y S): `#1B1033` → `#5935A7`, `#000000` → `#4D4D4D`, `#FFFFFF` → `#B3B3B3` (±1 por canal; test unitario).
48. El tooltip de velocidad dice `edi.velocidad.tooltip` (una sola variante) y el volumen del editor es el mismo valor que `config.reproductor.volumen` / `silenciado`.

## Cambios de esta revisión (2026-11-05)
Respecto a la versión de la Fase 0, sin cambiar el alcance:
- Datos: la letra vive en `cancion.json`; tiempos mostrados con el desplazamiento aplicado y marcas guardadas como `t − offset_ms`; límites contando pausas con tiempo.
- Modo sincronizar: cuenta atrás en silencio y arranque 2 s antes; reglas de "demasiado pronto" y de borrado de tiempos posteriores al sobrescribir; pausa al perder el foco; clic en fila; fin al soltar limitado.
- Ajuste fino: campos de tiempo editables, "Fijar inicio aquí", límites con pausas, toasts de palabras descartadas y fines automáticos.
- Atajos: fin con Ctrl/Cmd + flechas (antes Ctrl/Cmd + Alt), desplazamiento con , / . (antes [ ]), Retroceso también borra tiempos fuera del modo, Ctrl + Y.
- Cabecera: indicador de guardado separado de la insignia, menú ⋯ (atajos, volver a borrador), stepper con ✓ en el paso actual completado (0024).
- Guardado: vaciado del pendiente al salir, diálogo solo si falla, toast "Borrador guardado." solo si hubo cambios; resalte de 2 s, cambio de filtro y toast al marcar como lista.
- Estilo: paradas siempre ordenadas, acciones de contraste cuando ni blanco ni negro bastan, "Usar este estilo…" inactivo si ya es el predeterminado.
- Criterios renumerados (1–45).
- Tras las respuestas a [0025](../preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) y [0026](../preguntas/0026-textos-pendientes-del-editor-fase-5.md): "Probar a pantalla completa", la tecla F y la acción [▶ Reproducir] del toast pasan a la Fase 6; tooltip de velocidad con una sola variante (el tono baja); un solo volumen; API de guardado de ADR 0010; recarga por `LETRA_DESACTUALIZADA` con `edi.toast.recargada`; regla de la variante de luminosidad (L ± 30 en HSL). Criterios 46–48 añadidos.

### Revisión 2026-11-06 (Fase 6)
- "Probar a pantalla completa" y F activos: vaciado del guardado, reproductor encima del editor con la instantánea en memoria, disponibilidad (`edi.probar.sinlineas`), desplazamiento desde el reproductor como un paso de deshacer y vuelta con cabezal y selección en la línea que sonaba.
- `edi.probar.original` sustituida por `rep.original`; `bib.toast.lista` con [▶ Reproducir].
- La vista previa muestra `●●●` siempre antes de la primera línea (mismo cambio de render que el reproductor).
- Criterios 18, 38 y 42 actualizados.

### Revisión 2026-11-08 (0.2.0, subfase 2.1)
- Layout a alto completo con cabecera, tres columnas y dock; divisores accesibles, modos minimizados, prioridades de espacio, panel angosto corregido y persistencia global. Ver [Subfase 2.1](#subfase-21--layout-adaptable-y-paneles), con sus criterios 1–25. El seguimiento del cabezal sigue siendo manual a la espera de [0051](../preguntas/0051-seguimiento-automatico-del-cabezal.md).

### Revisión 2026-11-09 (0.2.0, fase 3)
- Sección «Tema» en el panel Estilo: «Temas definidos» con vínculo vivo y «Tema personalizado» con copia propia, procedencia, «Volver a heredar», edición de tema con confirmación de impacto, «Guardar como tema nuevo…», renombrar, duplicar, eliminar y tema de álbum o artista. Retira «Restablecer estilo predeterminado» y «Usar este estilo en canciones nuevas» (el predeterminado pasa a Ajustes). Ver [Fase 3](#fase-3-de-020--temas-y-biblioteca), con sus criterios T1–T30.

## Fuera del MVP — ampliación futura: sincronía por palabra
Decisión del usuario ([0002](../preguntas/0002-sincronia-por-palabra-en-mvp.md)): el MVP solo ofrece herramientas **por línea**; las palabras con tiempos que lleguen de LRCLIB o de un LRC mejorado se **muestran** (◆ en la fila, resaltado por palabra en la vista previa) y se **conservan**, pero no se editan. Esta sección **no se implementa en el MVP**; describe cómo ampliar el diseño en una versión posterior sin rehacer la vista:

1. **Segunda pasada opcional**: en la lista, cada línea sincronizada ofrece "Sincronizar palabras" (tecla **W**). Se entra en el modo "Sincronizar al ritmo" **acotado a esa línea**: suena desde 1 s antes de su inicio, a 0,75× por defecto, y cada **Intro** marca el inicio de la siguiente palabra (la primera palabra hereda el inicio de la línea; el fin de cada palabra = inicio de la siguiente; la última termina en el fin de la línea). Retroceso deshace, Esc sale.
2. **Modo de toda la canción por palabras** (opcional, avanzado): el mismo modo "Sincronizar al ritmo" con un conmutador "Por línea / Por palabra"; en "Por palabra" la "Siguiente" muestra la línea con la palabra siguiente subrayada.
3. **Ajuste fino**: en el panel Sincronía, bajo Inicio/Fin de la línea, una fila de "fichas" de palabras; seleccionar una ficha permite ±10/±100 ms con los mismos atajos (Tab/Mayús+Tab cambia de ficha).
4. **Línea de tiempo**: al seleccionar una línea con palabras, la barra del transporte hace *zoom* a esa línea y muestra cada palabra como segmento arrastrable.
5. **Borrar**: "Borrar tiempos de palabras" vuelve la línea al barrido progresivo.
6. **Criterio de "Lista"**: no cambia (basta el inicio de cada línea); las palabras son una mejora opcional.
7. Riesgo de UX a validar: sincronizar por palabra multiplica el esfuerzo (una pulsación por palabra, varias pasadas); por eso se ofrece siempre **después** de la sincronía por línea y nunca como requisito.

## Alcance del editor en 0.2.0

La alfa amplía el editor del MVP con marcadores de inicio y fin arrastrables, zoom y escucha en bucle, temas guardables y degradados en movimiento. El [plan de la alfa](../versiones/0.2.0/plan-2.md) recoge las decisiones y las fases que actualizarán esta spec.

### Primera fase de 0.2.0 — Fin de línea y barrido

- En Sincronía, el campo **Fin** muestra el tiempo efectivo y la etiqueta «Fin automático» cuando usa el cálculo del MVP. Debajo, muestra «Fija el fin para dejar un silencio antes de la siguiente línea». Si la línea carece de inicio, el control queda inactivo y muestra «Fija primero el inicio».
- El campo Fin, «Fijar fin aquí» y **O** permiten fijar el fin. Se conserva «Usar fin automático» para volver al valor calculado. Cambiar el fin conserva el inicio siguiente, entra en el historial de deshacer y respeta los límites de la letra, incluidas las pausas con tiempo. Un valor fuera de límites conserva el anterior y anuncia el motivo con los mensajes existentes.
- En reproducción, la vista previa muestra la línea siguiente en espera durante el hueco. Debe coincidir con el reproductor en los instantes límite y con desplazamiento distinto de cero. El modo estático de edición conserva su comportamiento.
- Si el texto ocupa varios renglones, la vista previa llena cada renglón por orden de lectura y reparte el avance según sus anchos visibles. Comparte los criterios de redimensionamiento y tiempos de palabra de la [spec del reproductor](07-reproductor.md#primera-fase-de-020--fin-de-línea-y-barrido).
- Al abrir y reproducir una canción de 0.1.0, los tiempos efectivos y los huecos coinciden con los originales hasta que se editen sus marcas.

### Segunda fase de 0.2.0 — Línea de tiempo de sincronía

La línea de tiempo vive en Sincronía, debajo del transporte. El transporte conserva su barra de posición para buscar en toda la canción. La nueva regla muestra la escala visible y permite buscar dentro de ella. En el ancho reducido del editor, la zona de sincronía admite desplazamiento vertical y los controles se ajustan en varias filas. El documento mantiene sus secciones del MVP como referencia. Para esta fase se aplican las reglas siguientes.

#### Disposición e interacción

```text
Línea de tiempo   [−] [+] [Zoom a la línea] [Ver canción completa] [Centrar en el cabezal]
Regla             00:12         00:14         00:16         00:18
Voz                  ▂▅▇▅▃▂▁                  ▂▃▇▅▃▂
Líneas              [ Inicio │ verso seleccionado │ Fin ]    [ verso siguiente ··· ]
Vista general   ├───────────────[ intervalo visible ]──────────────────────────┤
```

- Regla, onda, regiones y cabezal comparten eje de audio. Los bordes representan los tiempos de letra con el desplazamiento aplicado. La pista recorta la representación a la duración audible. Un borde recortado se distingue de un tirador y puede seguir ajustándose por el campo del panel. Las marcas de pausa con tiempo se muestran como referencias sin selección propia.
- Clic en la regla busca al instante indicado. Clic en una región selecciona su línea y sincroniza panel y lista sin buscar. La lista sigue siendo la ruta de teclado para elegir cualquier línea, incluso las que carecen de inicio o quedan fuera de vista. Mostrar texto truncado si la región es estrecha y conservar el nombre completo al enfocarla o apuntarla.
- Solo la región seleccionada muestra los tiradores visibles «Inicio de la línea» y «Fin de la línea». El fin automático se distingue mediante contorno discontinuo y nombre accesible «Fin de la línea (automático)». Cuando los extremos casi coinciden, los objetivos de puntero se separan verticalmente o se escalonan. Los campos Inicio y Fin siguen disponibles como alternativa.
- Un arrastre captura el puntero, muestra el tiempo provisional y mantiene el último valor válido. Reutiliza límites, desplazamiento de tiempos importados y avisos del panel de Sincronía. Al soltar tras un cambio válido, guardar una sola edición, crear un paso de deshacer y mostrar los avisos correspondientes una sola vez. Un clic o un arrastre sin cambio conserva el fin automático. Un cambio válido del tirador de fin fija ese tiempo. Esc, pérdida de captura, cambio de selección o actualización externa cancelan el gesto y restauran sus valores previos sin crear un paso.
- Tab alcanza cada tirador disponible. Cada uno anuncia nombre, tiempo y límites como deslizador. Flechas izquierda/derecha ajustan ±10 ms, con Mayús ±100 ms. Conservar los atajos de Inicio y Fin de la tabla del editor, I/O/L y sus campos. Se retiran los botones ±0,01 y ±0,1 de ambos extremos cuando funcionen las alternativas accesibles. Los controles de desplazamiento global permanecen.
- Los mensajes de límite se muestran junto al control y se anuncian al entrar en el límite, sin repetirlos en cada movimiento. El cabezal, los picos y los valores transitorios de arrastre carecen de anuncios continuos. Las acciones que mueven la vista conservan el foco y no cambian la línea elegida.

#### Bloquear enunciado

- En el panel C, junto a «Escuchar al ajustar», añadir «Bloquear enunciado». Al marcar, guardar la posición anterior e iniciar un bucle desde el inicio audible de la línea seleccionada, con pista y velocidad actuales. Si falta inicio o el intervalo no intersecta la pista, mostrar el motivo junto a la casilla y mantenerla inactiva. La línea y los límites actualizados durante el arrastre se reflejan en el bucle. Si un ajuste deja el cabezal fuera de un intervalo aún válido, vuelve a su inicio audible. Si durante el arrastre el intervalo provisional deja de ser audible, pausar temporalmente y mantener el bucle armado. Si vuelve a ser audible o se cancela el gesto, restaurar la reproducción previa al tramo inaudible, incluido su estado de pausa, con los límites que correspondan. Si se confirma un intervalo inaudible, terminar el bucle, restaurar la posición previa en pausa y explicar el motivo.
- Espacio pausa o reanuda el bucle salvo cuando el control enfocado consume la tecla. Buscar dentro de la línea conserva el bucle. Buscar fuera lo desactiva y respeta el destino solicitado. Desmarcar la casilla, cambiar de línea o pulsar Esc fuera del gesto termina el bucle y restaura la posición previa en pausa. Esc primero cierra el diálogo o popover enfocado, restaura el campo si está editándose o cancela el arrastre. Solo después puede terminar el bucle o salir del editor.
- El modo al ritmo y «Probar a pantalla completa» usan su propio flujo de reproducción. Al iniciarlos, terminar el bucle antes de cambiar de modo. «Escuchar al ajustar» conserva su valor durante el bucle y muestra «Disponible al salir del bucle». Fuera del bucle y con reproducción en pausa, se aplica la escucha de comprobación una sola vez al confirmar el arrastre, con los fragmentos y restauración del MVP.

#### Zoom, vista general y picos de voz

- Ctrl/Cmd + rueda sobre el eje local acerca o aleja con ancla en el instante bajo el puntero, salvo al topar con un extremo. «Acercar» y «Alejar» ofrecen el mismo cambio de escala con teclado. «Zoom a la línea» encaja la porción audible de la selección con margen. «Ver canción completa» muestra toda la duración. «Centrar en el cabezal» mantiene la escala y desplaza la vista hasta el instante actual.
- El desplazamiento horizontal de la rueda o del trackpad y Mayús + rueda desplazan la ventana. El rectángulo de «Vista general» representa el intervalo visible. Arrastrarlo o usar flechas con su foco desplaza a escala constante. El control anuncia los tiempos inicial y final visibles. La vista general conserva regla y regiones aun sin forma de onda. El cabezal sigue el audio sin seguimiento automático de la ventana. Zoom, paneo y redimensionamiento conservan posición de audio, selección e historial.
- «Forma de onda de la voz» muestra siempre los picos de la pista separada, aunque se escuche Original o Instrumental. Con separación pendiente, explicar la disponibilidad. Tras separar, mostrar «Preparando forma de onda…» mientras se calculan los picos. Si falla, «Forma de onda no disponible» con «Reintentar» cuando haya pista de voz y sea recuperable. El reintento genera solo la forma de onda. Regla, regiones, marcadores y zoom siguen disponibles en estos estados. La onda y su equivalente en la vista general son decorativos para tecnologías de asistencia. La resolución de picos se adapta al zoom sin cambiar el reloj del audio.

#### Microcopy añadido

| Identificador | Texto |
|---|---|
| `edi.timeline.titulo` | Línea de tiempo |
| `edi.timeline.regla` | Posición en la línea de tiempo |
| `edi.timeline.inicio` | Inicio de la línea |
| `edi.timeline.fin` | Fin de la línea |
| `edi.timeline.fin.auto` | Fin de la línea (automático) |
| `edi.timeline.bucle` | Bloquear enunciado |
| `edi.timeline.bucle.sinInicio` | Fija primero el inicio de la línea. |
| `edi.timeline.bucle.fuera` | Esta línea queda fuera del audio. |
| `edi.timeline.escucha.ocupada` | Disponible al salir del bucle. |
| `edi.timeline.zoom.mas` | Acercar |
| `edi.timeline.zoom.menos` | Alejar |
| `edi.timeline.zoom.linea` | Zoom a la línea |
| `edi.timeline.zoom.sinInicio` | Fija el inicio para acercar esta línea. |
| `edi.timeline.zoom.todo` | Ver canción completa |
| `edi.timeline.zoom.cabezal` | Centrar en el cabezal |
| `edi.timeline.vistaGeneral` | Vista general |
| `edi.timeline.vistaGeneral.intervalo` | De {inicio} a {fin} visibles |
| `edi.timeline.voz` | Forma de onda de la voz |
| `edi.timeline.voz.pendiente` | Disponible cuando termine la separación. |
| `edi.timeline.voz.generando` | Preparando forma de onda… |
| `edi.timeline.voz.error` | Forma de onda no disponible. |
| `edi.timeline.voz.reintentar` | Reintentar |

#### Criterios de aceptación de fase 2

1. A 1024 × 640 y con zoom de interfaz al 150 %, se puede alcanzar el transporte, la línea de tiempo y el panel. Los dos tiradores son alcanzables con teclado y distinguibles al coincidir visualmente. La regla busca y las regiones seleccionan sin alterar el cabezal.
2. Ajustar ambos extremos con ratón, campos y teclado respeta las vecinas, pausas y offset. Probar borde fuera de pista, fin automático sin cambio y un arrastre cancelado. Un arrastre confirmado crea una edición deshacible y, cuando proceda, un único aviso por consecuencia.
3. Activar el bucle reproduce desde el inicio audible. Probar pausa, cambio de límites mientras suena, cabezal fuera del nuevo intervalo, intento con intervalo inaudible y salida por Esc, cambio de selección y búsqueda externa. Probar un arrastre que vuelve provisionalmente inaudible la región. Al cancelar, el bucle conserva los límites y el estado de reproducción anteriores. Al confirmar un intervalo inaudible, se desactiva y vuelve a la posición previa en pausa. Confirmar que la escucha de comprobación opera una sola vez por ajuste fuera del bucle.
4. El zoom conserva el tiempo bajo el puntero hasta topar con un extremo. Zoom a la línea, ver todo, centrar, paneo y rectángulo de vista general funcionan con teclado sin mover el cabezal. Al redimensionar mientras suena, la onda y regiones siguen alineadas con el eje.
5. Probar separación pendiente, generación, fallo y reintento de picos. Cambiar la pista de escucha no cambia la procedencia de la onda. Con una pista larga de prueba, interactuar con zoom y marcadores mientras suena y comprobar que conserva posición y que se redibuja la porción visible según el nivel de detalle.

### Subfase 2.1 · Layout adaptable y paneles

Origen: Bug 2 del [reporte de Windows](../versiones/0.2.0/reporte-editor-fase-2.md) y [plan, subfase 2.1](../versiones/0.2.0/plan-2.md#subfase-21--estabilización-del-editor). Esta sección **sustituye** a los wireframes A y B, a la nota de columnas de A, a la frase «En el ancho reducido del editor, la zona de sincronía admite desplazamiento vertical…» de la segunda fase y a la última viñeta de «Accesibilidad» (1024 × 640 y zoom 150 %). El resto de la spec no cambia: no se añade ninguna función de edición; solo se reorganiza el espacio y se añaden divisores, modos minimizados y su persistencia.

#### Unidades y tamaños de prueba

- Todas las medidas de esta sección son **píxeles CSS a zoom de interfaz 100 %** (1 rem = 16 px). Se implementan en `rem` para que escalen con el zoom de Electron.
- Los tamaños de ventana del reporte son el **área de contenido** de la ventana en píxeles físicos. El viewport CSS = físico ÷ escala de Windows:

| Ventana (físico) | Escala | Viewport CSS | Modo de altura |
|---|---|---|---|
| 1280 × 720 | 100 % | 1280 × 720 | Compacto |
| 1280 × 720 | 125 % | 1024 × 576 | Compacto |
| 1720 × 1440 | 100 % | 1720 × 1440 | Normal |
| 1720 × 1440 | 125 % | 1376 × 1152 | Normal |
| 1920 × 1080 | 100 % | 1920 × 1080 | Normal |
| 1920 × 1080 | 125 % | 1536 × 864 | Normal |

- **Modo compacto de altura**: viewport con alto < 800 px CSS (800 es el alto de referencia de sistema-visual §4). Es un punto de corte fijo, no depende de los tamaños guardados.
- **Mínimo de diseño**: 1024 × 576 px CSS. A partir de ahí el editor cabe completo y sin scroll de página. Ver «Por debajo del mínimo».

#### Distribución

El editor ocupa exactamente el alto que queda bajo la barra de la app (56 px): `alto del editor = 100vh − 56 px`. La página (`html`/`body` y el contenedor de la vista) **nunca** hace scroll, ni vertical ni horizontal. Solo tienen scroll interno la **lista de líneas** y el **contenido del panel** (Sincronía o Estilo).

```
┌ Barra de la app (56) ──────────────────────────────────────────────────────────────┐
├────────────────────────────────────────────────────────────────────────────────────┤
│ ‹ Biblioteca │ «Bohemian Rhapsody» · Queen  [✎ Borrador] ✓ Guardado      [⟲][⟳][⋯]  │ CABECERA
│   (1)✓ Fuente ── (2)✓ Separación ── (3)✓ Letra ── (4)● Editor                       │
├──────────────────────┬─┬────────────────────────────────┬─┬────────────────────────┤
│ Líneas 48/52 sinc. [«]│⋮│          Vista previa          │⋮│[Sincronía|Estilo•]  [»]│ ZONA
│ ┌──────────────────┐ │ │   ┌────────────────────────┐   │ │ ┌────────────────────┐ │ SUPERIOR
│ │ (scroll propio)  │ │ │   │          16:9          │   │ │ │  (scroll propio)   │ │
│ │                  │ │ │   └────────────────────────┘   │ │ │                    │ │
│ └──────────────────┘ │ │  [⛶ Probar a pantalla completa] │ │ └────────────────────┘ │
│ Corregir la letra    │ │                                │ │                        │
├──────────────────────┴─┴──────────────── ⋯ ─────────────┴─┴────────────────────────┤ divisor del dock
│ [⏮][▶] 01:12.4 / 05:55 ━━━━━●━━┃━━┃━━━━━━━━━━━━━━  Velocidad [0,5×|0,75×|1×] 🔊━━━ │ DOCK:
│ Escuchar [Original|Voz|Instrumental]        [◉ Sincronizar al ritmo (S)] [Marcar como lista] │ transporte
│ Línea de tiempo [−][+][Zoom a la línea][Ver canción completa][Centrar en el cabezal] [⌄] │ línea
│ Regla · Voz · Líneas · Vista general                                                 │ de tiempo
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Márgenes del editor**: 16 px a izquierda y derecha; arriba 12 px (8 px en compacto); abajo 0 (el dock llega al borde de la ventana con su propio relleno). Es una excepción a los márgenes de vista de sistema-visual §4: el editor es una herramienta de trabajo a ventana llena.

**Cabecera**
- Normal: la cabecera actual en dos filas (≈ 96 px).
- Compacta (alto < 800): **una fila de 48 px**: ‹ Biblioteca · título · artista (con «…» y el texto completo en `title`) · insignia · indicador de guardado · stepper compacto · ⟲ ⟳ ⋯. El stepper compacto muestra los cuatro círculos de estado y solo la etiqueta del paso actual; las demás etiquetas siguen en su nombre accesible y en un tooltip. La navegación del stepper no cambia.

**Zona superior** (tres columnas en fila; el alto es el sobrante tras cabecera y dock)

| Columna | Ancho por defecto | Mínimo | Máximo | Contenido |
|---|---|---|---|---|
| Lista de líneas | 300 px (18,75 rem) | 256 px (16 rem) | 480 px (30 rem) | Fila de título (título, contador y botón «Minimizar», una sola fila, 32 px), banner (si lo hay) y filas dentro del **mismo** scroll, pie «Corregir la letra» (32 px). |
| Vista previa | El resto | 320 px (20 rem) | — | Encabezado «Vista previa» (en compacto, solo para lectores de pantalla), lienzo 16:9 y «Probar a pantalla completa». |
| Panel | 360 px (22,5 rem) | 300 px (18,75 rem) | 480 px (30 rem) | Fila de pestañas «Sincronía / Estilo» con el botón «Minimizar» (36 px) y el contenido de la pestaña con scroll propio. |

- **Vista previa**: el lienzo es el mayor rectángulo 16:9 que cabe en la columna descontando su encabezado (si es visible) y el botón; queda **centrado en horizontal y en vertical** dentro del hueco y el botón va justo debajo, centrado y con el ancho del lienzo (mínimo el de su texto). Fuera del lienzo solo hay fondo de la columna, sin bordes ni huecos vacíos fijos.
- El alto mínimo de la zona superior es **136 px** (8,5 rem): fila de título, al menos una fila de línea y el pie. El banner de la lista (`edi.banner.sinsync`, `edi.banner.yasync`) se desplaza con las filas: nunca reduce la lista por debajo de una fila visible.
- Entre columnas hay un **divisor** de 12 px (ver «Divisores»), en lugar del hueco actual de 16 px.

**Dock inferior** (`fondo-1`, borde superior `borde`, relleno 8 px; 4 px en compacto)
- **Transporte, siempre dos filas** desde 1024 px de ancho, sin partirse:
  - Fila 1: ⏮ · ▶/❚❚ · tiempo · barra de tiempo (ocupa el ancho libre, mínimo 240 px) · Velocidad · volumen.
  - Fila 2: Escuchar · (hueco flexible) · «Sincronizar al ritmo (S)» · primario («Marcar como lista» / «Hecho»).
  - «Cargando audio…» sustituye al tiempo de la fila 1 (sin fila extra).
  - Alto: 36 px por fila (96 px con relleno); en compacto, controles de 32 px (80 px). 32 px sigue siendo el objetivo mínimo de sistema-visual §4.
- **Línea de tiempo** (solo en la pestaña Sincronía, como hasta ahora): fila de controles en una línea (título, −, +, Zoom a la línea, Ver canción completa, Centrar en el cabezal y, a la derecha, «Minimizar»), regla 32 px, pista de voz y líneas, vista general 32 px.
  - Pista de voz y líneas: **76 px por defecto**, **48 px mínimo**. Es lo único que crece cuando el usuario agranda el dock.
  - Alto de la sección: 216 px por defecto (204 px en compacto); mínimo 188 px (176 px en compacto).
- En la pestaña **Estilo** no hay línea de tiempo: el dock es solo el transporte, no hay divisor del dock y la zona superior ocupa el resto. El alto guardado de la línea de tiempo no cambia y se vuelve a aplicar al regresar a Sincronía.
- **Modo «Sincronizar al ritmo»**: el banner E ocupa el lugar de la línea de tiempo (que en el modo está inactiva); durante el modo la línea de tiempo se muestra **minimizada** (minimapa y cabezal) bajo el banner y la fila 2 del transporte conserva solo «Escuchar». Si el dock es más bajo que lo que necesita el banner (≈ 140 px), crece temporalmente sin bajar la zona superior de 136 px. Al salir del modo vuelven el alto y el estado anteriores. Nada de esto se guarda como preferencia.

#### Qué cede primero cuando falta espacio

Las preferencias guardadas son **tamaños preferidos**; lo que se dibuja es el **tamaño efectivo**, calculado en cada redimensionado de la ventana en este orden, sin modificar la preferencia:

**Alto**
1. La zona superior (y con ella la vista previa) se reduce hasta 136 px.
2. La pista de voz se reduce desde su alto preferido hasta 48 px.
3. Con alto < 800 se aplica además el modo compacto (cabecera de una fila, controles de dock de 32 px, márgenes menores, encabezado de la vista previa solo para lectores).
4. Si aún no cabe, la línea de tiempo pasa a **minimizada por falta de espacio** (estado temporal, ver «Modos minimizados»).
5. Si con la línea de tiempo minimizada sigue sin caber, se aplica «Por debajo del mínimo».

Con los valores por defecto: a 1024 × 576 la zona superior mide ≈ 150 px y la línea de tiempo se ve completa; a 1280 × 720, ≈ 300 px; a 1536 × 864, ≈ 356 px.

**Ancho**
1. La vista previa se reduce hasta 320 px.
2. La lista se reduce hasta 256 px.
3. El panel se reduce hasta 300 px.
4. A 1024 px de ancho los tres mínimos y los divisores caben (256 + 320 + 300 + 24 + 32 de márgenes = 932 px). Un panel minimizado libera su ancho para la vista previa.

**Por debajo del mínimo** (viewport < 1024 px de ancho o alto insuficiente incluso con la línea de tiempo minimizada, ≈ < 400 px; solo ocurre con zoom de interfaz o escala ≥ 150 %):
- Por ancho: se usa la disposición B anterior (una columna izquierda con pestañas y la vista previa a la derecha), sin divisores entre columnas ni modos minimizados de lista y panel. El dock y su divisor se mantienen.
- Se permite **scroll vertical de la página**; nunca horizontal. Ningún control queda cortado ni superpuesto.
- Las preferencias guardadas no cambian.

#### Divisores

Tres divisores: **lista ↔ vista previa**, **vista previa ↔ panel** y **zona superior ↔ dock** (este último solo en Sincronía).

| Aspecto | Lista ↔ vista previa | Vista previa ↔ panel | Zona superior ↔ dock |
|---|---|---|---|
| Controla | Ancho de la lista | Ancho del panel | Alto de la línea de tiempo |
| `aria-orientation` | `vertical` | `vertical` | `horizontal` |
| Cursor | `col-resize` | `col-resize` | `row-resize` |
| Agrandar con | → | ← | ↑ |
| Reducir con | ← | → | ↓ |
| Por defecto | 300 px | 360 px | 216 px (204 en compacto) |
| Mínimo | 256 px | 300 px | 188 px (176 en compacto) |
| Máximo | mín(480 px, lo que deje 320 px a la vista previa) | mín(480 px, lo que deje 320 px a la vista previa) | lo que deje 136 px a la zona superior |

**Aspecto**: franja de 12 px (zona de agarre completa) con una línea centrada de 1 px `borde` y un agarre de puntos `⋮` (o `⋯` en el horizontal) de 16 px en `texto-3`, centrado, con objetivo de 24 × 24 px. *Hover*: línea de 2 px `borde-control`. Arrastrando: línea de 2 px `acento-texto`. Foco de teclado (`:focus-visible`): línea de 2 px `foco` y anillo estándar de sistema-visual §7 alrededor de la franja.

**Ratón**
- Arrastrar redimensiona en vivo (captura de puntero; durante el arrastre el cursor se mantiene en toda la ventana y no se selecciona texto). El tamaño se detiene en el mínimo y en el máximo efectivos; minimizar nunca ocurre por arrastre.
- **Esc** durante el arrastre lo cancela y devuelve el tamaño previo. Perder la captura confirma el último tamaño.
- **Doble clic**: restablece el tamaño por defecto de lo que controla y, si estaba minimizado, lo expande.
- Tooltip (a los 500 ms de *hover*): `edi.layout.divisor.tooltip`.

**Teclado** (patrón *Window Splitter* de WAI-ARIA)
- `role="separator"`, enfocable (`tabindex="0"`), en el orden de tabulación entre los dos elementos que separa. `aria-controls` = id de la columna o sección que controla. `aria-label` según «Microcopy».
- `aria-valuenow` = tamaño efectivo en px de lo que controla; `aria-valuemin` / `aria-valuemax` = mínimo y máximo efectivos actuales. `aria-valuetext` = `edi.layout.valor` («300 píxeles») o `edi.layout.valor.minimizado`.
- Flechas de su eje: ±16 px. **Mayús** + flecha: ±64 px. **Inicio**: mínimo. **Fin**: máximo efectivo. **Intro**: minimiza o expande lo que controla (alternar). Con el foco en el divisor, las cuatro flechas son del divisor: las del otro eje no hacen nada (en particular, ↑/↓ en un divisor vertical **no** cambian de línea). Espacio y el resto de atajos del editor siguen funcionando.
- Cada cambio por teclado se aplica al instante y lo anuncia el propio `aria-valuetext`; no hay anuncios extra.

**Restablecer todo**: menú ⋯ de la cabecera → `edi.layout.restablecer`. Devuelve los tres tamaños por defecto, expande todo y anuncia `edi.layout.anuncio.restablecida`. El foco vuelve al botón ⋯.

#### Modos minimizados

Minimizar **nunca oculta**: cada panel queda como una barra compacta con sus controles rápidos. Los modos son independientes y combinables.

**Lista minimizada** — riel vertical de **72 px** a la izquierda:
```
┌──────┐
│ [»]  │  Expandir lista de líneas
│  12  │  número de la línea seleccionada (t-subtitulo)
│ de 52│  (t-pequeno, texto-2)
│00:04.│  tiempo mostrado (t-tiempo; "--:--" sin inicio)
│  20  │
│ [↑]  │  Línea anterior (↑)
│ [↓]  │  Línea siguiente (↓)
│ [I]  │  Fijar inicio aquí (I)
└──────┘
```
- La línea mostrada es la **seleccionada** (la que edita el panel). El texto de la línea va en el tooltip y en el nombre accesible del indicador (`edi.layout.riel.linea`). Con ▶ (línea que suena) distinta de la seleccionada no se muestra nada extra: la vista previa ya la enseña.
- ↑/↓ y «I» hacen exactamente lo mismo que sus atajos (que siguen funcionando con el riel). «I» respeta los límites y muestra el tooltip de límite junto al botón.
- El contador, el banner y «Corregir la letra» no están en el riel: se recuperan al expandir.

**Panel minimizado** — riel vertical de **120 px** a la derecha:
```
┌──────────┐
│ [«]      │  Expandir panel
│ Inicio   │  (t-pequeno, texto-2)
│ 00:04.20 │  (t-tiempo, solo lectura)
│ Fin      │
│ 00:07.85 │  en texto-2 + "automático" debajo si es automático
│[Fijar fin│  Fijar fin aquí (O)
│   (O)]   │
│ ☐ Bloquear│ casilla "Bloquear enunciado" (etiqueta en dos renglones)
│ enunciado│
└──────────┘
```
- Los valores de Inicio/Fin son de **solo lectura**: para escribirlos hay que expandir. «Fijar fin (O)» y la casilla se comportan como en el panel completo (inactivos sin inicio, con el motivo `edi.timeline.bucle.sinInicio` / `edi.fin.sininicio` en tooltip; inactivos en el modo sincronizar).
- El riel siempre muestra los controles de Sincronía, aunque la última pestaña fuese Estilo. Al expandir, vuelve la pestaña que estaba activa. El punto `aviso` de contraste se muestra sobre el botón «Expandir panel» mientras haya algún ⚠ (con el nombre accesible `edi.layout.panel.expandir.aviso`).

**Línea de tiempo minimizada** — fila de **44 px** (40 en compacto) en el dock, bajo el transporte:
```
│ [⌃] Línea de tiempo  ├──────[▓ intervalo visible ▓]────┃──────────────────────┤ │
```
- Contiene el botón «Expandir línea de tiempo», la etiqueta «Línea de tiempo» y el **minimapa** de la vista general (mini regiones, rectángulo del intervalo visible y cabezal) a todo el ancho restante.
- El minimapa minimizado solo informa y busca: un clic busca a ese instante (como la barra del transporte); el rectángulo **no** se arrastra. Es `aria-hidden` porque la barra de tiempo del transporte es su equivalente accesible.
- El intervalo visible, el zoom y la selección se conservan al minimizar y expandir (expandir **no** centra en el cabezal).
- **Minimizada por falta de espacio** (paso 4 de «Qué cede primero»): la fila es la misma, el botón «Expandir línea de tiempo» queda `aria-disabled="true"` con el tooltip `edi.layout.timeline.sinEspacio`, y no se guarda como preferencia. Al haber espacio otra vez, vuelve sola al estado preferido. Si el foco estaba dentro de la línea de tiempo, pasa al botón «Expandir línea de tiempo» y se anuncia `edi.layout.anuncio.sinEspacio`.

**Cómo se minimiza y se expande**
- Botón icono en la cabecera de cada panel: lista `[«]` (`panel-left-close` / `panel-left-open`), panel `[»]` (`panel-right-close` / `panel-right-open`), línea de tiempo `[⌄]` / `[⌃]` (`chevron-down` / `chevron-up`). Son 32 × 32 px, con tooltip y `aria-expanded` + `aria-controls`.
- **Intro** en el divisor correspondiente alterna el estado. Con el panel minimizado, su divisor sigue enfocable: Intro, una flecha que agrande o un arrastre lo expanden (arrastrando, el tamaño parte del mínimo y sigue al puntero).
- Doble clic en el divisor: expande con el tamaño por defecto.
- No hay atajo de una tecla para minimizar (evita choques con los atajos de sincronía).

**Foco al cambiar de modo**
- Con el botón del panel: el foco pasa al botón equivalente del otro modo («Minimizar» → «Expandir» del riel o la fila, y al revés), en la misma posición visual.
- Con Intro o doble clic en un divisor: el foco se queda en el divisor.
- Si el elemento enfocado deja de existir por otro motivo (p. ej. «Restablecer distribución» o falta de espacio), el foco va al botón «Expandir»/«Minimizar» del panel afectado; nunca queda en `body`.
- Lista minimizada: «Saltar al contenido» y el foco inicial de entrada (cuando correspondía a la lista) van al botón «Expandir lista de líneas».

**Anuncios** (`aria-live="polite"`, la región del editor ya existente, una vez por cambio): `edi.layout.anuncio.minimizado` / `edi.layout.anuncio.expandido` con el nombre del panel; `edi.layout.anuncio.sinEspacio`; `edi.layout.anuncio.restablecida`. Las regiones conservan su *landmark* y nombre añadiendo el estado: «Lista de líneas, minimizada», «Panel, minimizado», «Línea de tiempo, minimizada».

#### Panel angosto: «Desplazamiento de toda la letra»

Corrige el título duplicado y el salto de renglón del reporte:
```
│ Desplazamiento de toda la letra                    │  h3, una sola vez
│ [−0,1 s] [ +0,00 ] [+0,1 s] [↺]                    │  una sola fila, nunca se parte
│ Úsalo si toda la letra va adelantada o atrasada…   │
```
- El título visible aparece **una sola vez** (el `h3`). El grupo lleva `role="group"` con `aria-labelledby` al `h3`. El campo **no** tiene etiqueta visible propia; su nombre accesible es `edi.offset.campo` («Segundos de desplazamiento») y su ayuda (`aria-describedby`) es `edi.offset.ayuda`.
- Fila única: −0,1 s (botón) · campo de 5,5 rem (88 px) con la unidad implícita · +0,1 s · **Restablecer** como botón icono `rotate-ccw` 36 × 36 con tooltip y nombre `edi.offset.restablecer` (inactivo con 0). Total ≈ 264 px: cabe en el panel a su mínimo (300 px con scroll reservado). Ningún control de esta fila pasa a otra línea entre 300 y 480 px de ancho.
- Los mensajes de error y de límite del campo (`edi.offset.rango`) van debajo de la fila, sin moverla.
- Regla general del panel: en todo su rango de anchos (300–480 px) ningún encabezado se repite como etiqueta visible del control que encabeza, y las filas de botones del panel (Inicio, Fin, desplazamiento) no se parten salvo que el panel diga lo contrario.

#### Persistencia (preferencia global)

- Se guardan **para todas las canciones** (no en `cancion.json`): ancho preferido de la lista, ancho preferido del panel, alto preferido de la línea de tiempo y los tres estados minimizado/expandido. Dónde y cómo se escriben lo decide el arquitecto (p. ej. junto a `config.reproductor.volumen`).
- Valores por defecto: lista 300 px expandida, panel 360 px expandido, línea de tiempo 216 px expandida.
- Se guarda al **soltar** un arrastre, tras una ráfaga de teclado (≈ 500 ms sin cambios), al minimizar o expandir y al restablecer. Nunca durante el arrastre.
- Se guardan los **tamaños preferidos** (en px a zoom 100 %), no los efectivos. Si la preferencia no cabe en la ventana actual, se dibuja el tamaño efectivo recortado según «Qué cede primero» **sin sobrescribir** la preferencia; al agrandar la ventana se recupera el tamaño preferido. Solo una acción del usuario sobre ese divisor o panel cambia la preferencia (y entonces se guarda el valor que el usuario ve).
- El estado temporal «minimizada por falta de espacio», el dock del modo sincronizar y la disposición de «Por debajo del mínimo» **no** se guardan.
- Una preferencia ausente, ilegible o fuera de rango (menor que el mínimo o mayor que el máximo absoluto) se sustituye por el valor por defecto de ese campo, sin aviso.
- Ni minimizar ni redimensionar entran en el historial de deshacer ni marcan la canción como modificada.

#### Seguimiento del cabezal

Se mantiene la regla de la segunda fase: **el intervalo visible es independiente del audio**. Al reproducir, el cabezal avanza y puede salir de la vista; la vista solo se mueve con «Centrar en el cabezal», zoom, paneo o la vista general. Minimizar, expandir o redimensionar la línea de tiempo tampoco la mueve. Si se decide un seguimiento automático, lo recogerá esta spec tras la respuesta a [0051](../preguntas/0051-seguimiento-automatico-del-cabezal.md).

#### Microcopy añadido (subfase 2.1)

| Clave | Texto |
|---|---|
| `edi.layout.divisor.lista` | Ancho de la lista de líneas |
| `edi.layout.divisor.panel` | Ancho del panel |
| `edi.layout.divisor.dock` | Alto de la línea de tiempo |
| `edi.layout.divisor.tooltip` | Arrastra para cambiar el tamaño. Doble clic: tamaño original. |
| `edi.layout.valor` | {n} píxeles |
| `edi.layout.valor.minimizado` | Minimizado · (femenino: lista, línea de tiempo) Minimizada |
| `edi.layout.lista.minimizar` / `edi.layout.lista.expandir` | Minimizar lista de líneas · Expandir lista de líneas |
| `edi.layout.panel.minimizar` / `edi.layout.panel.expandir` | Minimizar panel · Expandir panel |
| `edi.layout.panel.expandir.aviso` | Expandir panel (hay avisos de contraste) |
| `edi.layout.timeline.minimizar` / `edi.layout.timeline.expandir` | Minimizar línea de tiempo · Expandir línea de tiempo |
| `edi.layout.timeline.sinEspacio` | No cabe en esta ventana. Agrándala para ver la línea de tiempo completa. |
| `edi.layout.riel.linea` | Línea {n} de {total}, {tiempo}: {texto} · (sin inicio) Línea {n} de {total}, sin sincronizar: {texto} |
| `edi.layout.riel.anterior` / `edi.layout.riel.siguiente` | Línea anterior (↑) · Línea siguiente (↓) |
| `edi.layout.riel.fijarinicio` | Fijar inicio aquí (I) |
| `edi.layout.riel.fijarfin` | Fijar fin (O) — nombre accesible: Fijar fin aquí (O) |
| `edi.layout.riel.auto` | automático |
| `edi.layout.restablecer` | Restablecer distribución de paneles |
| `edi.layout.anuncio.minimizado` | {Panel} minimizado · (femenino) {Panel} minimizada |
| `edi.layout.anuncio.expandido` | {Panel} expandido · (femenino) {Panel} expandida |
| `edi.layout.anuncio.sinEspacio` | La línea de tiempo se ha minimizado porque no cabe en la ventana. |
| `edi.layout.anuncio.restablecida` | Distribución de paneles restablecida. |
| `edi.layout.region.minimizada` | {Región}, minimizada · (masculino) {Región}, minimizado |
| `edi.offset.campo` | Segundos de desplazamiento |
| `edi.offset.restablecer` | Restablecer desplazamiento (0,00 s) |

Nombres de panel en anuncios y regiones: «Lista de líneas» (f.), «Panel» (m.), «Línea de tiempo» (f.).

#### Criterios de aceptación de la subfase 2.1

Matriz de verificación: los seis viewports de «Unidades y tamaños de prueba» (1280 × 720, 1720 × 1440 y 1920 × 1080, cada uno a escala 100 % y 125 %), en Electron, con una canción de prueba de ≥ 60 líneas, separación completada y picos listos, salvo que el criterio diga otra cosa.

**Distribución**
1. En los seis viewports, con los valores por defecto, en las pestañas Sincronía y Estilo, en pausa, reproduciendo 5 s y tras redimensionar la ventana (crecer y encoger): `document.documentElement.scrollHeight <= innerHeight` y `scrollWidth <= innerWidth`. Ningún elemento de la vista sobresale del viewport (`getBoundingClientRect()` dentro de `[0, innerWidth] × [0, innerHeight]`).
2. Cabecera, las tres columnas, el transporte (dos filas) y la línea de tiempo completa son visibles a la vez en los seis viewports sin minimizar nada. El título del panel y el campo Inicio se ven sin desplazar el panel.
3. Solo la lista de líneas y el contenido del panel tienen scroll propio; con 60 líneas, la lista hace scroll y la página no. Todo control del panel (Sincronía y Estilo) es visible o alcanzable con el scroll del panel.
4. El lienzo de la vista previa mantiene 16:9 (± 1 px) y está centrado en su hueco (diferencia entre márgenes izquierdo y derecho, y entre superior e inferior, ≤ 1 px); «Probar a pantalla completa» queda justo debajo del lienzo.
5. Con alto < 800 se aplica el modo compacto (cabecera de una fila de 48 px con el stepper compacto, controles del dock de 32 px). A 1280 × 720 y 1024 × 576 la zona superior mide ≥ 136 px y muestra al menos una fila de línea, el título de la lista y «Corregir la letra».
6. Las dos filas del transporte y la fila de controles de la línea de tiempo no se parten en ningún viewport de la matriz; la barra de tiempo mide ≥ 240 px.
7. En la pestaña Estilo no hay línea de tiempo ni divisor del dock y la zona superior ocupa el alto liberado; al volver a Sincronía se recupera el alto anterior de la línea de tiempo.
8. En el modo sincronizar, el banner E y la línea de tiempo minimizada caben en el dock sin scroll de página en los seis viewports; al salir vuelven el alto y el estado anteriores, sin cambiar la preferencia guardada.

**Divisores**
9. Arrastrar cada divisor cambia su tamaño en vivo y se detiene en los mínimos (lista 256, panel 300, línea de tiempo 188/176 px) y en los máximos efectivos (vista previa ≥ 320 px, zona superior ≥ 136 px, lista y panel ≤ 480 px). Esc durante el arrastre restaura el tamaño previo.
10. Cada divisor tiene `role="separator"`, `aria-orientation`, `aria-controls`, `aria-label` de «Microcopy» y `aria-valuenow`/`aria-valuemin`/`aria-valuemax` iguales a los px efectivos; `aria-valuetext` dice «{n} píxeles» o «Minimizado/Minimizada».
11. Con el foco en un divisor: las flechas de su eje cambian 16 px (64 px con Mayús) en el sentido de la tabla; Inicio y Fin llevan al mínimo y al máximo; Intro minimiza y expande; ↑/↓ en un divisor vertical no cambian la línea seleccionada; Espacio sigue reproduciendo/pausando.
12. Doble clic en un divisor devuelve el tamaño por defecto (y expande si estaba minimizado). «Restablecer distribución de paneles» del menú ⋯ devuelve los tres tamaños por defecto, expande todo, lo anuncia y deja el foco en ⋯.
13. Los divisores muestran cursor `col-resize`/`row-resize`, línea de *hover* y de arrastre, y anillo de foco visible solo con teclado; el objetivo de agarre mide ≥ 12 px en su eje.

**Modos minimizados**
14. La lista minimizada (riel de 72 px) muestra número, total y tiempo de la línea seleccionada; ↑/↓ del riel y de teclado cambian la selección saltando pausas; «I» del riel fija el inicio en la posición actual con los mismos límites y avisos que el atajo.
15. El panel minimizado (riel de 120 px) muestra Inicio y Fin de la línea seleccionada (Fin con «automático» si lo es), «Fijar fin (O)» fija el fin y la casilla «Bloquear enunciado» inicia y termina el bucle igual que en el panel; ambos quedan inactivos sin inicio o en el modo sincronizar, con su motivo. Con un aviso de contraste, el botón «Expandir panel» lleva el punto `aviso` y su nombre accesible lo dice.
16. La línea de tiempo minimizada (fila de 44/40 px) muestra minimapa, intervalo visible y cabezal en movimiento al reproducir; un clic en el minimapa busca. Expandirla conserva el intervalo visible, el zoom y la selección.
17. Minimizar y expandir funcionan con el botón de cada panel y con Intro en su divisor; el foco sigue las reglas de «Foco al cambiar de modo» (nunca queda en `body`) y cada cambio se anuncia una vez con `edi.layout.anuncio.*`.
18. Con una ventana en la que la línea de tiempo no cabe ni a su mínimo (p. ej. 1024 × 500 CSS), se minimiza sola, su botón queda `aria-disabled` con `edi.layout.timeline.sinEspacio`, se anuncia, y al agrandar la ventana vuelve expandida sin que la preferencia guardada haya cambiado.
19. Por debajo de 1024 px de ancho (zoom de interfaz 150 % en una ventana de 1280 × 720) se usa la disposición B, hay como mucho scroll vertical de página, nunca horizontal, y ningún control queda cortado.

**Panel angosto**
20. Con el panel a 300, 360 y 480 px, la fila del desplazamiento (−0,1 s · campo · +0,1 s · Restablecer) está en un solo renglón (mismo `top` para los cuatro controles), el texto «Desplazamiento de toda la letra» aparece una sola vez en pantalla, el campo tiene el nombre accesible `edi.offset.campo` y el grupo se anuncia con el título. Restablecer está inactivo con 0 y deja el valor en 0.

**Persistencia**
21. Tras cambiar los tres tamaños y minimizar dos paneles, cerrar y volver a abrir la app (y abrir otra canción) muestra los mismos tamaños y estados.
22. Con una preferencia guardada mayor que lo que cabe (p. ej. lista 480 y panel 480 a 1024 px de ancho, o línea de tiempo de 600 px a 1280 × 720), se dibuja recortada sin scroll de página; la preferencia guardada no cambia hasta que el usuario actúa sobre ese divisor, y al agrandar la ventana se recupera.
23. Una preferencia ausente, corrupta o fuera de rango arranca con los valores por defecto sin error visible. Redimensionar o minimizar no crea pasos de deshacer ni cambia el indicador de guardado de la canción.

**Sin regresiones**
24. El seguimiento de la línea que suena en la lista, la selección desde la línea de tiempo, los tiradores, el zoom, el bucle y los atajos de la tabla del editor funcionan igual con cualquier combinación de tamaños y modos; la vista de la línea de tiempo no sigue sola al cabezal.

**Capturas de revisión**
25. Se guardan en `docs/ux/revision-fase-2.1/` en PNG con el nombre `editor-{ancho}x{alto}-{escala}-{estado}.png` (tamaño físico, p. ej. `editor-1280x720-125-defecto.png`). Como mínimo, para los seis viewports: `defecto` (Sincronía) y `estilo`; y a 1280 × 720 al 100 % y al 125 %: `lista-min`, `panel-min`, `timeline-min`, `todo-min`, `sync` (modo sincronizar) y `foco-divisor`. Además, `panel-300` con la fila del desplazamiento y `bajo-minimo` (disposición B). Cada captura muestra la ventana completa, sin recortes.

## Fase 3 de 0.2.0 · Temas y biblioteca

Origen: [plan, fase 3, feature 5](../versiones/0.2.0/plan-2.md#5-temas-guardables--l) y decisión del usuario en [0047](../preguntas/0047-temas-asignados-edicion-y-borrado.md). Modelo de datos, resolución y escritura del catálogo: [ADR 0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md). Detalles de interfaz acordados con el arquitecto: [0054](../preguntas/0054-detalles-de-interfaz-de-temas-y-biblioteca.md). Esta sección se ocupa del **panel Estilo**. La Biblioteca (agrupación, selección múltiple, tema de artista y álbum desde sus encabezados) está en [02 · Fase 3](02-biblioteca.md#fase-3-de-020--temas-y-biblioteca) y el tema predeterminado y la gestión del catálogo en [08 · Fase 3](08-ajustes-y-acerca.md#fase-3-de-020--temas-y-biblioteca).

**Sustituye**: los dos botones del final del wireframe D, las filas «Restablecer estilo predeterminado» y «Usar este estilo en canciones nuevas» de la tabla «Estilo (panel D)», la frase de «Deshacer y rehacer» sobre «Usar este estilo en canciones nuevas», el criterio 32 y las claves `edi.estilo.reset`, `edi.estilo.predet` y `edi.estilo.predet.toast`. «Volver a heredar» cumple el papel de «Restablecer» y el predeterminado se elige en Ajustes. El resto del panel (controles de fondo y letra, aviso de contraste y sus acciones rápidas) no cambia. **Respeta la [subfase 2.1](#subfase-21--layout-adaptable-y-paneles)**: todo vive dentro del contenido del panel, con su scroll propio, entre 300 y 480 px de ancho; nada añade scroll de página.

### Conceptos y procedencia

Una canción está en uno de dos **modos**:
- **Temas definidos** (vínculo vivo): su aspecto es el de un tema del catálogo. Si alguien edita ese tema y confirma, la canción cambia en la próxima reproducción.
- **Tema personalizado** (copia propia): su aspecto es un estilo guardado solo en la canción. Ningún tema lo cambia.

En «Temas definidos», el tema efectivo se resuelve en main con esta precedencia. La **procedencia** es el nivel que la da y siempre se muestra en texto:

| Nivel | Cuándo | Procedencia (`tema.origen.*`) | Corta (tarjeta, `tema.origen.corta.*`) |
|---|---|---|---|
| Canción | La canción tiene un tema asignado | Asignado a esta canción | propio |
| Álbum | Su álbum (de su artista) tiene tema | Del álbum «{álbum}» de {artista} | del álbum |
| Artista | Su artista tiene tema | Del artista {artista} | del artista |
| Al azar | Se creó sin predeterminado y recibió un tema al azar del catálogo | Elegido al azar al crear la canción | al azar |
| Predeterminado anterior | Seguía el tema predeterminado cuando se quitó en Ajustes («Ninguno…») y lo conserva, vinculado | Tema predeterminado anterior | predeterminado anterior |
| Estilo incluido | Se creó con el catálogo vacío | Estilo incluido de Shinobi Karaoke | incluido |
| Predeterminado | Hay tema predeterminado en Ajustes y la canción no tiene base fijada | Tema predeterminado | predeterminado |

Las tres filas «Al azar», «Predeterminado anterior» y «Estilo incluido» son la **base** fijada en la canción (ADR 0016 §2): están al mismo nivel y sustituyen al predeterminado global solo para esa canción. Sin base, se usa el predeterminado; sin base ni predeterminado, el estilo incluido (misma procedencia y texto que la fila «Estilo incluido»).

Correspondencia con las procedencias que entrega main (ADR 0016 §3): `cancion` → Canción · `album` → Álbum · `artista` → Artista · `aleatorio` → Al azar · `predeterminado_anterior` → Predeterminado anterior (`tema.origen.anterior`) · `incluido` → Estilo incluido · `predeterminado` → Predeterminado · `propio` → Tema personalizado · `respaldo` → Tema no disponible. El renderer no calcula procedencias: solo las traduce.

Dos casos más:
- **Tema personalizado**: procedencia `tema.origen.personalizado`. Es el caso de **todas las canciones de 0.1.0** al abrirlas por primera vez: conservan su estilo como copia propia y su aspecto no cambia (plan: «la herencia se activa por decisión explícita»).
- **Tema no disponible** (procedencia `respaldo`): la canción apunta a un tema que no está en el catálogo (carpeta copiada de otro equipo, catálogo restaurado de una copia anterior, catálogo apartado por ilegible, o su tema «al azar» o «predeterminado anterior» ya no existe) o el catálogo está en solo lectura. Se muestra con el aspecto de respaldo guardado en la canción. No es un borrado: si el tema vuelve a aparecer en el catálogo, la canción lo vuelve a usar sin hacer nada. Un tema **borrado** desde la app nunca deja canciones en este estado (se convierten antes en «Tema personalizado», ver «Eliminar tema»).

«Al azar» y «Estilo incluido» quedan fijados al crear la canción y no cambian al reabrirla. Al cambiar el predeterminado en Ajustes (decisión del usuario en [0052](../preguntas/0052-predeterminado-y-canciones-que-dependen-de-el.md): A1, B1, C1; detalle en [08 · Fase 3](08-ajustes-y-acerca.md#fase-3-de-020--temas-y-biblioteca)):
- de un tema a otro, las canciones con «Tema predeterminado» pasan al nuevo;
- de un tema a «Ninguno…», esas canciones **conservan** el tema que usaban, siguen vinculadas a él (editarlo las cambia) y su procedencia pasa a «Tema predeterminado anterior». Su aspecto y su portada no cambian;
- elegir un predeterminado nuevo **no** cambia las canciones con base fijada («al azar», «predeterminado anterior» o «estilo incluido»).

«Volver a heredar», «Temas definidos» y elegir un tema conservan la base: una canción con «predeterminado anterior» a la que se asigna y luego se quita un tema vuelve a «Tema predeterminado anterior». Para cambiar de golpe varias de estas canciones está «Aplicar tema…» en la Biblioteca.

### Wireframes del panel Estilo

**D1 — Temas definidos** (estado más habitual)
```
│ Tema                                              │  h3
│ ◉ Temas definidos                                 │  grupo de radio vertical
│   Usa un tema y recibe sus cambios.               │  (t-pequeno, texto-2)
│ ○ Tema personalizado                              │
│   Estilo propio solo para esta canción.           │
│ ───────────────────────────────────────────       │
│ [▣ Noche ninja                              ▾ ]   │  selector de tema (muestra + nombre)
│ Del álbum «A Night at the Opera» de Queen         │  procedencia (t-pequeno, texto-2)
│ Lo usan 12 canciones.                             │  (t-pequeno, texto-3)
│ [Personalizar]  [Editar tema]  [⋯]                │  una fila; ⋯ = «Más acciones del tema»
│ ───────────────────────────────────────────       │
│ Fondo   ▰▰▰ Degradado · 135°                      │  resumen de solo lectura
│ Letra   Atkinson Hyperlegible Next                │
│         ■ Letra #FFFFFF   ■ Lo ya cantado #FFD400 │
│ ───────────────────────────────────────────       │
│ ✓ Buen contraste                                  │
```
Con el tema **asignado a esta canción**, la procedencia es «Asignado a esta canción» y debajo aparece:
```
│ Asignado a esta canción                           │
│ [Volver a heredar]                                │
│ Usará «Neón», del artista Queen.                  │  `tema.heredar.destino`
```
Si el destino es `respaldo` (la base de la canción apunta a un tema que no está en el catálogo; [0056](../preguntas/0056-destino-respaldo-y-canciones-pendientes.md)):
```
│ Asignado a esta canción                           │
│ [Volver a heredar]                                │
│ ⚠ Su tema de origen no está en tus temas. Se verá │  `tema.heredar.destino.respaldo`
│ con el último aspecto guardado en esta canción    │  (⚠ en `aviso`, texto en `texto-2`)
│ («Tema no disponible»).                           │
```
Con el catálogo **vacío** (y procedencia «Estilo incluido»), en lugar del selector: `tema.catalogo.vacio` y solo [Personalizar].

**D2 — Tema personalizado**
```
│ Tema                                              │
│ ○ Temas definidos                                 │
│ ◉ Tema personalizado                              │
│ Estilo propio de esta canción. Los cambios no     │
│ afectan a ningún tema.                            │
│ [Guardar como tema nuevo…]                        │
│ ───────────────────────────────────────────       │
│ Fondo … Letra … (controles completos del wireframe D, sin los dos botones finales) │
│ aviso de contraste con sus acciones rápidas       │
```

**D3 — Editando un tema** (tras «Editar tema»)
```
│ ┌ ✎ Editando el tema «Noche ninja» ───────────┐   │  aviso en línea `info`
│ │ Lo usan 12 canciones. Los cambios se ven en   │   │
│ │ esta vista previa y no se aplican hasta que   │   │
│ │ los guardes.                                  │   │
│ └───────────────────────────────────────────────┘   │
│ Fondo … Letra … (controles completos)             │
│ aviso de contraste con sus acciones rápidas       │
│ ══════════════ pie fijo del panel ══════════════  │
│ [Guardar en el tema…]  [Descartar cambios]        │
│ [Guardar como tema nuevo…]                        │
```
- El grupo «Temas definidos / Tema personalizado», el selector y ⋯ quedan inactivos (`inert`) mientras dura la edición; el banner explica por qué.
- El pie es fijo dentro del panel (no se desplaza con el contenido) mientras el contenido del panel mida ≥ 200 px de alto; por debajo (disposición «Por debajo del mínimo»), el pie va al final del contenido y se alcanza con el scroll del panel. Dos filas de 36 px; los botones no se parten.

**D4 — Tema no disponible**
```
│ ┌ ⚠ Tema no disponible ─────────────────────────┐ │  aviso en línea `aviso`
│ │ Esta canción usaba «Atardecer», que no está en │ │
│ │ tus temas (quizá viene de otro equipo o de una │ │
│ │ copia). Se ve con el aspecto que tenía.        │ │
│ │ [Guardar como tema nuevo…]                     │ │
│ │ [Usar como tema personalizado]                 │ │
│ └────────────────────────────────────────────────┘ │
│ [▣ «Atardecer» (no disponible)              ▾ ]   │  elegir otro tema lo sustituye
│ Fondo … Letra … (resumen de solo lectura)         │
```
Si la canción no guarda el nombre del tema, el texto usa `tema.noDisponible.sinNombre`.

### Componentes e interacciones

| Elemento | Comportamiento |
|---|---|
| **Modo** (grupo de radio «Temas definidos» / «Tema personalizado») | Vertical, con una descripción por opción (cabe a 300 px; un control segmentado no cabría). Flechas ↑/↓ cambian de opción como en cualquier grupo de radio. Pasar a **Tema personalizado** = «Personalizar». Pasar a **Temas definidos** desde personalizado: la canción vuelve a heredar (sin tema asignado) y se descarta su estilo propio; un paso de deshacer y toast `tema.toast.definidos` con [Deshacer]. Sin confirmación: se puede deshacer durante la visita. |
| **Selector de tema** | Lista desplegable con los temas del catálogo por orden alfabético (comparación del idioma, sin distinguir mayúsculas ni tildes). Cada opción: muestra 16:9 de 48 × 27 px (fondo del tema con «Aa» en su fuente y color de letra, ver sistema visual) + nombre + etiqueta «Predeterminado» si lo es. Elegir un tema lo **asigna a esta canción** (vínculo vivo), sin confirmación (solo afecta a esta canción): vista previa en < 100 ms, autoguardado y un paso de deshacer. Elegir el tema que ya resuelve por herencia también lo asigna (la procedencia pasa a «Asignado a esta canción»). Búsqueda por tecleo como un `select`. |
| **Procedencia** | Texto `tema.origen.*` bajo el selector, con nombres de álbum y artista tal como se ven en la Biblioteca. Se actualiza en vivo si cambian la asignación de álbum o artista, el predeterminado o los metadatos de la canción. Va en el nombre accesible del selector (`aria-describedby`). |
| **Usos** | `tema.usos` con el recuento efectivo de canciones que hoy resuelven a ese tema (main; excluye personalizadas y las que usan otro tema por mayor precedencia). Se actualiza en vivo. |
| **Volver a heredar** | Solo con «Asignado a esta canción». Quita la asignación y conserva la base: la canción usa lo que dé su álbum, su artista, su base («al azar», «predeterminado anterior», «estilo incluido»), el predeterminado o el respaldo. Debajo, `tema.heredar.destino` dice qué tema usará antes de pulsarlo (con `alHeredar` del resumen vivo; ADR 0016 §3). Un paso de deshacer. Foco tras pulsarlo: el selector. **Destino `respaldo`** ([0056](../preguntas/0056-destino-respaldo-y-canciones-pendientes.md)): el botón sigue activo y sin confirmación (se deshace con Ctrl/Cmd + Z), pero la línea pasa a `tema.heredar.destino.respaldo`, con ⚠ en color `aviso`. No se nombra ningún tema: con esta procedencia se ignora `alHeredar.temaNombre`. Tras pulsarlo, el panel pasa a D4 y se anuncia `tema.anuncio.heredar.respaldo`; el foco va al selector de D4. |
| **Personalizar** | Copia el estilo **efectivo** actual a la canción y pasa a «Tema personalizado» (D2). El aspecto no cambia. Ningún tema cambia. Un paso de deshacer. Anuncio `tema.anuncio.personalizado`. Foco: el radio «Tema personalizado». Disponible también con el catálogo vacío y en «Tema no disponible» (`tema.noDisponible.personalizar`, mismo efecto). |
| **Editar tema** | Entra en D3 sobre el tema efectivo (no disponible si la procedencia es «Estilo incluido» o «Tema no disponible»: no hay tema que editar). Los controles parten del tema guardado. Los cambios forman un **borrador de tema en memoria**: se ven en la vista previa y en «Probar a pantalla completa», no se escriben en ningún sitio y la canción sigue vinculada al tema. Foco: el banner (`tabindex="-1"`), que se anuncia. |
| **Guardar en el tema…** (D3) | Abre la confirmación de impacto `tema.dialogo.guardar` (ver «Diálogos»). Al confirmar, se escribe el tema y el editor sale de D3 en «Temas definidos» con el aspecto nuevo. Toast `tema.toast.guardado`. |
| **Descartar cambios** (D3) | Sin confirmación si el borrador no tiene cambios; con cambios, `tema.dialogo.descartar`. Vuelve a D1 con el tema sin tocar. Foco: «Editar tema». |
| **Guardar como tema nuevo…** | En D2, D3 y D4. Abre `tema.dialogo.nuevo` (pide el nombre). Crea un tema con el estilo visible (D2: el estilo propio; D3: el borrador; D4: el aspecto de respaldo). **No cambia la canción**: en D3 el editor sale de la edición, descarta el borrador y la canción sigue con el tema original; en D2 sigue personalizada; en D4 sigue igual. Tras crear, aparece el aviso en línea `tema.nuevo.creado` con [Usar «{nuevo}» en esta canción], que es el **paso explícito** para aplicarlo (asigna el tema a la canción, un paso de deshacer). El foco va a ese botón. El aviso se cierra con ✕, al cambiar de modo o de tema, o al salir del editor. |
| **⋯ Más acciones del tema** (D1) | Menú contextual: «Renombrar tema…», «Duplicar tema…», separador, «Tema del álbum…», «Tema del artista…», separador, «Administrar temas…», separador, «Eliminar tema…» (destructivo, al final). Las tres primeras actúan sobre el tema efectivo; con «Estilo incluido» o «Tema no disponible» solo quedan las de álbum, artista y administrar. |
| **Renombrar tema…** | `tema.dialogo.renombrar`. No cambia el aspecto de ninguna canción, así que no pide confirmación de impacto. Toast `tema.toast.renombrado`. |
| **Duplicar tema…** | `tema.dialogo.duplicar` (nombre propuesto `tema.nombre.copia`). Crea una copia sin usos. Mismo aviso en línea `tema.nuevo.creado` que «Guardar como tema nuevo…». |
| **Eliminar tema…** | `tema.dialogo.eliminar` (ver «Diálogos»). Si la canción abierta estaba entre las afectadas, al terminar pasa a D2 con su aspecto de siempre; foco en el radio «Tema personalizado» y anuncio `tema.anuncio.eliminado.esta`. Si no, foco en el selector. |
| **Tema del álbum… / Tema del artista…** | Abre el diálogo de asignación de grupo, el mismo de la Biblioteca ([02 · Fase 3](02-biblioteca.md#tema-de-un-artista-o-de-un-álbum)), para el álbum o el artista de esta canción. Sin álbum (o sin artista): opción `aria-disabled` con el motivo `tema.grupo.sinAlbum` / `tema.grupo.sinArtista` en tooltip. Un álbum sin artista tampoco admite tema (`tema.grupo.albumSinArtista`). |
| **Administrar temas…** | Va a Ajustes, sección Temas ([08 · Fase 3](08-ajustes-y-acerca.md#fase-3-de-020--temas-y-biblioteca)), tras vaciar el guardado como cualquier salida. Desde ahí «‹ Volver al editor» regresa a esta canción. |
| **Resumen de solo lectura** (D1, D4) | «Fondo»: muestra del fondo (48 × 27) + «Sólido» o «Degradado · {ángulo}°». «Letra»: nombre de la fuente en su propia fuente + dos muestras de 16 px con su nombre y hex. Texto seleccionable, no son controles. |
| **Aviso de contraste en D1 y D4** | Se evalúa igual que siempre y conserva el punto `aviso` en la pestaña. Las acciones rápidas («Usar letra blanca», «Sugerir un color de resaltado») cambiarían el estilo, así que en D1/D4 se sustituyen por `tema.contraste.ayuda` con [Personalizar] y (en D1) [Editar tema]. En D2 y D3 las acciones rápidas funcionan como antes (en D3 cambian el borrador). |
| **Portada en la Biblioteca** | Consecuencia sin aviso: ver [02 · Fase 3](02-biblioteca.md#tarjeta-tema-y-portada) (sustituye a la fila «Portada en la Biblioteca» de la tabla del panel D). |

**Deshacer y rehacer**
- Entran en el historial de la visita (un paso cada uno): elegir tema, «Volver a heredar», «Personalizar», volver a «Temas definidos», «Usar «{nuevo}» en esta canción», «Usar como tema personalizado» y, **dentro de D3**, cada cambio del borrador.
- **No** entran (como antes «Usar este estilo en canciones nuevas»): guardar en el tema, crear, renombrar, duplicar y eliminar temas, el tema de álbum o artista. Todos pasan por diálogo.
- Al salir de D3 (guardar, descartar o guardar como nuevo), los pasos del borrador se retiran del historial: Ctrl/Cmd + Z ya no los rehace ni deshace.
- Si un tema deja de existir (eliminado desde este editor), se retiran del historial los pasos que lo asignarían. Ctrl/Cmd + Z nunca vuelve a vincular la canción a un tema borrado. El resto del historial se conserva.

**Salir con un borrador de tema**
- Cualquier salida del editor (‹ Biblioteca, Esc, stepper, «Corregir la letra», «Marcar como lista», «Hecho», «Administrar temas…», Ctrl/Cmd + , o N) con D3 abierto y cambios en el borrador muestra `tema.dialogo.salir`: [Seguir editando] (foco inicial, = Esc) · [Descartar cambios del tema] · [Guardar en el tema…] (abre la confirmación de impacto; al confirmar, se sale). Es la **segunda** confirmación de salida del editor, junto a `edi.dialogo.salir`; si ambas aplican, primero esta.
- «Probar a pantalla completa» no sale del editor: usa el borrador sin preguntar.
- Cerrar la ventana con un borrador de tema muestra el mismo diálogo (viable según ADR 0016 §10: el renderer declara guardado pendiente mientras el borrador tenga cambios y main espera la confirmación). «Descartar cambios del tema» cierra la app; «Guardar en el tema…» confirma, guarda y cierra; «Seguir editando» cancela el cierre. Un cierre forzado por el sistema pierde el borrador.

**Instantánea de reproducción**: un tema guardado se aplica a las reproducciones que **empiezan** después. Una reproducción ya en marcha (y, en fases posteriores, una exportación o una sesión en otra ventana) conserva el aspecto con el que empezó hasta terminar esa canción. La confirmación de impacto lo dice cuando main informa de una sesión en marcha (`tema.dialogo.guardar.sesion`).

### Diálogos

Todos con el componente «Diálogo modal» de sistema-visual §6: atrapan el foco, Esc = cancelar y devuelven el foco al disparador salvo que se indique otra cosa.

**Confirmar impacto — `tema.dialogo.guardar`** (también lo usan «Tema del álbum/artista…» y el cambio de predeterminado con su propio texto)
```
┌ ¿Guardar los cambios en «Noche ninja»? ───────────────┐
│ Cambiará el aspecto de 12 canciones, incluida esta.   │
│ · 3 lo tienen asignado                                │
│ · 7 lo heredan de su álbum o artista                  │
│ · 2 lo usan como tema predeterminado                  │
│ (si hay) · 1 lo recibió al azar                       │
│ (si hay) · 4 lo conservan como predeterminado anterior│
│ [▸ Ver las canciones]                                 │  revelador: lista de «título — artista»
│ No cambian las canciones con tema personalizado ni    │
│ las que usan otro tema.                               │
│ (si hay sesión) Lo que ya se está reproduciendo       │
│ seguirá con el aspecto anterior hasta que termine.    │
│        [Cancelar] [Guardar como tema nuevo…] [Guardar en «Noche ninja»] │
└───────────────────────────────────────────────────────┘
```
- Recuento y desglose los calcula main al abrir el diálogo (`temas.previsualizar`, `ImpactoIpc.desglose`). Correspondencia de líneas, en este orden: `cancion` → «lo tienen asignado»; `album` + `artista` → «lo heredan de su álbum o artista» (una sola línea, suma de los dos); `predeterminado` → «lo usan como tema predeterminado»; `aleatorio` → «lo recibieron al azar»; `predeterminadoAnterior` → «lo conservan como predeterminado anterior» (línea propia, no se suma a la del predeterminado). Las líneas con 0 no se muestran. Si queda una sola línea, se muestra igual (el usuario ve por qué cuenta). Los campos `propio`, `respaldo` e `incluido` del desglose no aparecen en este diálogo (no pueden resolver a un tema que se edita); los usa la Biblioteca.
- **Foco inicial en «Cancelar»** (cambio masivo; el usuario pidió protegerse de guardar por error). «Guardar como tema nuevo…» cierra este diálogo y abre el del nombre.
- Lista revelable: hasta 8 filas visibles con scroll propio, ordenadas por título. Es `role="list"`; el botón revelador lleva `aria-expanded`.
- **Confirmación obsoleta**: el diálogo se abre con `temas.previsualizar` y confirma con `temas.ejecutar` (ADR 0016 §7). Si main responde `CONFIRMACION_OBSOLETA` (p. ej. terminó de crearse una canción que hereda el tema, o se editaron datos), no se ha guardado nada: el diálogo toma el impacto nuevo que viene con el error, actualiza recuento y desglose y muestra arriba el aviso `error`/alerta `tema.obsoleto`. El foco se queda en el botón pulsado. Hay que confirmar otra vez.
- **Error de escritura**: el diálogo se cierra, el borrador sigue en D3 intacto y aparece el toast `tema.toast.error` con [Reintentar] (vuelve a abrir la confirmación) y [Copiar detalles]. El tema y las canciones no cambian.
- **El tema ya no existe**: `tema.error.noExiste` en el diálogo con [Guardar como tema nuevo…] y [Cancelar].

**Nombre del tema — `tema.dialogo.nuevo` / `tema.dialogo.duplicar` / `tema.dialogo.renombrar`**
```
┌ Guardar como tema nuevo ─────────────────────────────┐
│ Nombre del tema                                       │
│ [ Noche ninja (copia)                             ]   │  texto preseleccionado
│ Se creará un tema nuevo. «Noche ninja» y las          │  ayuda según origen
│ canciones que lo usan no cambian.                     │
│                              [Cancelar] [Crear tema]  │
└───────────────────────────────────────────────────────┘
```
- Propuesta: D3 y duplicar `tema.nombre.copia`; D2 `tema.nombre.cancion`; D4 el nombre guardado del tema no disponible (o `tema.nombre.cancion`). Si la propuesta ya existe se añade « 2», « 3»… hasta que sea única.
- Validación al confirmar y en vivo tras el primer intento: vacío → `tema.nombre.vacio`; repetido (misma identidad: NFC, espacios colapsados y sin distinguir mayúsculas, **conservando tildes**) → `tema.nombre.repetido`. Máximo 60 caracteres (`maxlength`, contador solo a partir de 50). Intro confirma. Error con borde `error` y `aria-describedby`.
- Renombrar: título `tema.dialogo.renombrar`, botón «Renombrar», sin ayuda de impacto; si el nombre no cambia, el botón cierra sin escribir.
- La comprobación en vivo es orientativa; la autoridad es main. Si al confirmar responde `TEMA_NOMBRE_DUPLICADO` (también al renombrar, o porque el nombre pasó a estar repetido entre abrir y confirmar), el diálogo sigue abierto, muestra `tema.nombre.repetido` en el campo y devuelve el foco al campo con el texto seleccionado. Nombres de 1 a 60 caracteres tras recortar espacios.

**Eliminar tema — `tema.dialogo.eliminar`**
```
┌ ¿Eliminar el tema «Noche ninja»? ─────────────────────┐
│ 12 canciones lo usan. Conservarán su aspecto actual   │
│ como tema personalizado y dejarán de estar vinculadas │
│ a «Noche ninja».                                      │
│ [▸ Ver las canciones]                                 │
│ También se quitará de 1 artista y 2 álbumes.          │  si los hay
│ (si es el predeterminado) Las canciones nuevas        │
│ recibirán un tema al azar hasta que elijas otro tema  │
│ predeterminado en Ajustes.                            │
│ No se puede deshacer.                                 │
│                          [Cancelar] [Eliminar tema]   │  destructivo; foco en Cancelar
└───────────────────────────────────────────────────────┘
```
- El recuento es **efectivo** (las canciones que hoy resuelven a ese tema por cualquier nivel); las que tienen tema personalizado u otro tema de mayor precedencia no cuentan y no cambian. Con 0: `tema.eliminar.cero`.
- Mientras se aplica: el botón pasa a «Eliminando…» (cargando) y, si hay más de 5 canciones, se muestra bajo el texto `tema.eliminar.progreso` («Guardando el aspecto de 4 de 12 canciones…»), con `{i}`/`{n}` del evento `temas:progreso` (`hechas`/`total` de la ficha del diálogo; ADR 0016 §7). `total` puede superar al recuento del diálogo porque incluye canciones que solo pierden su base sin cambiar de aspecto: se muestra el `total` del evento. Región `role="status"` que se anuncia al empezar y al terminar, no en cada paso. No se puede cancelar a medias.
- **Éxito**: se cierra y toast `tema.toast.eliminado`. Foco según dónde se lanzó (editor: ver la tabla; Ajustes: ver 08).
- **Escritura interrumpida**: el tema **sigue en el catálogo** en «borrado pendiente» (ADR 0016 §8) y el diálogo muestra `tema.eliminar.parcial` con la **lista de lo que falta** (ver «Lista de canciones tras un fallo a mitad», abajo), [Reintentar] (`temas.reanudarBorrado`: repite solo lo pendiente y luego retira el tema), [Cancelar el borrado] (`temas.cancelarBorrado`: el tema vuelve a estar disponible; las ya convertidas siguen como «Tema personalizado» con el mismo aspecto; toast `tema.toast.borradoCancelado`) y [Cerrar] (deja el borrado pendiente; se retoma desde Ajustes › Temas, ver [08](08-ajustes-y-acerca.md#fase-3-de-020--temas-y-biblioteca)). Las canciones ya convertidas quedan como «Tema personalizado» con su mismo aspecto: no hay cambio visible.
- **Confirmación obsoleta**: como en `tema.dialogo.guardar` (`tema.obsoleto`).

**Lista de canciones tras un fallo a mitad** ([0056](../preguntas/0056-destino-respaldo-y-canciones-pendientes.md)). La usan `tema.eliminar.parcial` (eliminar desde el editor o desde Ajustes, y «Terminar de eliminar» / [Reintentar], que llaman a `temas.reanudarBorrado`) y `aj.temas.ninguno.parcial` (spec 08). Estas operaciones se detienen en el primer fallo, así que el resultado (ADR 0016 §7) trae una canción `error` y el resto `pendiente`.
```
┌ ¿Eliminar el tema «Noche ninja»? ─────────────────────┐
│ No se pudo terminar: falló al guardar «La flaca» y    │  `tema.eliminar.parcial` (role="alert")
│ el borrado se detuvo. Faltan 3 canciones por          │
│ conservar su aspecto. El tema no se eliminará hasta   │
│ que se guarden todas.                                 │
│ ✕ La flaca — Jarabe de Palo · No se pudo guardar.     │
│                                    [Copiar detalles]  │
│ – Lucía — Sin artista · Pendiente                     │  `texto-3`
│ – Vivir — Queen · Pendiente                           │
│ Las pendientes no se intentaron porque el proceso se  │  `tema.parcial.notaPendientes` (`texto-3`)
│ detuvo en el fallo. Reintentar las guarda todas.      │
│        [Reintentar] [Cancelar el borrado] [Cerrar]    │
└───────────────────────────────────────────────────────┘
```
- Se listan **solo** las canciones `error` y `pendiente`, en el orden del resultado (la que falló, primero). Las `aplicada` no se listan.
- Fila `error`: ✕ en `error` + «{título} — {artista}» + `tema.parcial.fila.error` + [Copiar detalles] (copia el `codigo` de esa canción, sin rutas, como el resto de «Copiar detalles»).
- Fila `pendiente`: – en `texto-3` + «{título} — {artista}» + `tema.parcial.fila.pendiente`, todo en `texto-3`. Sin [Copiar detalles]: no hay error que copiar.
- `tema.parcial.notaPendientes` solo aparece si hay al menos una `pendiente`.
- El texto principal usa `{f}` = número de filas de la lista (`error` + `pendiente`), no «{k} de {n}». Así el texto sigue siendo cierto en los reintentos, donde main recalcula el conjunto y `n` ya no es el del primer intento.
- La lista es `role="list"`. El nombre accesible de cada fila incluye su estado, porque los símbolos son decorativos (`aria-hidden`): «La flaca — Jarabe de Palo, no se pudo guardar», «Lucía — Sin artista, pendiente». Hasta 8 filas visibles con scroll propio.
- Al aparecer, el texto principal se anuncia una vez (`role="alert"`) y el foco va a [Reintentar]. Si [Reintentar] vuelve a fallar, la lista y el texto se sustituyen por los del intento nuevo.

**Descartar — `tema.dialogo.descartar`**: «¿Descartar los cambios del tema?» «Los cambios que has hecho en «{tema}» no se guardarán. El tema y las canciones que lo usan no cambian.» [Seguir editando] (foco) [Descartar cambios] (destructivo).

### Estados

| Estado | Presentación |
|---|---|
| Temas definidos, heredado | D1 con la procedencia del nivel. |
| Temas definidos, asignado | D1 con «Asignado a esta canción», [Volver a heredar] y `tema.heredar.destino`. |
| Tema personalizado | D2. Canciones de 0.1.0 al abrirlas por primera vez. |
| Editando tema | D3; punto `info` en la pestaña «Estilo» y en «Expandir panel» si está minimizado, con nombre accesible `tema.pestana.editando`. |
| Catálogo vacío | D1 sin selector: `tema.catalogo.vacio`; solo [Personalizar]. |
| Estilo incluido | D1 con procedencia «Estilo incluido de Shinobi Karaoke»; selector con el marcador «Estilo incluido» (no es una opción); sin «Editar tema». |
| Tema no disponible | D4. |
| Catálogo apartado por ilegible | Main lo aparta y empieza uno nuevo (ADR 0016 §1). Las canciones que apuntaban a temas perdidos se ven en D4. Sin aviso extra en el editor; el aviso está en Ajustes (`aj.temas.apartado`). |
| Catálogo en solo lectura (`TEMAS_SOLO_LECTURA`) | Aviso `aviso` en lugar del selector: `tema.soloLectura`. Las canciones con tema se ven con su respaldo (D4 sin acciones de catálogo). Se puede personalizar; «Editar tema», el selector, ⋯ y «Guardar como tema nuevo…» quedan inactivos con ese motivo. |
| Tema en borrado pendiente (`BORRADO_PENDIENTE`) | El tema sigue resolviendo, pero no se ofrece en el selector. Si es el efectivo de esta canción: D1 con aviso `tema.borradoPendiente` y «Administrar temas…»; «Editar tema», renombrar, duplicar y eliminar inactivos con ese motivo. |
| Guardando tema | Botón del diálogo en «cargando»; el indicador de guardado de la cabecera **no** cambia (es del archivo de la canción). |
| Bloqueado por modo sincronizar | Como hoy: el panel Estilo no se abre durante el modo. |

### Accesibilidad
- Sección con `h3` «Tema». El grupo de modo es `role="radiogroup"` con nombre «Modo del tema»; cada descripción va en `aria-describedby` de su radio.
- El selector de tema anuncia nombre del tema y procedencia; cada opción, «{nombre}, predeterminado» cuando aplique. Las muestras son decorativas (`aria-hidden`).
- Anuncios `aria-live="polite"` (región del editor) solo en hitos: asignar, heredar, personalizar, entrar y salir de D3, tema guardado, creado, renombrado y eliminado. El aviso `tema.obsoleto` es `role="alert"`.
- Foco tras acciones destructivas o que hacen desaparecer el control: definido en la tabla; nunca queda en `body`.
- Contraste: los textos nuevos usan `texto-2`/`texto-3` sobre `fondo-1` (≥ 4,5:1, sistema-visual §2).

### Microcopy (fase 3, editor)

| Clave | Texto |
|---|---|
| `tema.titulo` | Tema |
| `tema.modo` | Modo del tema |
| `tema.modo.definidos` | Temas definidos — Usa un tema y recibe sus cambios. |
| `tema.modo.personalizado` | Tema personalizado — Estilo propio solo para esta canción. |
| `tema.selector` | Tema |
| `tema.selector.predeterminado` | Predeterminado |
| `tema.origen.cancion` | Asignado a esta canción |
| `tema.origen.album` | Del álbum «{álbum}» de {artista} |
| `tema.origen.artista` | Del artista {artista} |
| `tema.origen.predeterminado` | Tema predeterminado |
| `tema.origen.azar` | Elegido al azar al crear la canción |
| `tema.origen.anterior` | Tema predeterminado anterior |
| `tema.origen.incluido` | Estilo incluido de Shinobi Karaoke |
| `tema.origen.personalizado` | Estilo propio de esta canción. Los cambios no afectan a ningún tema. |
| `tema.origen.corta.*` | propio · del álbum · del artista · predeterminado · al azar · predeterminado anterior · incluido · (respaldo) no disponible |
| `tema.usos` | Lo usan {n} canciones. · (n = 1) Lo usa 1 canción. · (n = 0) Ninguna canción lo usa. |
| `tema.heredar` | Volver a heredar |
| `tema.heredar.destino` | Usará «{tema}», {procedencia en minúscula}. · (predeterminado anterior) Usará «{tema}», el tema predeterminado anterior. · (estilo incluido) Usará el estilo incluido de Shinobi Karaoke. |
| `tema.heredar.destino.respaldo` | ⚠ Su tema de origen no está en tus temas. Se verá con el último aspecto guardado en esta canción («Tema no disponible»). |
| `tema.personalizar` | Personalizar |
| `tema.editar` | Editar tema |
| `tema.mas` | Más acciones del tema |
| `tema.editando.titulo` | Editando el tema «{tema}» |
| `tema.editando.cuerpo` | Lo usan {n} canciones. Los cambios se ven en esta vista previa y no se aplican hasta que los guardes. |
| `tema.guardarEn` | Guardar en el tema… |
| `tema.descartar` | Descartar cambios |
| `tema.guardarNuevo` | Guardar como tema nuevo… |
| `tema.renombrar` / `tema.duplicar` / `tema.eliminar` | Renombrar tema… · Duplicar tema… · Eliminar tema… |
| `tema.album` / `tema.artista` | Tema del álbum… · Tema del artista… |
| `tema.administrar` | Administrar temas… |
| `tema.grupo.sinAlbum` | Esta canción no tiene álbum. Puedes añadirlo con «Editar datos» en la Biblioteca. |
| `tema.grupo.sinArtista` | Esta canción no tiene artista. Puedes añadirlo con «Editar datos» en la Biblioteca. |
| `tema.grupo.albumSinArtista` | Para dar un tema a este álbum, añade antes su artista. |
| `tema.catalogo.vacio` | Aún no tienes temas. Personaliza esta canción y usa «Guardar como tema nuevo…» para crear el primero. |
| `tema.soloLectura` | Tus temas se guardaron con una versión más nueva de Shinobi Karaoke y aquí no se pueden usar ni cambiar. Las canciones se ven con el aspecto guardado en cada una. Puedes personalizar esta canción. |
| `tema.borradoPendiente` | La eliminación de este tema quedó a medias. Termínala o cancélala en Ajustes › Temas. — [Administrar temas…] |
| `tema.toast.borradoCancelado` | Eliminación de «{tema}» cancelada. El tema sigue disponible; {k} canciones ya conservan su aspecto como tema personalizado. |
| `tema.eliminar.cancelar` | Cancelar el borrado |
| `tema.noDisponible.titulo` | Tema no disponible |
| `tema.noDisponible.cuerpo` | Esta canción usaba «{tema}», que no está en tus temas (quizá viene de otro equipo o de una copia). Se ve con el aspecto que tenía. |
| `tema.noDisponible.sinNombre` | Esta canción usaba un tema que no está en tus temas (quizá viene de otro equipo o de una copia). Se ve con el aspecto que tenía. |
| `tema.noDisponible.opcion` | «{tema}» (no disponible) |
| `tema.noDisponible.personalizar` | Usar como tema personalizado |
| `tema.contraste.ayuda` | Para corregirlo, personaliza esta canción o edita el tema. · (sin «Editar tema») Para corregirlo, personaliza esta canción. |
| `tema.nuevo.creado` | Tema «{nuevo}» creado. Esta canción sigue usando «{tema}». · (personalizada) Tema «{nuevo}» creado. Esta canción sigue con su tema personalizado. — [Usar «{nuevo}» en esta canción] |
| `tema.dialogo.guardar` | Título: ¿Guardar los cambios en «{tema}»? · Cuerpo: Cambiará el aspecto de {n} canciones[, incluida esta]. · Desglose: {a} lo tienen asignado · {b} lo heredan de su álbum o artista · {c} lo usan como tema predeterminado · {d} lo recibieron al azar · {e} lo conservan como predeterminado anterior · (cada línea con 1) 1 lo tiene asignado · 1 lo hereda de su álbum o artista · 1 lo usa como tema predeterminado · 1 lo recibió al azar · 1 lo conserva como predeterminado anterior · Nota: No cambian las canciones con tema personalizado ni las que usan otro tema. — [Cancelar] [Guardar como tema nuevo…] [Guardar en «{tema}»] |
| `tema.dialogo.guardar.uno` | (n = 1) Cambiará el aspecto de 1 canción[, que es esta]. |
| `tema.dialogo.guardar.sesion` | Lo que ya se está reproduciendo seguirá con el aspecto anterior hasta que termine. |
| `tema.verCanciones` | Ver las canciones · Ocultar las canciones |
| `tema.obsoleto` | Mientras confirmabas cambió qué canciones usan este tema. Revisa el nuevo recuento y confirma otra vez. |
| `tema.error.noExiste` | Este tema ya no existe. Puedes guardar tus cambios como un tema nuevo. |
| `tema.toast.guardado` | Tema «{tema}» guardado. |
| `tema.toast.error` | No se pudo guardar el tema. Tus cambios siguen aquí. — [Reintentar] [Copiar detalles] |
| `tema.dialogo.nuevo` | Título: Guardar como tema nuevo · Campo: Nombre del tema · Ayuda (D3): Se creará un tema nuevo. «{tema}» y las canciones que lo usan no cambian. · Ayuda (D2/D4): Se creará un tema con el aspecto de esta canción. La canción no cambia. — [Cancelar] [Crear tema] |
| `tema.dialogo.duplicar` | Título: Duplicar tema · Ayuda: La copia empieza igual que «{tema}». Ninguna canción la usa todavía. — [Cancelar] [Duplicar] |
| `tema.dialogo.renombrar` | Título: Renombrar tema · Campo: Nombre del tema — [Cancelar] [Renombrar] |
| `tema.nombre.copia` | {tema} (copia) |
| `tema.nombre.cancion` | Tema de «{título}» |
| `tema.nombre.vacio` | Escribe un nombre. |
| `tema.nombre.repetido` | Ya tienes un tema con ese nombre. |
| `tema.toast.creado` | Tema «{nuevo}» creado. |
| `tema.toast.renombrado` | Tema renombrado: «{nuevo}». |
| `tema.dialogo.eliminar` | Título: ¿Eliminar el tema «{tema}»? · Cuerpo: {n} canciones lo usan. Conservarán su aspecto actual como tema personalizado y dejarán de estar vinculadas a «{tema}». · Grupos: También se quitará de {x} artistas y {y} álbumes. · Predeterminado: Las canciones nuevas recibirán un tema al azar hasta que elijas otro tema predeterminado en Ajustes. · Cierre: No se puede deshacer. — [Cancelar] [Eliminar tema] |
| `tema.eliminar.uno` | (n = 1) 1 canción lo usa. Conservará su aspecto actual como tema personalizado y dejará de estar vinculada a «{tema}». |
| `tema.eliminar.cero` | Ninguna canción lo usa. |
| `tema.eliminar.progreso` | Guardando el aspecto de {i} de {n} canciones… |
| `tema.eliminar.parcial` | No se pudo terminar: falló al guardar «{título}» y el borrado se detuvo. Faltan {f} canciones por conservar su aspecto. El tema no se eliminará hasta que se guarden todas. · (f = 1) No se pudo terminar: falló al guardar «{título}». Falta esa canción por conservar su aspecto. El tema no se eliminará hasta que se guarde. — [Reintentar] [Cancelar el borrado] [Cerrar] |
| `tema.parcial.fila.error` | No se pudo guardar. — [Copiar detalles] |
| `tema.parcial.fila.pendiente` | Pendiente |
| `tema.parcial.notaPendientes` | Las pendientes no se intentaron porque el proceso se detuvo en el fallo. Reintentar las guarda todas. |
| `tema.toast.eliminado` | Tema «{tema}» eliminado. {n} canciones conservan su aspecto como tema personalizado. · (n = 0) Tema «{tema}» eliminado. |
| `tema.dialogo.descartar` | Título: ¿Descartar los cambios del tema? · Cuerpo: Los cambios que has hecho en «{tema}» no se guardarán. El tema y las canciones que lo usan no cambian. — [Seguir editando] [Descartar cambios] |
| `tema.dialogo.salir` | Título: Tienes cambios sin guardar en el tema «{tema}» · Cuerpo: Si sales ahora se perderán. Las canciones que usan el tema no cambian. — [Seguir editando] [Descartar cambios del tema] [Guardar en el tema…] |
| `tema.toast.definidos` | Esta canción usa ahora «{tema}» ({procedencia corta}). · (estilo incluido) Esta canción usa ahora el estilo incluido de Shinobi Karaoke. · (respaldo) Su tema de origen no está en tus temas: esta canción se ve con el último aspecto guardado en ella. — [Deshacer] |
| `tema.anuncio.asignado` | Tema «{tema}» asignado a esta canción. |
| `tema.anuncio.heredar` | Esta canción vuelve a heredar: usa «{tema}». · (estilo incluido) Esta canción vuelve a heredar: usa el estilo incluido de Shinobi Karaoke. |
| `tema.anuncio.heredar.respaldo` | Esta canción vuelve a heredar, pero su tema de origen no está en tus temas. Se ve con el último aspecto guardado. |
| `tema.anuncio.personalizado` | Tema personalizado. Los cambios solo afectan a esta canción. |
| `tema.anuncio.editando` | Editando el tema «{tema}». Los cambios no se aplican hasta que los guardes. |
| `tema.anuncio.eliminado.esta` | Tema eliminado. Esta canción conserva su aspecto como tema personalizado. |
| `tema.pestana.editando` | Estilo (editando un tema sin guardar) · Expandir panel (editando un tema sin guardar) |

### Criterios de aceptación de la fase 3 (editor)

**Modo y procedencia**
- T1. Una canción de esquema 1 se abre en «Tema personalizado» con el mismo estilo que tenía (comparación campo a campo) y la procedencia `tema.origen.personalizado`; ningún archivo cambia hasta que el usuario actúa.
- T2. Con una canción heredando, la procedencia muestra el nivel correcto en los cuatro niveles de la resolución (canción, álbum, artista, predeterminado) y en «al azar», «Tema predeterminado anterior» y «estilo incluido». Quitar sucesivamente asignación de canción, álbum y artista cambia procedencia, selector, usos y vista previa en vivo.
- T2b. Con una canción en «Tema predeterminado» que usa «Noche ninja», quitar el predeterminado en Ajustes (Ninguno…) deja la canción con el mismo aspecto y la procedencia `tema.origen.anterior`; editar y guardar «Noche ninja» la cambia (el diálogo de impacto la cuenta en la línea «lo conservan como predeterminado anterior»); elegir después otro predeterminado no la cambia. Asignarle otro tema y pulsar «Volver a heredar» (con `tema.heredar.destino` «Usará «Noche ninja», el tema predeterminado anterior.») la devuelve a esa procedencia.
- T3. Elegir un tema en el selector lo asigna a la canción sin diálogo, la vista previa cambia en < 100 ms, se autoguarda y Ctrl/Cmd + Z lo revierte. «Volver a heredar» quita la asignación y `tema.heredar.destino` dijo antes qué tema usaría.
- T4. «Personalizar» conserva el aspecto, pasa a D2 y ninguna edición posterior en D2 cambia el tema de origen ni otra canción (comprobar el archivo del catálogo y otra canción que use el tema).
- T5. Volver a «Temas definidos» desde D2 hace que la canción herede, muestra `tema.toast.definidos` y [Deshacer] recupera el estilo propio exacto.
- T6. En D1 y D4 los controles de fondo y letra son un resumen de solo lectura; con contraste bajo se ve el aviso con `tema.contraste.ayuda` y sin acciones rápidas; en D2 y D3 las acciones rápidas funcionan.

**Editar y guardar en el tema**
- T7. «Editar tema» entra en D3: banner anunciado, modo, selector y ⋯ inertes, pie fijo con los tres botones en dos filas sin partir entre 300 y 480 px de ancho del panel. Los cambios se ven en la vista previa y en «Probar a pantalla completa», y no se escribe nada (catálogo y `cancion.json` intactos).
- T8. «Guardar en el tema…» abre la confirmación con el recuento efectivo y el desglose calculados por main; el foco inicial está en «Cancelar»; la lista revelable contiene exactamente las canciones contadas. Con un tema usado por una canción asignada, una que lo hereda del álbum, otra del artista, otra del predeterminado, una personalizada y una con otro tema asignado, el recuento es 4.
- T9. Al confirmar, el tema se guarda, las 4 canciones se ven con el aspecto nuevo al abrirlas o reproducirlas, las otras no cambian, y una reproducción que había empezado antes conserva el aspecto anterior hasta terminar.
- T10. Si entre abrir y confirmar cambia el conjunto afectado (prueba: crear una canción que herede el tema predeterminado mientras el diálogo está abierto), no se guarda nada, se muestra `tema.obsoleto` como alerta con el recuento nuevo y hace falta confirmar otra vez.
- T11. Con un fallo de escritura simulado, nada cambia, el borrador sigue en D3 y aparece `tema.toast.error` con [Reintentar].
- T12. Salir del editor con cambios en D3 muestra `tema.dialogo.salir` con el foco en «Seguir editando»; «Descartar cambios del tema» sale sin tocar el tema; «Guardar en el tema…» confirma y sale. Sin cambios en el borrador se sale sin diálogo.
- T13. Tras guardar, descartar o guardar como nuevo, Ctrl/Cmd + Z no deshace pasos del borrador.

**Guardar como, renombrar, duplicar**
- T14. «Guardar como tema nuevo…» pide el nombre con la propuesta preseleccionada, rechaza vacío y repetido (con «Noche Ninja» frente a «noche ninja» repetido, y «Canción» frente a «Cancion» distinto), crea el tema y **no** cambia la canción: desde D3 vuelve a D1 con el tema original intacto; desde D2 sigue personalizada.
- T15. Tras crear, el aviso `tema.nuevo.creado` tiene el foco en [Usar «{nuevo}» en esta canción]; pulsarlo asigna el tema nuevo (procedencia «Asignado a esta canción») y es deshacible.
- T16. Renombrar cambia el nombre en el selector, en la procedencia de otras canciones y en Ajustes sin cambiar ningún aspecto ni pedir confirmación de impacto. Duplicar crea una copia con 0 usos.

**Eliminar**
- T17. «Eliminar tema…» muestra el recuento efectivo, los grupos afectados y, si es el predeterminado, la frase de canciones nuevas; foco inicial en «Cancelar».
- T18. Al confirmar, todas las canciones afectadas (asignadas o que lo heredaban) quedan en «Tema personalizado» con el aspecto idéntico al anterior, el tema desaparece del selector y de Ajustes, y las asignaciones de artista y álbum que lo usaban se quitan. Si la canción abierta estaba afectada, el panel pasa a D2 con el foco en el radio «Tema personalizado» y se anuncia `tema.anuncio.eliminado.esta`.
- T19. Con una escritura interrumpida simulada en la tercera de cinco canciones, el tema sigue en el catálogo, el diálogo muestra `tema.eliminar.parcial` con las canciones pendientes, y [Reintentar] completa las copias y retira el tema. La lista muestra exactamente 3 filas: la tercera canción con ✕, `tema.parcial.fila.error` y [Copiar detalles] (que copia su código), y la cuarta y la quinta con –, «Pendiente» en `texto-3` y sin [Copiar detalles]; debajo se ve `tema.parcial.notaPendientes`; el texto dice «Faltan 3 canciones» y nombra la canción que falló; el foco está en [Reintentar]. Si el fallo es en la última, solo hay una fila, no aparece la nota y se usa la variante f = 1. Con un fallo simulado al reanudar desde Ajustes («Terminar de eliminar»), la lista y «Faltan {f}» corresponden al intento nuevo. En otra prueba, [Cancelar el borrado] deja el tema disponible y las dos ya convertidas como «Tema personalizado» con el mismo aspecto. Ninguna canción queda en «Tema no disponible».
- T20. Después de eliminar un tema asignado en esta visita, Ctrl/Cmd + Z nunca vuelve a vincular la canción a ese tema.

**Grupos, recuperación y errores**
- T21. «Tema del álbum…» y «Tema del artista…» abren el diálogo de grupo de la Biblioteca para el álbum o artista de la canción; sin álbum, sin artista o con álbum sin artista, la opción es `aria-disabled` con su motivo.
- T22. Una carpeta de canción copiada de otro equipo, que apunta a un tema inexistente, abre en D4 con el aspecto de respaldo; «Usar como tema personalizado» la pasa a D2 sin cambio visible; «Guardar como tema nuevo…» propone el nombre guardado; elegir otro tema lo asigna. Si se restaura el catálogo con ese tema, la canción vuelve a D1 sola al reabrirla.
- T22b. (Destino `respaldo`, [0056](../preguntas/0056-destino-respaldo-y-canciones-pendientes.md)) Con una canción cuya base («al azar» o «predeterminado anterior») apunta a un tema que no está en el catálogo y que tiene otro tema asignado, D1 muestra bajo [Volver a heredar] `tema.heredar.destino.respaldo` con ⚠ en `aviso` y sin nombre de tema. Pulsarlo, sin diálogo, pasa el panel a D4, anuncia `tema.anuncio.heredar.respaldo` y deja el foco en el selector; Ctrl/Cmd + Z devuelve el tema asignado. Pasar de D2 a «Temas definidos» con ese mismo destino muestra la variante (respaldo) de `tema.toast.definidos`.
- T23. Con un catálogo de esquema más nuevo (`TEMAS_SOLO_LECTURA`), el panel muestra `tema.soloLectura`, la vista previa usa el aspecto de respaldo, «Personalizar» funciona y ninguna acción escribe el catálogo. Con un tema en borrado pendiente, el selector no lo ofrece y, si es el efectivo, se ve `tema.borradoPendiente`. Cerrar la ventana con cambios en D3 muestra `tema.dialogo.salir` y «Seguir editando» cancela el cierre.
- T24. Con el catálogo vacío, D1 muestra `tema.catalogo.vacio` y solo [Personalizar].

**Accesibilidad y layout**
- T25. Todo el flujo (modo, selector, heredar, personalizar, editar, guardar, guardar como, renombrar, duplicar, eliminar, grupo) es operable solo con teclado; los anuncios de «Accesibilidad» suenan una vez por acción; tras cada diálogo el foco queda donde dice la tabla y nunca en `body`.
- T26. A 300, 360 y 480 px de ancho del panel y en los seis viewports de la subfase 2.1, D1, D2, D3 y D4 no producen scroll de página ni texto cortado; el grupo de modo y la fila [Personalizar] [Editar tema] [⋯] no se parten.
- T27. Con el panel minimizado en D3, «Expandir panel» lleva el punto `info` y el nombre `tema.pestana.editando`.
- T28. Las muestras de tema del selector y del resumen reproducen fondo, fuente y color de letra del tema (comparación visual en la captura).

**Capturas de revisión**
- T29. Se guardan en `docs/ux/revision-fase-3/` (ver su [README](revision-fase-3/README.md)) con el nombre `editor-{ancho}x{alto}-{escala}-{estado}.png` a 1280 × 720 al 100 % y al 125 %: `tema-definidos`, `tema-asignado`, `tema-personalizado`, `tema-editando`, `tema-no-disponible`, `tema-catalogo-vacio`, `dialogo-guardar-impacto` (con la lista revelada), `dialogo-guardar-obsoleto`, `dialogo-nuevo-nombre`, `dialogo-eliminar` y `dialogo-salir-borrador`.
- T30. Sin regresiones de la subfase 2.1: los criterios 1–7, 13 y 20 de la subfase se mantienen con la pestaña Estilo en cada estado D1–D4.
