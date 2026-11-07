# 0001 — Plataforma y stack: app de escritorio Electron + worker Python gestionado con uv

- Estado: Aceptado
- Fecha: 2026-11-03
- Paso del pipeline: 0

## Contexto
Shinobi Karaoke debe funcionar **en local**, ser **gratuito y libre**, e **instalarse sin conocimientos técnicos** en Windows, macOS y Linux. El pipeline exige dos mundos muy distintos:

- **Interfaz rica y precisa en tiempo**: biblioteca, asistente de creación, editor de sincronía y reproductor a pantalla completa con resaltado de letra sincronizado con el audio.
- **Procesamiento pesado de audio**: descarga desde YouTube (yt-dlp, Python), decodificación y separación voz/instrumental con modelos de PyTorch/ONNX (ecosistema Python). Ver ADR 0003 y 0004.

El coste dominante de instalación **no es el framework de UI** sino Python + PyTorch + modelos (cientos de MB a varios GB). Un empaquetado con PyInstaller de un servidor con PyTorch ocupa ~410 MB en CPU y ~2,4 GB con CUDA (dato de un proyecto real, Voicebox), y PyInstaller no hace compilación cruzada.

## Alternativas consideradas
| Opción | Licencia | Pros | Contras |
|--------|----------|------|---------|
| A. **Web local** (servidor Python + UI en el navegador del usuario) | MIT/BSD (FastAPI, etc.) | Lo más simple de programar; un solo lenguaje en backend. | Igualmente hay que instalar Python/PyTorch; "abrir el navegador en localhost" confunde al usuario no técnico; pantalla completa, atajos y diálogos de archivo limitados por el navegador; ciclo de vida del servidor (cerrar pestaña ≠ cerrar app). |
| B. **Tauri 2** + sidecar Python (PyInstaller) | MIT/Apache-2.0 | Binario de UI muy pequeño (3–10 MB), poca RAM. | Usa el WebView del sistema: en Linux WebKitGTK necesita plugins de GStreamer para `<audio>` (error `autoaudiosink not found`, evento `ended` que no se dispara), y el render/tipografía difiere entre SO. La ventaja de tamaño desaparece al añadir PyTorch. Requiere toolchain Rust. |
| C. **Electron** + worker Python (instalado en primer arranque con uv) | MIT (Electron), Apache-2.0/MIT (uv) | Chromium idéntico en los 3 SO: audio, Web Audio, fuentes, pantalla completa y CSS consistentes (crítico para la sincronía karaoke). Ecosistema TS enorme. Precedente directo: ComfyUI Desktop (Electron + uv instalando dependencias Python al arrancar). Permite elegir la variante de PyTorch (CPU/CUDA/ROCm) en la máquina del usuario. | Instalador ~100–150 MB y ~150–400 MB de RAM. El primer arranque descarga Python y dependencias (requiere conexión). |
| D. **App nativa Python** (PySide6/Qt) | LGPL-3.0 | Un solo lenguaje. | Empaquetado de Qt + PyTorch con PyInstaller frágil y pesado (~GB con CUDA); UI de editor/reproductor más costosa de construir que con web; menos consistente para tipografías y degradados. |
| E. Electron + Python **congelado con PyInstaller** dentro del instalador | — | Funciona sin conexión tras instalar. | Instaladores de 0,5–2,5 GB por plataforma y por variante de GPU; build por SO; cada actualización de yt-dlp (frecuentes, ver ADR 0003) obliga a reconstruir y redistribuir todo. |

## Decisión
**Opción C: aplicación de escritorio Electron con un worker Python separado, cuyo entorno se crea en el primer arranque con `uv`.**

### Stack
| Capa | Tecnología | Licencia |
|------|-----------|----------|
| Shell de escritorio | Electron (versión estable vigente) | MIT |
| Build / empaquetado | electron-vite + electron-builder | MIT |
| Frontend (renderer) | TypeScript + React + Vite | MIT / Apache-2.0 (TS) |
| Proceso principal | TypeScript sobre Node (el de Electron): biblioteca, persistencia (ADR 0006), letras (ADR 0005), orquestación de trabajos | — |
| Worker de audio | Python 3.12 (python-build-standalone vía uv), paquete propio `shinobi_worker` invocado como CLI | PSF |
| Gestor de entorno Python | `uv` (binario incluido en el instalador) | Apache-2.0 o MIT |
| Separación | audio-separator + PyTorch / ONNX Runtime (ADR 0004) | MIT / BSD-3 / MIT |
| Audio I/O | PyAV (FFmpeg incluido en las wheels) + soundfile | BSD-3 / BSD-3 |
| YouTube | yt-dlp[default] + Deno (paquete oficial en PyPI) (ADR 0003) | Unlicense / MIT |

### Comunicación UI ↔ worker
Sin servidor HTTP: el proceso principal de Electron lanza `python -m shinobi_worker <comando> --json-args ...` como **proceso hijo por trabajo**. El worker emite **JSON Lines** por stdout (`progreso`, `log`, `resultado`, `error`). Cancelar = terminar el proceso hijo (y su árbol). Así no hay puertos, tokens ni ciclo de vida de servidor que gestionar. Detalle en `docs/arquitectura.md`.

### Empaquetado e instalación
- **Windows**: instalador NSIS (x64) por usuario, sin permisos de administrador.
- **macOS**: DMG universal o uno por arquitectura (arm64 prioritario). Con firma *ad hoc* (obligatoria para ejecutar en Apple Silicon), sin Developer ID ni notarización.
- **Linux**: AppImage (principal) y .deb.
- **Firma de código: no en el MVP** (decisión del usuario, `preguntas/0001`). La configuración de electron-builder deja preparados los campos de firma (Windows y macOS) desactivados, para activarlos después sin cambios de arquitectura. La página de descarga incluye una guía para superar SmartScreen y Gatekeeper (`docs/ux/01-primer-arranque.md`, Parte A).
- El instalador contiene Electron + UI + binario `uv` + el código fuente del worker y su `uv.lock`. **No** contiene Python, PyTorch ni modelos.
- **Primer arranque ("Preparando Shinobi Karaoke")**: el proceso principal ejecuta `uv` para (1) descargar Python 3.12, (2) crear un venv en el directorio de datos local de la app, (3) instalar dependencias bloqueadas con `uv pip install --torch-backend=auto` (detecta CUDA/ROCm/XPU; si no hay GPU usa wheels CPU — importante en Linux, donde la wheel por defecto de PyPI es CUDA y pesa GB), y (4) descargar el modelo de separación por defecto (ADR 0004). Se muestra progreso y es reanudable si falla.
- **Actualizaciones de yt-dlp** sin publicar nueva versión de la app: el proceso principal puede ejecutar `uv pip install -U "yt-dlp[default]"` (al detectar fallo de descarga o periódicamente). Ver ADR 0003.
- **Ffmpeg**: no se requiere el ejecutable; se usa PyAV (wheels con FFmpeg) — ver ADR 0003. Verificado en la tarea 0005: audio-separator 0.48.0 **exige** `ffmpeg` en su constructor y al escribir con pydub; el worker lo evita anulando `check_ffmpeg_installed` y escribiendo con soundfile (`preguntas/0009`, ADR 0004). Plan B documentado: `imageio-ffmpeg` (paquete BSD-2, binario GPL compatible) con su binario enlazado como `ffmpeg` en el PATH del worker.

## Consecuencias
- Positivas:
  - Render idéntico de letra, degradados, fuentes y audio en los tres SO.
  - Instalador ligero y una sola build por SO para todas las variantes de GPU (la variante de PyTorch se resuelve en la máquina del usuario).
  - yt-dlp se puede actualizar en caliente (clave porque YouTube rompe la descarga con frecuencia).
  - Worker Python aislado: un fallo o un `kill` no tumba la UI.
- Negativas / riesgos:
  - **El primer arranque necesita conexión** y descarga ≈ 0,4–0,5 GB (CPU, Rápido), ≈ 1,2 GB (Apple Silicon, medido) y ≈ 4–5,3 GB (CUDA, calculado). Sin instalación offline en el MVP.
  - Dependencia de servicios de terceros en la instalación (PyPI, índice de PyTorch, GitHub/Hugging Face para modelos, python-build-standalone). Mitigación: reintentos, reanudación y mensajes de error claros.
  - **Sin firma de código en el MVP** (`preguntas/0001`, respondida): Windows (SmartScreen) y macOS (Gatekeeper) muestran advertencias que el usuario debe saltar con la guía de instalación. Efecto secundario: en macOS las notificaciones nativas no funcionan sin firma (se usa rebote e insignia del Dock, `arquitectura.md` §6). Se reevaluará tras el MVP.
  - Dos lenguajes (TS + Python) en el repo.
  - Electron consume más RAM que Tauri (aceptable frente a PyTorch).
- Impacto en UX:
  - Hace falta una **pantalla de primer arranque** con progreso por fases (Python, dependencias, modelo), tamaño estimado, reintento y error comprensible.
  - Aviso del SO al instalar (app sin firmar) → guía de instalación con capturas.
  - Arranque normal rápido (~1–3 s); el primer trabajo de separación tras abrir la app añade unos segundos de carga de PyTorch y del modelo.

## Revisiones
- 2026-11-03: respuesta del usuario a `preguntas/0001` (sin firma en el MVP).
- 2026-11-04 (resultados del spike 0005): primer arranque medido en macOS arm64 — Python 3.12 gestionado por uv 24 MB (72 MiB en disco); dependencias ≈ 296 MB de descarga, 61 paquetes, venv 1,2 GB; la caché de uv (pico 1,1 GB) se vacía con `uv cache clean` tras instalar (`prune` no libera nada). Calculado: Windows x64 CPU ≈ 311 MB, Linux x64 CPU ≈ 434 MB, Windows CUDA ≈ 3,1 GB, Linux CUDA ≈ 4,4 GB. Los índices CPU y cu128 de torch publican versiones distintas: **fijar versión por perfil** en el lock. `audioread` se declara explícitamente. Ffmpeg: ver arriba y `preguntas/0009`.
- 2026-11-04 (revisión de cierre de la Fase 1): la seguridad del renderer, el origen propio `shinobi-app://` (en lugar de `file://`), la política de navegación/permisos y los *fuses* de empaquetado se fijan en el [ADR 0008](0008-seguridad-de-electron-y-protocolos-propios.md). Versiones reales del esqueleto: Electron 45 (Node 24), electron-vite 6, React 19, TypeScript 6, ESLint 9 (tarea 0002).
- 2026-11-04 (respuesta a [`preguntas/0015`](../preguntas/0015-macos-intel-sin-pytorch-y-macos-minimo.md)): **macOS 14 o posterior** en Apple Silicon (torch 2.15, onnxruntime 1.31.1 y av 19 solo publican `macosx_14_0_arm64`); la app lo comprueba al arrancar (`process.getSystemVersion()` < 14 → B6) sin subir `LSMinimumSystemVersion`. **Mac Intel**: sin runtime (PyTorch ≥ 2.3 y onnxruntime ≥ 1.24 no publican x86_64); fuera del MVP de forma provisional, decisión de producto en [`preguntas/0016`](../preguntas/0016-mac-intel-fuera-del-mvp.md). Distribución en macOS: **solo DMG arm64** mientras no se responda.
- 2026-11-06 ([ADR 0012](0012-empaquetado-con-electron-builder-fuses-uv-y-licencias.md), `preguntas/0042`): la configuración concreta del empaquetado pasa al ADR 0012. En Linux, el `.deb` es la opción recomendada en Ubuntu, Debian y Mint y el AppImage la del resto: sustituye a "AppImage (principal)".

## Fuentes
- Notificaciones en Electron (requisitos de AppUserModelID en Windows y firma en macOS): https://www.electronjs.org/docs/latest/tutorial/notifications
- Tauri vs Electron 2026 (tamaño/memoria, WebKitGTK): https://dev.to/devtoolpicks/tauri-vs-electron-for-indie-hackers-in-2026-honest-comparison-o0e , https://www.levminer.com/blog/tauri-vs-electron
- Wails — problemas de WebKitGTK/GStreamer en Linux (afecta también a Tauri): https://wails.io/docs/guides/linux
- Tauri discussion #8426 (GStreamer en WebKitGTK): https://github.com/tauri-apps/tauri/discussions/8426
- Tamaño de sidecar PyInstaller con PyTorch (410 MB CPU / 2,43 GB CUDA): https://docs.voicebox.sh/developer/building
- Arranque onefile vs onedir de PyInstaller: https://github.com/evi-assistant/evi-ai/wiki/desktop-bundling
- ComfyUI Desktop (Electron + uv instala dependencias Python al arrancar; GPL-3.0): https://github.com/Comfy-Org/desktop
- uv + PyTorch, `--torch-backend=auto`: https://docs.astral.sh/uv/guides/integration/pytorch/
- PyAV (BSD-3, wheels con FFmpeg): https://pypi.org/project/av/
- Deno en PyPI (oficial, MIT): https://pypi.org/project/deno/
