# 05 — Letra (buscar en LRCLIB, pegar o importar)

- Paso del pipeline: 3 (Letra)
- ADRs: [0005](../adr/0005-letras-y-formato-de-sincronia.md), [0006](../adr/0006-persistencia-y-modelo-de-datos.md)
- Restricciones: [arquitectura.md "Restricciones e implicaciones para UX" §2–§4, §7](../arquitectura.md)

## Objetivo
Conseguir la letra correcta de la canción con el mínimo esfuerzo: encontrarla en LRCLIB (idealmente ya sincronizada), elegir entre candidatos o, si no hay, pegarla o importarla. **Sin callejones sin salida**: siempre hay una alternativa manual.

Usuario/tarea principal: "Quiero la letra de esta canción, a ser posible ya sincronizada".

## Wireframes

**A — Resultados** (la búsqueda se lanza sola al entrar si la canción no tiene letra)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ ‹ Biblioteca │ «Bohemian Rhapsody» · Queen          ✎ Borrador · guardado │
│   (1)✓ Fuente ──── (2)⟳ Separación 42 % ──── (3)● Letra ──── (4)○ Editor  │
├──────────────────────────────────────────────────────────────────────────┤
│  Letra                                                                   │
│  Título [ Bohemian Rhapsody      ] Artista [ Queen        ] [ Buscar ]    │
│                                                                          │
│  ┌ Resultados (3) ───────────────────┐ ┌ Vista previa ─────────────────┐ │
│  │ ◉ Bohemian Rhapsody — Queen       │ │ [00:00.5] Is this the real life│ │
│  │   A Night at the Opera · 5:55     │ │ [00:04.2] Is this just fantasy │ │
│  │   (◆ Sincronizada por palabra)    │ │ [00:07.9] Caught in a landslide│ │
│  │   ✓ Duración igual que tu audio   │ │ …                              │ │
│  │ ○ Bohemian Rhapsody — Queen       │ │                                │ │
│  │   Live Aid · 6:02                 │ │ 52 líneas                      │ │
│  │   (◇ Sincronizada por línea)      │ │                                │ │
│  │   ⚠ 7 s más larga que tu audio    │ │                                │ │
│  │ ○ Bohemian Rhapsody — Queen       │ │                                │ │
│  │   (▭ Solo texto)                  │ │                                │ │
│  └───────────────────────────────────┘ └────────────────────────────────┘ │
│  Letra: LRCLIB                                                           │
│                                                                          │
│  ¿No es ninguna?  [ Pegar la letra ] [ Importar archivo .lrc o .txt ]    │
│                                          [ Usar esta letra ] (primario)  │
└──────────────────────────────────────────────────────────────────────────┘
```

**B — Pegar la letra**
```
│  Pega la letra                                                           │
│  Una línea de la canción por renglón. Deja un renglón en blanco entre    │
│  estrofas si quieres.                                                    │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Is this the real life?                                           │   │
│  │ Is this just fantasy?                                            │   │
│  │ …                                                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  52 líneas · se sincronizarán en el editor                              │
│                   [ Volver a los resultados ] (fantasma) [ Usar esta letra ]│
```

**C — Letra ya elegida** (al volver a este paso)
```
│  Letra actual · origen: LRCLIB (sincronizada por línea) · 52 líneas      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Área de texto editable con la letra (sin marcas de tiempo)       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  ⓘ Si cambias el texto de una línea, esa línea tendrá que volver a       │
│    sincronizarse. Las demás conservan su tiempo.                         │
│  [ Buscar otra letra ] [ Importar archivo ]           [ Ir al editor ]   │
```

## Componentes e interacciones
| Elemento | Comportamiento |
|----------|----------------|
| Campos Título / Artista | Prerrellenados con los metadatos; editables (se guardan en la canción al buscar). Intro = Buscar. |
| Buscar | `get` → `search` (ADR 0005). Botón en estado "Buscando…" (normalmente < 2 s, timeout 10 s). Se lanza automáticamente al entrar si no hay letra. |
| Lista de resultados | `role="listbox"`, selección única, flechas ↑/↓ cambian selección y la vista previa; el primero (mejor ordenado) viene seleccionado. Cada candidato: título — artista, álbum · duración, **insignia de sincronía** y **comparación de duración**. |
| Insignia de sincronía | ◆ "Sincronizada por palabra" (`exito`) · ◇ "Sincronizada por línea" (`info`) · ▭ "Solo texto" (`texto-2`). Icono + texto siempre. Una letra por palabra se conserva y se resalta por palabra en el reproductor, aunque en el MVP el editor solo ajusta tiempos de línea ([0002](../preguntas/0002-sincronia-por-palabra-en-mvp.md)). |
| Comparación de duración | Diferencia con la duración real del audio: ≤ 2 s → "✓ Duración igual que tu audio"; 3–10 s → "⚠ {n} s más larga/corta que tu audio" (`aviso`); > 10 s → "⚠ Duración muy distinta: puede ser otra versión" (`aviso`). |
| Vista previa | Primeras ~15 líneas con sus tiempos (si los tiene), desplazable; total de líneas. |
| Usar esta letra | Guarda la letra (`origen: lrclib`, `lrclib_id`), marca el paso Letra como completado y pasa a la vista C con foco en "Ir al editor". Si ya existía una letra con sincronía, diálogo: "¿Sustituir la letra actual? Perderás la sincronía que hayas hecho." [Cancelar] [Sustituir]. |
| Atribución | "Letra: LRCLIB" visible bajo los resultados y en la vista C mientras el origen sea LRCLIB (enlace a lrclib.net en el navegador del sistema). |
| Pegar la letra | Muestra B. Contador de líneas en vivo (no cuenta renglones vacíos). Pegar un texto con marcas `[mm:ss.xx]` se detecta como LRC y se importa con sus tiempos (aviso: "Hemos detectado tiempos de sincronía y los conservaremos."). |
| Importar archivo | Diálogo nativo con filtro `.lrc`, `.txt`. Se aplica igual que "Usar esta letra" (`origen: archivo`); si el archivo no tiene líneas válidas: "Este archivo no contiene letra que podamos leer." |
| Edición en C | Área de texto con la letra (una línea por renglón). Autoguardado al salir del área o tras 1 s sin escribir. Las líneas cuyo texto no cambia conservan sus tiempos (y sus palabras sincronizadas); las líneas nuevas o modificadas quedan sin sincronizar. Solo cuentan como "sin cambio" las diferencias de espacios (al principio/final o espacios dobles); cambiar mayúsculas, puntuación o una sola letra deja la línea sin sincronizar. Las líneas repetidas (estribillos) se emparejan en orden ([0005](../preguntas/0005-viabilidad-detalles-ux-fase-0.md) §4). El aviso `let.edicion.aviso` cubre este comportamiento. |
| Renglones vacíos | Se guardan como **pausa** (separador de estrofa): en el editor se muestran como fila "♪ pausa" y no requieren sincronía ni cuentan en el número de líneas (ver spec 06). Varios renglones vacíos seguidos = **una** pausa; los del principio y del final se descartan. En un LRC, una marca de tiempo sin texto (`[01:23.45]`) es una pausa **con tiempo**: marca el final de la línea anterior. |
| Ir al editor | Navega a la vista 06. |
| Teclado | Foco inicial: lista de resultados (si hay) o campo Título (si no). Ctrl/Cmd+Intro = "Usar esta letra". |

## Estados
| Estado | Presentación |
|--------|--------------|
| Vacío (sin búsqueda aún) | Campos + "Buscar" + alternativas manuales visibles. |
| Cargando | Lista con 3 filas esqueleto + "Buscando la letra…". "Pegar la letra" e "Importar" siguen disponibles. |
| Sin resultados (`LETRA_NO_ENCONTRADA`) | Banner `info`: "**No encontramos la letra.** Revisa el título y el artista (quita cosas como «Remastered» o «Live») y busca de nuevo, o pega la letra tú." + foco en Título. |
| Instrumental (`INSTRUMENTAL`) | Banner `aviso`: "**Esta canción es instrumental**, según LRCLIB. Si tiene letra, pégala o impórtala." |
| Sin conexión / servicio caído | Banner `aviso` con texto del código + [Reintentar]; alternativas manuales destacadas. |
| Éxito | Vista C. Stepper: Letra ✓. |
| Borrador | Todo se autoguarda; "✎ Borrador · guardado" en la cabecera. |

## Microcopy
| Clave | Texto |
|-------|-------|
| `let.titulo` | Letra |
| `let.boton.buscar` | Buscar |
| `let.buscando` | Buscando la letra… |
| `let.resultados` | Resultados ({n}) |
| `let.sync.palabra` / `linea` / `texto` | Sincronizada por palabra · Sincronizada por línea · Solo texto |
| `let.dur.igual` | Duración igual que tu audio |
| `let.dur.dif` | {n} s más larga que tu audio · {n} s más corta que tu audio |
| `let.dur.muydif` | Duración muy distinta: puede ser otra versión |
| `let.atribucion` | Letra: LRCLIB |
| `let.alternativa` | ¿No es ninguna? |
| `let.boton.pegar` | Pegar la letra |
| `let.boton.importar` | Importar archivo .lrc o .txt |
| `let.boton.usar` | Usar esta letra |
| `let.pegar.titulo` | Pega la letra |
| `let.pegar.ayuda` | Una línea de la canción por renglón. Deja un renglón en blanco entre estrofas si quieres. |
| `let.pegar.contador` | {n} líneas · se sincronizarán en el editor |
| `let.pegar.lrc` | Hemos detectado tiempos de sincronía y los conservaremos. |
| `let.boton.volver` | Volver a los resultados |
| `let.actual` | Letra actual · origen: {origen} ({sincronía}) · {n} líneas |
| `let.edicion.aviso` | Si cambias el texto de una línea, esa línea tendrá que volver a sincronizarse. Las demás conservan su tiempo. |
| `let.boton.otra` | Buscar otra letra |
| `let.boton.editor` | Ir al editor |
| `let.dialogo.sustituir` | ¿Sustituir la letra actual? Perderás la sincronía que hayas hecho. — [Cancelar] [Sustituir] |
| `let.error.LETRA_NO_ENCONTRADA` | **No encontramos la letra.** Revisa el título y el artista (quita cosas como «Remastered» o «Live») y busca de nuevo, o pega la letra tú. |
| `let.error.INSTRUMENTAL` | **Esta canción es instrumental**, según LRCLIB. Si tiene letra, pégala o impórtala. |
| `let.error.SIN_CONEXION` | **Sin conexión a internet.** Puedes pegar la letra o importar un archivo, y buscarla más tarde. |
| `let.error.SERVICIO_NO_DISPONIBLE` | **El servicio de letras no responde.** Suele ser temporal. Reintenta en unos minutos o pega la letra tú. |
| `let.error.archivo` | Este archivo no contiene letra que podamos leer. |

## Criterios de aceptación
1. Al entrar en el paso sin letra, la búsqueda se lanza automáticamente con título, artista, álbum y duración de la canción.
2. Cada candidato muestra título, artista, álbum (si hay), duración, insignia de sincronía (palabra/línea/texto, con icono y texto) y la comparación de duración con los umbrales indicados.
3. Los resultados aparecen ordenados (palabra > línea > texto, y por cercanía de duración) con el primero seleccionado y su vista previa visible.
4. Las flechas ↑/↓ cambian el candidato seleccionado y actualizan la vista previa.
5. "Usar esta letra" guarda letra y origen, marca el paso Letra como completado y muestra la vista C; si ya había sincronía, pide confirmación antes de sustituir.
6. Cuando el origen es LRCLIB se muestra "Letra: LRCLIB" en la vista y se guarda `lrclib_id`.
7. Sin resultados, instrumental, sin conexión o servicio caído muestran su banner y nunca bloquean: "Pegar la letra" e "Importar" están siempre disponibles.
8. Editar título/artista y pulsar Buscar (o Intro) repite la búsqueda y guarda los metadatos en la canción.
9. Pegar texto plano crea líneas sin sincronizar (renglones vacíos = pausas: varios seguidos forman una sola y se descartan los del principio y del final); pegar texto LRC conserva sus tiempos y lo indica, y sus marcas sin texto se guardan como pausas con tiempo.
10. Importar `.lrc`/`.txt` funciona igual; un archivo sin líneas válidas muestra el error y no modifica la letra existente.
11. En la vista C, las ediciones se autoguardan; las líneas sin cambios (o con cambios solo de espacios) conservan sus tiempos y palabras, y cualquier otro cambio en una línea (mayúsculas, puntuación, letras) la deja sin sincronizar.
12. La búsqueda no bloquea la interfaz y supera el timeout de 10 s con el banner de servicio no disponible.
13. La vista es operable con teclado; Ctrl/Cmd+Intro equivale a "Usar esta letra".
