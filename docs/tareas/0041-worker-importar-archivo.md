# 0041 — Worker: comando `importar-archivo` (PyAV → `mezcla.flac` 16 bits, sonoridad y metadatos)
- Estado: Hecha
- Paso del pipeline: 1
- Depende de: 0028, 0029
- ADRs: 0003 (normalización y metadatos), 0006, 0009
- Spec UX: docs/ux/03-anadir-cancion.md ("Leyendo el audio…", errores de fuente, aviso > 10 min)

## Objetivo
Convertir cualquier archivo de audio o vídeo que lea PyAV en la mezcla normalizada de la canción y devolver los datos que necesita el formulario "Revisar datos". Es también la rutina que reutiliza `descargar-youtube` (0048).

## Criterios de aceptación
- [ ] `python -m shinobi_worker importar-archivo --args '{"entrada": "<ruta>", "salida": "<dir de la canción>", "borrar_entrada": false}'` escribe `<salida>/fuente/mezcla.flac`: primera pista de **audio** del contenedor (se ignora el vídeo), remuestreada con `av.AudioResampler` a 44 100 Hz, estéreo (mono → duplicado; > 2 canales → *downmix* de PyAV), PCM 16 bits, escrita con soundfile **por bloques** (memoria acotada: un archivo de 11 min no carga todo en memoria a la vez salvo lo que exija pyloudnorm; anotar el pico de RAM).
- [ ] Escritura segura: se escribe `mezcla.flac.tmp` y se renombra al terminar; si falla o se cancela no queda `mezcla.flac` parcial (el `.tmp` lo borra el worker en errores controlados y el main en cancelación).
- [ ] Sonoridad integrada con pyloudnorm sobre las muestras decodificadas → `lufs` y `ganancia_db = -16 - lufs` redondeada a 0,1 dB y limitada a [-20, +20]; audio en silencio (LUFS `-inf`) → `ganancia_db = 0`.
- [ ] Metadatos: etiquetas `title`/`artist`/`album` del contenedor y del *stream* (sin distinguir mayúsculas; ID3, MP4, Vorbis); si falta el título, heurística sobre el nombre de archivo (`Artista - Título`, quitando extensión, `_` → espacio, números de pista iniciales `01 `/`01. `/`01 - `); recortes de espacios; máximo 200 caracteres (como `ux/03`). `duracion_ms` = muestras decodificadas / 44 100 (nunca la del contenedor). `nombre_original` = nombre base del archivo.
- [ ] Errores (`tipo: error` con el código del catálogo): sin pista de audio, contenedor ilegible, archivo de texto, truncado sin muestras → `FORMATO_NO_SOPORTADO`; duración < 10 s → `AUDIO_DEMASIADO_CORTO`; `ENOSPC` → `SIN_ESPACIO`; entrada inexistente → `ARGUMENTOS_NO_VALIDOS`. Mensaje técnico en `mensaje`, sin rutas del usuario en el texto pensado para la UI.
- [ ] Progreso: `{"fase":"preparando","valor":null}` al empezar y, si la duración del contenedor es conocida, valores 0–1 por bloques (la UI puede ignorarlos: `ux/03` usa barra indeterminada).
- [ ] El archivo de entrada **no se modifica** (test: SHA-256 y `mtime` iguales antes y después) salvo con `borrar_entrada: true` (lo usa YouTube), que lo borra al terminar con éxito.
- [ ] Resultado con el esquema de 0029. `duracion_ms > 600000` no es error (la UI muestra el aviso).
- [ ] Tests con el audio generado de 0028: cada formato anunciado (MP3, M4A, FLAC, WAV 16/24/float, OGG/Opus, WebM, MP4, MKV), mono, multicanal, etiquetas con tildes/CJK, heurística del nombre, corto, largo (11 min, < 10 s de proceso), sin audio, corrupto, texto `.mp3`, entrada intacta, `borrar_entrada`, salida 44,1 kHz/2 canales/`PCM_16` comprobada con soundfile, `ganancia_db` de un tono a −20 LUFS ≈ +4 dB. Uno de ellos con `PATH` sin `ffmpeg` (subproceso con entorno limpio) en los 3 SO.

## Notas de implementación
- Módulo `worker/shinobi_worker/importar_archivo.py`, registrado en `comandos.py` como `importar-archivo`. API pública reutilizable por 0048: `normalizar(entrada, salida, borrar_entrada=False, alprogreso=None) -> dict` (esquema `ResultadoImportarArchivo`), `metadatos_desde_nombre(nombre)` y `limpiar_texto(texto)`.
- Decodifica con PyAV (primera pista de audio; `AudioResampler` a `fltp` estéreo 44,1 kHz), escribe por bloques en `mezcla.flac.tmp` (soundfile, FLAC PCM_16) y renombra al terminar; en errores controlados o interrupciones borra el `.tmp`. Los bloques float32 se acumulan solo para pyloudnorm.
- Metadatos: etiquetas del contenedor y del stream (sin distinguir mayúsculas); si falta `title`, heurística del nombre (el artista de la etiqueta tiene prioridad sobre el de la heurística). Archivo truncado con alguna muestra decodificada se acepta (con la duración real); sin muestras → `FORMATO_NO_SOPORTADO`.
- Cómo probarlo: `cd worker && uv run pytest tests/test_importar_archivo.py` (46 tests, ~25 s; incluye subproceso con `PATH` vacío).
- Medido (macOS, WAV estéreo de 11 min): 3,75 s y **pico de RAM ≈ 966 MB** (float32 acumulado ≈ 233 MB, más las copias float64 de pyloudnorm).
- Ajuste de CI: el umbral de 10 s medía tiempo de pared y falló en Windows con 10,86 s; otra ejecución registró 17,1 s. La prueba funcional de 11 min ya no impone ese umbral dependiente del equipo: comprueba resultado, progreso y número completo de muestras del FLAC, con el límite general de 60 s del subproceso. El objetivo de 10 s queda como referencia de rendimiento, no como garantía de CI. En macOS la prueba tardó 3,89 s en la suite; `worker/.venv/bin/pytest --durations=5`: 327 aprobadas, 7 deseleccionadas; Ruff y formato correctos.
- Deuda: (1) el pico de RAM podría bajar midiendo la sonoridad por bloques con `pyloudnorm.IIRfilter` + gating propio; no se hace por no reimplementar R128. (2) `SIN_ESPACIO` solo se prueba con un fallo simulado (`ENOSPC`). (3) Las pruebas en Windows/Linux no se han ejecutado aquí. (4) `-70 LUFS` o menos (puerta absoluta) se trata como silencio (`lufs: null`, ganancia 0).
