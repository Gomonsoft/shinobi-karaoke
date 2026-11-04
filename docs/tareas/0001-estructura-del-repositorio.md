# 0001 — Estructura del repositorio y archivos de licencia
- Estado: Pendiente
- Paso del pipeline: 0
- Depende de: —
- ADRs: 0001, 0002, 0007
- Spec UX: —

## Objetivo
Crear el esqueleto de carpetas del monorepo descrito en `docs/arquitectura.md` §5, con los archivos legales y de configuración comunes, sin código de aplicación todavía.

## Criterios de aceptación
- [ ] Existen `app/`, `worker/`, `spikes/` y `.github/workflows/` (vacías salvo un `README.md` de una línea o `.gitkeep`) con la estructura de `arquitectura.md` §5.
- [ ] `LICENSE` en la raíz con el texto íntegro de la GPL-3.0; el `README.md` raíz indica "GPL-3.0-or-later" (ADR 0002).
- [ ] `THIRD_PARTY_NOTICES.md` en la raíz con secciones vacías: Electron y dependencias JS, worker Python (FFmpeg vía PyAV, yt-dlp, Deno, audio-separator, PyTorch/ONNX Runtime), modelos de separación (UVR, MelBand RoFormer Kim), fuentes tipográficas (SIL OFL), iconos (Lucide, ISC), servicios (LRCLIB).
- [ ] `.gitignore` cubre `node_modules/`, `out/`, `dist/`, `app/.datos-dev/`, `.venv/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, `spikes/**/salida/`.
- [ ] `.editorconfig` (UTF-8, LF, 2 espacios en TS/JSON/MD, 4 en Python) y `.gitattributes` con `* text=auto eol=lf`.
- [ ] El `README.md` raíz explica en pocas líneas cómo arrancar la app y el worker en desarrollo (se completa en 0002 y 0003) y enlaza `docs/`.

## Notas de implementación
(las rellena el programador al terminar)
