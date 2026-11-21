# 0239 — Progreso, resultado, fallos y estado de las exportaciones en la principal

- Estado: Hecha
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

- [x] V11–V13, V15, V20–V22 de la spec 10 con la API falsa (un doble por código de error).
- [x] V25 y V26 (ya no condicionado) en lo que toca al renderer: texto `exp.cierre.*` en el diálogo de cierre y toast `exp.toast.interrumpida` tras la caída.
- [x] V14–V18 y V20 en lo que muestra la principal (resumen con el formato corto, detalle del éxito, `exp.error.posicion` siempre presente).
- [x] V27 y V28 para los estados B–D.

## Pruebas de feedback

- Unitarias: `estado.test.ts` (orden de eventos, porcentaje monótono) y Testing Library de los estados B–D y de los toasts.
- E2E: ninguna.
- Críticos: no.
- Manual: nada.

## Notas de implementación

### Qué se hizo
- `renderer/src/exportacion/estado.ts`: `crearAlmacenExportaciones` (alimentado por `estado()`, `exportacion:cambio` y `exportacion:progreso`; descarta eventos atrasados: el estado no retrocede y la barra nunca baja; mide lo que tardó), `clasificarAviso` (qué toast corresponde) y `hitoDe` (qué se anuncia).
- `renderer/src/exportacion/contexto.ts` y `ProveedorExportacion.tsx`: contexto `useExportaciones()` (`exportaciones`, `activaDe`, `abrir`, `cerrar`, `iniciada`, `existia`, `pedirCancelar`), host del diálogo, toasts (`exp.toast.ok|error|cancelada|quitada|noExiste|limpieza|interrumpida`, que esperan al foco de la ventana como los de la spec 04), región `aria-live` de hitos y la confirmación `exp.dialogo.cancelar` para el panel y la tarjeta. Montado en `App.tsx` (envuelve el marco y el diálogo de cierre).
- `dialogo/DialogoSeguimiento.tsx`: B (subpasos, porcentaje, posición `mm:ss de mm:ss`, tiempo restante), B2 (cola, «Quitar de la cola»), B3 (confirmación en línea, Esc vuelve), B4 (cancelando), C (éxito) y D (un doble por código de error, acciones según la tabla, «Copiar detalles», «Cambiar opciones», «Reintentar»). `DialogoExportacion` enruta entre formulario y seguimiento.
- `dialogo/textosProgreso.ts`: `exp.*` de progreso, resultado, toasts, anuncios y `act.exp`/`bib.exp.*` (los usa 0240).
- Pruebas: `estado.test.ts` (orden, porcentaje monótono, avisos, hitos) y `ProveedorExportacion.test.tsx` (B, B2, B3, B4, C, D por código, toasts con el diálogo cerrado, limpieza, caída, sin foco, anuncios).

### Decisiones y desviaciones
- Preguntas abiertas no bloqueantes: [0132](../preguntas/0132-avisos-de-limpieza-e-interrupcion-de-la-exportacion.md) (cómo llegan `LIMPIEZA_FALLIDA` y «interrumpida»; provisional: se deducen de `error.codigo` en `clasificarAviso`) y [0133](../preguntas/0133-reintentar-una-exportacion-con-el-mismo-destino.md) («Reintentar» pierde un nombre de archivo cambiado a mano).
- `exp.error.conservado` y la línea «El archivo que ya había…» de B3 solo se muestran si la exportación se lanzó desde este diálogo (el renderer recuerda `destino.existe` al iniciar); `ExportacionIpc` no trae ese dato.
- «Tardó …» (C) lo mide el renderer desde que ve la exportación en curso; no sale si solo la vio terminada.
- «Calculando tiempo…» sale mientras main no da `etaSegundos`; no se cuentan los 15 s de la spec 04 en el renderer.
- La notificación del sistema con la ventana sin foco es cosa de main (0237); aquí solo se retrasan los toasts hasta recuperar el foco.
- El toast `exp.toast.ok` solo lleva «Mostrar en la carpeta» (la spec 10 dice que el diálogo C «queda disponible desde el toast» sin definir un segundo botón).
- V25 (texto `exp.cierre.*` en el diálogo de cierre) se hace en 0240, que es dueña de `DialogoCierre`; el toast `exp.toast.interrumpida` está aquí.

### Cómo probarlo
`cd app && npx vitest run --project renderer src/renderer/src/exportacion`. Con main real (0237): exportar una canción, cerrar el diálogo y ver el toast al terminar; cancelar con confirmación y comprobar que el diálogo se cierra con `exp.toast.cancelada`.

### Verificación manual (para la guía de `docs/Test-manuales/`)
- Lector de pantalla: solo se anuncian inicio, subpasos, 25/50/75 %, éxito y cancelación; el fallo se lee como alerta.
- Foco: B → «Seguir en segundo plano»; B3 → «Seguir exportando»; C → «Mostrar en la carpeta»; D → «Reintentar» (o la acción principal); al cerrar vuelve al disparador.
- Con la ventana sin foco al terminar, el toast aparece al volver.

### Deuda técnica
- Cuando 0237 defina cómo llegan la limpieza y la interrupción (0132), sustituir `clasificarAviso`.
