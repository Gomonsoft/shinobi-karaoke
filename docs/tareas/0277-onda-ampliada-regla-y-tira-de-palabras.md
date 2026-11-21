# 0277 — Onda ampliada, regla, tiradores y tira de palabras del editor preciso

- Estado: Pendiente
- Paso del pipeline: 4 (editor)
- Fase: 9 de 0.2.1 · Lote F (ventana del editor preciso)
- Depende de: 0276 (mismo lote), 0272 (tipos `BorradorLinea`, `PalabraBorrador` y límites)
- ADRs: [0021](../adr/0021-sincronia-simplificada-y-editor-preciso-de-linea.md) §9 («Forma de onda ampliada») y §Alternativas 4; [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md) (picos, estados, Canvas, tiradores)
- Spec UX: [06 · Fase 9, «Contenido»](../ux/06-editor.md#contenido) (filas «Regla», «Vista», «Voz de la línea», «Límites de la línea», «Tira de palabras», «Tiradores de palabra»), «Accesibilidad (fase 9)» (listbox y sliders); criterios **P6** y **P10** (interacción), **P19** (parte visual de la tira); [sistema visual · 0.2.1](../ux/sistema-visual.md#021--sincronía-editor-preciso-y-barra-de-carga-fases-8-y-9) (zona de onda y segmento de palabra)
- Tamaño: M

## Objetivo

Los componentes visuales de la zona central de la ventana, controlados por props (sin estado de edición propio), para que 0278 los conecte con el borrador.

## Archivos (solo estos)

- `app/src/renderer/src/vistas/editor/preciso/` (carpeta nueva): `OndaLinea.tsx`, `ReglaPrecisa.tsx`, `TiraPalabras.tsx`, `TiradorPreciso.tsx`, `vistaPrecisa.ts` (coordenadas tiempo ↔ px de la vista fija), `preciso.module.css` y sus tests

## Criterios de aceptación

- [ ] `vistaPrecisa(inicio, fin, margen, duracion)`: de `inicio − máx(margen, 250)` a `fin + máx(margen, 250)`, recortada a `[0, duración]`; sin zoom propio.
- [ ] `OndaLinea` lee los picos de la voz con `picos.leer` sobre la vista con presupuesto = ancho del canvas (≤ 4096), ignora respuestas obsoletas por `generacion`, pinta en Canvas con la resolución de la vista y sombrea los márgenes con `rgba(0,0,0,0.35)`; estados `edi.timeline.voz.pendiente` / `.generando` / `.error` + [Reintentar]; `aria-hidden`.
- [ ] `ReglaPrecisa`: marcas como la línea de tiempo; un clic llama a `alBuscar(ms)`.
- [ ] Tiradores de la línea (3 px `texto-1`, discontinuo si el fin es automático) y de la palabra seleccionada (2 px `acento-texto`, escalonados si casi coinciden), `role="slider"` con `aria-valuetext`, objetivo ≥ 24 × 24, arrastre con captura y tiempo provisional junto al puntero; Esc cancela; los límites los calcula quien los usa (prop `limitar(ms)` que devuelve valor y límite).
- [ ] `TiraPalabras`: `role="listbox"` horizontal con *roving tabindex*, un segmento por palabra con el aspecto de marcada / sin marcar / seleccionada / atenuada y nombre `edi.preciso.aria.palabra`; clic selecciona, doble clic llama a `alEscucharPalabra`; ←/→ e Inicio/Fin cambian la selección.
- [ ] Estado no dependiente solo del color (borde continuo/discontinuo y texto accesible).

## Pruebas de feedback

- Unitarias: `vistaPrecisa.test.ts`; pruebas de componente de `TiraPalabras` (roles, teclado, nombres), `OndaLinea` (presupuesto pedido y respuesta obsoleta con un doble de `picos`), tiradores (límite, Esc).
- E2E: ninguna (la cubre 0280).
- Críticos: no.
- Manual: guía de la fase 9 — la onda deja ver dónde empieza cada palabra.

## Notas de implementación
