# 0239 — Progreso, resultado, fallos y estado de las exportaciones en la principal

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: [0238](0238-dialogo-de-exportacion-formulario.md) (comparte `DialogoExportacion`)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §8, §10 y §11
- Spec UX: [10](../ux/10-exportacion.md) wireframes B, B2, B3, B4, C y D, §«Progreso», §«Al terminar», §«Errores», toasts `exp.toast.*`, anuncios

## Objetivo
Seguir una exportación desde la principal: progreso, cola, cancelar, éxito, fallo y toasts, también con el diálogo cerrado.

## Contrato
- `renderer/src/exportacion/estado.ts`: almacén de exportaciones alimentado por `exportacion.estado()` y los eventos `exportacion:cambio`/`exportacion:progreso`, que descarta eventos atrasados (barra que nunca retrocede).
- Estados B–D en `DialogoExportacion`; «Seguir en segundo plano» y Esc no cancelan; confirmación en línea; «Reintentar» (instantánea nueva) y «Cambiar opciones».
- Toasts: `exp.toast.ok` con «Mostrar en la carpeta», `exp.toast.error` persistente con [Ver], `exp.toast.cancelada`, `exp.toast.quitada`, `exp.toast.noExiste`, `exp.toast.limpieza` e `exp.toast.interrumpida` (aviso único tras una caída). Notificación del sistema con la ventana sin foco, como en la spec 04.
- Anuncios de hitos (inicio, subpasos, 25/50/75 %, éxito, cancelación) y errores con `role="alert"`.

## Criterios de aceptación
- [ ] V11–V13, V15, V20–V22 de la spec 10 con la API falsa (un doble por código de error).
- [ ] V25 y V26 en lo que toca al renderer (texto `exp.cierre.*` en el diálogo de cierre y toast tras la caída).
- [ ] V27 y V28 para los estados B–D.

## Pruebas de feedback
- Unitarias: `estado.test.ts` (orden de eventos, porcentaje monótono) y Testing Library de los estados B–D y de los toasts.
- E2E: ninguna.
- Críticos: no.
- Manual: nada.

## Notas de implementación
