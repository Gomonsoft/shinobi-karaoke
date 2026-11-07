# 0144 — Barrido por renglón visual

- Estado: Pendiente
- Paso del pipeline: 4 y 6
- Depende de: [0112](0112-contratos-compartidos-de-la-fase-6.md)
- ADRs: [0005](../adr/0005-letras-y-formato-de-sincronia.md), [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md), [0011](../adr/0011-reproductor-pantalla-completa-y-reutilizacion-del-motor.md)
- Specs: [Editor](../ux/06-editor.md), [Reproductor](../ux/07-reproductor.md), [Sistema visual](../ux/sistema-visual.md)
- Plan: [Fase 1](../versiones/0.2.0/plan-2.md#fase-1--fin-y-barrido)

## Objetivo

Corregir el recorte del bloque que pinta a la vez todos los renglones partidos y compartir la solución en vista previa y reproductor.

## Archivos y contrato

- `app/src/renderer/src/karaoke/PantallaLetra.tsx`, `pantallaLetra.module.css` y pruebas. La posición de reproducción y los valores de `render.ts` mantienen su contrato.
- Medir cajas del texto base con `Range.getClientRects()` después de resolver fuente, escala y salto. Agrupar rectángulos en orden de renglón, conservar espacios y ligaduras de la disposición efectiva y pintar el texto decorativo sin modificar sus medidas. Mantener ocultas las copias decorativas para accesibilidad.
- Reparto puro para progreso de línea: ancho pintado del renglón = máximo de cero y mínimo entre su ancho y el avance total menos la suma de anchos anteriores. En letras con tiempos de palabra, usar el progreso propio de cada palabra y repartir solo dentro de sus fragmentos visuales.
- Invalidar por texto, tamaño, escala o fuente y al resolver fuentes tardías. Usar geometría guardada durante el fotograma. No cambiar el origen del reloj ni añadir dependencias.

## Criterios de aceptación

- [ ] Vitest comprueba extremos, anchos desiguales y un solo renglón. Con anchos 120/60, 50 % da 90/0 y 75 % da 120/15.
- [ ] Una línea con tres o más renglones completa cada uno antes de pintar el siguiente.
- [ ] Redimensionar durante reproducción y completar la carga de la fuente recalcula geometría desde el mismo tiempo de audio, sin reiniciar el barrido.
- [ ] Se mantienen fuente, ajuste y posición del texto, y los tiempos de palabra importada. Una palabra fragmentada conserva su ventana temporal y se recorre en orden.

## Verificación

Desde `app/`, ejecutar `npm test -- src/renderer/src/karaoke`, `npm run lint` y `npm run typecheck`. La medición real de Chromium se verifica en 0145.

## Notas de implementación

Pendientes.
