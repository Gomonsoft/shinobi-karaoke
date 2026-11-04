# 0001 — Estructura del repositorio y archivos de licencia
- Estado: Hecha
- Paso del pipeline: 0
- Depende de: —
- ADRs: 0001, 0002, 0007
- Spec UX: —

## Objetivo
Crear el esqueleto de carpetas del monorepo descrito en `docs/arquitectura.md` §5, con los archivos legales y de configuración comunes, sin código de aplicación todavía.

## Criterios de aceptación
- [x] Existen `app/`, `worker/`, `spikes/` y `.github/workflows/` (vacías salvo un `README.md` de una línea o `.gitkeep`) con la estructura de `arquitectura.md` §5.
- [x] `LICENSE` en la raíz con el texto íntegro de la GPL-3.0; el `README.md` raíz indica "GPL-3.0-or-later" (ADR 0002).
- [x] `THIRD_PARTY_NOTICES.md` en la raíz con secciones vacías: Electron y dependencias JS, worker Python (FFmpeg vía PyAV, yt-dlp, Deno, audio-separator, PyTorch/ONNX Runtime), modelos de separación (UVR, MelBand RoFormer Kim), fuentes tipográficas (SIL OFL), iconos (Lucide, ISC), servicios (LRCLIB).
- [x] `.gitignore` cubre `node_modules/`, `out/`, `dist/`, `app/.datos-dev/`, `.venv/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, `spikes/**/salida/`.
- [x] `.editorconfig` (UTF-8, LF, 2 espacios en TS/JSON/MD, 4 en Python) y `.gitattributes` con `* text=auto eol=lf`.
- [x] El `README.md` raíz explica en pocas líneas cómo arrancar la app y el worker en desarrollo (se completa en 0002 y 0003) y enlaza `docs/`.

## Notas de implementación
- Se creó el esqueleto de `arquitectura.md` §5: `app/` (incl. `resources/{fonts,bin}`, `src/{shared,main/*,preload,renderer/src/*}`), `worker/{shinobi_worker,tests}`, `spikes/` y `.github/workflows/`. Las carpetas vacías llevan `.gitkeep`; `app/`, `worker/` y `spikes/` tienen un `README.md` breve.
- `LICENSE`: texto íntegro de GPL-3.0 (gnu.org, 674 líneas). `THIRD_PARTY_NOTICES.md` con secciones vacías. `.gitignore`, `.editorconfig`, `.gitattributes` según criterios (se añadió `.DS_Store` al ignore).
- README raíz: licencia GPL-3.0-or-later y guía provisional de arranque.
- Cómo probarlo: `find app worker spikes .github -type d`, `git status --ignored`, `git check-ignore -v app/.datos-dev spikes/x/salida`.
- Deuda técnica: README de arranque se completa en 0002 y 0003; no hay `package.json`/`pyproject.toml` aún (no hay tests ni linters que ejecutar).
