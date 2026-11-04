# 0005 — Spike: separación sin ffmpeg, tiempos por perfil y tamaños del runtime
- Estado: Hecha
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
- [x] **Entorno como en producción**: con `uv` (sin Python del sistema), `uv python install 3.12`, `uv venv`, `uv pip install --torch-backend=auto "audio-separator[cpu]"` (o el extra GPU que corresponda) + `av soundfile pyloudnorm`. Anotar para cada máquina disponible: SO, CPU, RAM, GPU/VRAM, backend de torch elegido, **MB descargados**, **tamaño en disco** del venv y de la caché de uv (pico y tras `uv cache prune`), y tiempo de instalación.  
  Estado: (solo macOS arm64; Windows/Linux calculados, no medidos)
- [x] **Mezcla**: script que con PyAV decodifica un MP3, un M4A y un MP4 de vídeo, remuestrea a 44,1 kHz estéreo y escribe `mezcla.flac` (PCM 16 bits) con soundfile; anota tiempo y tamaño para una canción de ~4 min. Mide la sonoridad con pyloudnorm.
- [~] **Sin ffmpeg**: ejecutar la separación con un PATH del que se ha eliminado cualquier `ffmpeg`/`ffprobe` (comprobar con `which`/`where`) en al menos dos SO (idealmente los tres). Resultado: funciona / falla (con el error). Si falla: repetir añadiendo `imageio-ffmpeg` y poniendo su binario en el PATH del proceso; documentar qué hace falta.  
  Estado: macOS arm64: hecho (falla por defecto; funciona con parche o con imageio-ffmpeg). Windows y Linux: SIN MEDIR
- [x] **Modelos**: identificar en el catálogo de audio-separator el archivo exacto del modelo **Rápido** (UVR MDX-Net de instrumental/voz, ONNX) y del modelo **Calidad** (MelBand RoFormer Kim); para cada uno: nombre de archivo, URL de origen, tamaño, SHA-256 y enlace a su licencia declarada. Si el candidato Rápido tiene licencia dudosa, proponer alternativa del mismo catálogo.
- [~] **Tiempos** con la misma canción de ~4 min (y una de ~10 min en CPU): tiempo de carga del modelo, tiempo de separación, pico de RAM (y VRAM si aplica), y **factor** = minutos de proceso / minuto de audio, para: Rápido en CPU; Calidad en CPU; Calidad en MPS y en CUDA si hay hardware (si no, "sin medir").  
  Estado: CPU y MPS medidos en un M1 8 GB; CUDA SIN MEDIR
- [~] **FLAC 16 bits vs WAV float32 como entrada**: separar ambos y comparar las salidas (diferencia RMS en dB entre instrumentales y escucha breve); conclusión: ¿aceptable usar `mezcla.flac` como entrada? (ADR 0003, revisión 2026-11-03).  
  Estado: comparación numérica hecha; la escucha humana queda pendiente
- [x] **Progreso**: comprobar que se puede interceptar `tqdm` de audio-separator para obtener progreso 0–1 por bloques; anotar la frecuencia de actualización real y si la fase de carga del modelo es identificable.
- [~] **Cancelación**: matar el proceso a mitad (SIGTERM / `taskkill /T /F`) no deja procesos huérfanos; anotar qué archivos parciales quedan.  
  Estado: SIGTERM en macOS verificado; `taskkill /T /F` en Windows SIN MEDIR
- [x] Notas con una tabla de resultados y un borrador de los datos del manifiesto (`modelos[]` con nombre, url, bytes, sha256; `runtime[plataforma][perfil].bytes_descarga` y `bytes_disco`; `factores[perfil_hardware][modo]` mín–máx). Si algo invalida una decisión (p. ej. ffmpeg imprescindible), abrir una pregunta `Para: arquitecto`.

## Notas de implementación

### Qué se hizo
Spike desechable en `spikes/separacion/` (todo ignorado por git salvo los scripts): entorno uv aislado, scripts de mezcla, separación instrumentada, cancelación y comparación, y mediciones en una sola máquina. Preguntas abiertas para el arquitecto (no bloquean): [0009](../preguntas/0009-audio-separator-exige-ffmpeg.md) y [0010](../preguntas/0010-apple-silicon-cpu-mas-rapida-que-mps.md).

Archivos: `env.sh` (variables que mantienen uv, Python, caché y venv dentro de `spikes/separacion/`), `generar_formatos.py` (MP3/M4A/MP4 de prueba con PyAV), `mezcla.py` (PyAV -> `mezcla.flac` + LUFS), `separar.py` (separación con tiempos, RAM y captura de `tqdm`), `medir.sh` (ejecuta con PATH sin ffmpeg), `comparar.py`, `cancelar.py`, `tamanos_descarga.py` / `tamanos_plataforma.py` (tamaños de wheels).

### Cómo reproducirlo (macOS arm64; el resto de SO: ver "Sin medir")
```
cd spikes/separacion && mkdir -p salida/bin && # descargar uv (binario) en salida/bin/uv; luego:
source env.sh
$UV python install 3.12 && $UV venv --python 3.12 .venv
$UV pip install --python .venv/bin/python --torch-backend=auto "audio-separator[cpu]" av soundfile pyloudnorm audioread
.venv/bin/python mezcla.py cancion.mp3 salida/trabajo/mezcla.flac
./medir.sh rapido_cpu UVR-MDX-NET-Inst_HQ_4.onnx salida/trabajo/mezcla.flac --cpu     # sin ffmpeg en el PATH
./medir.sh calidad_cpu vocals_mel_band_roformer.ckpt salida/trabajo/mezcla.flac --cpu   # sin --cpu: MPS/CUDA automático
```
Audio de prueba: *They Didn't Believe Me* (Alice Green y Harry Macdonough, grabación de 1914, **dominio público**, Wikimedia Commons / Library of Congress), 207,2 s; de ella se generaron MP3 (192 kb/s), M4A (AAC 128) y MP4 (con vídeo negro) con PyAV. El clip de ~10 min son tres repeticiones de la misma pieza. Es un disco acústico antiguo: la calidad de la separación no es representativa, los tiempos sí.

### Máquina medida
MacBook Air, Apple M1 (8 núcleos), **8 GB de RAM**, macOS 26.5, sin GPU dedicada (MPS disponible). Python 3.12.16 (uv), torch 2.15.0, onnxruntime 1.31.1, audio-separator 0.48.0, av 19.0.2, soundfile 0.14.0, pyloudnorm 0.2.0. Red rápida. **Una sola máquina: los factores no se pueden generalizar a otros CPU.**

### 1. Instalación y tamaños (macOS arm64, backend de torch `auto` = wheels de PyPI, que sirven CPU y MPS)
| Concepto | Medido |
|----------|--------|
| Binario `uv` 0.13.7 | 28 MB (en el instalador real iría empaquetado) |
| Python 3.12.16 gestionado por uv | descarga 24 MB; disco 72 MiB; 1,8 s |
| Dependencias (`audio-separator[cpu]` + av + soundfile + pyloudnorm + audioread) | **descarga ≈ 296 MB** (suma de wheels de PyPI; `diffq` se compila desde sdist) ; 61 paquetes |
| Tiempo de `uv pip install` (caché vacía) | 13,8 s (red muy rápida; con 50 Mbit/s serían ≈ 1 min) |
| Disco del venv | **1,2 GB** (torch 569 MB, llvmlite 126, onnxruntime 76, scipy 70, av 45) |
| Caché de uv | pico 1,1 GB; `uv cache prune` **no libera nada** (todo está en uso); `uv cache clean` borra 1,1 GiB lógicos y el venv sigue funcionando. En APFS uv clona archivos, así que el disco real (df) fue +1146 MB con caché y +1103 MB tras limpiar; en Windows la caché y el venv comparten por enlaces duros, pero conviene limpiar con `uv cache clean` (o usar `UV_CACHE_DIR` temporal) tras instalar |
| Modelo Rápido | 59 074 342 B |
| Modelo Calidad | 913 106 900 B (+ yaml de 944 B) |
| `imageio-ffmpeg` (solo si se usa el plan B) | wheel 22,6 MB; 52 MB en disco |

Total Apple Silicon: descarga ≈ 296 + 24 + 59 MB (Rápido) o + 913 MB (Calidad) -> **≈ 0,38 GB (Rápido) / ≈ 1,23 GB (Calidad)**; disco ≈ 1,3 GB (Rápido) / 2,2 GB (Calidad) sin la caché. (La UX asume "Apple Silicon ≈ 4 GB" de espacio libre: sobra margen.)

Calculado desde los tamaños publicados de los wheels (NO instalado, NO medido): Windows x64 CPU ≈ 311 MB; Windows x64 con torch cu128 ≈ **3,1 GB**; Linux x64 CPU ≈ 434 MB; Linux x64 con CUDA 12.8 ≈ **4,4 GB** (los paquetes `nvidia-*` suman la mayor parte). Observación: el índice cu128 ofrece torch 2.11 y el de CPU 2.15, hay que fijar versiones por perfil. `torchvision` se instala como dependencia aunque no se use (pocos MB).

### 2. Mezcla (PyAV -> 44,1 kHz estéreo -> `mezcla.flac` PCM 16 con soundfile; 207,2 s)
| Entrada | Decodificar | Total (+ escribir FLAC) | `mezcla.flac` | LUFS integrados | Ganancia a -16 LUFS |
|---------|------------:|-------------:|-------:|------:|------:|
| MP3 192k | 0,33 s | 0,63 s | 14,3 MB | -17,6 | +1,6 dB |
| M4A AAC 128k | 0,25 s | 0,58 s | 11,9 MB | -17,4 | +1,4 dB |
| MP4 (vídeo+AAC) | 0,28 s | 0,56 s | 11,9 MB | -17,4 | +1,4 dB |
| WAV 16 bits (referencia) | 0,14 s | 0,46 s | 14,4 MB | -17,3 | +1,3 dB |
Conclusión: la importación local cuesta **< 1 s** por canción de ~3,5 min; el MP4 se lee sin ffmpeg. El FLAC pesa ~14 MB/3,5 min en esta grabación antigua; con música moderna a plena escala será mayor (por eso el ADR 0003 estima 70–100 MB/canción con pistas; aquí: mezcla 14,4 + pistas 33,8 MB (Rápido) o 22,9 MB (Calidad) = 37–48 MB).

### 3. Sin ffmpeg (macOS arm64, `env -i PATH=/usr/bin:/bin`, `which ffmpeg ffprobe` -> no encontrados)
| Prueba | Resultado |
|--------|-----------|
| A. `Separator()` por defecto | **FALLA** al construirlo: `FileNotFoundError: 'ffmpeg'` (`check_ffmpeg_installed()` no tolera su ausencia; ni siquiera llega a cargar el modelo) |
| B. Parche `Separator.check_ffmpeg_installed = lambda self: None` + `use_soundfile=True`, salida FLAC | **FUNCIONA** (lectura con librosa/soundfile, escritura FLAC 16 bits con soundfile) |
| E. Parche pero escritura por defecto (pydub) | **FALLA** al escribir: `AudioExportError ... [Errno 2] 'ffmpeg'` |
| C. Sin parche, `imageio-ffmpeg` con un enlace llamado `ffmpeg` en el PATH del proceso, escritura por defecto | **FUNCIONA** (ffmpeg 9.0); el binario de imageio se llama `ffmpeg-macos-aarch64-v9.0` (hay que enlazarlo/copiarlo como `ffmpeg`) y está compilado con `--enable-gpl` |
Hallazgos adicionales: (1) audio-separator 0.48.0 importa `audioread` sin declararlo: añadirlo al entorno; (2) sin `model_file_dir` usa `/tmp/audio-separator-models/` (crea la carpeta al listar modelos): pasar siempre `model_file_dir`; (3) el subtipo del fichero de salida **sigue al de entrada**: con `mezcla.flac` PCM_16 la salida es FLAC 16 bits (bien), pero con un WAV float32 y `output_format=FLAC` **falla** (`Invalid combination of format, subtype and endian`); (4) los stems de Calidad se llaman `(vocals)` y `(other)` (other = instrumental) y los de Rápido `(Vocals)` e `(Instrumental)`: renombrar al guardar. **Windows y Linux: sin medir** (cómo: ejecutar `medir.sh`/`separar.py` con `where ffmpeg` / `which ffmpeg` vacío; debería comportarse igual porque el fallo es de Python, pero falta confirmarlo, en especial el parche y rutas de Windows). Ver pregunta 0009.

### 4. Modelos (catálogo de audio-separator 0.48.0)
| Perfil | Fichero | URL (primera opción) | Bytes | SHA-256 | Licencia declarada |
|--------|---------|-----|------:|---------|--------------------|
| Rápido | `UVR-MDX-NET-Inst_HQ_4.onnx` (SDR voz 8,8 / instr. 15,5 según el catálogo) | `https://github.com/nomadkaraoke/python-audio-separator/releases/download/model-configs/UVR-MDX-NET-Inst_HQ_4.onnx` (más abajo) | 59 074 342 | `3c4b5b9b05090fdf238f38ba5046813982d50e2a652e9cb3324ea79720c3c9c8` | Código de UVR: MIT (GitHub `Anjok07/ultimatevocalremovergui`). **El repositorio de pesos `TRvlvr/model_repo` no declara licencia**: los pesos "MIT con atribución" del ADR 0004 son una afirmación sin fuente explícita; conviene que el arquitecto lo revise |
| Calidad | `vocals_mel_band_roformer.ckpt` (+ `vocals_mel_band_roformer.yaml`, 944 B, SHA-256 `b958b29c8f7195f0d86bee6759a33980db675c4ecaf2fcaa80fa125828e6cd38`) = "MelBand Roformer \| Vocals by Kimberley Jensen" (SDR voz 12,6) | `https://github.com/nomadkaraoke/python-audio-separator/releases/download/model-configs/vocals_mel_band_roformer.ckpt` (origen: `https://huggingface.co/KimberleyJSN/melbandroformer/resolve/main/MelBandRoformer.ckpt`, mismo tamaño y SHA) | 913 106 900 | `87201f4d31afb5bc79993230fc49446918425574db48c01c405e44f365c7559e` (coincide con LFS de Hugging Face) | **MIT** según los metadatos de Hugging Face (`license: mit`; el README no tiene más texto) |
URLs del Rápido: `https://github.com/nomadkaraoke/python-audio-separator/releases/download/model-configs/UVR-MDX-NET-Inst_HQ_4.onnx` (espejo de audio-separator) y `https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Inst_HQ_4.onnx` (origen); ambos responden 200 con el mismo tamaño. El catálogo no publica SHA-256 del Rápido (`model-checksums.json` no lo incluye): el del manifiesto es el calculado aquí. Otras variantes `Inst_HQ_1..5` tienen SDR casi idénticos (15,3–15,5); se eligió la 4 por mejor SDR de instrumental; la elección definitiva queda para la integración. El candidato "Kim" del ADR es el `vocals_mel_band_roformer` de Kimberley Jensen; las variantes "Kim FT" de unwa son otros autores con licencia sin verificar.

### 5. Tiempos (canción de 207,2 s = 3,45 min; PATH sin ffmpeg; "carga" = `load_model` con modelo ya en disco)
| Perfil / dispositivo | Carga | Separación | **Factor** (min proc./min audio) | Pico RAM (RSS) | Notas |
|----------------------|------:|-----------:|------:|------:|-------|
| Rápido, CPU (3 ejecuciones) | 1,0–1,25 s | 145–164 s | **0,70–0,79** | 1,65–2,07 GB | entrada FLAC; con WAV float32: 149 s (0,72) |
| Rápido, 10 min (621,6 s), CPU | 1,1 s | 488 s | **0,79** | 2,34 GB | |
| Rápido, automático (CoreML) | 2,4 s | 361 s | **1,74** | 3,34 GB | `CoreMLExecutionProvider`; más lento que CPU |
| Calidad, CPU | 1,8–2,3 s | 224 s (FLAC) / 234 s (WAV) | **1,08–1,13** | 3,10 GB | |
| Calidad, 10 min, CPU | 1,8 s | 790 s | **1,27** | 3,22 GB | |
| Calidad, MPS (2 ejecuciones) | 2,8 s (24,7 s la primera: incluye descargar 913 MB) | 354–357 s | **1,71–1,72** | 0,85–1,27 GB + 1,2 GB en MPS | MPS **más lento** que CPU en este M1 de 8 GB (pregunta 0010) |
| Calidad, CUDA (NVIDIA) | sin medir | sin medir | sin medir | sin medir | ver "Sin medir" |
La verificación SHA-256 del modelo de 913 MB y la creación del grafo no son relevantes tras la primera carga (carga ≈ 2 s). Los tiempos de importar torch/audio-separator (~1,7–2,0 s) se suman al arranque del proceso. Variación entre ejecuciones del mismo caso: ≈ ±8 %. Estimación ADR 0004 (Apple Silicon, Calidad, 4 min: 2–6 min): medido 4,5 min en CPU y ~7 min en MPS para 3,45 min de audio.

### 6. FLAC 16 bits vs WAV float32 como entrada
Se separó la misma mezcla como `mezcla.flac` (PCM 16) y como WAV float32 (mismas muestras sin cuantizar) y se comparó la salida (WAV float32 en el segundo caso para no cuantizar):
| Modelo | Pista | RMS de la diferencia | Relativo al RMS de la pista |
|--------|-------|------:|------:|
| Rápido | instrumental | -101,1 dBFS | -71,2 dB |
| Rápido | voz | -101,1 dBFS | -79,6 dB |
| Calidad | other (instrumental) | -101,3 dBFS | -73,1 dB |
| Calidad | voz | -101,3 dBFS | -79,7 dB |
La diferencia queda en el suelo de ruido de cuantización de 16 bits (≈ -98 dBFS): **no medible a efectos audibles; es aceptable usar `mezcla.flac` PCM 16 como entrada** (confirma ADR 0003, rev. 2026-11-03). Limitación: el agente no puede escuchar audio; la "escucha breve" queda para una persona (opcional).

### 7. Progreso (`tqdm`)
Se puede interceptar: basta con envolver `tqdm.std.tqdm.update` (los módulos hacen `from tqdm import tqdm`, pero el método es de la clase). Resultados:
- Rápido: **barra principal de 48 pasos** (3,45 min; 142 pasos para 10 min) que cubre ~97 % del tiempo, con un paso cada 2,4–3,4 s de media (máximo 4,2–6,4 s); después una **segunda barra** (37 pasos, ~2 s) de postproceso. Hay que mapear 0–0,97 -> barra 1 y 0,97–1 -> barra 2 (o ignorar la 2.ª).
- Calidad: **una barra de 19 pasos** (57 para 10 min), un paso cada 11,5 s (CPU) o 18,4 s (MPS), máximo 17 s / 26 s: **actualizaciones muy espaciadas**; la UI debe interpolar con el factor medido entre eventos.
- Fase de carga identificable: `load_model()` es una llamada separada (1–3 s con el modelo en disco; ~25 s si hay que descargarlo y verificarlo), y el último tramo "guardando" dura ~1 s (escritura de 2 FLAC); las descargas también usan `tqdm` (con `unit="iB"`), por lo que el filtro por unidad las distingue. Antes del primer paso hay 3–15 s de lectura/remuestreo de la entrada (fase "preparando", indeterminada).

### 8. Cancelación (macOS)
`SIGTERM` al proceso (sesión nueva, comprobado en Rápido tras 30 s y en Calidad tras 40 s): sale con código -15 en 0,05–0,09 s; **sin procesos huérfanos** (el grupo tenía 2 procesos, el hijo auxiliar de multiprocessing terminó con el padre); **sin ficheros parciales de salida** (audio-separator escribe las pistas solo al final). Con una **descarga de modelo** interrumpida sí queda `<modelo>.<pid>.partial` (30 MB en la prueba) en la carpeta de modelos: el proceso principal debe borrar `*.partial` al cancelar o arrancar. `taskkill /T /F` en Windows: sin medir.

### 9. Borrador de datos para `runtime-manifest.json`
```json
{
  "modelos": [
    {"id": "rapido",  "archivo": "UVR-MDX-NET-Inst_HQ_4.onnx",
     "url": ["https://github.com/nomadkaraoke/python-audio-separator/releases/download/model-configs/UVR-MDX-NET-Inst_HQ_4.onnx",
             "https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Inst_HQ_4.onnx"],
     "bytes": 59074342, "sha256": "3c4b5b9b05090fdf238f38ba5046813982d50e2a652e9cb3324ea79720c3c9c8"},
    {"id": "calidad", "archivo": "vocals_mel_band_roformer.ckpt",
     "url": ["https://github.com/nomadkaraoke/python-audio-separator/releases/download/model-configs/vocals_mel_band_roformer.ckpt",
             "https://huggingface.co/KimberleyJSN/melbandroformer/resolve/main/MelBandRoformer.ckpt"],
     "bytes": 913106900, "sha256": "87201f4d31afb5bc79993230fc49446918425574db48c01c405e44f365c7559e",
     "extra": [{"archivo": "vocals_mel_band_roformer.yaml", "url": "https://github.com/nomadkaraoke/python-audio-separator/releases/download/model-configs/vocals_mel_band_roformer.yaml", "bytes": 944,
                "sha256": "b958b29c8f7195f0d86bee6759a33980db675c4ecaf2fcaa80fa125828e6cd38"}]}
  ],
  "runtime": {
    "darwin-arm64": {"cpu_o_mps": {"bytes_descarga": 320000000, "bytes_disco": 1280000000, "medido": true}},
    "win32-x64":    {"cpu": {"bytes_descarga": 313000000, "bytes_disco": null, "medido": false},
                     "cuda": {"bytes_descarga": 3100000000, "bytes_disco": null, "medido": false}},
    "linux-x64":    {"cpu": {"bytes_descarga": 436000000, "bytes_disco": null, "medido": false},
                     "cuda": {"bytes_descarga": 4400000000, "bytes_disco": null, "medido": false}}
  },
  "factores": {
    "apple_silicon_m1_8gb": {"rapido_cpu": [0.70, 0.79], "calidad_cpu": [1.08, 1.27], "calidad_mps": [1.71, 1.72], "rapido_coreml": [1.74, 1.74]},
    "cpu_x86": {"rapido": null, "calidad": null},
    "nvidia_cuda": {"calidad": null}
  }
}
```
(`bytes_descarga` de darwin = 296 MB de wheels + 24 MB de Python; `bytes_disco` = venv 1,2 GB + Python 72 MiB, sin la caché de uv, sin modelo. Las cifras de Windows y Linux son los wheels publicados + Python, calculadas.)

### Sin medir (cómo medirlo después)
- **NVIDIA/CUDA (Windows y Linux)**: en una máquina con GPU, `uv pip install --torch-backend=auto "audio-separator[gpu]" av soundfile pyloudnorm audioread` y `./medir.sh calidad_cuda vocals_mel_band_roformer.ckpt mezcla.flac` (sin `--cpu`); además VRAM: añadir `torch.cuda.max_memory_allocated()` a `separar.py`. Medir también MB descargados reales y disco del venv (esperable 4–8 GB) y tiempo de instalación.
- **Windows y Linux sin GPU**: lo mismo con `--cpu`; en Windows comprobar `where ffmpeg` vacío y la cancelación con `taskkill /T /F /PID`, y que el enlace/copia `ffmpeg.exe` de imageio-ffmpeg funciona (plan B).
- **CPU x86 típica y Macs con más RAM/GPU (M2–M4 Pro/Max)**: los factores de la tabla son solo de un M1 de 8 GB.
- Escucha humana de FLAC vs WAV y de la calidad de separación con música actual.

### Deuda técnica / observaciones para la integración
- Anclar versiones de audio-separator, torch, onnxruntime; la API/CLI de audio-separator cambia con frecuencia y el parche es de un método interno (pregunta 0009).
- Pasar siempre `model_file_dir`, `use_soundfile=True`, y renombrar los stems (`other` -> instrumental).
- Verificar los pesos del modelo Rápido: la licencia explícita del repo de pesos de UVR no está declarada.
- `onnx-weekly` (versión de desarrollo) entra como dependencia transitiva: valorar fijarlo o excluirlo.

### Disco ocupado y cómo borrarlo
Todo lo descargado está dentro de `spikes/separacion/` (ignorado por git: `.venv/` y `salida/`): **≈ 4,2 GB** (venv 1,2 GB, caché uv 1,1 GB, modelos 0,94 GB, pistas generadas 0,61 GB, audio y mezclas 0,2 GB, Python 72 MB, uv 27 MB). Borrar: `rm -rf spikes/separacion/.venv spikes/separacion/salida`. Aviso: uv creó además `~/.cache/uv` (≈ 33 MB) fuera de `spikes/`; se puede borrar con `rm -rf ~/.cache/uv` (no se pudo borrar desde la sesión). No se instaló nada global.
