# 0032 — Worker: comando `diagnostico` (confirmación del perfil con PyTorch)
- Estado: Hecha
- Paso del pipeline: 0
- Depende de: 0028, 0029
- ADRs: 0004 (detección en dos pasos, paso 2; Apple Silicon en CPU, `preguntas/0010`), 0009
- Spec UX: docs/ux/01-primer-arranque.md ("Comprobando tu equipo…", criterio 5b)

## Objetivo
Tras instalar las dependencias, confirmar el perfil de hardware con PyTorch. Solo puede **rebajar** Calidad → Rápido, nunca subir.

## Criterios de aceptación
- [x] `python -m shinobi_worker diagnostico --args '{"perfil_previsto": "cuda"|"mps"|"cpu"}'` emite un `resultado` con el esquema de 0029: `perfil` final, `dispositivo` (`cuda` | `cpu`), `gpu`, `vram_mb`, `motivo_rebaja`, versiones de torch y onnxruntime (si están).
- [x] Reglas: `cuda` previsto → se confirma si `torch.cuda.is_available()` y una operación mínima en GPU funciona y VRAM total ≥ 4096 MB; VRAM < 4096 → `cpu` con `motivo_rebaja: "memoria"`; CUDA no disponible o la operación falla → `cpu` con `"generico"`. `mps` previsto → se confirma `mps` (perfil Calidad, **ejecución en CPU**, `preguntas/0010`; no se exige `torch.backends.mps.is_available()`), salvo que torch no se pueda importar → `cpu`/`"generico"`. `cpu` → `cpu` sin rebaja.
- [x] `import torch` es perezoso (dentro del comando) para no penalizar los demás comandos; si torch no está instalado (entorno de desarrollo sin el extra `separacion`), el comando devuelve `cpu`/`"generico"` sin excepción y emite un `log` de aviso.
- [x] Progreso indeterminado (`fase: "diagnostico"`, `valor: null`) al empezar; tarda < 15 s con torch en disco.
- [x] Tests (CI normal): con un módulo `torch` falso inyectado (`sys.modules` o parámetro) para cada rama: CUDA ≥ 4 GB, CUDA 2 GB, CUDA que falla al operar, sin CUDA, MPS, sin torch. Test `pesado` (se omite en CI) con el extra `separacion` real.
- [x] Integración con el cliente del worker (0013): test de Vitest que ejecuta `diagnostico` con el worker de desarrollo y recibe un resultado válido (`cpu`/`"generico"` en CI, sin torch).

## Notas de implementación
- **Qué se hizo**: `worker/shinobi_worker/diagnostico.py` (módulo propio; registrado en `comandos.py`). `diagnosticar(perfil_previsto, importar)` es pura e inyectable (el importador permite un `torch` falso); `diagnostico(args)` valida `perfil_previsto`, emite `progreso diagnostico/null` y el `resultado` con el esquema de 0029. CUDA: `is_available()` + operación mínima (`ones+sum+synchronize`) + VRAM ≥ 4096 MB (si no, `memoria`; si falla, `generico`). `mps` se confirma como `perfil: mps`, `dispositivo: cpu`, sin exigir `mps.is_available()`. Sin torch: `cpu`/`generico` con `log` de aviso (con `cpu` previsto no es rebaja y no hay aviso). `onnxruntime` se lee de los metadatos del paquete (sin importarlo).
- **Archivos**: `worker/shinobi_worker/diagnostico.py`, `worker/tests/test_diagnostico.py` (ramas con torch falso, CLI, test `pesado` con torch real), `app/src/main/trabajos/worker.test.ts` (integración Vitest).
- **Cómo probarlo**: `cd worker && uv run ruff check && uv run pytest`; `cd app && npx vitest run src/main/trabajos/worker.test.ts`; con el extra: `uv sync --extra separacion && uv run pytest -m pesado`.
- **Deuda**: el test `pesado` no se ha ejecutado aquí (no se instaló PyTorch); la operación en GPU real solo está verificada con doble. Si hay CUDA pero `torch` es una build solo-CPU, `is_available()` es falso y se rebaja a `generico`.
