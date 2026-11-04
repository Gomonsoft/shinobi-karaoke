# Avisos de terceros

Shinobi Karaoke se distribuye bajo GPL-3.0-or-later (ver `LICENSE`). Este archivo reúne los créditos y licencias de los componentes de terceros. Las secciones se completarán a medida que se incorporen dependencias.

## Electron y dependencias JS

Dependencias de ejecución actuales (se incluyen en el bundle de la app): React y React DOM (MIT). Electron (MIT) se distribuye con la app. El resto (electron-vite, Vite, TypeScript, ESLint, Prettier, Vitest, Testing Library, Playwright…) son herramientas de desarrollo, no se distribuyen.

(lista completa pendiente de la tarea de empaquetado)

## Worker Python

FFmpeg (vía PyAV), yt-dlp, Deno, audio-separator, PyTorch / ONNX Runtime.

Esqueleto actual (tarea 0003): sin dependencias de producción (solo biblioteca estándar). Solo desarrollo, no se distribuyen: pytest (MIT), ruff (MIT).

(pendiente: dependencias de producción de las fases 2-3)

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
