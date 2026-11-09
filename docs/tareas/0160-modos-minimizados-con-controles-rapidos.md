# 0160 — Modos minimizados con controles rápidos

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: [0159](0159-divisores-accesibles-y-restablecer-distribucion.md)
- ADRs: [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--layout-adaptable-y-paneles), [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md)
- Specs: [Editor, subfase 2.1](../ux/06-editor.md#subfase-21--layout-adaptable-y-paneles) («Modos minimizados», «Foco al cambiar de modo», «Anuncios», «Microcopy»), [Sistema visual, rieles](../ux/sistema-visual.md#020--divisores-y-rieles-del-editor-subfase-21)
- Plan: [Subfase 2.1, punto 2](../versiones/0.2.0/plan-2.md#subfase-21--estabilización-del-editor)

## Objetivo

Minimizar no oculta nada: la lista pasa a un riel de 72 px, el panel a uno de 120 px y la línea de tiempo a una fila de 44 px (40 en compacto), cada uno con sus controles rápidos. Los modos son independientes y combinables. Esta tarea también añade la **línea de tiempo minimizada por falta de espacio**, que es temporal y nunca se guarda. El estado sigue en memoria: lo persiste 0161.

## Enfoque

- **Botones** de 32 × 32 en la cabecera de cada zona, con tooltip, `aria-expanded` y `aria-controls`: lista `panel-left-close`/`panel-left-open`, panel `panel-right-close`/`panel-right-open` y línea de tiempo `chevron-down`/`chevron-up` (iconos de `lucide-react`, ya en dependencias). **Intro** en el divisor correspondiente alterna (`alAlternar` de 0159). Una flecha que agranda o un arrastre desde el estado minimizado expanden partiendo del mínimo. Doble clic expande con el tamaño por defecto.
- **`RielLista.tsx`**:
  - Muestra número, total y tiempo de la línea **seleccionada** (`t-tiempo`, «--:--» si no tiene inicio).
  - Nombre accesible y tooltip `edi.layout.riel.linea`.
  - Botones ↑, ↓ e I que despachan exactamente las mismas acciones que los atajos: mismos límites, mismo tooltip de límite junto al botón y saltan pausas.
- **`RielPanel.tsx`**:
  - Inicio y Fin de solo lectura. Fin muestra «automático» si lo es.
  - «Fijar fin (O)» y la casilla «Bloquear enunciado» reutilizan los manejadores de `PanelSincronia`. Quedan inactivos sin inicio o en el modo sincronizar, con su motivo.
  - Siempre muestra los controles de Sincronía. Al expandir vuelve la pestaña que estaba activa.
  - Lleva el punto `aviso` sobre «Expandir panel» mientras haya avisos de contraste (`edi.layout.panel.expandir.aviso`).
- **Línea de tiempo minimizada**:
  - Extraer la vista general de `PistaSincronia.tsx` a `VistaGeneral.tsx`, con una variante `informativa`: solo clic para buscar, sin arrastrar el rectángulo y `aria-hidden`.
  - Conserva el intervalo visible, el zoom y la selección. Expandir no centra en el cabezal.
  - En el modo sincronizar, la fila minimizada sustituye a la línea de tiempo inactiva que dejó 0157 bajo el banner.
- **Minimizada por falta de espacio** (`minimizadoPorEspacio` de 0156):
  - La fila es la misma, con «Expandir» en `aria-disabled="true"` y el tooltip `edi.layout.timeline.sinEspacio`.
  - Si el foco estaba dentro, pasa a ese botón y se anuncia `edi.layout.anuncio.sinEspacio` una vez.
  - Al volver el espacio, recupera el estado preferido. No toca preferencias.
- **Foco**:
  - Al cambiar de modo con el botón, el foco pasa al botón equivalente del otro modo.
  - Con Intro o doble clic en el divisor, el foco se queda en el divisor.
  - Si el elemento con foco desaparece (restablecer o falta de espacio), el foco va al botón Expandir/Minimizar de la zona afectada y nunca a `body`.
  - Con la lista minimizada, «Saltar al contenido» y el foco inicial van a «Expandir lista de líneas».
- **Anuncios** en la región `aria-live` existente, una vez por cambio: `edi.layout.anuncio.minimizado`/`expandido`, con género («Lista de líneas» f., «Panel» m., «Línea de tiempo» f.). Las regiones añaden «, minimizada»/«, minimizado» a su nombre accesible. `aria-valuetext` del divisor: `edi.layout.valor.minimizado`.
- «Restablecer distribución» (0159) expande también las tres zonas.

## Archivos

- `app/src/renderer/src/vistas/editor/RielLista.tsx`, `RielPanel.tsx`, `VistaGeneral.tsx` y sus tests (nuevos).
- `app/src/renderer/src/vistas/editor/PistaSincronia.tsx`, `pistaSincronia.module.css` (extracción de la vista general; conservar la medición por contenedor de 0154).
- `app/src/renderer/src/vistas/editor/Editor.tsx`, `editor.module.css`, `ListaLineas.tsx`, `PanelSincronia.tsx` (botones Minimizar y manejadores compartidos), `useDistribucion.ts`.
- `app/src/renderer/src/vistas/editor/textos.ts`: claves `edi.layout.lista.*`, `panel.*`, `timeline.*`, `riel.*`, `anuncio.*` y `region.*`.
- `app/e2e/editor-layout.spec.ts`.

## Criterios de aceptación

- [ ] Criterios 14–18 de la spec y la parte de minimizados del 8.
- [ ] Vitest: el riel de la lista y los atajos ↑/↓/I producen el mismo estado del *reducer*. El riel del panel queda inactivo sin inicio y en el modo sincronizar, con su motivo. El punto de aviso tiene su nombre accesible. La vista general informativa busca con un clic y no arrastra.
- [ ] E2E: minimizar y expandir cada zona con su botón y con Intro en el divisor. El foco nunca queda en `body` (`document.activeElement !== document.body` tras cada paso). Cada cambio se anuncia una vez.
- [ ] E2E: la fila minimizada muestra el cabezal avanzando al reproducir y un clic busca. Al expandir se conservan el intervalo visible y el zoom.
- [ ] E2E: a 1024 × 500 CSS (ventana 1280 × 625 con `setZoomFactor(1.25)`), la línea de tiempo se minimiza sola con «Expandir» en `aria-disabled` y vuelve expandida al agrandar.
- [ ] Todo minimizado (`todo-min`) a 1024 × 576: sin scroll de página y la previa ocupa el ancho liberado.
- [ ] Ningún caso de `editor.spec.ts` (0153 y 0154) cambia de resultado.

## Verificación

Desde `app/`: `npm test -- src/renderer/src/vistas/editor`, `npm run lint`, `npm run typecheck` y `npm run test:e2e -- e2e/editor-layout.spec.ts e2e/editor.spec.ts`.

## Notas de implementación

- Hecho: `BotonLayout.tsx` (botón de 32 × 32 con tooltip, `aria-expanded`, `aria-controls`, `aria-disabled` con motivo y punto `aviso`), `RielLista.tsx` (72 px: número, total y tiempo de la línea seleccionada con nombre accesible `edi.layout.riel.linea`, ↑, ↓ e I), `RielPanel.tsx` (120 px: Inicio, Fin con «automático», «Fijar fin (O)» y «Bloquear enunciado», con su motivo y inactivos en el modo sincronizar) y `VistaGeneral.tsx` (minimapa extraído de `PistaSincronia`, con variante `informativa`: `aria-hidden`, un clic busca, no se arrastra, con cabezal propio `data-cabezal-general`). `PistaSincronia` recibe `minimizada`, `expandirNoDisponible` y `alternarMinimizada` y conserva el intervalo visible y el zoom porque es la misma instancia. La fila minimizada mide 44 px (40 en compacto) con una variable propia (`--alto-fila-minimizada`) para que se mida en el mismo fotograma.
- `Editor.tsx`: `alternarZona` (botón: foco al equivalente del otro modo; Intro o doble clic: foco en el divisor), anuncios en la región `aria-live` existente (ahora un contenedor con dos `span`; `data-anuncio-layout` para el de la distribución), minimización por falta de espacio (temporal: anuncia una vez, mueve el foco a «Expandir» si estaba dentro y nunca toca la preferencia), «Saltar al contenido» y foco inicial a «Expandir lista de líneas» con la lista minimizada, y `moverSeleccion`, compartido por los atajos y el riel (mismo código, mismas acciones). `limiteDeCampo` se extrae de `PanelSincronia` para enseñar el aviso de límite junto a «I» y «O» de los rieles. La región de la lista se llama ahora «Lista de líneas» (antes «Sincronía») y las minimizadas añaden «, minimizada» o «, minimizado».
- En el modo sincronizar la fila minimizada sustituye a la línea de tiempo inactiva: `main` ya no hace scroll bajo 720 de alto. `e2e/editor-layout.spec.ts` exige «sin elementos fuera del viewport» y sin scroll en `main` en el modo sincronizar en los seis viewports. Para ello hubo que arreglar la rejilla de la sección (`grid-template-columns: minmax(0, 1fr)`: con el botón nuevo la fila de controles desbordaba a 1024 px) y la altura de la fila minimizada (con la variable de la distribución, el primer fotograma medía una fila de 204 px y el modelo daba «bajo mínimo por alto»).
- Pruebas: `Editor.paneles.test.tsx` (riel y atajos con el mismo estado, «I» del riel, riel del panel inactivo con su motivo y punto `aviso` con nombre, foco, anuncios, sin espacio), `VistaGeneral.test.tsx` (2) y, en E2E: minimizar y expandir cada zona con botón e Intro (foco nunca en `body`, anuncio una vez), rieles, cabezal en movimiento, clic que busca y zoom conservado, 1024 × 500 CSS (`setZoomFactor(1.25)` en una ventana de 1280 × 625) y todo minimizado a 1024 × 576.
- Desviación: en el modo sincronizar, «Expandir» de la fila minimizada queda con `aria-disabled` y el motivo «Sincronizando al ritmo» (la spec no lo define). Deuda: si `bajoMinimo = 'alto'` hace aparecer la barra de scroll de `main` justo a 1024 px de ancho, el ancho útil baja y el modelo pasa a la disposición B sin volver sola (histéresis). Con la fila minimizada ya no ocurre en la matriz, pero conviene revisarlo en 0162.
