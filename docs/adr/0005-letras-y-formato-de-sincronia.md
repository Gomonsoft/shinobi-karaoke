# 0005 — Letras: LRCLIB + entrada manual; sincronía propia por línea con palabras opcionales; sin alineación automática en el MVP

- Estado: Aceptado
- Fecha: 2026-11-03
- Paso del pipeline: 3 y 4

## Contexto
El paso 3 necesita la letra de la canción, idealmente **ya sincronizada**; el paso 4 permite ajustar la sincronía. Restricciones: gratuito, **sin claves de API**, el servicio externo debe poder fallar sin romper la app, y alternativa sin conexión. Entrada disponible: título, artista, álbum (si lo hay) y duración real (ADR 0003).

Estado del arte (noviembre 2026):
- **LRCLIB** (lrclib.net): base de datos de letras **gratuita, abierta, sin clave ni cuenta**, ~3 millones de registros, con letras sincronizadas por línea (LRC) y, cada vez más, **por palabra** (formato *Lyricsfile* YAML, campo `hasWordSync`). Código del servidor MIT. API:
  - `GET /api/get?track_name&artist_name&album_name&duration` → mejor coincidencia (tolerancia de duración ±2 s), 404 si no hay.
  - `GET /api/search?q=` o `track_name`/`artist_name` → hasta 20 resultados.
  - Respuesta: `plainLyrics`, `syncedLyrics` (LRC `[mm:ss.xx]`), `instrumental`, `hasWordSync`, `lyricsfile`.
  - Límites aprox.: ~45 peticiones/min por IP (anónimo), ~90 con `User-Agent` descriptivo; respetar `Retry-After` en 429. Registro opcional de app para más cuota.
  - No declara licencia de los textos de las letras.
- Alineación automática letra-audio: **WhisperX** (BSD-2) o **stable-ts** (MIT) pueden alinear texto con la voz separada, pero añaden modelos de 1–3 GB, alineadores por idioma (wav2vec2) con licencias variadas y minutos extra de CPU.

## Alternativas consideradas
### Servicio de letras
| Opción | Licencia / acceso | Pros | Contras |
|--------|-------------------|------|---------|
| A. **LRCLIB** | Gratis, sin clave, API abierta | Letras sincronizadas (línea y a veces palabra); búsqueda por duración. | Cobertura irregular fuera de música popular; servicio comunitario sin SLA; sin licencia declarada de los textos. |
| B. Musixmatch / Genius / Spotify | Requieren clave, términos restrictivos o scraping | Gran cobertura. | Claves/cuentas, términos que prohíben este uso; descartado por criterio 2. |
| C. lyrics.ovh y similares | Gratis, sin clave | Simple. | Solo texto plano, sin sincronía, fiabilidad baja. No aporta frente a LRCLIB + pegar a mano. |
| D. Volcado local de LRCLIB (SQLite) | — | Offline. | Varios GB; desproporcionado para el MVP. |

### Formato de sincronía interno
| Opción | Pros | Contras |
|--------|------|---------|
| LRC simple como formato de almacenamiento | Estándar, legible. | Solo por línea; sin fin de línea; parseo con ambigüedades. |
| LRC mejorado (A2, `<mm:ss.xx>` por palabra) | Palabras. | Variantes no estándar; sin metadatos. |
| **JSON propio dentro del proyecto (ADR 0006), con importación/exportación LRC y LRC mejorado** | Inicio y fin explícitos por línea y por palabra, en ms enteros; validable; extensible. | Requiere conversores. |

### Alineación automática en el MVP
| Opción | Pros | Contras |
|--------|------|---------|
| Incluir (WhisperX / stable-ts sobre la voz separada) | Sincroniza letras pegadas a mano sin esfuerzo. | +1–3 GB de descarga, minutos de CPU, calidad irregular por idioma/estilo, más superficie de licencias. Contradice "simplicidad del MVP". |
| **No incluir; herramienta manual de "toque al ritmo"** | Simple, offline, funciona en cualquier idioma. | Requiere esfuerzo del usuario cuando LRCLIB no tiene la letra sincronizada. |

## Decisión
1. **Servicio**: **LRCLIB**, llamado desde el **proceso principal** de Electron (no necesita Python), con cabecera `User-Agent: ShinobiKaraoke/<versión> (<url del repositorio>)`, peticiones secuenciales y respeto de `Retry-After`. Estrategia:
   1. `GET /api/get` con título, artista, álbum y duración.
   2. Si 404 → `GET /api/search` con `track_name` + `artist_name` (y si no hay resultados, `q` libre); ordenar por: tiene sincronía por palabra > por línea > texto plano, y por cercanía de duración. Mostrar los candidatos al usuario para que elija.
   3. Si `instrumental: true` → informar de que la canción no tiene letra.
   - Timeout 10 s; cualquier fallo de red o del servicio lleva a la alternativa manual sin bloquear.
   - Se guarda el `id` de LRCLIB y el origen en la canción (atribución y posible refresco).
2. **Alternativa manual / offline**: pegar texto plano (una línea de letra por línea) o **importar un archivo `.lrc` / `.txt`**. Las líneas sin tiempos quedan "sin sincronizar".
3. **Formato interno**: JSON propio (esquema en ADR 0006): lista de **líneas** con `inicio_ms` / `fin_ms` y lista opcional de **palabras** con `inicio_ms` / `fin_ms`. Conversores:
   - Importar: LRC (`[mm:ss.xx]`, con varias marcas por línea y offset `[offset:]`), LRC mejorado (`<mm:ss.xx>`), Lyricsfile YAML de LRCLIB (`lines[].words`).
   - Exportar: LRC y LRC mejorado (útil para el usuario; no es requisito de UI del MVP).
   - **Pausas**: los renglones vacíos (texto pegado, `.txt`, o marcas LRC sin texto) se convierten en elementos `tipo: "pausa"` (ADR 0006); varios seguidos se funden en uno y se descartan los del principio y del final. Una pausa con marca de tiempo conserva su `inicio_ms`.
   - **Fin de línea**: `fin_ms: null` significa **automático** y se calcula al renderizar (no se guarda) con una única función compartida `finEfectivo` (respuesta a `preguntas/0005` §6): fin fijado si existe → fin de la última palabra si hay palabras → inicio de la pausa siguiente si tiene tiempo → inicio de la línea siguiente si el hueco es ≤ 8 s y no hay pausa → si hay pausa sin tiempo o hueco > 8 s, `inicio + min(hueco, máx(2000, 400 × nº de palabras))` → última línea, `min(inicio + 5000, duración)`. Un fin fijado cumple `inicio < fin ≤ inicio de la siguiente`.
   - **Editar el texto** de una letra ya sincronizada (respuesta a `preguntas/0005` §4): el proceso principal empareja las líneas antiguas y nuevas con un diff LCS por líneas (comparando el texto con los espacios normalizados); las emparejadas conservan `id`, tiempos y palabras; las nuevas o modificadas quedan sin sincronizar.
4. **Resaltado**: si la línea tiene palabras con tiempos → resaltado por palabra; si no → **barrido progresivo** de la línea interpolado linealmente entre su inicio y su fin efectivo. **Decisión de producto (`preguntas/0002`, respondida por el usuario): las herramientas del editor del MVP sincronizan solo por línea**; los tiempos por palabra solo existen si la letra los trae (LRCLIB/Lyricsfile o `.lrc` mejorado importado) y se muestran y conservan, pero no se editan una a una (solo se desplazan con su línea al mover su inicio y se borran con ella; ADR 0006, `ux/06` criterio 7d). El modelo de datos y el reproductor soportan palabras para ampliarlo después sin migraciones.
5. **Herramienta de sincronía (editor)**: modo "toque al ritmo": reproducir (velocidad 0,5×–1×) y pulsar una tecla/botón al inicio de cada línea; después, ajuste fino por línea (±10/100 ms, arrastrar) y desplazamiento global (offset) para letras de LRCLIB que vayan adelantadas/atrasadas. Se puede sincronizar escuchando la **mezcla original** (`fuente/mezcla.flac`, ADR 0003), sin esperar a la separación.
   - Tiempo de una pulsación: `KeyboardEvent.timeStamp` convertido a tiempo del `AudioContext` con `getOutputTimestamp()`, menos la latencia de salida, y a tiempo de canción según la velocidad (error del sistema ≤ 20 ms con salida por cable/altavoces; con Bluetooth se corrige con el desplazamiento global). Se ignoran las repeticiones de teclado.
   - En el MVP las velocidades < 1× **cambian el tono** (`playbackRate` de Web Audio); la reproducción con *time-stretch* (`<audio>` con `preservesPitch`) es una mejora a evaluar en la Fase 5 sin impacto en datos.
6. **Alineación automática**: **fuera del MVP**. Candidata post-MVP (WhisperX/stable-ts sobre `voz.flac`), a evaluar en un ADR propio.

### Riesgos legales y mitigación
Las letras están protegidas por derechos de autor y LRCLIB no declara licencia de sus textos. Mitigación: la consulta la inicia el usuario para una canción concreta, la letra se guarda solo en su biblioteca local, no hay funciones de compartir/publicar ni la app redistribuye letras; se atribuye la fuente ("Letra: LRCLIB") en la canción.

## Consecuencias
- Positivas: flujo sin claves ni coste; muchas canciones populares llegan ya sincronizadas; funciona sin conexión con entrada manual; formato propio preparado para palabra a palabra.
- Negativas / riesgos: cobertura limitada para música poco conocida o en ciertos idiomas; la letra puede no corresponder a la versión exacta (remasters, versiones en directo) → desfases que el usuario corrige con el offset; dependencia de un servicio comunitario (posible caída o cambio de límites).
- Impacto en UX:
  - Búsqueda rápida (< 2 s normalmente); puede devolver 0, 1 o varios candidatos → pantalla de elección con indicador "sincronizada / por palabra / solo texto".
  - Si no hay resultados o no hay conexión: pegar letra o importar archivo, sin callejones sin salida.
  - Necesidad de editar título/artista y reintentar la búsqueda.
  - Herramienta de sincronía manual con teclado; el usuario necesita oír la voz (usar mezcla original o pista de voz).

## Revisiones
- 2026-11-03: respuesta del usuario a `preguntas/0002` (solo por línea en el editor); pausas, fin automático, diff al editar el texto y precisión del toque (respuesta a `preguntas/0005` §4–§7).
- 2026-11-04: tras `preguntas/0006`, las palabras se desplazan y se borran con su línea (ADR 0006).
- 2026-11-04 (revisión de cierre de la Fase 1): como el validador exige inicios **estrictamente** crecientes, ids únicos y `palabras: null` en vez de lista vacía (ADR 0006), los conversores de importación (Fase 4) deben normalizar antes de validar: ordenar por inicio las líneas expandidas de LRC con varias marcas; si dos elementos quedarían con el mismo inicio (marcas repetidas, dúos), desplazar el posterior +1 ms (repetido si hace falta); generar ids nuevos únicos; convertir listas de palabras vacías en `null`. Una letra que siga sin cumplir los invariantes tras normalizar se trata como "sin sincronizar" (se conservan los textos, sin tiempos) en lugar de rechazarse.

## Fuentes
- Documentación de la API de LRCLIB: https://lrclib.net/docs
- Servidor LRCLIB (MIT): https://github.com/tranxuanthang/lrclib
- Plugin LibreLyrics para LRCLIB (estrategia get → search): https://pypi.org/project/librelyrics-lrclib/
- Cliente Python de LRCLIB: https://lrclibapi.readthedocs.io/en/stable/lrclib.html
- Formato LRC (y extensión A2/mejorado): https://en.wikipedia.org/wiki/LRC_(file_format)
- WhisperX: https://github.com/m-bain/whisperX ; stable-ts: https://github.com/jianfch/stable-ts
