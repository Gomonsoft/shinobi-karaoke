# 0218 — Capturas de revisión de la fase 5

- Estado: Pendiente
- Paso del pipeline: 4–6
- Depende de: [0211](0211-editor-controles-de-degradado-y-movimiento.md)–[0217](0217-biblioteca-insignia-letra-lista.md)
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md)
- Spec UX: [06](../ux/06-editor.md#fase-5-de-020--estilo-espera-y-letra-lista) F5-1, [07](../ux/07-reproductor.md#fase-5-de-020--estilo-espera-y-letra-lista) R14, [02](../ux/02-biblioteca.md#fase-5-de-020--estilo-espera-y-letra-lista) LB7

## Objetivo

Generar las capturas que el diseñador pide para revisar la fase 5, siguiendo el patrón _opt-in_ de `temas-capturas.spec.ts`. Ajustes no cambia en esta fase, así que no hay tarea de Ajustes ni de temas: las muestras de tema son estáticas por construcción (fase 0).

## Contrato

- `e2e/fase5-capturas.spec.ts`, que solo se ejecuta con `SHINOBI_CAPTURAS_5=1`. Escribe en `docs/ux/revision-0.2.0-fase-5/` con los nombres de la spec:
  - **editor** a 1280 × 720 al 100 % y al 125 %: `fondo-radial`, `fondo-conico-movimiento`, `fondo-reducido`, `espera-d2`, `espera-d1-propios`, `espera-ejemplo`, `dock-letra-lista`, `dialogo-letra-lista`, `silencios-no-disponible`, `dialogo-silencios` y `silencios-aplicado`;
  - **reproductor** a 1920 × 1080 y 1280 × 720: `hueco-tres-indicadores`, `hueco-cuenta`, `hueco-barra`, `letra-lista`, `fondo-radial` y `fondo-conico`;
  - **biblioteca** `biblioteca-1280x800-100-letra-lista`.
- Datos inventados, sin red. Para las capturas con movimiento, se busca un instante fijo con el reproductor en pausa.

## Archivos

`app/e2e/fase5-capturas.spec.ts` (nuevo) y las capturas en `docs/ux/revision-0.2.0-fase-5/`.

## Criterios de aceptación

- [ ] Con `SHINOBI_CAPTURAS_5=1` se generan todas las capturas listadas. Sin la variable, la spec se salta.
- [ ] Se anota en el inventario de `docs/pruebas.md` como secundaria _opt-in_.

## Pruebas de feedback

- Unitarias: ninguna.
- E2E: esta spec, _opt-in_. El agente la ejecuta una vez para producir las capturas.
- Críticos: no.
- Manual: el diseñador revisa las capturas.

## Notas de implementación
