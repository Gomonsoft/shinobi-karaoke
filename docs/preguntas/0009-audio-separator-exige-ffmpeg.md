# 0009 — audio-separator exige el binario `ffmpeg` al arrancar: ¿parche o imageio-ffmpeg?
- De: programador
- Para: arquitecto
- Estado: Respondida
- Bloquea: no (la tarea 0005 queda hecha; afecta a la integración del worker y a ADR 0001/0003/0004)

## Contexto
El spike 0005 (macOS arm64, audio-separator 0.48.0) midió que, **sin `ffmpeg` en el PATH, `Separator()` falla** con `FileNotFoundError: 'ffmpeg'` (`check_ffmpeg_installed()` lo lanza en el constructor, antes de cargar ningún modelo). Además, por defecto escribe los FLAC con pydub, que también ejecuta `ffmpeg`. Lo que sí es verificable:
- **Opción 1 — parche + soundfile** (sin binario): `Separator.check_ffmpeg_installed = lambda self: None` y `Separator(use_soundfile=True, output_format="FLAC")`. Separa y escribe FLAC 16 bits sin `ffmpeg` (lectura vía librosa/soundfile/PyAV no la necesita). Mide igual de rápido. Riesgo: depende de un método interno; hay que fijar la versión de audio-separator y probar al actualizar.
- **Opción 2 — `imageio-ffmpeg`** en el entorno y su binario en el PATH del proceso: funciona sin parche. Costes: +22,6 MB de descarga en macOS arm64 (38,9 MB Windows x64, 68 MB Linux x64) y ~52 MB en disco; el binario se llama `ffmpeg-macos-aarch64-v9.0`, así que hay que crear un enlace/copia llamado `ffmpeg`/`ffmpeg.exe` en un directorio del PATH del hijo; y **está compilado con `--enable-gpl`** (GPL), lo que habría que valorar frente al ADR 0002 aunque se ejecute como proceso aparte.
- Extra: audio-separator 0.48.0 **importa `audioread` sin declararlo como dependencia**; hay que añadirlo explícitamente al entorno.
- Sin medir: Windows y Linux (en esta máquina solo hay macOS).

## Pregunta
¿Adoptamos la opción 1 (parche + `use_soundfile=True`, fijando versión, con la opción 2 como plan B) o la opción 2?

## Opción provisional tomada (si no bloquea)
Opción 1 como diseño del worker, con `audioread` añadido a las dependencias y la prueba "sin ffmpeg en el PATH" como test de integración; la opción 2 queda documentada como plan B.

## Respuesta
(arquitecto, 2026-11-04)

**Se adopta la opción 1** (la provisional), con estas condiciones:
1. **Encapsulado**: el parche (`check_ffmpeg_installed` anulado) y `use_soundfile=True`, `output_format="FLAC"`, `model_file_dir=<datos>/modelos` viven solo dentro de la implementación de la interfaz `Separador` del worker (ADR 0004), en un único punto comentado. Nada más del worker toca internos de audio-separator.
2. **Versiones fijadas** en `uv.lock`: `audio-separator==0.48.0`, `torch`, `onnxruntime` y la dependencia transitiva `onnx-weekly` (o excluirla si no hace falta en inferencia). Actualizar audio-separator es un cambio deliberado que pasa por el test del punto 4.
3. **`audioread` (MIT) se declara explícitamente** en las dependencias del worker (y se añade al inventario de ADR 0002). Es un fallo de empaquetado de audio-separator, no una decisión de diseño: si una versión futura lo declara, se mantiene igual (no estorba).
4. **Test de integración "sin ffmpeg"**: el worker se ejecuta con un PATH filtrado (sin `ffmpeg`/`ffprobe`, comprobado con `which`/`where` dentro del propio test) y separa un clip corto a FLAC 16 bits. Va en la CI de los tres SO (tarea 0024 o la primera tarea de la Fase 3, con un modelo pequeño cacheado). Esto sustituye a la medición manual pendiente en Windows/Linux.
5. **Entrada siempre `mezcla.flac` PCM 16** (el spike confirmó que la salida hereda el subtipo de la entrada y que un WAV float32 con salida FLAC falla). El worker no admite otra entrada.

**Por qué no la opción 2 (imageio-ffmpeg) como solución principal**: añade 23–68 MB por SO, obliga a crear un enlace/copia `ffmpeg(.exe)` en un directorio del PATH del hijo (frágil en Windows y con rutas no ASCII) y reintroduce un ejecutable externo que la arquitectura evitó a propósito (ADR 0001/0003: PyAV cubre toda la E/S). El binario `--enable-gpl` **no es un problema de licencia**: el proyecto es GPL-3.0-or-later y FFmpeg GPL (v2+ o v3) es compatible; además no lo redistribuiríamos (lo instala uv desde PyPI en la máquina del usuario). Solo obligaría a acreditarlo en `THIRD_PARTY_NOTICES` si se activara.

**Plan B (documentado, no implementado)**: si una versión de audio-separator rompe el parche y no hay arreglo rápido, se añade `imageio-ffmpeg` (paquete BSD-2, binario GPL) al entorno y el worker antepone al PATH del proceso un directorio de `runtime/` con el enlace/copia `ffmpeg(.exe)`. Disparador: el test del punto 4 falla tras actualizar y el parche no tiene solución trivial.

Recogido en ADR 0001 (revisión 2026-11-04 bis), ADR 0002 (inventario: audioread, imageio-ffmpeg como plan B), ADR 0004 (revisión con datos del spike) y `arquitectura.md`.
