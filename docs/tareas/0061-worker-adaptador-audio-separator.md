# 0061 — Worker: adaptador `audio-separator` (sin ffmpeg, soundfile, CPU en Apple Silicon, renombrado de stems y progreso por `tqdm`)
- Estado: Hecha
- Paso del pipeline: 2
- Depende de: 0060
- ADRs: 0004 (Revisiones 2026-11-04 y 2026-11-05), 0009 §1
- Spec UX: —
- Preguntas: `preguntas/0009` (parche + `use_soundfile`), `preguntas/0010` (CPU en Apple Silicon)
- Cuándo: tras 0060; en paralelo con 0065. Es la única tarea que toca internos de audio-separator

## Objetivo
Implementar `SeparadorReal`, la versión real de la interfaz `Separador`, con todo lo que midió el spike 0005 encapsulado en un único módulo comentado.

## Criterios de aceptación
- [x] `worker/shinobi_worker/separacion_real.py` (solo se importa desde la fábrica de 0060):
  - **Sin ffmpeg** (`preguntas/0009`): anula `Separator.check_ffmpeg_installed` en **un único punto comentado** y crea `Separator(use_soundfile=True, output_format="FLAC", model_file_dir=<modelo.dir>, output_dir=<salida_dir>)`. Ningún otro módulo toca internos de audio-separator.
  - **Dispositivo** (`preguntas/0010`): con `dispositivo == 'cpu'` fuerza la CPU en todos los SO. PyTorch no ve MPS ni CUDA y ONNX Runtime usa solo `CPUExecutionProvider`. Mecanismo equivalente al `--cpu` de `spikes/separacion/separar.py`. Con `'cuda'`, la selección automática de audio-separator.
  - **Bloques**: `normal` = valores por defecto de audio-separator; `pequenos` = mitad de `segment_size` y `batch_size = 1` (en `mdxc_params` para Calidad y en `mdx_params` para Rápido). Anotar los valores en las notas.
  - **Renombrado de stems**: `(vocals)`/`(Vocals)` → `voz.flac`; `(other)`/`(Instrumental)` → `instrumental.flac`. Si falta alguno → `ERROR_INTERNO` con la lista de archivos generados en el `log`.
  - **Progreso**: envuelve `tqdm.std.tqdm.update` mientras dura la separación (y lo restaura al terminar).
    - Descarta las barras con `unit == "iB"` (descargas).
    - Calidad: una barra → `separando` 0–1.
    - Rápido: barra 1 → 0–0,97 y barra 2 → 0,97–1 (0005 §7).
    - `detalle {paso, total}` de la barra principal.
    - `load_model()` va dentro de `cargando_modelo`; la escritura de las pistas, en `guardando`.
  - **Errores**: `torch.cuda.OutOfMemoryError`, `MemoryError`, y `RuntimeError` con "out of memory", "can't allocate memory" o "DefaultCPUAllocator" → `MEMORIA_INSUFICIENTE` (reintentable). Fallo al cargar el checkpoint (archivo truncado o corrupto) → `MODELO_NO_DISPONIBLE`. ENOSPC → `SIN_ESPACIO`.
  - Nunca descarga modelos: si audio-separator intentara descargar (archivo ausente), se corta antes con `MODELO_NO_DISPONIBLE` (0060 ya comprueba los archivos).
- [x] **Versión fijada**: el adaptador comprueba al importar que `audio_separator.__version__ == "0.48.0"` (la del extra `separacion`). Si no, registra un `log` de aviso. No falla: lo detecta el test de 0062.
- [x] **Test de contrato sin PyTorch** (`tests/test_separacion_contrato.py`, CI normal, sin marcador):
  - un módulo `audio_separator` **de prueba** inyectado en `sys.modules` que imita la API usada: `Separator(...)`, `check_ffmpeg_installed()` (lanza `FileNotFoundError` si no hay `ffmpeg` en el PATH), `load_model()`, `separate()` que usa `tqdm` y escribe stems con los nombres reales;
  - comprueba con el PATH filtrado (sin `ffmpeg` ni `ffprobe`, verificado con `shutil.which` dentro del test) que el adaptador aplica el parche, pasa `use_soundfile=True`, FLAC y `model_file_dir`, renombra los stems, filtra las barras `iB` y mapea los errores.
  - Este es el test "sin ffmpeg" que corre en la CI normal de los 3 SO (0062). La prueba con el audio-separator real es `pesado`.
- [x] **Prueba `pesado`** (`tests/test_separacion_real.py`, `@pytest.mark.pesado`; necesita el extra `separacion` y el modelo Calidad en `SHINOBI_MODELOS_DIR`, si no se salta con un motivo claro):
  - separa 20 s de audio generado con Calidad en CPU, con el PATH sin ffmpeg;
  - comprueba FLAC 16 bits, 44,1 kHz, estéreo y duración ±50 ms en ambas pistas;
  - comprueba que se emitieron ≥ 1 evento de `separando` y ninguno de descarga;
  - anota en el resultado de pytest (`record_property`) los segundos y el factor.
- [x] `ruff` y tests normales sin el extra `separacion` instalado (el adaptador no se importa en la CI normal salvo con el módulo de prueba).

## Notas de implementación
- **Archivos**: `worker/shinobi_worker/separacion_real.py` (`SeparadorReal`; nombre fijado por la fabrica de 0060, no `separacion_audio_separator`), `worker/tests/test_separacion_contrato.py` (19 tests, CI normal, con `audio_separator`, `torch` y `tqdm` de prueba inyectados en `sys.modules`; PATH vacio verificado con `shutil.which`), `worker/tests/test_separacion_real.py` (`pesado`, se salta sin extra o sin `SHINOBI_MODELOS_DIR`).
- **Parche y dispositivo**: `_aplicar_parche` (unico punto) anula `Separator.check_ffmpeg_installed`; `_cpu_forzada` sustituye `torch.cuda.is_available` y `torch.backends.mps.is_available` por `False` (con `__wrapped__`) solo durante la separacion y los restaura; sin GPU visible, audio-separator usa `CPUExecutionProvider` en ONNX. Con `cuda`, seleccion automatica.
- **Bloques `pequenos`**: `segment_size` 256 -> 128 y `batch_size = 1`. Calidad: `mdxc_params={segment_size:128, override_model_segment_size:True, batch_size:1, overlap:None, pitch_shift:0}` (el override es necesario: sin el, MDXC usa el `chunk_size` del yaml). Rapido: `mdx_params={hop_length:1024, segment_size:128, overlap:0.25, batch_size:1, enable_denoise:False}`. `normal` no pasa parametros (defaults de audio-separator).
- **Progreso**: `_Progreso` + `_interceptar_tqdm` (restaura `update` en `finally`). Calidad: barra 1 -> 0-1; Rapido: barra 1 -> 0-0,97 y barra 2 -> 0,97-1 (detalle solo de la barra 1); las demas y las `iB` se descartan; el valor nunca retrocede. `separando` 0.0 al empezar; `guardando` se emite al completarse la ultima barra o, si tqdm no entrego ese ultimo update, al volver `separate()`.
- **Version**: audio-separator 0.48.0 no expone `__version__`; se usa `importlib.metadata`. Si no es 0.48.0, `log warning` al importar, sin fallar.
- **Errores**: se recorre la cadena `__cause__/__context__`: `OutOfMemoryError` (por nombre de clase, sin importar torch), `MemoryError` y `RuntimeError` con los textos de memoria -> `MEMORIA_INSUFICIENTE` reintentable; ENOSPC -> `SIN_ESPACIO`; cualquier otro fallo dentro de `load_model` -> `MODELO_NO_DISPONIBLE`; el resto -> `ERROR_INTERNO`. Stem ausente -> `ERROR_INTERNO` con la lista de archivos en el `log`; stems sobrantes se borran.
- **Probar**: `cd worker && uv run pytest tests/test_separacion_contrato.py`; real: `uv sync --extra separacion && SHINOBI_MODELOS_DIR=<dir> uv run pytest -m pesado tests/test_separacion_real.py`.
- **Deuda**: la prueba `pesado` no se ha ejecutado aqui (sin extra ni modelo). `load_model` de audio-separator aun descarga ficheros auxiliares pequenos (p. ej. `download_checks.json`) si faltan; no son modelos, pero conviene confirmarlo en la prueba real. `tqdm` no es dependencia directa (viene con el extra), por eso el test de contrato lo imita.
