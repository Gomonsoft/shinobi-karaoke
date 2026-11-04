# 0002 — Licencia del proyecto: GPL-3.0-or-later

- Estado: Aceptado
- Fecha: 2026-11-03
- Paso del pipeline: 0

## Contexto
Shinobi Karaoke es software libre y gratuito (ver `00-vision-y-alcance.md`). La licencia debe ser compatible con **todas** las dependencias elegidas en los ADR 0001, 0003, 0004 y 0005, incluidos binarios redistribuidos (Electron/Chromium, FFmpeg dentro de PyAV, yt-dlp) y pesos de modelos. Además, conviene que garantice que las versiones derivadas sigan siendo libres.

### Inventario de licencias de dependencias
| Componente | Licencia | Compatible con GPL-3.0 |
|-----------|----------|------------------------|
| Electron (incluye Chromium y Node) | MIT (Chromium: BSD-3 + componentes LGPL/MPL/etc.) | Sí |
| React, Vite, electron-vite, electron-builder | MIT | Sí |
| TypeScript | Apache-2.0 | Sí (con GPL-3, no con GPL-2) |
| uv | Apache-2.0 o MIT | Sí |
| Python (python-build-standalone) | PSF-2.0 | Sí |
| PyTorch | BSD-3-Clause | Sí |
| ONNX Runtime | MIT | Sí |
| audio-separator | MIT (pide crédito a UVR) | Sí |
| PyAV | BSD-3-Clause (wheels con FFmpeg LGPL o GPL) | Sí, en ambos casos |
| soundfile / libsndfile | BSD-3 / LGPL-2.1+ | Sí |
| yt-dlp | Unlicense (sus ejecutables congelados incluyen código GPLv3+) | Sí |
| yt-dlp-ejs, Deno | Unlicense / MIT | Sí |
| Pesos MelBand RoFormer (Kim) | MIT declarado en Hugging Face (el repositorio GitHub no declara licencia; hay copias que la etiquetan GPL-3.0) | Sí en ambos casos |
| Pesos UVR MDX-Net (`Inst_HQ_4`, perfil Rápido) | **Sin licencia declarada** en `TRvlvr/model_repo` (el código de UVR es MIT); revisado en la tarea 0005 | **Pendiente**: `preguntas/0012` (usuario) |
| audioread (dependencia no declarada de audio-separator) | MIT | Sí |
| imageio-ffmpeg (solo plan B, `preguntas/0009`) | BSD-2 (paquete); binario FFmpeg `--enable-gpl` | Sí (GPL compatible con GPL-3.0-or-later); acreditar FFmpeg si se activa |
| Fuentes tipográficas incluidas | SIL Open Font License 1.1 | Sí (obra agregada; la OFL permite incluirlas con cualquier software) |
| Datos de LRCLIB | Sin licencia declarada; **no se redistribuyen**, se consultan en tiempo de uso | N/A |

Excluido por licencia: **pesos de Demucs v4 (htdemucs/htdemucs_ft)**, porque su autor los declaró en el pasado "para investigación" (términos de MUSDB) y la etiqueta MIT actual en Hugging Face está en disputa; y **Open-Unmix UMX-L** (CC BY-NC-SA 4.0). Ver ADR 0004.

## Alternativas consideradas
| Opción | Licencia | Pros | Contras |
|--------|----------|------|---------|
| A. MIT | Permisiva | Máxima reutilización; simple. | Permite forks cerrados/de pago que reempaqueten el trabajo (incl. el flujo de YouTube) sin devolver mejoras. |
| B. Apache-2.0 | Permisiva con patentes | Cláusula de patentes. | Mismo problema que MIT respecto a forks cerrados. |
| C. **GPL-3.0-or-later** | Copyleft fuerte | Garantiza que derivados sigan libres; compatible con todo el inventario (incl. Apache-2.0 y componentes GPLv3 de yt-dlp/FFmpeg); precedente en apps similares (ComfyUI Desktop, UVR GUI es MIT pero muchas herramientas de audio son GPL). | Impide incorporar código o pesos con licencias incompatibles (p. ej. no comerciales) — lo cual ya es criterio del proyecto. |
| D. AGPL-3.0 | Copyleft de red | Cubre uso como servicio. | Innecesario: la app es local, no un servicio de red. Añade fricción sin beneficio. |
| E. MPL-2.0 | Copyleft débil por archivo | Intermedio. | No protege el conjunto; sin ventaja clara aquí. |

## Decisión
**GPL-3.0-or-later** para todo el código del proyecto (app Electron y worker Python).

Reglas derivadas:
- Toda nueva dependencia o modelo debe tener licencia compatible con GPL-3.0 **y** permitir uso libre (sin cláusulas no comerciales, "solo investigación" ni restricciones de campo de uso). El arquitecto lo verifica antes de aceptarla.
- Se incluirá `LICENSE` (texto GPL-3.0) en la raíz y una pantalla/archivo de **avisos de terceros** (`THIRD_PARTY_NOTICES`) con créditos obligatorios (UVR, autores de modelos, fuentes OFL, FFmpeg).
- Los pesos de modelos **no se redistribuyen** en el instalador: se descargan desde su origen en el primer arranque (ADR 0004), lo que reduce la exposición si su licencia resultara ser distinta a la declarada.

## Consecuencias
- Positivas: el proyecto y sus derivados permanecen libres; inventario compatible sin excepciones.
- Negativas / riesgos: cualquier contribución futura que quiera usar un modelo no comercial (p. ej. Demucs v4 si se confirma "solo investigación") queda vetada; la licencia de algunos pesos comunitarios está declarada de forma inconsistente (riesgo residual documentado en ADR 0004).
- Impacto en UX: hace falta una sección "Acerca de / Licencias" con los avisos de terceros y créditos (UVR, autores de modelos, LRCLIB).

## Revisiones
- 2026-11-04 (tarea 0005): los pesos UVR MDX-Net no declaran licencia (se suponía MIT con atribución) → `preguntas/0012`; se añaden audioread e imageio-ffmpeg (plan B) al inventario.

## Fuentes
- GPL-3.0: https://www.gnu.org/licenses/gpl-3.0.html ; compatibilidad de licencias (FSF): https://www.gnu.org/licenses/license-list.html
- yt-dlp (Unlicense; ejecutables con GPLv3+): https://github.com/yt-dlp/yt-dlp
- audio-separator (MIT, crédito a UVR): https://github.com/nomadkaraoke/python-audio-separator
- PyAV (BSD-3): https://pypi.org/project/av/
- Deno en PyPI (MIT): https://pypi.org/project/deno/
- Demucs (código MIT, repositorio archivado): https://github.com/facebookresearch/demucs ; disputa sobre licencia de pesos: https://huggingface.co/adefossez/HTDemucs/discussions/1
- Open-Unmix (UMX-L no comercial): https://huggingface.co/teamup-tech/Open-Unmix-weights
- MelBand RoFormer Kim (MIT en HF): https://huggingface.co/KimberleyJSN/melbandroformer
- ComfyUI Desktop (GPL-3.0, precedente): https://github.com/Comfy-Org/desktop
