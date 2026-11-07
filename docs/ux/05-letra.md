# 05 — Letra (buscar en LRCLIB, pegar o importar)

- Paso del pipeline: 3 (Letra)
- ADRs: [0005](../adr/0005-letras-y-formato-de-sincronia.md), [0006](../adr/0006-persistencia-y-modelo-de-datos.md)
- Restricciones: [arquitectura.md "Restricciones e implicaciones para UX" §2–§4, §7](../arquitectura.md)
- Preguntas: [0022](../preguntas/0022-huecos-ux-de-la-vista-letra-fase-4.md) (huecos de la Fase 4; respondida) y [0024](../preguntas/0024-stepper-letra-actual-y-volver-a-letra-desde-el-editor.md) (✓ de Letra en el stepper estando en la vista; respondida). Ver la sección "Casos de la Fase 4" al final (§10: texto demasiado largo).

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
│  estrofas si quieres. Borra los renglones que no se cantan, como         │
│  «[Estribillo]» o «(x2)».                                                │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Is this the real life?                                           │   │
│  │ Is this just fantasy?                                            │   │
│  │ …                                                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  52 líneas · se sincronizarán en el editor                              │
│  (si es LRC:) ⓘ Hemos detectado tiempos de sincronía y los conservaremos.│
│               Ignoraremos 2 renglones sin tiempo.                       │
│                   [ Volver a los resultados ] (fantasma) [ Usar esta letra ]│
```

**C — Letra ya elegida** (al volver a este paso)
```
│  Letra actual · de LRCLIB · sincronizada por línea · 52 líneas           │
│  Letra: LRCLIB                                                           │
│  (tras importar un LRC con renglones ignorados, hasta salir de la vista:)│
│  ⓘ Hemos ignorado 2 renglones sin tiempo del archivo.            [ × ]   │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Área de texto editable con la letra (sin marcas de tiempo)       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  (si algún renglón empieza por [mm:ss]:)                                 │
│  ⓘ Aquí las marcas como «[01:23.45]» se guardan como texto. Para         │
│    conservar los tiempos, importa el archivo o pega la letra desde       │
│    «Buscar otra letra».                                                  │
│  ⓘ Si cambias el texto de una línea, esa línea tendrá que volver a       │
│    sincronizarse. Las demás conservan su tiempo.                         │
│  [ Buscar otra letra ] [ Importar archivo ]           [ Ir al editor ]   │
```

**C con el área vacía** (0 líneas; ver "Casos de la Fase 4" §2)
```
│  Sin letra todavía. Escribe o pega aquí la letra, o busca otra.          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                                                                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  (solo si la canción está Lista:)                                        │
│  ⚠ Una canción lista necesita al menos una línea de letra. Este cambio   │
│    no se ha guardado.                                                    │
│  [ Buscar otra letra ] [ Importar archivo ]   [ Ir al editor ] (inactivo)│
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
| Usar esta letra | Guarda la letra (`origen: lrclib`, `lrclib_id`), marca el paso Letra como completado y pasa a la vista C con foco en "Ir al editor". Se puede guardar mientras la fuente de YouTube sigue descargándose. Si ya hay una letra con ≥ 1 línea, pide confirmación antes (diálogo `let.dialogo.sustituir`, con dos variantes según tenga o no sincronía; ver "Casos de la Fase 4" §4). |
| Atribución | "Letra: LRCLIB" visible bajo los resultados y en la vista C mientras el origen sea LRCLIB (enlace a lrclib.net en el navegador del sistema). |
| Pegar la letra | Muestra B. Contador de líneas en vivo (no cuenta renglones vacíos). Pegar un texto con marcas `[mm:ss.xx]` se detecta como LRC y se importa con sus tiempos (aviso `let.pegar.lrc` y, si hay renglones con texto sin marca, `let.pegar.ignoradas`). El texto pegado se conserva mientras no se salga de la vista Letra (también al ir a "Volver a los resultados" y volver). "Usar esta letra" pide confirmación como en A. Un texto que supera el límite (512 KB o 5000 renglones) muestra `let.pegar.demasiado` (§10). |
| Importar archivo | Diálogo nativo con filtro `.lrc`, `.txt`. Se aplica igual que "Usar esta letra" (`origen: archivo`); si el archivo no tiene líneas válidas: "Este archivo no contiene letra que podamos leer." La confirmación de sustituir se pide **después** de leer el archivo y solo si es válido; cancelar el selector o el diálogo no cambia nada. Si era un LRC con renglones ignorados, la vista C muestra `let.importar.ignoradas` hasta cerrarlo o salir de la vista. |
| Edición en C | Área de texto con la letra (una línea por renglón). Autoguardado al salir del área o tras 1 s sin escribir. Las líneas cuyo texto no cambia conservan sus tiempos (y sus palabras sincronizadas); las líneas nuevas o modificadas quedan sin sincronizar. Solo cuentan como "sin cambio" las diferencias de espacios (al principio/final o espacios dobles); cambiar mayúsculas, puntuación o una sola letra deja la línea sin sincronizar. Las líneas repetidas (estribillos) se emparejan en orden ([0005](../preguntas/0005-viabilidad-detalles-ux-fase-0.md) §4). El aviso `let.edicion.aviso` cubre este comportamiento. |
| Renglones vacíos | Se guardan como **pausa** (separador de estrofa): en el editor se muestran como fila "♪ pausa" y no requieren sincronía ni cuentan en el número de líneas (ver spec 06). Varios renglones vacíos seguidos = **una** pausa; los del principio y del final se descartan. En un LRC, una marca de tiempo sin texto (`[01:23.45]`) es una pausa **con tiempo**: marca el final de la línea anterior. |
| Ir al editor | Navega a la vista 06 cuando el audio está listo. Si la descarga de YouTube sigue en curso, muestra el estado `let.esperandoAudio` con un indicador giratorio y deja el botón inactivo hasta que `evento:cancion` confirme la fuente completada. No muestra un error de guardado: la letra ya está guardada. |
| Teclado | Foco inicial: lista de resultados (si hay) o campo Título (si no). Ctrl/Cmd+Intro = "Usar esta letra". |

## Estados
| Estado | Presentación |
|--------|--------------|
| Vacío (sin búsqueda aún) | Campos + "Buscar" + alternativas manuales visibles. |
| Cargando | Lista con 3 filas esqueleto + "Buscando la letra…". "Pegar la letra" e "Importar" siguen disponibles. |
| Sin resultados (`LETRA_NO_ENCONTRADA`) | Banner `info`: "**No encontramos la letra.** Revisa el título y el artista (quita cosas como «Remastered» o «Live») y busca de nuevo, o pega la letra tú." + foco en Título. |
| Instrumental (`INSTRUMENTAL`) | Banner `aviso`: "**Esta canción es instrumental**, según LRCLIB. Si tiene letra, pégala o impórtala." |
| Instrumental con candidatos (`instrumental: true` y lista no vacía) | Banner `aviso` `let.aviso.instrumentalConCandidatos` encima de la lista; la lista se muestra y se usa con normalidad (foco en la lista). |
| Letra vacía (C, 0 líneas) | Ver "Casos de la Fase 4" §2. |
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
| `let.pegar.ayuda` | Una línea de la canción por renglón. Deja un renglón en blanco entre estrofas si quieres. Borra los renglones que no se cantan, como «[Estribillo]» o «(x2)». |
| `let.pegar.contador` | {n} líneas · se sincronizarán en el editor |
| `let.pegar.lrc` | Hemos detectado tiempos de sincronía y los conservaremos. |
| `let.pegar.ignoradas` | Ignoraremos {n} renglones sin tiempo. · (1) Ignoraremos 1 renglón sin tiempo. |
| `let.pegar.demasiado` | Este texto es demasiado largo para ser una letra. Comprueba que has pegado solo la letra de la canción. |
| `let.error.demasiadoLarga` | El texto es demasiado largo para ser una letra. Este cambio no se ha guardado. |
| `let.importar.ignoradas` | Hemos ignorado {n} renglones sin tiempo del archivo. · (1) Hemos ignorado 1 renglón sin tiempo del archivo. |
| `let.boton.volver` | Volver a los resultados |
| `let.actual` | Letra actual · {origen} · {sincronía} · {n} líneas (con 1: "1 línea") |
| `let.origen.lrclib` / `manual` / `archivo` | de LRCLIB · pegada · de un archivo |
| `let.actual.sync.palabra` / `linea` / `ninguna` / `parte` | sincronizada por palabra · sincronizada por línea · sin sincronizar · sincronizada en parte |
| `let.actual.vacia` | Sin letra todavía. Escribe o pega aquí la letra, o busca otra. |
| `let.error.listaSinLineas` | Una canción lista necesita al menos una línea de letra. Este cambio no se ha guardado. |
| `let.edicion.marcas` | Aquí las marcas como «[01:23.45]» se guardan como texto. Para conservar los tiempos, importa el archivo o pega la letra desde «Buscar otra letra». |
| `let.edicion.aviso` | Si cambias el texto de una línea, esa línea tendrá que volver a sincronizarse. Las demás conservan su tiempo. |
| `let.boton.otra` | Buscar otra letra |
| `let.boton.editor` | Ir al editor |
| `let.esperandoAudio` | Esperando la canción para continuar… |
| `let.editorEsperando` | Espera a que termine la descarga para continuar. |
| `let.editorAudioNoListo` | El audio todavía no está listo para continuar. |
| `let.dialogo.sustituir` | Con sincronía: ¿Sustituir la letra actual? Perderás la sincronía que hayas hecho. — [Cancelar] [Sustituir] |
| `let.dialogo.sustituirTexto` | Sin sincronía: ¿Sustituir la letra actual? Se reemplazará el texto que tienes ahora. — [Cancelar] [Sustituir] |
| `let.aviso.instrumentalConCandidatos` | **La versión más parecida es instrumental**, según LRCLIB. Abajo tienes otras versiones con letra: comprueba que coinciden con tu audio. |
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
5. "Usar esta letra" guarda letra y origen, marca el paso Letra como completado y muestra la vista C; si ya había una letra con ≥ 1 línea, pide confirmación antes de sustituir (criterio 16).
6. Cuando el origen es LRCLIB se muestra "Letra: LRCLIB" en la vista y se guarda `lrclib_id`.
7. Sin resultados, instrumental, sin conexión o servicio caído muestran su banner y nunca bloquean: "Pegar la letra" e "Importar" están siempre disponibles.
8. Editar título/artista y pulsar Buscar (o Intro) repite la búsqueda y guarda los metadatos en la canción.
9. Pegar texto plano crea líneas sin sincronizar (renglones vacíos = pausas: varios seguidos forman una sola y se descartan los del principio y del final); pegar texto LRC conserva sus tiempos y lo indica, y sus marcas sin texto se guardan como pausas con tiempo.
10. Importar `.lrc`/`.txt` funciona igual; un archivo sin líneas válidas muestra el error y no modifica la letra existente.
11. En la vista C, las ediciones se autoguardan; las líneas sin cambios (o con cambios solo de espacios) conservan sus tiempos y palabras, y cualquier otro cambio en una línea (mayúsculas, puntuación, letras) la deja sin sincronizar.
12. La búsqueda no bloquea la interfaz y supera el timeout de 10 s con el banner de servicio no disponible.
13. La vista es operable con teclado; Ctrl/Cmd+Intro equivale a "Usar esta letra".
14. **Resumen de C**: `let.actual` usa `let.origen.*` según `origen` y `let.actual.sync.*` según la regla de "Casos de la Fase 4" §1; con 1 línea dice "1 línea". No se muestra el nombre del archivo importado.
15. **Área vacía**: en borrador, se guarda, se muestra `let.actual.vacia`, el stepper pasa a Letra ○, Editor queda no navegable con `paso.motivo.sinLetra` e "Ir al editor" queda inactivo; la vista sigue en C. En una canción lista, no se guarda, se muestra `let.error.listaSinLineas` bajo el área sin borrar lo escrito y el aviso desaparece en cuanto el área tiene ≥ 1 línea (que se guarda con normalidad).
16. **Sustituir**: "Usar esta letra" (A), "Usar esta letra" (B) e "Importar" piden confirmación si la canción ya tiene ≥ 1 línea: `let.dialogo.sustituir` si alguna línea tiene inicio, `let.dialogo.sustituirTexto` si no. Foco inicial en "Cancelar"; Cancelar o Esc no cambian nada. Al importar, el diálogo sale tras leer el archivo y solo si es válido.
17. **Marcas en C**: un texto con `[mm:ss]` escrito o pegado en el área de C se guarda como texto literal; mientras algún renglón empiece por una marca de tiempo se muestra `let.edicion.marcas` (informativo, no bloquea el guardado).
18. **Instrumental con candidatos**: con `instrumental: true` y candidatos, se muestra la lista con `let.aviso.instrumentalConCandidatos` encima; sin candidatos, `let.error.INSTRUMENTAL`.
19. **Renglones ignorados**: al pegar un LRC con renglones de texto sin marca, B muestra `let.pegar.ignoradas` con el recuento en vivo; al importarlo, C muestra `let.importar.ignoradas` (cerrable, desaparece al salir de la vista). Sin renglones ignorados no se muestra nada.
20. **Navegar**: al volver a la vista sin haber elegido letra en los 10 min siguientes, se ven los resultados anteriores sin consultar la red; pasado ese tiempo, o con "Buscar" o "Buscar otra letra", se consulta de nuevo. El texto de B se conserva al pasar a A y volver a B mientras no se salga de la vista Letra.
21. **Texto demasiado largo** (§10): en B, con más de 512 KB (UTF-8) o más de 5000 renglones, se muestra `let.pegar.demasiado` como aviso `error` en línea bajo el área, el contador de líneas y los avisos de LRC no se muestran y "Usar esta letra" queda inactivo; el aviso desaparece en cuanto el texto vuelve a caber. En C, el mismo límite muestra `let.error.demasiadoLarga` bajo el área, sin guardar ni borrar lo escrito y sin el toast genérico de error; si se sale de la vista así, se conserva la última letra guardada. El texto "512 KB" no aparece en la interfaz.
22. **Letra antes de terminar YouTube**: "Usar esta letra", pegar e importar guardan la letra aunque la fuente siga `en_curso`; no se pierde el progreso de descarga. En C aparece el icono giratorio con `let.esperandoAudio`, "Ir al editor" queda inactivo con el motivo `let.editorEsperando`, y la interfaz lo habilita al recibir `evento:cancion` con la fuente `completado`. No aparece "No se pudo guardar la letra" por el estado de la fuente.

## Casos de la Fase 4 (respuesta a `preguntas/0022`)

**§1 Resumen de C.** `Letra actual · {origen} · {sincronía} · {n} líneas`, p. ej. "Letra actual · de LRCLIB · sincronizada por línea · 52 líneas" o "Letra actual · pegada · sin sincronizar · 12 líneas". No se guarda ni se muestra el nombre del archivo. Sincronía, mirando solo los elementos `linea`:
| Condición | Texto |
|-----------|-------|
| Ninguna línea con inicio | sin sincronizar |
| Unas con inicio y otras sin él | sincronizada en parte |
| Todas con inicio y al menos una con palabras | sincronizada por palabra |
| Todas con inicio y ninguna con palabras | sincronizada por línea |

**§2 Área vacía.** En borrador se guarda y la vista se queda en C (no salta a A mientras se está en ella); al volver a entrar más tarde se ve A con la búsqueda automática, como cualquier canción sin letra. En una lista no se guarda (aviso `let.error.listaSinLineas`); no se ofrece "Volver a borrador" aquí: si el usuario quiere rehacer la letra desde cero, tiene "Buscar otra letra", "Importar" o el menú de la Biblioteca. Si sale de la vista con el área vacía, al volver ve la letra guardada.

**§3 Marcas en C.** Texto literal (la detección de LRC solo ocurre en B y al importar), con el aviso informativo `let.edicion.marcas`. Regla del aviso: algún renglón empieza por `[m:ss]` o `[mm:ss.xx]`.

**§4 Confirmación al sustituir.** En los tres caminos (A, B, Importar) y siempre que haya ≥ 1 línea, no solo con sincronía: una letra pegada y retocada también es trabajo. Al importar, después de leer el archivo y solo si es válido (un archivo no válido muestra `let.error.archivo` sin diálogo).

**§5 Instrumental con candidatos.** Texto propio (`let.aviso.instrumentalConCandidatos`), porque `let.error.INSTRUMENTAL` ("es instrumental… pégala") contradice una lista con letras.

**§6 Renglones de estructura.** Sin filtrado automático (riesgo de borrar versos reales); se conservan como líneas y la ayuda de B pide borrarlos.

**§7 Navegación.** Resultados anteriores durante 10 min (caché en memoria del ADR 0005); "Buscar" y "Buscar otra letra" consultan siempre. El texto de B vive en el estado de la vista Letra: se pierde al salir de ella o al usarlo.

**§8 Motivos del stepper.** Ver `00-mapa-de-vistas.md` §2: se mantienen "Primero añade el audio" y "Primero elige una letra", y se añade "Espera a que termine la descarga" para Letra/Editor con la fuente descargándose.

**§9 Renglones ignorados en un LRC.** Sí se avisa (`let.pegar.ignoradas` en B, `let.importar.ignoradas` en C), porque perder versos en silencio rompe "nunca perder trabajo". Cómo llega el recuento al renderer: `preguntas/0023`.

**§10 Texto demasiado largo** (revisión 2026-11-05 del texto que añadió la tarea 0085 sin spec). Se **corrige** "El texto es demasiado largo (máximo 512 KB).":
- "KB" es jerga y el número no ayuda a nadie: una letra real ocupa 2–10 KB, así que quien llega al límite ha pegado otra cosa (una página entera, un libro, un archivo binario). El mensaje dice qué pasó y qué hacer.
- El límite no es solo de bytes: los conversores también rechazan más de 5000 renglones (`ErrorLetraDemasiadoGrande('elementos')`), y para ese caso "máximo 512 KB" era falso.
- Textos: `let.pegar.demasiado` en B y `let.error.demasiadoLarga` en C (antes C mostraba el toast genérico "No se pudo guardar la letra."). Al importar un archivo que supera el límite se mantiene `let.error.archivo`. Criterio 21.
