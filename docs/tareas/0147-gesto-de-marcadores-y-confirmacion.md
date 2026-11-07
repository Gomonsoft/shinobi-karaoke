# 0147 — Gesto de marcadores y confirmación

- Estado: Pendiente
- Paso del pipeline: 4
- Depende de: [0146](0146-coordenadas-y-viewport-de-la-linea-de-tiempo.md), [0143](0143-fin-de-linea-independiente.md)
- ADRs: [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md)
- Specs: [Editor](../ux/06-editor.md), [Sistema visual](../ux/sistema-visual.md)
- Plan: [Fase 2](../versiones/0.2.0/plan-2.md#fase-2--línea-de-tiempo)

## Objetivo

Previsualizar cambios válidos durante el arrastre y confirmar como una sola edición reversible.

## Archivos y contrato

Trabajar en la lógica de edición del renderer, `estado.ts` y pruebas, con las operaciones de `app/src/shared/letra.ts` y `app/src/shared/letras/tiempos.ts`. Exponer una sesión de gesto ligada a id de línea, borde, letra base y revisión. Derivar la vista provisional de esa base sin autoguardar ni modificar el historial. El resultado incluye motivo de límite existente. Un commit aplica una sola edición si siguen vigentes la revisión y la selección. Acordar con 0149 el contrato del gesto y del callback, sin cablear Editor en esta tarea.

## Criterios de aceptación

- [ ] Probar conversión inversa con offset y reutilización de límites de vecinas, pausas y palabras.
- [ ] Un fin automático se fija al confirmar un cambio válido, sin fijarse tras clic o gesto sin cambio.
- [ ] Si el puntero supera un límite, retener el último valor válido y producir aviso consolidado.
- [ ] Confirmar deja un paso de deshacer y un único cambio persistible. Cancelar, cambio externo o pérdida de captura no confirma nada ni ensucia el historial.
- [ ] Un paso de deshacer restaura también la condición automática y cualquier desplazamiento de palabras gestionado por el dominio.

## Verificación

Desde `app/`, `npm test -- src/shared/letras src/shared/letra.test.ts src/renderer/src/vistas/editor` y `npm run typecheck`.

## Notas de implementación

Pendientes.
