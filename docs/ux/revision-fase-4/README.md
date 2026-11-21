# Revisión visual — Fase 4 de 0.2.0 (ventana secundaria y cola)

- Specs de referencia: [02-biblioteca.md, fase 4](../02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) (S18), [07-reproductor.md, fase 4](../07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola) (P16), [06-editor.md, fase 4](../06-editor.md#fase-4-de-020--ventana-secundaria-y-cola) (E8) y [08-ajustes-y-acerca.md, fase 4](../08-ajustes-y-acerca.md#fase-4-de-020--ventana-secundaria-y-cola) (AR4).
- Estado: **parcialmente tomadas** (tarea 0190, 2026-11-20). 24 capturas con `SHINOBI_CAPTURAS_4=1 npx playwright test e2e/sesion-capturas.spec.ts --workers=1` desde `app/` (Electron, `--force-device-scale-factor`, `setContentSize`). Se ejecutó una sola vez; los estados que fallaron están en «Pendientes».
- Equipo: macOS 15 (Darwin 25.5), una sola pantalla Retina. La pantalla 2 es simulada (`SHINOBI_PANTALLAS_SIMULADAS`): macOS recoloca la ventana secundaria en la única pantalla real.
- Semilla: `sembrar(datos)` (0006/0094), canciones «Reproductor: lista» (20) y «Reproductor: lista incompleta» (21), `transicion_s` = 15 s (4 s en la captura de Ajustes), «Borrador recién creado» (4) como entrada que falla.

## Tomadas
- `biblioteca-1280x800-100-*` y `biblioteca-1280x720-125-*`: `dialogo-pantalla`, `dialogo-una-pantalla`, `tarjetas-sesion` (con el panel de cola abierto), `fallo`, `dialogo-cierre`, `monitor-desconectado`, `fin-cola`, `cola-conservada`, `caida`.
- `reproductor-{1920x1080,1280x720}-*`: `fallo`, `fin-cola`, `espera-vacia`.
- `ajustes-1280x800-100-reproductor`.

## Pendientes (la spec los intenta y los anota; hay que corregir el guion y repetirlos)
- `biblioteca-*-sesion`: el botón «Mostrar la cola» no existe con ese nombre cuando el panel ya está abierto; basta quitar el clic (equivale a `tarjetas-sesion`) o usar el nombre del indicador.
- `biblioteca-*-cuenta` y `reproductor-*-cuenta` / `cuenta-reducido`: con la pendiente que falla en primer lugar, la máquina pasa directamente a `error` sin cuenta. Hay que poner antes una canción válida.
- `biblioteca-*-espera` y `reproductor-*-espera`: abrir con `{ tipo: 'cola' }` y una pendiente no deja la fase `espera` (empieza la cuenta); hay que llegar a `espera` por la vía que defina la spec.
- `reproductor-*-reanudada`: el guion pulsó Ctrl + W sobre una ventana que ya se había cerrado.
- `editor-1280x800-100-dialogo-bloqueo`: el guion seguía en Ajustes (falló el botón «Volver»); sale tras corregir la captura de Ajustes.

## Observaciones
- Las capturas del reproductor miden 1920 × 762 y 1280 × 720 recortado: la pantalla real de este equipo es menor que 1080 de alto y macOS limita `setContentSize`. Para P16 a 1920 × 1080 hace falta un monitor mayor o el equipo de revisión.
- Las capturas son de la implementación vigente; la revisión del diseñador queda por hacer.
