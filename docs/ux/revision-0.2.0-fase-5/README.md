# Revisión visual — Fase 5 de 0.2.0 (estilo, espera y Letra lista)

- Specs de referencia: [06-editor.md, fase 5](../06-editor.md#fase-5-de-020--estilo-espera-y-letra-lista) (F5-1), [07-reproductor.md, fase 5](../07-reproductor.md#fase-5-de-020--estilo-espera-y-letra-lista) (R14) y [02-biblioteca.md, fase 5](../02-biblioteca.md#fase-5-de-020--estilo-espera-y-letra-lista) (LB7).
- Estado: **tomadas** (tarea 0218, 2026-11-20): 35 capturas con `SHINOBI_CAPTURAS_5=1 npx playwright test e2e/fase5-capturas.spec.ts --workers=1` desde `app/`. La revisión del diseñador sigue por hacer.
- Equipo: macOS 15 (Darwin 25.5), una sola pantalla Retina. Sin red, datos inventados (semilla `sembrar`, canción «Reproductor: lista», 30 s).
- La carpeta `revision-fase-5/` es de la fase 5 del MVP; esta es la de 0.2.0.

## Tomadas

- `editor-1280x720-{100,125}-*` (11 estados cada una): `fondo-radial`, `fondo-conico-movimiento` (en pausa a 12,3 s), `fondo-reducido` (movimiento reducido emulado), `espera-d2`, `espera-d1-propios`, `espera-ejemplo`, `dock-letra-lista`, `dialogo-letra-lista`, `silencios-no-disponible`, `dialogo-silencios` (con la lista revelada) y `silencios-aplicado`.
- `reproductor-{1920x1080,1280x720}-*` (6 estados cada una): `hueco-tres-indicadores`, `hueco-cuenta`, `hueco-barra`, `letra-lista`, `fondo-radial`, `fondo-conico` (los fondos, en pausa a 12,3 s; los huecos, a 14,6 s y 14,0 s).
- `biblioteca-1280x800-100-letra-lista`: Letra lista, Letra lista incompleta, Lista y borrador.

## Pendientes

- Ninguna capturada en falso. Observaciones de abajo.

## Cómo se llega a cada estado

- Cada estado reescribe `cancion.json` de la semilla antes de lanzar la app (estilo, modalidad, fines) y abre el editor o el reproductor local.
- `espera-d1-propios`: semilla con temas; la canción usa «Neón» con `reemplazos.espera`.
- `dialogo-silencios` y `silencios-aplicado`: la voz de la canción se sustituye por tramos de 1,2 s cada 3 s y se fijan fines largos en dos líneas, para que haya silencios que ajustar. `silencios-no-disponible`: «Editor: separación interrumpida» (sin forma de onda).
- `dock-letra-lista` y `dialogo-letra-lista`: la canción como borrador con todas sus líneas sincronizadas.

## Observaciones

- Las capturas del reproductor se toman con el reproductor local de la ventana principal. La pantalla de este equipo es menor que 1920 × 1080, así que macOS limita `setContentSize` y las de 1920 × 1080 salen recortadas en alto. Para R14 a 1920 × 1080 exactos hace falta un monitor mayor.
- Las capturas son de la implementación vigente.
