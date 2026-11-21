# 0232 — Sondeo de capacidades de exportación y licencias de los códecs

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: — (paralela a 0231)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §4, §5 y §12, [0002](../adr/0002-licencia-del-proyecto.md), [0012](../adr/0012-empaquetado-con-electron-builder-fuses-uv-y-licencias.md#revisión-para-020--fase-6)
- Spec UX: [10](../ux/10-exportacion.md) (estado F «Sin perfiles»)

## Objetivo
Saber qué puede exportar el equipo y dejar acreditados los códecs que se usan.

## Contrato
- Comando `capacidades-exportacion` (`worker/shinobi_worker/capacidades_exportacion.py`): para cada formato, si existen el codificador de video y `libopus`, y si el contexto del codificador abre con la resolución máxima de cada proporción (sin codificar). Responde en < 2 s: `resultado { formatos: { mkv_av1: { disponible, max_16_9, max_4_3, motivo }, webm_vp9: {…} }, version_av }`. `ImportError` → `RUNTIME_NO_DISPONIBLE`.
- `worker/scripts/inspeccionar_av.py`: falla también si una rueda no trae `libsvtav1`, `libvpx` o `libopus` (opción `--enable-…` o biblioteca), y lo informa por plataforma.
- `THIRD_PARTY_NOTICES.md`: SVT-AV1 (BSD-3-Clause-Clear + AOM Patent License 1.0), libvpx (BSD-3-Clause + concesión de patentes de WebM) y libopus (BSD-3-Clause), dentro del bloque de FFmpeg de PyAV.

## Criterios de aceptación
- [ ] En el venv de desarrollo, `capacidades-exportacion` informa los dos formatos disponibles con 3840 × 2160 y 2880 × 2160.
- [ ] Con un doble que oculta `libsvtav1`, `mkv_av1` sale no disponible con motivo `codificador`.
- [ ] `inspeccionar_av.py` sobre las 6 ruedas fijadas sigue en OK (comprobado el 2026-11-20 en el ADR) y falla con una rueda sin `libopus` (prueba con un zip falso).

## Pruebas de feedback
- Unitarias (pytest): el comando con PyAV real y con el doble; la comprobación nueva de `inspeccionar_av.py` sobre un zip sintético (sin red).
- E2E: ninguna.
- Críticos: no.
- Manual: nada.

## Notas de implementación
