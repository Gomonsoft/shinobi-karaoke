# 003 — Sensibilidad ajustable en «Ajustar los silencios»

- Estado: Idea
- Origen: sesión del 2026-11-20 (feature 13 del plan 0.2.0)
- Fecha: 2026-11-20
- Relacionadas: plan 0.2.0 feature 13, ADR 0015

## Problema
El umbral de silencio será único y provisional. En canciones con mucha reverberación, coros de fondo o separadas con el modelo «Rápido», puede detectar silencios de más o de menos.

## Propuesta
En el aviso de «Ajustar los silencios», un control de sensibilidad (baja, normal, alta) con vista previa del número de líneas que cambian, y marcas de los silencios detectados sobre la onda de voz.

## Valor y coste
- Valor: medio-alto si las 6 canciones de referencia del usuario muestran que un único umbral no basta.
- Coste estimado: S–M.
- Dudas: esperar a los datos de las canciones de referencia antes de decidir.

## Decisión
