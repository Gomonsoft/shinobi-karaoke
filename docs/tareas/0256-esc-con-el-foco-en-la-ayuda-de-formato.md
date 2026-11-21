# 0256 — Esc con el foco en la ayuda de «Formato» no cierra el diálogo de exportación
- Estado: Pendiente
- Paso del pipeline: 6 (exportación)
- Depende de: —
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md)
- Spec UX: [10](../ux/10-exportacion.md) (Esc cierra primero el popover y después el diálogo; caso 1.9 de la guía de la fase 6)
- Versión: 0.2.0-alpha.2 · corrección pequeña del informe de QA (I-5)

## Objetivo
Con el foco en el botón ⓘ de «Formato», el primer Esc cierra la ayuda, como debe. El segundo ya no cierra el diálogo y hay que pulsar [Cancelar] ([QA](../Test-manuales/0.2.0/ejecucion-2026-11-21-windows.md) I-5). Causa, comprobada: `cerrarAyuda` (`app/src/renderer/src/exportacion/dialogo/Formulario.tsx:211-218`), que se usa en el `onKeyDown` del botón (línea 268) y del popover (línea 280), hace `preventDefault` y `stopPropagation` en cada Esc aunque la ayuda ya esté cerrada.

## Contrato
- `cerrarAyuda` solo intercepta Esc si la ayuda está abierta (`if (e.key !== 'Escape' || !ayudaAbierta) return`). Con la ayuda cerrada, el evento llega al diálogo y lo cierra, con el foco de vuelta en el ⋯ de origen, como con [Cancelar].
- Nada más cambia.

## Criterios de aceptación
- [ ] Foco en ⓘ con la ayuda abierta: Esc la cierra, el foco queda en ⓘ y el diálogo sigue abierto.
- [ ] Foco en ⓘ con la ayuda cerrada: Esc cierra el diálogo.

## Pruebas de feedback
- Unitarias: el test de componente del formulario (`DialogoFormulario.test.tsx` o el del diálogo que monte `Formulario`), con los dos casos y `await act(async () => {})` antes de pulsar Esc (regla 11 de `pruebas.md`).
- E2E: ninguna.
- Críticos: no.
- Manual: repetir el caso 1.9 de la guía de la fase 6.

## Notas de implementación
