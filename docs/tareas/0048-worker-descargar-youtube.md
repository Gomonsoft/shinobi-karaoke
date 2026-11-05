# 0048 — Worker: comando `descargar-youtube` (descarga con progreso + normalización en el mismo trabajo)
- Estado: Hecha
- Paso del pipeline: 1
- Depende de: 0041, 0047
- ADRs: 0003, 0006, 0009 §7
- Spec UX: docs/ux/04-progreso-pipeline.md (subpasos "Descargar de YouTube" → "Preparar el audio", `prog.fase.descargando`)

## Objetivo
Un único trabajo que descarga el mejor audio del vídeo y lo convierte en `fuente/mezcla.flac` reutilizando la rutina de 0041, borrando la descarga al terminar.

## Criterios de aceptación
- [x] `python -m shinobi_worker descargar-youtube --args '{"url": "...", "salida": "<biblioteca/<id>>"}'`: `format=bestaudio/best`, `noplaylist`, plantilla `<salida>/fuente/descarga.%(ext)s`, sin postprocesado, `continuedl` desactivado (una descarga interrumpida se repite desde cero: el paso queda `interrumpido`, ADR 0006).
- [x] Progreso: `progress_hooks` → `{"fase":"descargando","valor":0..1,"detalle":{"bytes":n,"total":m}}` (`total_bytes` o `total_bytes_estimate`; sin total → `valor: null`), como mucho ~4 mensajes/s; después `{"fase":"preparando","valor":null}` y la normalización de 0041 con `borrar_entrada: true`.
- [x] Resultado (esquema de 0029): los datos de `importar-archivo` + `bytes_descargados` + `id_video`. La duración es la del audio decodificado.
- [x] Errores: los de 0047 (clasificación compartida) durante la descarga, `SIN_ESPACIO` (`ENOSPC`), y los de 0041 durante la normalización (p. ej. `FORMATO_NO_SOPORTADO`, `AUDIO_DEMASIADO_CORTO`). Ante cualquier error el worker borra `fuente/descarga.*` y `mezcla.flac.tmp`; ante cancelación (SIGTERM/`taskkill`) los borra el main en `alDescartar` (0049).
- [x] Con el doble (`SHINOBI_YTDLP_FALSO`): `descargar` genera con PyAV un audio de la duración indicada en el JSON de la fixture (opcional `bytes_por_segundo` y `ritmo` para simular una descarga lenta con progreso) o falla con el error simulado; permite probar cancelación a mitad.
- [x] Tests (CI, sin red): descarga falsa completa → `mezcla.flac` válida y sin `descarga.*`; progreso creciente con `detalle`; error de bot → `YOUTUBE_BLOQUEADO`; audio corto → `AUDIO_DEMASIADO_CORTO` sin restos; cancelación a mitad (subproceso + SIGTERM en POSIX) sin procesos huérfanos. Test `red` con el mismo vídeo libre de 0047.

## Notas de implementación
- `descargar_youtube` en `worker/shinobi_worker/youtube.py` (registrado en `comandos.py`): valida la URL, `fuente.descargar` con progreso limitado a ~4/s (`descargando` con `detalle {bytes,total}`; sin total, `valor: null`), luego `preparando` y `normalizar(..., borrar_entrada=True)` de 0041. Resultado: datos de `importar-archivo` + `bytes_descargados` + `id_video`. Ante error se borran `fuente/descarga.*` y `mezcla.flac.tmp`.
- `FuenteYoutubeReal.descargar`: `continuedl=False`; `ENOSPC` (también envuelto en `DownloadError`) -> `SIN_ESPACIO`. El logger de yt-dlp descarta el aviso "ffmpeg not found".
- Doble: la fixture JSON admite `duration`, `bytes_por_segundo`, `ritmo` (segundos de descarga simulada, progreso ~10/s) y `error_descarga`. Genera un WAV con soundfile (no PyAV; PyAV lo decodifica en la normalización).
- Tests: `worker/tests/test_descargar_youtube.py` (6 sin red + 1 `red` con Big Buck Bunny, CC BY). Probar: `uv run pytest`; real: `SHINOBI_TESTS_RED=1 uv run pytest -m red`.
- Deuda: el test `red` no se ha ejecutado aquí (sin red); `ruff check .` falla en `scripts/compilar_requisitos.py` (E501, anterior a esta tarea).
