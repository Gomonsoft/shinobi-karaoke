# 0003 — Fuente de audio: archivo local (PyAV) y YouTube (yt-dlp + Deno)

- Estado: Aceptado
- Fecha: 2026-11-03
- Paso del pipeline: 1

## Contexto
El paso 1 recibe una **ruta de archivo** o una **URL de YouTube** y debe producir:
1. Un **audio de trabajo normalizado** para la separación (ADR 0004).
2. **Metadatos**: título, artista, álbum (si existe) y duración — imprescindibles para buscar la letra (ADR 0005, LRCLIB exige duración con tolerancia de ±2 s).

Restricciones: todo local y gratuito; sin claves; instalable sin dependencias del sistema (ADR 0001: no exigimos `ffmpeg` instalado); riesgos legales de la descarga desde YouTube.

Estado del arte relevante (noviembre 2026):
- **yt-dlp** es la herramienta de referencia (Unlicense). Desde la versión 2025.11.12, el soporte completo de YouTube **requiere un runtime JavaScript externo** (Deno recomendado y habilitado por defecto; Node ≥ 22, Bun o QuickJS opcionales) más el componente `yt-dlp-ejs`, incluido en el extra `yt-dlp[default]`. Sin runtime, YouTube está "deprecado" y puede devolver formatos limitados o fallar.
- **Deno** se publica oficialmente en PyPI (paquete `deno`, MIT, Win x64 / macOS x64+arm64 / Linux x64+arm64), por lo que se instala en el mismo entorno uv que el worker.
- **PyAV** (BSD-3) trae FFmpeg dentro de sus wheels para Windows, macOS y Linux: permite leer prácticamente cualquier formato de audio/vídeo, leer etiquetas y remuestrear sin el ejecutable `ffmpeg`.
- YouTube cambia su web con frecuencia y rompe yt-dlp periódicamente; la solución habitual es actualizar yt-dlp.

## Alternativas consideradas
| Opción | Licencia | Pros | Contras |
|--------|----------|------|---------|
| **Descarga: yt-dlp[default] + Deno (PyPI) en el entorno uv** | Unlicense / MIT | Estándar de facto, mantenido activamente; actualizable en caliente con `uv pip install -U`; sin binarios del sistema. | Debe actualizarse a menudo; +~40 MB por Deno. |
| Descarga: ejecutable oficial de yt-dlp (binario PyInstaller) | GPLv3+ (combinado) | Incluye EJS. | Otro binario por plataforma; actualización con `-U` propia; sigue necesitando Deno. |
| Descarga: yt-dlp usando el Node embebido en Electron (`ELECTRON_RUN_AS_NODE`, `--js-runtimes node:<ruta>`) | MIT | Sin descarga extra de Deno. | Truco frágil y no documentado por yt-dlp para este uso; Node no está habilitado por defecto. Queda como plan B. |
| Descarga: bibliotecas JS (ytdl-core y derivados) | MIT | Todo en Node. | Históricamente se rompen antes y se reparan más tarde que yt-dlp; varias abandonadas. |
| **Decodificación: PyAV** | BSD-3 (+FFmpeg en wheels) | Sin `ffmpeg` del sistema; lee audio y vídeo (mp4, mkv, webm…); acceso a etiquetas y duración. | API de más bajo nivel que llamar a la CLI. |
| Decodificación: binario ffmpeg (imageio-ffmpeg / static builds) | LGPL/GPL | CLI conocida. | Sin `ffprobe` en imageio-ffmpeg; parsear stderr para metadatos es frágil. Queda como respaldo si audio-separator lo exigiera (ver ADR 0001). |
| Decodificación en el renderer (Web Audio `decodeAudioData`) | — | Sin Python para importar. | Formatos limitados (sin metadatos, sin vídeo en algunos códecs); la separación necesita el archivo en disco de todos modos. |

## Decisión

### Archivo local
- Formatos aceptados: los que decodifique PyAV/FFmpeg. Se anuncian oficialmente: **MP3, M4A/AAC, FLAC, WAV, OGG/Opus, WebM**, y también **vídeo** (MP4, MKV, MOV, WebM) del que se extrae la pista de audio.
- El archivo se decodifica a `fuente/mezcla.flac` dentro de la carpeta de la canción (en preparación: `biblioteca/.importando/<id>/`, ADR 0006), de modo que la biblioteca no depende de que el usuario mueva o borre el archivo. **El original no se copia ni se conserva** (revisión 2026-11-03).

### YouTube
- Comando del worker `fuente-youtube`: `yt-dlp` vía su API Python con `format=bestaudio/best`, `noplaylist=True`, sin postprocesado (no se usa `-x`, así no se necesita ffmpeg/ffprobe), plantilla de salida dentro del directorio de la canción, y el JSON de información (`extract_info`) para metadatos.
- Primero se obtiene **solo la información** (rápido, ~2–5 s) para mostrar título, canal, duración y miniatura antes de descargar; luego se descarga con progreso (hook `progress_hooks` → JSON Lines).
- Solo URLs de vídeo individuales (`youtube.com/watch`, `youtu.be`, `music.youtube.com`, `shorts`). Listas de reproducción, directos y contenido privado/con restricción de edad/región se rechazan con error claro (sin login ni cookies en el MVP).
- **Actualización de yt-dlp**: si una descarga falla con un error de extracción, el proceso principal ofrece/realiza `uv pip install -U "yt-dlp[default]"` y reintenta una vez. Además se comprueba como máximo una vez por semana al iniciar (si hay conexión; si falla, se ignora).

### Normalización (común a ambas fuentes)
- Decodificar con PyAV y remuestrear a **44,1 kHz estéreo**, guardado como **FLAC PCM 16 bits** (`fuente/mezcla.flac`) con soundfile: es la entrada de la separación y **se conserva** como pista "Original" del editor y de la vista previa sin pistas (respuesta a `preguntas/0005` §12). Mono → se duplica a estéreo. El archivo descargado de YouTube o el original no se conservan: se borran tras escribir la mezcla. (Antes: `trabajo.wav` float32 temporal; se sustituye porque el editor necesita la mezcla después de separar y el original puede ser un vídeo que Chromium no reproduce.) El spike (tarea 0005) verifica que la entrada FLAC 16 bits no degrada la separación.
- Medir la **sonoridad integrada (LUFS, EBU R128)** con `pyloudnorm` (MIT) y guardar una `ganancia_db` para que el reproductor iguale el volumen entre canciones (objetivo −16 LUFS, sin modificar los archivos).
- Rechazar audio de duración < 10 s o sin pista de audio; avisar (no bloquear) si dura > 10 min por el coste de la separación.

### Metadatos
- **Archivo local**: etiquetas del contenedor (`title`, `artist`, `album`) y duración vía PyAV; si faltan, heurística sobre el nombre de archivo (`Artista - Título`).
- **YouTube**: campos `track`, `artist`, `album` cuando existen (vídeos de YouTube Music); si no, `title` + `channel`/`uploader`, con limpieza heurística de sufijos ("(Official Video)", "[Lyrics]", "ft. …") y separación por " - ".
- La duración real se toma **siempre del audio decodificado** (no del contenedor ni de YouTube).
- Los metadatos son **editables por el usuario** antes de buscar la letra: la heurística fallará a menudo.

### Riesgos legales y mitigación
- Las Condiciones de servicio de YouTube prohíben descargar contenido salvo cuando YouTube lo habilita expresamente; la descarga además puede chocar con normas anti-elusión de medidas tecnológicas y la excepción de copia privada en la UE suele exigir fuente lícita. Hay precedentes de acciones de la industria discográfica contra youtube-dl (retirada DMCA en GitHub en 2020, revertida; demanda en Alemania contra el host de su web).
- Mitigaciones:
  1. El usuario aporta la URL; la app **no** incluye buscador ni catálogo de YouTube.
  2. Uso **personal y local**: sin funciones de compartir/publicar (fuera de alcance del MVP), sin subida a ningún servidor.
  3. **Aviso único** en la primera importación desde YouTube: "Usa solo contenido que tengas derecho a descargar; eres responsable del uso". Se registra la aceptación en la configuración local.
  4. yt-dlp no se incluye en el instalador: se instala desde PyPI en el primer arranque como dependencia del entorno.
  5. La importación desde YouTube se implementa como **módulo desactivable** (flag de compilación/configuración), para poder publicar builds sin YouTube (p. ej. en tiendas de apps) si fuera necesario.

## Consecuencias
- Positivas: soporte amplio de formatos sin dependencias del sistema; metadatos útiles para buscar letras; yt-dlp actualizable sin nueva versión de la app.
- Negativas / riesgos:
  - YouTube puede dejar de funcionar temporalmente (hasta que salga una versión de yt-dlp que lo arregle). Error más probable: "Sign in to confirm you're not a bot" / HTTP 403/429 — no se soportan cookies en el MVP.
  - Riesgo legal residual (ver arriba).
  - Ocupación en disco: mezcla + pistas separadas en FLAC (≈ 70–100 MB por canción de 4 min).
- Impacto en UX:
  - Importar archivo local: casi instantáneo (copia + decodificación, ~2–10 s).
  - YouTube: vista previa de información en ~2–5 s; descarga de ~5–60 s según conexión; con barra de progreso y cancelable.
  - Hace falta un formulario para **revisar/editar título y artista** tras importar.
  - Mensajes de error diferenciados: URL no válida, lista de reproducción, vídeo privado/no disponible/restringido, sin conexión, YouTube bloqueó la descarga (se reintentará tras actualizar).
  - Aviso legal único antes de la primera descarga.

## Revisiones
- 2026-11-03 (respuesta a `preguntas/0005` §3 y §12): la normalización genera `fuente/mezcla.flac` permanente en lugar de `trabajo.wav` temporal; el original no se conserva; la importación local se prepara en una carpeta oculta y la canción se materializa al confirmar.

## Fuentes
- yt-dlp (licencia, opciones, EJS): https://github.com/yt-dlp/yt-dlp
- yt-dlp EJS (runtimes JS, `yt-dlp[default]`, versiones mínimas Deno 2.3 / Node 22): https://github.com/yt-dlp/yt-dlp/wiki/EJS
- Anuncio del requisito de runtime JS (issue #15012): https://github.com/yt-dlp/yt-dlp/issues/15012
- Gigazine, yt-dlp 2025.11.12 exige Deno: https://gigazine.net/gsc_news/en/20251113-yt-dlp-required-deno-javascript-runtime
- Deno en PyPI: https://pypi.org/project/deno/
- PyAV: https://pypi.org/project/av/
- imageio-ffmpeg (respaldo): https://github.com/imageio/imageio-ffmpeg
- pyloudnorm: https://github.com/csteinmetz1/pyloudnorm
- GitHub restablece youtube-dl tras la retirada DMCA (2020): https://github.blog/news-insights/policy-news-and-insights/standing-up-for-developers-youtube-dl-is-back/
- Demanda de discográficas contra el host de la web de youtube-dl: https://news.slashdot.org/story/22/01/16/025217
- Resumen de riesgos de descarga y copia privada en la UE (fuente secundaria): https://cocondesneiges.pages.dev/en/automation/how-to-download-youtube-videos-legally/
