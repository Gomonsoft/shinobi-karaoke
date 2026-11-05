# Avisos de terceros

Shinobi Karaoke se distribuye bajo GPL-3.0-or-later (ver `LICENSE`). Este archivo reúne los créditos y licencias de los componentes de terceros. Las secciones se completarán a medida que se incorporen dependencias.

## Electron y dependencias JS

Dependencias de ejecución actuales (se incluyen en el bundle de la app): React y React DOM (MIT). Electron (MIT) se distribuye con la app. El resto (electron-vite, Vite, TypeScript, ESLint, Prettier, Vitest, Testing Library, Playwright…) son herramientas de desarrollo, no se distribuyen.

- **yaml** (eemeli/yaml) 2.9.1 — ISC, © Eemeli Aro, <https://github.com/eemeli/yaml>. Solo en el proceso principal (lectura del Lyricsfile de LRCLIB, tarea 0080); no entra en el bundle del renderer.

(lista completa pendiente de la tarea de empaquetado)

## Worker Python

FFmpeg (vía PyAV), yt-dlp, Deno, audio-separator, PyTorch / ONNX Runtime.

Dependencias base de la Fase 2 (tarea 0028), versiones fijadas en `worker/uv.lock`. Licencias comprobadas en los metadatos de las ruedas instaladas (`importlib.metadata`, `licenses/` de cada `dist-info`) y en el binario de FFmpeg:

- **PyAV** (`av`) 19.0.2 — BSD-3-Clause, <https://github.com/PyAV-Org/PyAV>.
- **FFmpeg incluido en las ruedas de PyAV** (libavcodec/libavformat/libavutil 63.1/63.1/61.1) — licencia **efectiva**: se declara LGPL-3.0 o posterior (`avutil_license() = "LGPL version 3 or later"`, configuración con `--enable-version3`, sin `--enable-gpl` ni `--enable-nonfree`), pero **todas las ruedas incluyen y enlazan libx264 y libx265 (GPL-2.0-or-later)**, de modo que el conjunto, tal como se distribuye, se rige en la práctica por la **GPL-3.0** (compatible con la GPL-3.0-or-later de este proyecto). Revisión hecha con `worker/scripts/inspeccionar_av.py` sobre las ruedas `av` 19.0.2 fijadas en `worker/requisitos/` (macOS arm64, Windows x64 —CPU y CUDA, la misma rueda— y Linux x64 —CPU y CUDA, la misma rueda—) y la de macOS x64 (sin archivo de requisitos): en ninguna aparece `--enable-nonfree`, `libfdk`, `libnpp`, `cuda-nvcc` ni `decklink`. Además de x264 y x265 enlazan libmp3lame (LGPL-2.1+), libopus (BSD-3-Clause), libvpx (BSD-3-Clause), libdav1d (BSD-2-Clause), libwebp (BSD-3-Clause), libSvtAv1Enc (BSD-3-Clause-Clear/AOM), libvmaf (BSD-2-Clause-Patent) y zlib; la de Windows, libvpl (MIT), y las de Windows y Linux activan `--enable-nvenc/nvdec/amf`, que solo cargan en tiempo de ejecución los controladores del fabricante (no incluyen código propietario). PyAV no se incluye en el instalador: se instala desde PyPI en el primer arranque (ADR 0002, Revisiones). Se repite la comprobación en cada cambio de la versión de `av`. <https://ffmpeg.org/legal.html>, <https://github.com/PyAV-Org/pyav-ffmpeg>.
- **x264** (libx264.165) — GPL-2.0-or-later, © VideoLAN / x264 project, <https://www.videolan.org/developers/x264.html>. Incluido en las ruedas de PyAV; este programa no lo usa para codificar vídeo.
- **x265** (libx265.217) — GPL-2.0-or-later, © MulticoreWare, Inc., <https://bitbucket.org/multicoreware/x265_git>. Incluido en las ruedas de PyAV; este programa no lo usa para codificar vídeo.
- **soundfile** 0.14.0 — BSD-3-Clause, <https://github.com/bastibe/python-soundfile>.
- **libsndfile** 1.2.2 (incluida en la rueda de soundfile) — LGPL-2.1-or-later, texto en `_soundfile_data/COPYING` de la rueda.
- **numpy** 2.5.4 — BSD-3-Clause (la rueda declara `BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0` por componentes empaquetados), <https://github.com/numpy/numpy>.
- **pyloudnorm** 0.2.0 — MIT, <https://github.com/csteinmetz1/pyloudnorm>.
- **yt-dlp** 2026.10.26 — Unlicense (dominio público), <https://github.com/yt-dlp/yt-dlp>.
- **yt-dlp-ejs** 0.8.0 — `Unlicense AND MIT AND ISC` según los metadatos de la rueda (el propio código es Unlicense; MIT e ISC por las bibliotecas JavaScript empaquetadas), <https://github.com/yt-dlp/ejs>.
- **Deno** (paquete PyPI `deno` 2.9.8, redistribuye los binarios de Deno) — MIT, <https://github.com/denoland/deno>.

Solo desarrollo, no se distribuyen: pytest (MIT), ruff (MIT).

Extra `separacion` (se instala en el primer arranque con los requisitos bloqueados de `worker/requisitos/`, tarea 0030). Licencias según los metadatos de PyPI y los repositorios de cada proyecto:

- **audio-separator** 0.48.0 — MIT, <https://github.com/nomadkaraoke/python-audio-separator>.
- **PyTorch** (`torch` 2.15.0; 2.11.0+cu128 en NVIDIA) — BSD-3-Clause, <https://github.com/pytorch/pytorch>. Las ruedas CUDA arrastran las bibliotecas `nvidia-*` de NVIDIA (licencia de usuario final de NVIDIA CUDA), que no se redistribuyen con la app: las descarga el usuario desde PyPI en su equipo.
- **ONNX Runtime** (`onnxruntime` 1.31.1) — MIT, <https://github.com/microsoft/onnxruntime>.
- **audioread** 3.1.0 — MIT, <https://github.com/beetbox/audioread>.
- **onnx-weekly** 1.24.0.dev20261102 (dependencia transitiva) — Apache-2.0, <https://github.com/onnx/onnx>.

El modelo Rápido (`UVR-MDX-NET-Inst_HQ_4.onnx`) sigue con licencia no declarada y uso provisional (sección siguiente y `docs/preguntas/0012-licencia-no-declarada-del-modelo-rapido.md`); el manifiesto lo marca con `licencia: "no declarada"` y `provisional: true`. El resto de dependencias transitivas (más de 60 paquetes) se revisarán al empaquetar (tarea 0025).

## Modelos de separación

Los modelos no se incluyen en el instalador: se descargan desde su origen en el primer arranque.

- **MelBand RoFormer (Kim)** — `vocals_mel_band_roformer.ckpt` (perfil Calidad). Licencia MIT según su repositorio en Hugging Face.
- **UVR MDX-Net** — `UVR-MDX-NET-Inst_HQ_4.onnx` (perfil Rápido). **Licencia no declarada** por el repositorio de pesos; uso provisional pendiente de aclaración de los autores de UVR (ver `docs/preguntas/0012-licencia-no-declarada-del-modelo-rapido.md`). El código de UVR es MIT.

## Fuentes tipográficas

SIL Open Font License 1.1.

- **Atkinson Hyperlegible Next** 400, 600 y 700 (WOFF2 sin modificar), (c) 2020-2024 The Atkinson Hyperlegible Next Project Authors, <https://github.com/googlefonts/atkinson-hyperlegible-next>. Licencia OFL 1.1 en `app/resources/fonts/atkinson-hyperlegible-next/OFL.txt`. El archivo OFL no declara *Reserved Font Name*. Es la fuente de la interfaz y la predeterminada de la letra.

Familias para la letra del karaoke (pregunta 0004), un archivo WOFF2 cada una con el `OFL.txt` de su repositorio en `app/resources/fonts/<familia>/`. Los archivos son las fuentes originales sin modificar (solo reempaquetadas de TTF a WOFF2, sin subconjuntos ni cambio de nombre). Nunito y Playfair Display se incluyen como fuente variable completa (la letra usa el peso 800) para no modificar el diseño. Peso total del registro de la letra: unos 674 KB.

- **Nunito** 800 (variable), (c) 2014 The Nunito Project Authors, <https://github.com/googlefonts/nunito>. OFL 1.1. Sin *Reserved Font Name*.
- **Montserrat** 700, (c) 2024 The Montserrat.Git Project Authors, <https://github.com/JulietaUla/Montserrat>. OFL 1.1. Sin *Reserved Font Name*.
- **Oswald** 600, (c) 2016 The Oswald Project Authors, <https://github.com/googlefonts/OswaldFont>. OFL 1.1. Sin *Reserved Font Name*.
- **Lora** 700, (c) 2011 The Lora Project Authors, <https://github.com/cyrealtype/Lora-Cyrillic>. OFL 1.1. *Reserved Font Name*: "Lora" (el archivo no se ha modificado ni renombrado).
- **Playfair Display** 800 (variable), (c) 2017 The Playfair Display Project Authors, <https://github.com/clauseggers/Playfair-Display> (archivo del catálogo oficial <https://github.com/google/fonts/tree/main/ofl/playfairdisplay>). OFL 1.1. *Reserved Font Name*: "Playfair Display" (sin modificar ni renombrar).
- **Bangers** 400, (c) 2010 The Bangers Project Authors, <https://github.com/googlefonts/bangers> (archivo del catálogo oficial <https://github.com/google/fonts/tree/main/ofl/bangers>). OFL 1.1. Sin *Reserved Font Name*.
- **Noto Sans** 700 (versión 2.015, variante sin hinting), (c) 2022 The Noto Project Authors, <https://github.com/notofonts/latin-greek-cyrillic>. OFL 1.1. Sin *Reserved Font Name*.

## Iconos

- **Lucide** (`lucide-react`, ISC; partes derivadas de Feather bajo MIT), <https://lucide.dev/license>. Se incluye en el bundle del renderer solo con los iconos importados.

## Servicios

LRCLIB (consultado en tiempo de uso; sus datos no se redistribuyen).

(pendiente)
