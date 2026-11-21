# Revisión visual — Fase 4 de 0.2.0 (ventana secundaria y cola)

- Specs de referencia: [02-biblioteca.md, fase 4](../02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) (S18), [07-reproductor.md, fase 4](../07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola) (P16), [06-editor.md, fase 4](../06-editor.md#fase-4-de-020--ventana-secundaria-y-cola) (E8) y [08-ajustes-y-acerca.md, fase 4](../08-ajustes-y-acerca.md#fase-4-de-020--ventana-secundaria-y-cola) (AR4).
- Estado: **tomadas** (tarea 0190, 2026-11-20): 40 capturas con `SHINOBI_CAPTURAS_4=1 npx playwright test e2e/sesion-capturas.spec.ts --workers=1` desde `app/` (Electron, `--force-device-scale-factor`, `setContentSize`). La revisión del diseñador sigue por hacer.
- Equipo: macOS 15 (Darwin 25.5), una sola pantalla Retina. La pantalla 2 es simulada (`SHINOBI_PANTALLAS_SIMULADAS`): macOS recoloca la ventana secundaria en la única pantalla real.
- Semilla: `sembrar(datos)` (0006/0094), canciones «Reproductor: lista» (20) y «Reproductor: lista incompleta» (21), `transicion_s` = 15 s (4 s en la captura de Ajustes), «Borrador recién creado» (4) como entrada que falla.

## Tomadas
- `biblioteca-1280x800-100-*` y `biblioteca-1280x720-125-*` (12 estados cada una): `dialogo-pantalla`, `dialogo-una-pantalla`, `tarjetas-sesion`, `sesion`, `cuenta`, `fallo`, `dialogo-cierre`, `monitor-desconectado`, `espera`, `fin-cola`, `cola-conservada`, `caida`.
- `reproductor-{1920x1080,1280x720}-*` (7 estados cada una): `cuenta`, `cuenta-reducido`, `fallo`, `fin-cola`, `reanudada`, `espera`, `espera-vacia`.
- `ajustes-1280x800-100-reproductor` (AR4) y `editor-1280x800-100-dialogo-bloqueo` (E8).

## Pendientes
- Ninguna, salvo la limitación de tamaño descrita abajo.

## Cómo se llega a cada estado (guion corregido)
- `cuenta`: sesión con una canción válida a continuación y, detrás, la que falla; al terminar la primera empieza la cuenta. `fallo` llega al terminar esa segunda.
- `espera`: no se abre con `{ tipo: 'cola' }` (con una pendiente empieza a sonar directamente). Se termina una canción con otra pendiente y se pulsa «Detener cuenta» (spec 07).
- `reanudada`: el reproductor solo pide confirmar el cierre si hay pendientes; se añade una antes de pulsar Ctrl + W y «Cerrar y conservar cola».
- `app.close()` de Playwright queda colgado con una sesión abierta (espera el diálogo de cierre): el guion cierra con `app.exit(0)`.

## Observaciones
- Las capturas del reproductor miden 1920 × 762 y 1280 × 720 recortado: la pantalla real de este equipo es menor que 1080 de alto y macOS limita `setContentSize`. Para P16 a 1920 × 1080 hace falta un monitor mayor o el equipo de revisión.
- Las capturas son de la implementación vigente; la revisión del diseñador queda por hacer.
