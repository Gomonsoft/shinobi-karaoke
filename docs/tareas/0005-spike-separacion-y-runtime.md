# 0005 — Spike: separación sin ffmpeg, tiempos por perfil y tamaños del runtime
- Estado: Pendiente
- Paso del pipeline: 2 (y 0: instalación)
- Depende de: 0001
- ADRs: 0001, 0003, 0004
- Spec UX: docs/ux/01-primer-arranque.md, docs/ux/04-progreso-pipeline.md, docs/ux/08-ajustes-y-acerca.md (usan las cifras que salgan de aquí)

## Objetivo
Validar cuanto antes los riesgos técnicos de la Fase 0 y obtener **datos medidos** para el manifiesto de runtime y las estimaciones de la UX:
1. que `audio-separator` funciona **sin `ffmpeg` en el PATH** leyendo `mezcla.flac` y escribiendo FLAC;
2. tiempos reales de separación por perfil y modo;
3. tamaños reales de descarga y de disco del runtime por perfil.

Es una prueba de concepto **desechable**: el código va en `spikes/separacion/` (scripts sueltos, no se importa desde `app/` ni `worker/`). El entregable son las notas de esta tarea.

## Criterios de aceptación
- [ ] **Entorno como en producción**: con `uv` (sin Python del sistema), `uv python install 3.12`, `uv venv`, `uv pip install --torch-backend=auto "audio-separator[cpu]"` (o el extra GPU que corresponda) + `av soundfile pyloudnorm`. Anotar para cada máquina disponible: SO, CPU, RAM, GPU/VRAM, backend de torch elegido, **MB descargados**, **tamaño en disco** del venv y de la caché de uv (pico y tras `uv cache prune`), y tiempo de instalación.
- [ ] **Mezcla**: script que con PyAV decodifica un MP3, un M4A y un MP4 de vídeo, remuestrea a 44,1 kHz estéreo y escribe `mezcla.flac` (PCM 16 bits) con soundfile; anota tiempo y tamaño para una canción de ~4 min. Mide la sonoridad con pyloudnorm.
- [ ] **Sin ffmpeg**: ejecutar la separación con un PATH del que se ha eliminado cualquier `ffmpeg`/`ffprobe` (comprobar con `which`/`where`) en al menos dos SO (idealmente los tres). Resultado: funciona / falla (con el error). Si falla: repetir añadiendo `imageio-ffmpeg` y poniendo su binario en el PATH del proceso; documentar qué hace falta.
- [ ] **Modelos**: identificar en el catálogo de audio-separator el archivo exacto del modelo **Rápido** (UVR MDX-Net de instrumental/voz, ONNX) y del modelo **Calidad** (MelBand RoFormer Kim); para cada uno: nombre de archivo, URL de origen, tamaño, SHA-256 y enlace a su licencia declarada. Si el candidato Rápido tiene licencia dudosa, proponer alternativa del mismo catálogo.
- [ ] **Tiempos** con la misma canción de ~4 min (y una de ~10 min en CPU): tiempo de carga del modelo, tiempo de separación, pico de RAM (y VRAM si aplica), y **factor** = minutos de proceso / minuto de audio, para: Rápido en CPU; Calidad en CPU; Calidad en MPS y en CUDA si hay hardware (si no, "sin medir").
- [ ] **FLAC 16 bits vs WAV float32 como entrada**: separar ambos y comparar las salidas (diferencia RMS en dB entre instrumentales y escucha breve); conclusión: ¿aceptable usar `mezcla.flac` como entrada? (ADR 0003, revisión 2026-11-03).
- [ ] **Progreso**: comprobar que se puede interceptar `tqdm` de audio-separator para obtener progreso 0–1 por bloques; anotar la frecuencia de actualización real y si la fase de carga del modelo es identificable.
- [ ] **Cancelación**: matar el proceso a mitad (SIGTERM / `taskkill /T /F`) no deja procesos huérfanos; anotar qué archivos parciales quedan.
- [ ] Notas con una tabla de resultados y un borrador de los datos del manifiesto (`modelos[]` con nombre, url, bytes, sha256; `runtime[plataforma][perfil].bytes_descarga` y `bytes_disco`; `factores[perfil_hardware][modo]` mín–máx). Si algo invalida una decisión (p. ej. ffmpeg imprescindible), abrir una pregunta `Para: arquitecto`.

## Notas de implementación
(las rellena el programador al terminar)
