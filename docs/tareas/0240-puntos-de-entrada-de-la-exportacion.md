# 0240 — Puntos de entrada: Biblioteca, editor, panel de actividad y cierre

- Estado: Hecha
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

- [x] V1, V2, V12 (fila del panel y tarjeta) y V25 (texto del cierre) de la spec 10.
- [x] Con una sesión activa, «Exportar video…» sigue disponible en la Biblioteca, sin candado (X6 de la spec 02 con una sola rama).

## Pruebas de feedback

- Unitarias: Testing Library del menú de la tarjeta, del ⋯ del editor y del atajo, de la fila del panel y del diálogo de cierre.
- E2E: ninguna propia (0241).
- Críticos: sí si toca vistas del flujo principal (Biblioteca y editor): ejecutar `npm run test:e2e:criticos`.
- Manual: nada.

## Notas de implementación

### Qué se hizo
- **Biblioteca** (`TarjetaCancion.tsx`, `Biblioteca.tsx`): «Exportar video…» (icono `film`) entre «Editar datos» y «Aplicar tema…» en las Listas no Dañadas, también con sesión y sin candado; con una exportación de esa canción en curso o en cola, «Ver exportación» y «Cancelar exportación…» (antes de «Eliminar…»; también en un borrador que se exporta desde el editor); línea `bib.exp.linea` / `bib.exp.cola` bajo la insignia (en un borrador sin otro trabajo sustituye a «Falta…»; entra en el `aria-label`); `exp.eliminar.extra` en el diálogo de eliminar. La tarjeta usa `useExportaciones()` (sin ampliar `AccionesTarjeta`).
- **Editor** (`useExportarDesdeEditor.tsx`, `Editor.tsx`, `atajos.ts`, `DialogoAtajos.tsx`): ítem «Exportar video… (Ctrl/Cmd + E)» tras «Atajos de teclado» (o «Ver exportación»), Ctrl/Cmd + E (no actúa en campos de texto ni con un diálogo abierto), pausa, vaciado del guardado antes de abrir y diálogo `edi.exp.guardado` ([Quedarme en el editor] / [Exportar igualmente]); `aria-disabled` con `exp.motivo.sinPistas` / `exp.motivo.sinLineas`; inactivo en sincronizar y con error de audio; nota `edi.exp.temaBorrador` mediante `temaBorrador`; fila `edi.atajo.exportar` en el diálogo de atajos.
- **Panel de actividad** (`IndicadorActividad.tsx`): filas `act.exp` con [Ir] (abre el diálogo en su estado) y ✕ (`exp.dialogo.cancelar`; en cola, sin confirmar), y se cuentan en «{n} en curso · {m} en cola».
- **Cierre** (`DialogoCierre.tsx`, `textosCierre.ts`): las exportaciones en curso o en cola suman a `{n}`, se nombran con `exp.cierre.item` y se añade `exp.cierre.extra`.
- `exportacion/lineas.ts` (línea de la tarjeta y fase del panel) y textos en `textosProgreso.ts`.
- Pruebas: `puntosDeEntrada.test.tsx` (tarjeta, líneas, panel, cierre, hook del editor), `Editor.exportar.test.tsx` (Ctrl/Cmd + E, ⋯, motivos y atajos) y `atajos.test.ts`; los dos tests de menú de la Biblioteca incluyen ahora «Exportar video…».

### Decisiones y desviaciones
- Texto provisional `No se puede exportar ahora mismo.` para el ítem inactivo del editor en el modo sincronizar y con «Error de audio»: la spec solo dice que queda inactivo, sin motivo (`EXP_MENU.noDisponible`).
- En el editor, la apertura no mueve el foco por su cuenta: `Dialogo` lo devuelve al elemento activo al abrir (el ⋯ o el origen de Ctrl/Cmd + E).
- `edi.exp.temaBorrador` se pasa con `tema.borradorModificado`; con el borrador de tema abierto, el vaciado no lo guarda (por diseño).
- «Eliminar…» solo añade el texto; la cancelación con limpieza antes de la papelera la hace main (ADR 0019 §10, 0237).
- Dañadas: sin entrada de exportación.

### Cómo probarlo
`cd app && npx vitest run --project renderer src/renderer/src/exportacion src/renderer/src/vistas/editor/Editor.exportar`. Con main real (0237): ⋯ de una Lista › Exportar video…; Ctrl/Cmd + E en el editor; panel de actividad; cerrar la app con una exportación en marcha.

### Verificación manual (para la guía de `docs/Test-manuales/`)
- Editor: Ctrl/Cmd + E con el foco en la lista de líneas y volver el foco ahí al cerrar el diálogo; con un borrador de tema abierto, la nota `edi.exp.temaBorrador`.
- Cerrar la app (Cmd + Q y cerrar ventana en macOS) con una exportación en curso y en cola: el diálogo nombra «exportar «{título}»» y no pregunta dos veces.
- Eliminar una canción que se exporta: el texto extra y que no queda temporal en disco.

### Deuda técnica
- El aviso de tema borrador y el motivo de «inactivo» del editor pueden afinarse si el diseñador define su microcopy.
- Las capturas de la spec (V29, X7) las hace 0241.
