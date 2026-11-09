# 0171 — «Editar tema»: borrador en memoria, guardar con impacto y salir con borrador

- Estado: Pendiente
- Paso del pipeline: 4
- Depende de: [0170](0170-panel-estilo-seccion-tema.md)
- ADRs: [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §7, §10, [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--fase-3)
- Specs: [Editor · Fase 3, D3, «Salir con un borrador de tema», «Instantánea de reproducción»](../ux/06-editor.md#fase-3-de-020--temas-y-biblioteca) (T7–T13, T23, T27)

## Objetivo

Implementar D3: borrador del tema en memoria con los controles completos, banner, pie fijo, «Guardar en el tema…» con `DialogoImpactoTema` y `temas.ejecutar({ tipo: "editar" })`, «Descartar cambios», «Guardar como tema nuevo…» desde el borrador, historial del borrador y aviso al salir del editor o cerrar la ventana.

## Contrato

- El borrador no entra en el autoguardado de la canción; sus pasos entran en el historial de la visita y se retiran al salir de D3 (T13). Deshacer nunca escribe en el catálogo.
- Vista previa y «Probar a pantalla completa» pintan el borrador.
- `revisionTema` del borrador = la del tema al entrar; si main responde `CONFIRMACION_OBSOLETA` por revisión, el diálogo se actualiza como dice la spec.
- Salidas del editor (todas las de la spec) con borrador modificado → `tema.dialogo.salir` antes de `edi.dialogo.salir`.
- Cierre de ventana: mientras el borrador tenga cambios, `app.guardadoPendiente(true)`; el diálogo de cierre existente (`navegacion/DialogoCierre.tsx`) delega en `tema.dialogo.salir` y llama a `app.confirmarCierre()` al decidir. Sin cambios en main.
- Punto `info` en la pestaña «Estilo» y en «Expandir panel» (`tema.pestana.editando`).

## Archivos

- `app/src/renderer/src/vistas/editor/useBorradorTema.ts` (nuevo) y su prueba.
- `app/src/renderer/src/vistas/editor/SeccionTema.tsx`, `PanelEstilo.tsx`, `panelEstilo.module.css`, `estado.ts`, `textos.ts`, `Editor.tsx`, `RielPanel.tsx` (punto `info`).
- `app/src/renderer/src/navegacion/salida.ts`, `DialogoCierre.tsx` y sus pruebas.

## Criterios de aceptación

- [ ] T7: D3 con banner anunciado, modo/selector/⋯ inertes, pie fijo con tres botones en dos filas sin partir entre 300 y 480 px; nada se escribe (catálogo y `cancion.json` sin cambios, comprobado con el doble).
- [ ] T8–T9: «Guardar en el tema…» abre el impacto con foco en «Cancelar»; al confirmar se escribe el tema y el editor sale de D3 con el aspecto nuevo y `tema.toast.guardado`.
- [ ] T10–T11: confirmación obsoleta y error de escritura se comportan como la spec; el borrador sigue intacto tras el error.
- [ ] T12–T13: salir con cambios muestra `tema.dialogo.salir` con foco en «Seguir editando»; sin cambios sale sin diálogo; tras guardar, descartar o guardar como nuevo, Ctrl/Cmd + Z no toca pasos del borrador.
- [ ] T23 (parte de cierre): cerrar la ventana con cambios en D3 muestra el diálogo y «Seguir editando» cancela el cierre; «Descartar cambios del tema» cierra.
- [ ] T27: con el panel minimizado en D3, «Expandir panel» lleva el punto `info` y su nombre accesible.

## Notas de implementación
