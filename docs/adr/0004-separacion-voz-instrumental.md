# 0004 — Separación voz/instrumental: audio-separator con MelBand RoFormer (GPU) o MDX-Net (CPU)

- Estado: Aceptado
- Fecha: 2026-11-03
- Paso del pipeline: 2

## Contexto
A partir de la mezcla normalizada (ADR 0003: `fuente/mezcla.flac`, 44,1 kHz estéreo) hay que obtener dos pistas: **voz** e **instrumental**. Restricciones:
- **Licencia libre del código y de los pesos** (ADR 0002: nada "solo investigación" ni no comercial).
- Funcionar en ordenadores **sin GPU** (caso mayoritario de usuarios no técnicos), aprovechando la GPU si existe (NVIDIA CUDA, Apple Silicon MPS).
- Ejecutarse **en segundo plano**, con **progreso** y **cancelación**, sin bloquear la UI.

Estado del arte (noviembre 2026):
- Los modelos **RoFormer** (BS-RoFormer, Mel-Band RoFormer) lideran en voces: SDR de voz ≈ 11–13 dB frente a ≈ 8,3–8,4 dB de HTDemucs v4. Son más lentos y consumen más memoria que HTDemucs; en CPU, "significativamente más lentos".
- **Demucs** (Meta): repositorio **archivado** el 1-1-2025 (mantenimiento mínimo en el fork de adefossez). Código MIT, pero el autor declaró los pesos v3/v4 "para investigación" (términos de MUSDB); la etiqueta MIT en Hugging Face (2026) está discutida sin respuesta del autor.
- **audio-separator** (nomadkaraoke, MIT) unifica la inferencia de arquitecturas MDX (ONNX), VR, Demucs y MDXC/RoFormer; descarga modelos bajo demanda con verificación SHA-256; soporta CUDA, Apple MPS/CoreML, CPU y DirectML experimental (MDX/VR; RoFormer cae a CPU). Python ≥ 3.10.
- Modelos **MDX-Net de UVR** (ONNX) son ligeros: ~2–5 min de CPU para una canción de 3 min (dato de un despliegue público); licencia MIT del proyecto UVR con atribución.
- **Spleeter** (Deezer): código y pesos MIT, muy rápido, pero calidad claramente inferior, TensorFlow y sin mantenimiento.

## Alternativas consideradas
| Opción | Licencia (código / pesos) | Pros | Contras |
|--------|---------------------------|------|---------|
| A. **audio-separator + MelBand RoFormer (Kim)** | MIT / MIT declarado en Hugging Face (repo GitHub sin licencia; algunas copias dicen GPL-3.0 — ambas compatibles) | Calidad de voz de primer nivel; misma API que MDX. | Lento en CPU; checkpoint grande (~0,9 GB, a confirmar); datos de entrenamiento no documentados. |
| B. **audio-separator + UVR MDX-Net (ONNX)** | MIT / MIT (UVR, con atribución) | Rápido en CPU; modelo pequeño (~50–70 MB); ONNX Runtime. | Calidad inferior a RoFormer (más "sangrado" de voz en el instrumental). |
| C. Demucs v4 (htdemucs / htdemucs_ft) | MIT / **dudosa (solo investigación)** | Muy conocido; ~1,5× duración en CPU. | Licencia de pesos incompatible con ADR 0002 mientras no se aclare; repo archivado; peor en voces que RoFormer. |
| D. Spleeter | MIT / MIT | Licencia clara, rapidísimo. | Calidad baja para karaoke; TensorFlow; abandonado. |
| E. Open-Unmix | MIT / UMX-HQ MIT, UMX-L CC BY-NC-SA | Licencia clara (UMX-HQ). | Calidad muy por debajo del estado del arte. |
| F. BS-RoFormer viperx (modelo por defecto de audio-separator) | MIT / no documentada | Mejor SDR del catálogo de audio-separator (voz 12,9). | Licencia de pesos sin declarar → no cumple ADR 0002 hasta verificarse. |

## Decisión
**Librería: `audio-separator` (MIT), ejecutada en el worker Python como proceso hijo (ADR 0001).**

**Selección automática del modelo según el hardware detectado en el primer arranque:**

| Perfil | Cuándo | Modelo | Motor |
|--------|--------|--------|-------|
| **Calidad** | GPU NVIDIA (CUDA) o Apple Silicon (MPS) disponible | MelBand RoFormer (Kim) — salida voz + instrumental (residuo) | PyTorch |
| **Rápido** | Solo CPU (o GPU no soportada por RoFormer, p. ej. DirectML) | UVR MDX-Net de instrumental/voz (ONNX, p. ej. `UVR-MDX-NET-Inst_HQ_*`; el fichero exacto se fija en la tarea de integración tras comprobar calidad y licencia) | ONNX Runtime |

- En el primer arranque solo se descarga el modelo del perfil detectado. El otro se descarga bajo demanda desde **Ajustes → Separación de voz** (respuesta a `preguntas/0003`): *Automático (recomendado)* / *Calidad* / *Rápido*; el modo se guarda en `config.json` (`separacion.modo`, ADR 0006) y solo cambia cuando el nuevo modelo está descargado y verificado. Cada separación usa el **modo vigente al empezar** (también las que estaban en cola); si su modelo no está disponible, usa el otro modo con modelo descargado. "Re-separar con más calidad" por canción queda fuera del MVP.
- **Detección del perfil en dos pasos** (respuesta a `preguntas/0005` §2): (1) previa, en el proceso principal sin Python (SO/arquitectura + `nvidia-smi`), para conocer antes de instalar el tamaño de descarga y el espacio necesario; (2) confirmación con PyTorch tras instalar (`shinobi_worker diagnostico`: CUDA/MPS operativo y ≥ 4 GB de VRAM), que solo puede rebajar Calidad → Rápido.
- **Manifiesto de runtime** (`app/resources/runtime-manifest.json`, generado en el build): por modelo, nombre de archivo, URL de origen, tamaño y SHA-256; por plataforma y perfil, tamaño de descarga de Python y dependencias; y **factores de tiempo de referencia** (min de proceso por min de audio) por perfil de hardware × modo. La UI lee de aquí tamaños y estimaciones; tras cada separación se guarda el factor medido en `config.json` y sustituye al de referencia. Tamaños aproximados: Rápido ≈ 65 MB, Calidad ≈ 0,9 GB (a confirmar en la tarea 0005).
- Los modelos se descargan desde su origen (release de audio-separator / UVR / Hugging Face) con **verificación SHA-256** y se guardan en el directorio de datos local de la app (`modelos/`), no en `/tmp` (valor por defecto de audio-separator).
- Se registra en la canción qué modelo y versión produjo las pistas (ADR 0006), para poder re-separar más tarde.
- Pistas resultantes en **FLAC** estéreo 44,1 kHz (`pistas/voz.flac`, `pistas/instrumental.flac`): sin pérdida, ~40 % más pequeñas que WAV y reproducibles por Chromium.
- Demucs v4 y BS-RoFormer viperx quedan **excluidos** hasta que sus pesos tengan una licencia libre verificable; si se aclaran, se valorarán en un ADR que sustituya a este.

### Ejecución en segundo plano, progreso y cancelación
- El proceso principal de Electron encola un trabajo `separar` (concurrencia **1** para trabajos pesados) y lanza `python -m shinobi_worker separar ...`.
- **Entrada/salida**: entrada `fuente/mezcla.flac`; la mezcla **no** se borra al terminar (ADR 0003, revisión 2026-11-03).
- **Progreso**: audio-separator usa `tqdm` internamente por bloques de audio; el worker intercepta `tqdm` (sustituyendo su salida por un emisor) y publica JSON Lines `{"tipo":"progreso","fase":"separando","valor":0.42}`. Fases: `cargando_modelo` (indeterminada, 5–20 s), `separando` (0–1), `guardando`. Con el ritmo medido se calcula un **tiempo restante estimado** en el proceso principal. Si la intercepción no fuera fiable, se usa como respaldo una estimación por tiempo (duración × factor medido del perfil) — a validar en la primera tarea.
- **Cancelación**: el proceso principal termina el proceso hijo (y su árbol) — SIGTERM y, tras 3 s, SIGKILL / `taskkill /T /F` en Windows — y borra salidas parciales. El estado del paso vuelve a `pendiente`.
- **Cierre de la app durante un trabajo**: se avisa; si se confirma, se cancela. Al reabrir, un paso que quedó `en_curso` se marca como `interrumpido` y se ofrece reintentar (no se reanuda a medias).
- **Errores**: memoria insuficiente (GPU/RAM) → reintento automático una vez con bloques más pequeños y, si persiste en GPU, en CPU con el perfil rápido; archivo de modelo corrupto → re-descarga.

### Tiempos estimados (canción de 4 min)
| Hardware | Perfil | Estimación | Fiabilidad |
|----------|--------|-----------|------------|
| NVIDIA reciente (≥ 6 GB VRAM) | Calidad | ~0,5–2 min | Media (benchmarks GPU públicos) |
| Apple Silicon (M1–M4) | Calidad | ~2–6 min | Baja (sin benchmark fiable) |
| CPU moderna (4–8 núcleos) | Rápido | ~3–7 min | Media (despliegue público: 2–5 min por 3 min de audio) |
| CPU, forzando Calidad | Calidad | ~15–40 min | Baja (estimación) |

Más 5–20 s de carga de PyTorch y del modelo por trabajo. **Las cifras deben medirse en la primera tarea técnica** ([tarea 0005](../tareas/0005-spike-separacion-y-runtime.md)) y actualizar este ADR y la sección de restricciones de `arquitectura.md`.

Requisitos mínimos orientativos: 8 GB de RAM; para el perfil Calidad en GPU, ≥ 4 GB de VRAM.

## Consecuencias
- Positivas: calidad estado del arte donde hay GPU; tiempos razonables sin GPU; una sola librería para ambos perfiles; licencias compatibles con GPL-3.0.
- Negativas / riesgos:
  - **Licencias de pesos comunitarios declaradas de forma inconsistente** (MIT en Hugging Face vs. repo sin licencia; datos de entrenamiento no documentados). Mitigación: no se redistribuyen en el instalador, se descargan desde su origen, se acredita a los autores y se revisará si aparece información nueva.
  - La calidad en CPU (perfil Rápido) será perceptiblemente peor: restos de voz en el instrumental.
  - Dependencia de un proyecto comunitario (audio-separator) para la API de inferencia; mitigación: el worker encapsula la llamada en una interfaz propia (`Separador`) para poder cambiar de librería.
  - Variabilidad grande de tiempos según hardware.
- Impacto en UX:
  - Paso **largo y asíncrono** (minutos): el usuario debe poder salir, navegar por la biblioteca o avanzar al paso de letra mientras se separa (técnicamente la letra y la sincronía pueden trabajar sobre el audio original; solo el reproductor y "marcar como lista" requieren las pistas).
  - Barra de progreso con fase y tiempo restante estimado; botón cancelar; notificación al terminar (nativa en Windows/Linux; en macOS sin firma, rebote e insignia del Dock — ver `arquitectura.md` §6).
  - Modo visible (informativo) y ajustable en Ajustes con estimación de tiempo por equipo y tamaño de descarga (respuesta a `preguntas/0003`).
  - Mensajes de error comprensibles (memoria insuficiente, modelo no descargado/sin conexión).
  - El usuario puede querer escuchar voz e instrumental para comprobar el resultado.

## Revisiones
- 2026-11-03: ajuste global de modo (respuestas a `preguntas/0003` y `0005` §2, §10); detección previa sin Python; manifiesto de runtime con tamaños, SHA-256 y factores de tiempo; entrada `mezcla.flac`.

## Fuentes
- audio-separator (MIT; arquitecturas, aceleración, descarga de modelos con SHA-256, API Python): https://github.com/nomadkaraoke/python-audio-separator
- Demucs (archivado, MIT, ~1,5× duración en CPU, ≥ 3 GB VRAM): https://github.com/facebookresearch/demucs
- Disputa de licencia de pesos HTDemucs: https://huggingface.co/adefossez/HTDemucs/discussions/1 ; https://huggingface.co/adefossez/HTDemucs-ft/discussions/1
- MelBand RoFormer Kim (HF, MIT): https://huggingface.co/KimberleyJSN/melbandroformer ; repo: https://github.com/KimberleyJensen/Mel-Band-Roformer-Vocal-Model
- Paper Mel-Band RoFormer: https://arxiv.org/pdf/2310.01809
- Comparativa de SDR por algoritmo (MVSEP): https://mvsep.com/en/algorithms
- Repositorio de entrenamiento (ZFTurbo, MIT): https://github.com/ZFTurbo/Music-Source-Separation-Training
- Benchmark 2026 HTDemucs vs BS-RoFormer vs Spleeter (tiempos GPU): https://dev.to/codesugar_lin_037a57b06a4/htdemucs-vs-bs-roformer-vs-spleeter-a-2026-audio-source-separation-benchmark-2ll8
- Tiempos CPU/GPU de MDX-Net (despliegue público): https://replicate.com/gianpaj/audio_separator
- Open-Unmix (licencias de pesos): https://huggingface.co/teamup-tech/Open-Unmix-weights
- MelBandRoFormer y CPU (ComfyUI): https://comfy.org/hub/workflows/melbandroformer-audio-separation-99aec65eea89/
