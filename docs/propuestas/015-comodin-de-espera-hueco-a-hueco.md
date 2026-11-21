# 015 — Comodín de espera hueco a hueco

- Estado: Idea
- Origen: arquitecto, fase 5 de 0.2.0 (ADR 0018, pregunta 0100 §1)
- Fecha: 2026-11-20
- Relacionadas: plan 0.2.0, features 9 y 13; ADR 0018 §3 y §6

## Problema
Los comodines de espera (puntos, barra y cuenta 3·2·1) se activan para toda la canción y aparecen en cada silencio que supera el umbral. No se puede tener la cuenta en un solo silencio concreto, por ejemplo en el solo de guitarra, y no en los demás.

## Propuesta
En el editor, sobre la línea de tiempo o en la lista de líneas, permitir activar, cambiar o quitar el comodín de un hueco concreto. «Ajustar los silencios» podría marcar directamente los huecos que detecta.

## Valor y coste
- Valor: medio, para canciones con pocos silencios largos y muy distintos entre sí.
- Coste estimado: M. Guarda marcas por hueco en la letra. Hay que decidir qué les pasa al mover tiempos y cómo conviven con el ajuste por canción.
- Dudas: ¿basta el control por canción y el umbral? Esperar al uso real de la fase 5.

## Decisión
