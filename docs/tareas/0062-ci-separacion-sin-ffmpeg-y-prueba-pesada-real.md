# 0062 — CI: separación "sin ffmpeg en el PATH" en los 3 SO y prueba `pesado` con el modelo real en `runtime-real`
- Estado: En curso (código hecho y validado en local; falta la primera ejecución de `runtime-real` en GitHub)
- Paso del pipeline: 2
- Depende de: 0061; 0056 (`runtime-real` instala Calidad). Coordinar con 0058, que también edita `runtime-real.yml` e `instalar-runtime.mjs`
- ADRs: 0004 (Consecuencias: parche mitigado con versión fijada y test), 0007, 0009 §8
- Spec UX: —
- Preguntas: `preguntas/0009` punto 4 (test "sin ffmpeg" en la CI de los 3 SO)
- Cuándo: en cuanto esté 0061; en paralelo con 0065–0068

## Objetivo
Cerrar el riesgo del parche de audio-separator con dos niveles de prueba, sin descargar modelos ni instalar PyTorch en la CI normal:
1. **CI normal** (cada push y PR, 3 SO): test de contrato con el PATH sin ffmpeg y un audio-separator de prueba (0061), más el comando `separar` con el doble (0060).
2. **`runtime-real`** (manual, 3 SO): audio-separator y PyTorch reales y el modelo Calidad que acaba de instalar el gestor, también sin ffmpeg en el PATH.

## Criterios de aceptación
- [ ] **CI normal** (`.github/workflows/ci.yml`, job `worker`, matriz de 3 SO):
  - un paso explícito "Separación sin ffmpeg en el PATH" que ejecuta `uv run pytest tests/test_separacion_contrato.py tests/test_separar*.py -v` con un PATH reducido, sin `ffmpeg`/`ffprobe`. En Windows se quita del PATH cualquier directorio que contenga `ffmpeg.exe`, y el propio test lo comprueba con `shutil.which`. Los runners de GitHub traen ffmpeg instalado: el paso debe fallar si el filtro no lo quita;
  - la CI normal **no** instala el extra `separacion` ni descarga modelos: comprobación en el mismo paso (`python -c "import importlib.util,sys; sys.exit(importlib.util.find_spec('torch') is not None)"`).
- [ ] **`runtime-real.yml`**: el paso "Pruebas con red y pesadas del worker" recibe `SHINOBI_MODELOS_DIR=<SHINOBI_DATOS>/modelos` (el modelo Calidad que instaló el gestor) y ejecuta los `pesado` con el PATH sin ffmpeg (mismo filtro que la CI normal), de modo que `test_separacion_real.py` (0061) corre en Windows, macOS y Linux.
- [ ] **Separación real de extremo a extremo** en `app/scripts/instalar-runtime.mjs`, tras instalar y con el lanzador de producción:
  - `separar` sobre 60 s de audio generado, con Calidad en CPU y sin ffmpeg en el PATH;
  - añade al JSON `separacion: { segundos, factor, pico_rss_mb | null, voz_bytes, instrumental_bytes }`;
  - falla si faltan las pistas o no son FLAC 16 bits.
  Cubre el criterio opcional de la tarea 0058 ("primer factor x86").
- [ ] **Versión de audio-separator**: un test `pesado` comprueba que la instalada es la de `pyproject.toml` (`0.48.0`). El README del worker indica que **actualizar audio-separator, torch u onnxruntime exige ejecutar `runtime-real`** antes de fusionar, y que si el parche deja de funcionar se aplica el plan B de `preguntas/0009` (imageio-ffmpeg) previa pregunta al arquitecto.
- [ ] Primera ejecución de `runtime-real` con este cambio: copiar a las notas, por SO, el factor de Calidad en CPU (60 s) y el resultado del `pesado`. Si en Windows o Linux el factor medido queda fuera de la estimación del manifiesto (`estimacion.cpu.calidad`) en más de un 30 %, abrir una pregunta `Para: arquitecto` para actualizar los factores.

## Notas de implementación
**Qué se hizo**
- `worker/scripts/sin_ffmpeg.py` (+ `tests/test_sin_ffmpeg.py`): ejecuta un comando con el PATH sin carpetas con `ffmpeg`/`ffprobe` (`.exe/.cmd/.bat` en Windows), resuelve el ejecutable con el PATH original, falla con código 3 si `shutil.which` aún los ve y exporta `SHINOBI_SIN_FFMPEG=1`; con esa variable `test_path_heredado_sin_ffmpeg_si_lo_pide_la_ci` (contrato) y `test_path_externo_sin_ffmpeg` comprueban el PATH heredado.
- `ci.yml`, job `worker` (3 SO): paso "Separación sin ffmpeg en el PATH" (`shell: bash`) con el filtro y `pytest tests/test_separacion_contrato.py tests/test_separar*.py -v`, más la comprobación de que `torch` no está instalado.
- `runtime-real.yml`: el paso antiguo se divide en "Pruebas con red del worker" (`-m red`) y "Pruebas pesadas del worker (sin ffmpeg en el PATH)" (`-m pesado` con el filtro y `SHINOBI_MODELOS_DIR=${{ runner.temp }}/shinobi-datos/modelos`).
- `test_separacion_real.py`: nuevo `pesado` de versión (instalada == `pyproject.toml` == 0.48.0; se salta sin el extra).
- `app/scripts/instalar-runtime.mjs`: tras `demo`/`diagnostico`, con el lanzador de producción y el PATH sin ffmpeg, genera 60 s de audio sintético (FLAC 16 bits) y ejecuta `separar` (Calidad, CPU, `normal`). El JSON añade `separacion: {segundos, factor, pico_rss_mb|null, voz_bytes, instrumental_bytes, segundos_separando, estimacion_manifiesto}`; falla si faltan las pistas o no son FLAC de 16 bits (se lee STREAMINFO). El pico de RAM se muestrea cada 2 s con `ps` (macOS/Linux) o CIM (Windows): el mayor RSS entre los procesos con `shinobi_worker` en la línea de comandos; `null` si falla.
- `worker/README.md`: sección de separación sin ffmpeg y la regla de ejecutar `runtime-real` al actualizar audio-separator/torch/onnxruntime (plan B: `preguntas/0009`).

**Validado en local**: `uv run pytest` (312 pasan), ruff check/format, `sin_ffmpeg.py uv run pytest contrato + separar*` (40 pasan) con `torch` ausente, YAML de ambos workflows parseado (ruby) y Prettier, Prettier/ESLint/`node --check` del script, el generador de audio (FLAC PCM_16 estéreo) y el lector de bits del FLAC. **No** se ejecutó el workflow ni la separación real (sin modelo ni PyTorch).

**Pendiente (primera ejecución en GitHub)**: copiar aquí, por SO, `separacion.factor` (Calidad CPU, 60 s) y el resultado del `pesado`. Si en Windows o Linux el factor queda fuera de `estimacion.cpu.calidad` ([1,5; 4]) en más de un 30 %, abrir pregunta `Para: arquitecto`. Coordinado con 0058: se relió `instalar-runtime.mjs` y solo se añadió el bloque de separación.
- Nota: si en un runner ffmpeg está en una carpeta de sistema (p. ej. `/usr/bin`), el filtro la quita entera; `uv` y el comando se resuelven antes con el PATH original, pero si algún paso necesitara otra herramienta de esa carpeta habría que revisarlo en la primera ejecución.
