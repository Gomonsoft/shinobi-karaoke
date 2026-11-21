# 0279 — Integrar el editor preciso en el editor: abrir, bloqueo de la línea, aplicar como un paso y guardar el texto

- Estado: Pendiente
- Paso del pipeline: 4 (editor) y 5 (guardado)
- Fase: 9 de 0.2.1 · Lote D (editor)
- Depende de: 0271 (mismo lote), 0278 (ventana), 0283 (`letras.editarTextoLinea`), 0262 (`guardarTiempos` con palabras manuales), 0272 (`aplicarEdicionPrecisa`), 0273 (preferencias)
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §4, §7 y §9; [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-021--fases-8-y-9) (historial y guardado); [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md#revisión-para-021--fases-8-y-9)
- Spec UX: [06 · Fase 9](../ux/06-editor.md#fase-9-de-021--editor-preciso-de-línea): «Abrir la ventana», «Aplicar, cancelar y cerrar» (lo que afecta al editor), «Deshacer» (en el editor), «Relación con el resto del editor», «Indicador en la lista, el panel y la línea de tiempo»; tabla «Atajos de teclado en 0.2.1» (P, F6); criterios **P1**, **P2** (recordar y restablecer), **P3**, **P12**, **P13**, **P16**, **P17**, **P19**, **P20**, **P22** (en el editor)
- Tamaño: L

## Objetivo

Conectar la ventana (0278) con el editor: puntos de entrada, bloqueo de la línea abierta, un paso del historial al aplicar, guardado del texto y de las palabras, e indicadores.

## Archivos (solo estos)

- `app/src/renderer/src/vistas/editor/`: `Editor.tsx`, `estado.ts` (acción `aplicar_preciso`), `useGuardadoEditor.tsx` (texto antes de tiempos), `ListaLineas.tsx` (botón de la fila de título, menú contextual de fila, indicador `whole-word`), `PanelSincronia.tsx` (botón y avisos), `RielPanel.tsx`/riel de la lista, `PistaSincronia.tsx` (región ocupada y fronteras de palabras), `atajos.ts`, `DialogoAtajos.tsx`, `usePreferenciasPaneles.ts`, `fixturesApi.ts`, `textos.ts`, `editor.module.css` y sus tests

## Criterios de aceptación

- [ ] **Abrir** con P, el botón `whole-word` de la fila de título de la lista, el del panel, el del riel y el menú contextual de la fila («Editor preciso de línea… (P)» · «Escuchar la línea (Mayús + L)» · «Escuchar desde esta línea (L)» · separador · «Borrar tiempos de esta línea (Supr)»). Con línea sin inicio, modo al ritmo o error de audio: `aria-disabled` con su motivo; P solo muestra el tooltip (P1). Con la ventana abierta, P y el botón le devuelven el foco; al cerrar, el foco vuelve a quien la abrió (P3).
- [ ] La ventana recibe `limites` = área del editor bajo la barra de la app y la referencia = borde derecho de la lista; posición, tamaño y margen se guardan en `config.editor.paneles.preciso` y «Restablecer distribución de paneles» los restablece (P2).
- [ ] **Aplicar** = un solo paso del historial (`aplicar_preciso`, nombre `edi.preciso.paso`) con `aplicarEdicionPrecisa`: texto, límites y palabras (o ninguna con «Quitar…»), fin fijado si era automático y quedan palabras; un Ctrl/Cmd + Z lo devuelve todo (también las importadas, si las tenía) y recarga la ventana si sigue en esa línea (P13). ⟲/Ctrl + Z con el foco en el editor y borrador con cambios: aplica y deshace (P15).
- [ ] **Guardado**: `useGuardadoEditor` llama a `letras.editarTextoLinea` por cada línea cuyo texto cambió respecto a la última instantánea enviada y después a `guardarTiempos` con `origen_palabras: "manual"`. Tras aplicar con texto cambiado, la lista, la vista previa y `cancion.json` muestran el texto nuevo y la línea conserva inicio, fin y palabras (P12). Guardar y reabrir conserva las palabras (P18, parte de datos).
- [ ] **Relación con el editor** (tabla de la spec): la línea abierta no ofrece tiradores en la línea de tiempo ni campos, I/O/Supr/Retroceso/Alt-Ctrl + flechas, «Usar fin automático», «Borrar tiempos» ni «Bloquear enunciado» (`edi.preciso.ocupado`); «Bloquear enunciado» activo al abrir termina; seleccionar otra línea (lista, región, ↑/↓) aplica y carga esa línea, o muestra `edi.preciso.vacio.sinInicio` con [Fijar inicio aquí (I)]; «Sincronizar al ritmo», «Ajustar los silencios», «Corregir la letra» y salir aplican y cierran; F y Ctrl/Cmd + E aplican y la ventana sigue al volver; `LETRA_DESACTUALIZADA` la cierra sin aplicar (P16, P17). La vista previa pinta la línea con el borrador.
- [ ] **Indicadores**: icono `whole-word` en las filas con palabras hechas a mano (`edi.preciso.indicador`, nombre accesible con `edi.preciso.indicador.aria`); en el panel `edi.preciso.indicador.panel` y `edi.preciso.aviso.descartar`; fronteras de palabra de 1 px en la región y `edi.preciso.aviso.tirador` en el tooltip de sus tiradores (P19).
- [ ] Mover después el inicio o el fin de esa línea por cualquier vía de 8.2 vuelve al barrido progresivo con `edi.toast.palabras` y un Ctrl/Cmd + Z o [Deshacer] lo devuelve (P20).
- [ ] F6 / Mayús + F6 entre la ventana y el editor; los atajos del editor ignoran eventos dentro de `data-ventana-flotante`; el diálogo de atajos añade P, F6 y la sección `edi.preciso.atajos.titulo` (P22).

## Pruebas de feedback

- Unitarias: `estado.test.ts` (`aplicar_preciso` como un paso, deshacer completo), prueba del guardado (orden texto → tiempos con una API doble), pruebas de componente de entrada y bloqueo.
- E2E: la cubre 0280.
- Críticos: sí (editor y guardado del flujo principal).
- Manual: guía de la fase 9 — Esc aplicando no sorprende.

## Notas de implementación
