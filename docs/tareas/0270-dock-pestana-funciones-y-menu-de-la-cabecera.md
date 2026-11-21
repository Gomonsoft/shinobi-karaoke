# 0270 — Dock con «Hecho» y «Marcar como…», pestaña «Funciones» y menú ⋯ reducido

- Estado: Pendiente
- Paso del pipeline: 4 (editor)
- Fase: 8 de 0.2.1 · Lote D (editor)
- Depende de: 0269 (mismo lote: `Editor.tsx`, `textos.ts`)
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §8 (pestaña «Funciones»); [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §5 (`marcarLista` con modalidad); [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--layout-adaptable-y-paneles) (distribución)
- Spec UX: [06 · 8.6](../ux/06-editor.md#86--estados-y-acciones-dock-pestaña-funciones-y-menú-) («Dock, fila 2», «Pestaña «Funciones»», «Menú ⋯ de la cabecera»), «Estados (fase 8, editor)», «Accesibilidad (fase 8, editor)», claves `edi.funciones.*` y `edi.layout.riel.funciones`; criterios **E8-12** a **E8-18**; [sistema visual · 0.2.1](../ux/sistema-visual.md#021--sincronía-editor-preciso-y-barra-de-carga-fases-8-y-9) (pestañas, sección de «Funciones», botón del riel)
- Tamaño: L

## Objetivo

Dejar a la vista las funciones mayores (feedback, punto 7) y los botones de estado también en Lista y Letra lista.

## Archivos (solo estos)

- `app/src/renderer/src/vistas/editor/`: `Editor.tsx`, `PanelFunciones.tsx` (nuevo) y su test, `BotonLista.tsx`, `BotonLetraLista.tsx`, `RielPanel.tsx`, `distribucion.ts`, `useDistribucion.ts`, `textos.ts`, `editor.module.css` y sus tests
- `app/e2e/editor.spec.ts`, `e2e/editor-layout.spec.ts`, `e2e/fase5.spec.ts` y las specs que abran estas acciones desde el menú ⋯ (buscar con `grep`)

## Criterios de aceptación

- [ ] Dock, fila 2, a la derecha: borrador «Marcar como letra lista» + **«Marcar como lista»**; Lista «Marcar como letra lista» + **«Hecho»**; Letra lista «Marcar como lista» + **«Hecho»**. No se parte en los seis viewports de la subfase 2.1 (E8-12).
- [ ] En Lista, «Marcar como letra lista» (con aviso de primera activación si no está silenciado) cambia la modalidad con `biblioteca.marcarLista(id, { modalidad })`, vacía el guardado, vuelve a la Biblioteca con la tarjeta enfocada y resaltada y `bib.toast.letraLista`; en Letra lista, «Marcar como lista» sin diálogo y `bib.toast.lista`. Con líneas sin inicio, la primera pulsación de la visita (de los dos o de «Hecho») muestra `edi.hecho.incompleta` (E8-13). Con un borrador de tema, `tema.dialogo.salir` primero.
- [ ] Pestaña «Funciones» (`tablist` de tres, ←/→, Inicio/Fin) con «Exportar video» (o «Ver exportación» + `bib.exp.linea`/`bib.exp.cola`), «Ajustar los silencios», «Modo de reproducción» y «Estado de la canción» con los textos y botones de la tabla de la spec por estado; cada acción hace lo mismo que su versión del menú ⋯ (mismos diálogos, toasts e historial) (E8-14). Todos los botones secundarios. La línea de tiempo se ve con «Funciones» (solo «Estilo» la oculta).
- [ ] Motivo de no disponible siempre visible bajo el botón (`aria-disabled`, `aria-describedby`, icono `info`), actualizado en vivo: `exp.motivo.sinPistas`/`sinLineas` y el primer renglón de `edi.silencios.falta.*`; al pulsar «Ajustar los silencios…» no disponible se abre su popover de siempre (E8-15).
- [ ] Menú ⋯ con solo «Atajos de teclado (F1)» y «Restablecer distribución de paneles» (E8-16).
- [ ] Riel: botón «Funciones» que expande el panel en esa pestaña con el foco en su primer botón disponible; en el modo al ritmo la pestaña está inactiva y Ctrl/Cmd + E no actúa; a 300 px las tres pestañas no se parten (E8-17). Foco al terminar cada acción según la spec.
- [ ] Las cuatro funciones mayores se alcanzan sin ⋯, con ratón y con teclado (E8-18).

## Pruebas de feedback

- Unitarias: `PanelFunciones.test.tsx` (tabla por estado, motivos, foco), `distribucion.test.ts` (tercera pestaña), pruebas del dock.
- E2E: las specs cambiadas (`npm run test:e2e:cambios`); `editor-layout.spec.ts` comprueba las tres pestañas a 300 px.
- Críticos: sí — el flujo principal marca la canción como lista desde el dock (`npm run test:e2e:criticos`; si el crítico usaba el menú ⋯, avisar a `qa` en las notas).
- Manual: guía de la fase 8 — se encuentran las funciones sin ⋯.

## Notas de implementación
