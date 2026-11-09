# 0159 — Divisores accesibles y «Restablecer distribución»

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: [0157](0157-layout-del-editor-a-alto-completo.md)
- ADRs: [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--layout-adaptable-y-paneles)
- Specs: [Editor, subfase 2.1](../ux/06-editor.md#subfase-21--layout-adaptable-y-paneles) («Divisores», «Microcopy»), [Sistema visual, divisores y rieles](../ux/sistema-visual.md#020--divisores-y-rieles-del-editor-subfase-21), [§7 Foco](../ux/sistema-visual.md#7-foco-y-navegación-por-teclado)
- Plan: [Subfase 2.1, punto 2](../versiones/0.2.0/plan-2.md#subfase-21--estabilización-del-editor)

## Objetivo

Tres divisores (lista ↔ vista previa, vista previa ↔ panel y zona superior ↔ dock, este último solo en Sincronía) que redimensionan con ratón y teclado según el patrón *Window Splitter* de WAI-ARIA. Doble clic restablece. La acción «Restablecer distribución de paneles» va en el menú ⋯. En esta tarea las preferencias viven **en memoria** (estado del editor) y se pierden al salir: la persistencia es de 0161. Intro para minimizar llega en 0160. Aquí Intro no hace nada.

## Enfoque

- Componente genérico `componentes/Divisor.tsx` con su CSS propio (`componentes/divisor.module.css`):
  - Props: `orientacion` (`vertical` controla un ancho y `horizontal` un alto), `controla` (id), `etiqueta`, `valor`, `min`, `max`, `minimizado`, `textoValor`, `alCambiar(valor, origen: 'teclado' | 'arrastre')`, `alConfirmar(valor)`, `alRestablecer()` y `alAlternar?()`.
  - No conoce el editor. Usa `aplicarTecla`/`aplicarArrastre` de 0156, o recibe esas funciones como props para no depender del editor.
  - Estilos: franja de 12 px, línea de 1 px y agarre de 16 px (objetivo de 24 × 24). *Hover*, arrastre y `:focus-visible` según sistema-visual. Cursor `col-resize`/`row-resize`.
- **Ratón**:
  - `setPointerCapture`. Durante el arrastre, clase global en `body` con el cursor y `user-select: none`.
  - Tamaño en vivo acotado a `[min, max]` efectivos y nunca minimiza.
  - Esc cancela y devuelve el tamaño previo. `lostpointercapture` confirma el último tamaño.
  - El tamaño se aplica por propiedad CSS en cada `pointermove` (con `requestAnimationFrame`), sin pasar por el *reducer* de edición.
  - Doble clic llama a `alRestablecer` (defecto de lo que controla y expande).
  - Tooltip `edi.layout.divisor.tooltip` a los 500 ms.
- **Teclado**:
  - `role="separator"`, `tabindex="0"`, orden de tabulación entre los elementos que separa, `aria-orientation`, `aria-controls`, `aria-label` y `aria-valuenow`/`min`/`max` (efectivos) más `aria-valuetext` (`edi.layout.valor`).
  - Flechas ±16, con Mayús ±64. Inicio y Fin.
  - Las flechas del otro eje se consumen sin efecto (`preventDefault` y `stopPropagation`, para que ↑/↓ no cambien de línea).
  - Espacio y los demás atajos del editor siguen funcionando: revisar `useAtajosEditor.ts`, que hoy puede ignorar el evento si el foco no está en una zona conocida. Añadir `data-foco-editor="divisor"` o equivalente.
- **Menú ⋯**: nuevo ítem `edi.layout.restablecer`. Devuelve los tres tamaños por defecto, expande todo (cuando exista 0160), anuncia `edi.layout.anuncio.restablecida` en la región `aria-live` existente y devuelve el foco al botón ⋯.
- **Preferencia frente a efectivo**: el estado guarda preferencias. Una acción del usuario sobre un divisor fija la preferencia con el valor **visible** (`preferenciaTrasAccion`). Un recorte por tamaño de ventana nunca la cambia.
- Redimensionar no crea pasos de deshacer ni cambia el indicador de guardado.

## Archivos

- `app/src/renderer/src/componentes/Divisor.tsx`, `Divisor.test.tsx`, `divisor.module.css` (nuevos).
- `app/src/renderer/src/vistas/editor/Editor.tsx` (colocar los divisores, estado de preferencias en memoria e ítem de menú), `editor.module.css` (franjas de la rejilla), `useDistribucion.ts`.
- `app/src/renderer/src/vistas/editor/useAtajosEditor.ts`, `atajos.ts` y `atajos.test.ts` (foco en el divisor).
- `app/src/renderer/src/vistas/editor/textos.ts`: claves `edi.layout.divisor.*`, `edi.layout.valor`, `edi.layout.restablecer` y `edi.layout.anuncio.restablecida`.
- `app/e2e/editor-layout.spec.ts`.

## Criterios de aceptación

- [ ] Criterios 9–13 de la spec. Vitest con `Divisor` aislado: atributos ARIA, teclas, Mayús, Inicio y Fin, eje contrario sin efecto, Esc durante el arrastre, doble clic y `lostpointercapture`.
- [ ] E2E a 1280 × 720 y 1920 × 1080 (100 %): cada divisor arrastrado con `page.mouse` se detiene en los mínimos (256/300/188, o 176 en compacto) y en los máximos efectivos (previa ≥ 320, zona superior ≥ 136, lista y panel ≤ 480). La página no hace scroll en ningún momento.
- [ ] E2E: con el foco en el divisor de la lista, ↓ no cambia la línea seleccionada y Espacio reproduce y pausa.
- [ ] «Restablecer distribución de paneles» devuelve 300/360/216 (204 en compacto), lo anuncia una sola vez y deja el foco en ⋯.
- [ ] Redimensionar no añade pasos al historial ni cambia «Guardado» (Vitest del *reducer* sin acciones nuevas y E2E que comprueba que `cancion.json` no cambia).
- [ ] La onda y las regiones siguen alineadas tras arrastrar el divisor del panel o del dock mientras suena (0154 y 0153 en verde).

## Verificación

Desde `app/`: `npm test -- src/renderer/src/componentes/Divisor src/renderer/src/vistas/editor`, `npm run lint`, `npm run typecheck` y `npm run test:e2e -- e2e/editor-layout.spec.ts e2e/editor.spec.ts`.

## Notas de implementación

- Hecho: `componentes/Divisor.tsx` + `divisor.module.css` (genérico, sin conocer el editor): `role="separator"`, `tabindex="0"`, `aria-orientation`/`controls`/`label`/`valuenow`/`min`/`max`/`valuetext`, franja de 12 px con línea de 1 px, agarre de 16 px (12 × 24 px; 24 × 12 px en el horizontal), *hover*, arrastre y `:focus-visible` según sistema-visual, tooltip propio a los 500 ms. Recibe `alTecla` y `alArrastre`, que el editor enlaza con `aplicarTecla` y `aplicarArrastre` de 0156 (la lógica de teclas y límites no se duplica). Ratón: `setPointerCapture`, `requestAnimationFrame`, atributo `data-arrastre-divisor` en `body` (cursor y `user-select: none` en `base.css`), Esc cancela y restaura, `lostpointercapture` y `pointerup` confirman una sola vez y solo si hubo movimiento. Doble clic restablece.
- Editor: los tres divisores sustituyen a las franjas vacías (`data-divisor` se conserva). El tamaño en vivo se escribe directamente en la variable CSS (`aplicarTamanoVivo` en `useDistribucion.ts`), sin estado ni *reducer*; al confirmar o con teclado se llama a `preferenciaTrasAccion` (valor visible, entero, expande). Ítem «Restablecer distribución de paneles» en el menú ⋯ (restablece las tres preferencias, expande todo y anuncia una vez; `MenuContextual` ya devuelve el foco a ⋯).
- Atajos: `FocoEditor` incluye `divisor` (`data-foco-editor`). En un divisor las cuatro flechas y Inicio son suyas (↑/↓ ya no cambian de línea) y Espacio y el resto siguen. `useAtajosEditor` se aparta mientras hay un arrastre (`ATRIBUTO_ARRASTRE_DIVISOR`) para que Esc sea del arrastre y no salga del editor.
- Pruebas: `Divisor.test.tsx` (13), `atajos.test.ts` (+1), `Editor.paneles.test.tsx` (9, compartido con 0160 y 0161) y, en `e2e/editor-layout.spec.ts`: arrastre a mínimos y máximos a 1280 × 720 y 1920 × 1080 (sin scroll y sin escribir `cancion.json`), Esc, teclado (↓ no cambia de línea, Espacio reproduce, ±16, Mayús, Inicio, Fin), restablecer (valores, anuncio una vez, foco en ⋯) y el criterio pendiente de 0158 con el panel a 300, 360 y 480 px.
- Cómo probarlo, desde `app/`: `npm test -- src/renderer/src/componentes/Divisor src/renderer/src/vistas/editor` y `npm run test:e2e -- e2e/editor-layout.spec.ts`.
- Deuda: el tooltip del divisor es propio (no usa `Tooltip`, que envuelve en un `span` y rompería la rejilla). Un arrastre desde el estado minimizado estira el riel al tamaño en vivo hasta soltar (la zona no se expande visualmente hasta confirmar).
