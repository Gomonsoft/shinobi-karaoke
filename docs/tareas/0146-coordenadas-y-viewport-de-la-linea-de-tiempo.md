# 0146 — Coordenadas y viewport de la línea de tiempo

- Estado: Pendiente
- Paso del pipeline: 4
- Depende de: Fase 1 integrada en develop
- ADRs: [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md)
- Specs: [Editor](../ux/06-editor.md), [Sistema visual](../ux/sistema-visual.md)
- Plan: [Fase 2](../versiones/0.2.0/plan-2.md#fase-2--línea-de-tiempo)

## Objetivo

Definir el modelo puro de regla, regiones y viewport, compartido por puntero, teclado, minimapa y onda.

## Archivos y contrato

Añadir un módulo de geometría en `app/src/renderer/src/vistas/editor/` y pruebas Vitest. Recibe letra, duración y área visible. Proyecta `inicio_ms` y `finEfectivo` al tiempo de audio con el offset, preservando extremos reales y señalando recortes. Las pausas temporizadas son referencias. Mantener la lógica de datos en las funciones de dominio existentes. Los helpers de viewport reciben duración y ancho positivo y producen ventanas y escalas válidas.

## Criterios de aceptación

- [ ] La conversión tiempo ↔ píxel es inversa dentro de la ventana y las pruebas cubren offset positivo y negativo.
- [ ] La región automática usa el fin efectivo, una pausa limita y una línea sin inicio carece de región.
- [ ] Clip visual distingue extremos exteriores, una región totalmente exterior no dibuja región ni tiradores.
- [ ] Zoom bajo el puntero conserva tiempo salvo en extremos. Zoom a selección, vista completa, centrar en cabezal y paneo respetan duración, incluso con pista muy corta y cambios de tamaño.
- [ ] La ventana mínima es de un segundo, o la pista completa si dura menos. Los campos conservan precisión de 10 ms.

## Verificación

Desde `app/`, `npm test -- src/renderer/src/vistas/editor` y `npm run typecheck`.

## Notas de implementación

Pendientes.
