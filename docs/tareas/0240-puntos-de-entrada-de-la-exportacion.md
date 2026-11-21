# 0240 — Puntos de entrada: Biblioteca, editor, panel de actividad y cierre

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: [0239](0239-progreso-resultado-y-estado-de-exportaciones.md)
- ADRs: [0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) §3 y §8
- Spec UX: [10](../ux/10-exportacion.md) §«Puntos de entrada», §«Interacción con otras acciones», §«Cerrar la app…»; [02 · Fase 6](../ux/02-biblioteca.md#fase-6-de-020--exportación); [06 · Fase 6](../ux/06-editor.md#fase-6-de-020--exportación)

## Objetivo

Abrir el diálogo desde donde lo pide la spec y reflejar las exportaciones en la Biblioteca y el panel de actividad.

## Contrato

- Biblioteca: «Exportar video…» / «Ver exportación» en el ⋯ de las tarjetas Lista (no Dañadas); línea `bib.exp.linea` / `bib.exp.cola` en la tarjeta; `exp.eliminar.extra` en el diálogo de eliminar.
- Editor: «Exportar video…» en el ⋯ de la cabecera y Ctrl/Cmd + E, con vaciado del guardado antes de abrir (la instantánea es de lo guardado), motivos `exp.motivo.sinPistas` / `exp.motivo.sinLineas`, inactivo en sincronizar y con error de audio; también en borradores.
- Panel de actividad: filas `act.exp` con [Ir] y ✕ (cancelar con confirmación).
- Diálogo de cierre de la spec 04: `exp.cierre.item` y `exp.cierre.extra`.

## Criterios de aceptación

- [ ] V1, V2, V12 (fila del panel y tarjeta) y V25 (texto del cierre) de la spec 10.
- [ ] Con una sesión activa, «Exportar video…» sigue disponible en la Biblioteca (sin candado).

## Pruebas de feedback

- Unitarias: Testing Library del menú de la tarjeta, del ⋯ del editor y del atajo, de la fila del panel y del diálogo de cierre.
- E2E: ninguna propia (0241).
- Críticos: sí si toca vistas del flujo principal (Biblioteca y editor): ejecutar `npm run test:e2e:criticos`.
- Manual: nada.

## Notas de implementación
