# 002 — Elegir el dispositivo de salida de audio

- Estado: Idea
- Origen: plan 0.2.0, feature 10 («mejora futura de prioridad baja»)
- Fecha: 2026-11-20
- Relacionadas: ADR 0017, ADR 0011

## Problema
El audio sale por el dispositivo predeterminado del sistema. Con un proyector por HDMI, el sistema puede cambiar la salida al HDMI sin que el operador lo quiera, o al revés.

## Propuesta
Un selector de dispositivo de salida en Ajustes › Reproductor, recordado entre sesiones, con vuelta al predeterminado si el dispositivo desaparece.

## Valor y coste
- Valor: medio; depende de lo que salga en el caso «Audio por HDMI» de la guía manual de la fase 4.
- Coste estimado: M (`setSinkId`, permisos de dispositivos, recuperación).
- Riesgos: diferencias entre sistemas operativos.

## Decisión
