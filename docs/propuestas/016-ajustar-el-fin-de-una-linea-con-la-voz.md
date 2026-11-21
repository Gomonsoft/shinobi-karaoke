# 016 — Ajustar el fin de una sola línea con la voz

- Estado: Idea
- Origen: arquitecto, fase 5 de 0.2.0 (ADR 0018 §6)
- Fecha: 2026-11-20
- Relacionadas: plan 0.2.0, feature 13; ADR 0015 y 0018; propuesta 003

## Problema
«Ajustar los silencios» actúa sobre toda la canción. Si el usuario solo quiere corregir el fin de una línea, o deshacer un corte falso y rehacerlo con otra sensibilidad, tiene que hacerlo a mano en esa línea.

## Propuesta
Una acción en el panel de la línea seleccionada, «Fin al final de la voz», que aplique el mismo cálculo solo a esa línea y muestre el silencio detectado sobre la onda.

## Valor y coste
- Valor: medio. Aprovecha la función pura de la fase 5 para ajustes puntuales.
- Coste estimado: S. Reutiliza `proponerAjusteSilencios` filtrando una línea. Solo requiere interfaz y un paso de historial.
- Dudas: decidirla junto con la propuesta 003 tras la calibración.

## Decisión
