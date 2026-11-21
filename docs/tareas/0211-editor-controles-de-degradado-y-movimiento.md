# 0211 — Editor: controles de degradado, centro y movimiento

- Estado: Pendiente
- Paso del pipeline: 4
- Depende de: [0200](0200-esquema-del-estilo-ampliado-y-normalizacion.md), [0204](0204-geometria-del-fondo-y-css-de-los-tres-degradados.md), [0205](0205-peor-contraste-por-tramos-y-cierre-conico.md). Para integrar G7/G8 en la vista previa: [0213](0213-pantalla-de-letra-fondo-en-movimiento-indicadores-y-sin-barrido.md) (prop `fondoEstatico`).
- ADRs: [0018](../adr/0018-estilo-ampliado-espera-letra-lista-y-ajuste-de-silencios.md) §1, §2 y §4, [0016](../adr/0016-catalogo-de-temas-e-identidad-de-artista-y-album.md) §10
- Spec UX: [06 · G · Degradados y movimiento](../ux/06-editor.md#g--degradados-y-movimiento-feature-8) (G1–G11) y [sistema visual · fase 5](../ux/sistema-visual.md#020--estilo-espera-y-letra-lista-fase-5)

## Objetivo

En Estilo › Fondo, elegir la forma del degradado, el centro, el ángulo de inicio y el movimiento con su velocidad. Bajo la vista previa, detener el movimiento. En D1 y D4, mostrar el resumen.

## Contrato

- **Componente nuevo** `vistas/editor/estilo/ControlesFondo.tsx`, montado en `PanelEstilo.tsx` en lugar de las filas «Sólido/Degradado» y «Ángulo». Comprende:
  - **Forma**: segmentado Lineal / Radial / Cónico (`radiogroup`). Cambiar de forma conserva colores, ángulo, centro y movimiento.
  - **Centro**: cuadrícula 3 × 3 (`radiogroup` 2D), con flechas sin dar la vuelta e Inicio/Fin. Un valor fuera de 0/0,5/1 no marca ninguna celda y se describe con `edi.fondo.centro.otro`.
  - **Ángulo / Ángulo de inicio** según la forma. En el radial se oculta, pero se conserva.
- **Reparto de paradas** (función pura `repartirParadas(n, forma)` en `vistas/editor/estilo/paradas.ts`):
  - en el **cónico**, en i/n;
  - en el lineal y el radial, por igual de 0 a 1.

  Se aplica al cambiar de forma y al añadir o quitar colores. Un cónico abierto con la última parada en 1 no se reparte hasta que el usuario cambia algo.

- **Movimiento**:
  - la casilla empieza desmarcada; al marcarla guarda `{ periodo_s: 30, sentido: 'horario' }` y al desmarcarla, `null`;
  - **Velocidad** es un segmentado Lenta / Media / Rápida (60/30/15). Otro `periodo_s` guardado aparece como cuarta opción «{n} s», que desaparece al elegir otra;
  - un `sentido` antihorario guardado se conserva en cualquier cambio;
  - bajo la casilla van la ayuda `edi.fondo.mov.ayuda.*` y, si el sistema pide reducir el movimiento, `edi.fondo.mov.reducido`.
- **«Detener el movimiento del fondo»**:
  - botón icono 36 × 36 con `aria-pressed` junto a «Probar a pantalla completa», que se estrecha 44 px;
  - visible solo si hay movimiento y no está activo el movimiento reducido;
  - es estado de la visita: no se guarda ni entra en el historial;
  - pasa `fondoEstatico` a la vista previa (0213).
- **Resumen D1/D4**: `edi.fondo.resumen`, con forma, ángulo o centro y velocidad.
- **Historial**: cada cambio es un paso de deshacer con la acción `estilo` existente. Los cambios del dial se agrupan como hoy.
- **Temas (G9)**: no hace falta código nuevo, porque los campos viajan en `estilo`. Se comprueba en las pruebas.
- **Textos**: las claves `edi.fondo.*` de la spec, en `vistas/editor/textos.ts`, en un bloque propio.

## Archivos

`vistas/editor/estilo/{ControlesFondo,paradas}.ts(x)` (nuevos), la integración en `PanelEstilo.tsx`, el botón junto a «Probar» en `Editor.tsx` (pocas líneas), el bloque de textos, CSS del panel y sus pruebas.

## Criterios de aceptación

- [ ] G1, G3, G5 (parte de interfaz: valores guardados y opción «45 s»), G7, G8 y G11.
- [ ] G4 (reparto, en prueba unitaria).
- [ ] G9: guardar como tema nuevo y aplicarlo a otra canción conserva forma, centro y movimiento.
- [ ] G10 se ve en el panel con el muestreo de 0205.
- [ ] El panel a 300, 360 y 480 px no genera scroll de página (criterio general de la subfase 2.1).

## Pruebas de feedback

- Unitarias:
  - `paradas.test.ts` (G4);
  - `ControlesFondo.test.tsx`: forma, cuadrícula con teclado, velocidad, periodo «45 s», antihorario conservado y movimiento reducido emulado con `matchMedia`;
  - `PanelEstilo.test.tsx` (resumen D1/D4).
- E2E: ninguna. G2 (píxel a píxel) y G8 los cubre el E2E de [0219](0219-integracion-guia-manual-e-informe-de-la-fase-5.md).
- Críticos: no (solo renderer del editor, fuera del flujo crítico). Si se toca `Editor.tsx` en la parte del dock, sí.
- Manual (guía de la fase): G4, sin costura visible en el cónico con dos colores muy distintos; G12, fluidez en un equipo modesto.

## Notas de implementación
