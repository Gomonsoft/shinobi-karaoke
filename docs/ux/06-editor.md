# 06 — Editor (sincronía + estilo + vista previa)

- Paso del pipeline: 4 (Editor) y 5 (Guardado: borrador / lista)
- ADRs: [0005](../adr/0005-letras-y-formato-de-sincronia.md) (formato, `finEfectivo`, toque al ritmo), [0006](../adr/0006-persistencia-y-modelo-de-datos.md) (`cancion.json`, estados, invariantes de la letra, `moverInicioLinea` / `borrarTiemposLinea`, formato del estilo), [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md) (motor de audio, reloj, `marcarInicioLinea`, API de guardado)
- Restricciones: [arquitectura.md §7 y "Restricciones e implicaciones para UX" §5–§6](../arquitectura.md)
- Sistema visual: [sistema-visual.md §6–§10](sistema-visual.md) (componentes, foco, estilo predeterminado, reglas de contraste, valores fijos de render)
- Preguntas: [0002](../preguntas/0002-sincronia-por-palabra-en-mvp.md) (usuario: **sincronía solo por línea** en el MVP), [0004](../preguntas/0004-fuentes-tipograficas-incluidas-y-del-sistema.md) (solo fuentes incluidas), [0005](../preguntas/0005-viabilidad-detalles-ux-fase-0.md) y [0006](../preguntas/0006-ajustes-specs-ux-tras-0005.md) (pausas, fin automático, precisión del toque, lista incompleta), [0024](../preguntas/0024-stepper-letra-actual-y-volver-a-letra-desde-el-editor.md) (stepper y volver a Letra), [0025](../preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) (detalles técnicos de la Fase 5; respondida: pantalla completa en la Fase 6, desplazamiento ±30 s, el tono baja con la velocidad, un solo volumen, API de guardado), [0026](../preguntas/0026-textos-pendientes-del-editor-fase-5.md) (letra recargada y regla de "color más claro"; respondida)
- Revisión: 2026-11-05, puesta al día para la Fase 5 (ver "Cambios de esta revisión" al final).

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
- **Reproduciendo**: dibuja lo que vería el reproductor en esa posición (línea actual y siguiente, barrido o resaltado por palabra, indicador de entrada `●●●`, pantalla de título antes de la primera línea). Las líneas sin inicio se omiten; las pausas no se dibujan. No muestra el aviso `rep.incompleta`.
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
3. Toast `bib.toast.lista` "«{título}» está lista para cantar." con [▶ Reproducir], que abre el reproductor (spec 07) como el botón de la tarjeta. En la Fase 5 (sin reproductor) el toast sale **sin** [▶ Reproducir]; la acción llega con la Fase 6 ([0025](../preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) §1).

### Probar a pantalla completa
- Botón bajo la vista previa o **F**. Abre el reproductor (spec 07) desde el tiempo mostrado de la línea seleccionada − 3 s (o desde la posición actual si la línea no tiene inicio), con el estilo actual y el desplazamiento actual.
- Suena el instrumental si existe; si no, la mezcla original con la etiqueta `edi.probar.original` siempre visible.
- Esc vuelve al editor en la misma posición, en pausa. Un cambio de desplazamiento hecho allí (, / .) se guarda en la canción y se ve al volver.
- **Fase 6** ([0025](../preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) §1): llega con el reproductor. En la Fase 5 el botón no se muestra (tampoco su hueco en los wireframes A y B) y la tecla F no hace nada ni aparece en el diálogo de atajos.

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
| F | Probar a pantalla completa (desde la Fase 6) |
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
- Funciona a 1024 × 640 y con zoom de la interfaz hasta 150 % (a partir de ahí, desplazamiento vertical del panel, nunca contenido cortado).

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
| `edi.probar.original` | Vista previa con la canción original (la separación aún no ha terminado) |
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
18. Durante el modo, el panel Estilo, el ajuste fino, Supr, I/O/L, ↑/↓ (y, desde la Fase 6, "Probar a pantalla completa") no responden, y la vista previa resalta en vivo.
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
38. Tras marcar como lista, la Biblioteca enfoca la tarjeta, la desplaza a la vista, la resalta 2 s con borde `exito`, pasa el filtro a *Todas* si era *Borradores* y muestra `bib.toast.lista` (en la Fase 5 sin acción; con [▶ Reproducir] desde la Fase 6).
39. En una Lista, "Hecho" vuelve a la Biblioteca con la tarjeta enfocada; si está incompleta, la primera pulsación muestra `edi.hecho.incompleta` con sus dos acciones y el estado guardado no cambia.
40. "Volver a borrador…" del menú ⋯ (solo en Lista) pide la confirmación de spec 02 y deja la canción en borrador sin salir del editor ni cambiar letra o estilo.
41. Los estados de la tabla (sin sincronizar, ya sincronizada, cargando audio, separación en curso/pendiente, error de audio) se muestran con sus textos; el banner `edi.banner.yasync` se cierra con ✕ o con el primer cambio de tiempos.

**Pantalla completa y teclado**
42. (Se verifica en la Fase 6; en la Fase 5 el botón no aparece y F no hace nada.) "Probar a pantalla completa" (o F) abre el reproductor desde la línea seleccionada − 3 s con el estilo y el desplazamiento actuales, con el instrumental o la mezcla y la etiqueta `edi.probar.original`; Esc vuelve al editor en la misma posición y en pausa.
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

## Fuera del MVP — ampliación futura: sincronía por palabra
Decisión del usuario ([0002](../preguntas/0002-sincronia-por-palabra-en-mvp.md)): el MVP solo ofrece herramientas **por línea**; las palabras con tiempos que lleguen de LRCLIB o de un LRC mejorado se **muestran** (◆ en la fila, resaltado por palabra en la vista previa) y se **conservan**, pero no se editan. Esta sección **no se implementa en el MVP**; describe cómo ampliar el diseño en una versión posterior sin rehacer la vista:

1. **Segunda pasada opcional**: en la lista, cada línea sincronizada ofrece "Sincronizar palabras" (tecla **W**). Se entra en el modo "Sincronizar al ritmo" **acotado a esa línea**: suena desde 1 s antes de su inicio, a 0,75× por defecto, y cada **Intro** marca el inicio de la siguiente palabra (la primera palabra hereda el inicio de la línea; el fin de cada palabra = inicio de la siguiente; la última termina en el fin de la línea). Retroceso deshace, Esc sale.
2. **Modo de toda la canción por palabras** (opcional, avanzado): el mismo modo "Sincronizar al ritmo" con un conmutador "Por línea / Por palabra"; en "Por palabra" la "Siguiente" muestra la línea con la palabra siguiente subrayada.
3. **Ajuste fino**: en el panel Sincronía, bajo Inicio/Fin de la línea, una fila de "fichas" de palabras; seleccionar una ficha permite ±10/±100 ms con los mismos atajos (Tab/Mayús+Tab cambia de ficha).
4. **Línea de tiempo**: al seleccionar una línea con palabras, la barra del transporte hace *zoom* a esa línea y muestra cada palabra como segmento arrastrable.
5. **Borrar**: "Borrar tiempos de palabras" vuelve la línea al barrido progresivo.
6. **Criterio de "Lista"**: no cambia (basta el inicio de cada línea); las palabras son una mejora opcional.
7. Riesgo de UX a validar: sincronizar por palabra multiplica el esfuerzo (una pulsación por palabra, varias pasadas); por eso se ofrece siempre **después** de la sincronía por línea y nunca como requisito.
