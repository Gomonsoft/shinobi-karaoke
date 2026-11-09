# 0170 — Panel Estilo: sección «Tema» (modo, selector, procedencia y acciones)

- Estado: Pendiente
- Paso del pipeline: 4
- Depende de: [0169](0169-base-de-temas-en-el-renderer.md) (prueba con dobles; la integración real se verifica en [0176](0176-verificacion-e2e-capturas-e-informe-de-la-fase-3.md))
- ADRs: [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §3 (`alHeredar`), §9–§10, [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--fase-3)
- Specs: [Editor · Fase 3](../ux/06-editor.md#fase-3-de-020--temas-y-biblioteca) (D1, D2, D4, estados y criterios T1–T6, T2b, T14–T22, T22b, T24–T26, T28), [0055](../preguntas/0055-textos-de-predeterminado-anterior-y-ajustes-de-la-fase-3.md), [0056](../preguntas/0056-destino-respaldo-y-canciones-pendientes.md) (destino `respaldo`)

## Objetivo

Sustituir el final del panel Estilo por la sección «Tema» de la spec: modo «Temas definidos»/«Tema personalizado», selector con procedencia y usos, «Volver a heredar» con destino, «Personalizar», «Guardar como tema nuevo…» con el aviso «Usar «{nuevo}» en esta canción», menú ⋯ (renombrar, duplicar, tema de álbum o artista, administrar, eliminar), resumen de solo lectura y estados (catálogo vacío, estilo incluido, no disponible, solo lectura, borrado pendiente). La edición del tema (D3) es de 0171.

## Contrato

- El editor carga `obtener(id)` con `apariencia` en disco y `resuelta`. Al abrir, la vista previa pinta `resuelta.estilo` (o el estilo propio en D2).
- **Datos vivos** (ADR 0016 §9, revisión 2): procedencia, tema efectivo, estilo resuelto y `alHeredar` se leen del **resumen vivo** de la canción, que el editor ya mantiene: el de `biblioteca.listar()` al abrir, la respuesta de `guardarApariencia`, cada `cancion:cambiada` de su id y un nuevo `biblioteca.listar()` tras cada `temas:cambiado`, descartando respuestas antiguas. Los usos (`tema.usos`) salen de `CatalogoIpc` (`useCatalogoTemas`). Si llega un `temas:cambiado` mientras hay un guardado de selección en vuelo, manda la respuesta más reciente.
- **«Volver a heredar» y `tema.heredar.destino`**: el destino es `apariencia.alHeredar` del resumen vivo, calculado en main. El renderer **no** llama a `resolverApariencia`. Textos de la spec 06:
  - genérico: «Usará «{tema}», {procedencia en minúscula}.», con `procedenciaLarga` de 0169 en minúscula y los nombres de álbum y artista como en la Biblioteca;
  - `predeterminado_anterior`: «Usará «{tema}», el tema predeterminado anterior.»;
  - `incluido`: «Usará el estilo incluido de Shinobi Karaoke.»;
  - `respaldo` ([0056](../preguntas/0056-destino-respaldo-y-canciones-pendientes.md), T22b): `tema.heredar.destino.respaldo` («⚠ Su tema de origen no está en tus temas. Se verá con el último aspecto guardado en esta canción («Tema no disponible»).»), con ⚠ en `aviso` (`aria-hidden`) y el texto en `texto-2`. **No se nombra ningún tema**: con procedencia `respaldo` se ignora `alHeredar.temaNombre`.
  - Al pulsarlo (en cualquier destino, también `respaldo`, sin confirmación porque se deshace con Ctrl/Cmd + Z): `guardarApariencia(id, { modo: "heredar" })`, que conserva la base, anuncio `tema.anuncio.heredar` (variante «estilo incluido» si el destino es `incluido`) y foco en el selector. Con destino `respaldo` el panel pasa a D4 y se anuncia `tema.anuncio.heredar.respaldo`.
- **Variantes de 0056** en `vistas/editor/textos.ts`: `tema.toast.definidos` (genérica con la procedencia corta, «estilo incluido» y `respaldo`, esta última sin nombre de tema), `tema.anuncio.heredar` (genérica y «estilo incluido») y `tema.anuncio.heredar.respaldo`. La procedencia corta de `respaldo` («no disponible») sale de `procedenciaCorta` de 0169, aunque el toast `respaldo` no la usa.
- **Guardado**: `guardarApariencia` con la selección; mismo *debounce* y vaciado que hoy. El historial de la visita pasa de `{ letra, estilo }` a `{ letra, apariencia }` (selección + estilo propio). Deshacer reenvía la selección. Si un tema deja de existir, se retiran los pasos que lo asignarían (T20).
- Tras cada cambio de selección, la procedencia, `alHeredar` y los usos vienen de main (véase «Datos vivos»); el renderer no los calcula.
- «Administrar temas…» navega a Ajustes › Temas tras vaciar el guardado. El origen «editor» y el regreso («‹ Volver al editor») son de [0175](0175-ajustes-seccion-temas.md), dueña de `navegacion/estado.ts`; esta tarea solo llama a la acción de navegación existente con la sección «temas» y, cuando 0175 la publique, con el origen.
- **Retiradas**: «Restablecer estilo predeterminado», «Usar este estilo en canciones nuevas», sus claves y su escritura de `config.estilo_predeterminado`. **Excepción de propiedad acordada**: esta tarea retira `estilo_predeterminado` de `configParcialRendererSchema` en `shared/config.ts` (una línea y su prueba), porque es la última consumidora; el campo sigue en `configSchema` como heredado.

## Archivos

- `app/src/renderer/src/vistas/editor/SeccionTema.tsx` (nuevo) y `SeccionTema.test.tsx`.
- `app/src/renderer/src/vistas/editor/PanelEstilo.tsx`, `PanelEstilo.test.tsx`, `panelEstilo.module.css`, `textos.ts`.
- `app/src/renderer/src/vistas/editor/estado.ts`, `estado.test.ts` (historial), `guardado.ts`, `guardado.test.ts`, `useGuardadoEditor.tsx`.
- `app/src/renderer/src/vistas/editor/Editor.tsx` (solo la llamada de «Administrar temas…»).
- `app/src/shared/config.ts`, `config.test.ts` (solo la retirada indicada).

## Criterios de aceptación

- [ ] T1: una canción sin `apariencia` abre en D2 con su estilo y `tema.origen.personalizado`; ningún archivo cambia hasta actuar.
- [ ] T2–T3: procedencia correcta en los niveles canción, álbum, artista, predeterminado, al azar, predeterminado anterior e incluido; elegir un tema lo asigna sin diálogo, la vista previa cambia en < 100 ms, se autoguarda y Ctrl/Cmd + Z lo revierte; «Volver a heredar» anuncia antes su destino.
- [ ] T2b: con la canción de la semilla de 0168 (base `predeterminado_anterior`), la procedencia es `tema.origen.anterior`; al asignarle «Neón», `tema.heredar.destino` dice «Usará «Sol», el tema predeterminado anterior.» antes de pulsar, y «Volver a heredar» la devuelve a esa procedencia con el mismo aspecto. Con los dobles, si llega `temas:cambiado` y el nuevo `listar()` trae otro `alHeredar` (por ejemplo, tras poner tema al artista), el texto cambia sin recargar el editor.
- [ ] Ninguna ruta del editor importa `resolverApariencia` (comprobado con una prueba o una regla de lint sobre `vistas/editor/`).
- [ ] T4–T5: «Personalizar» conserva el aspecto y las ediciones en D2 no cambian el tema ni otras canciones; volver a «Temas definidos» hereda, muestra `tema.toast.definidos` (variante según el destino) y [Deshacer] recupera el estilo propio exacto.
- [ ] T22b (con los dobles): una canción asignada cuyo `alHeredar` es `{ procedencia: "respaldo", temaNombre: "Sol" }` muestra bajo [Volver a heredar] `tema.heredar.destino.respaldo` con ⚠ en `aviso` y sin «Sol» en ningún texto; pulsarlo, sin diálogo, deja el panel en D4, anuncia `tema.anuncio.heredar.respaldo` y deja el foco en el selector; Ctrl/Cmd + Z devuelve el tema asignado. Desde D2 con ese mismo destino, pasar a «Temas definidos» muestra la variante `respaldo` de `tema.toast.definidos`. Con destino `incluido`, el anuncio es la variante «estilo incluido» de `tema.anuncio.heredar`.
- [ ] T6: en D1/D4 resumen de solo lectura y `tema.contraste.ayuda` sin acciones rápidas; en D2 las acciones rápidas funcionan.
- [ ] T14–T16: «Guardar como tema nuevo…» no cambia la canción y el aviso deja el foco en [Usar «{nuevo}» en esta canción], deshacible; renombrar y duplicar sin confirmación de impacto.
- [ ] T17–T18, T20: eliminar desde ⋯ con el diálogo de 0169 (el fallo a mitad, T19, lo pinta `DialogoEliminarTema` con `ListaFalloAMitad` de 0169; esta tarea no lo reimplementa); si la canción estaba afectada, pasa a D2 con foco en el radio y `tema.anuncio.eliminado.esta`; Ctrl/Cmd + Z no vuelve a vincularla.
- [ ] T21: «Tema del álbum…»/«Tema del artista…» abren `DialogoTemaGrupo`; sin álbum, sin artista o álbum sin artista quedan `aria-disabled` con su motivo.
- [ ] T22–T24: D4 con nombre guardado o `sinNombre`; solo lectura con `tema.soloLectura` y solo «Personalizar»; tema en borrado no ofrecido y `tema.borradoPendiente` si es el efectivo; catálogo vacío con `tema.catalogo.vacio`.
- [ ] T25–T26, T28, T30: operable con teclado; a 300, 360 y 480 px de panel y en los seis viewports de 2.1 sin scroll de página ni texto cortado; muestras fieles; los criterios 1–7, 13 y 20 de la subfase 2.1 se mantienen en D1–D4 (`e2e/editor-layout.spec.ts` en verde).
- [ ] El editor ya no lee ni escribe `config.estilo_predeterminado`; `config.actualizar({ estilo_predeterminado })` se rechaza.

## Notas de implementación
