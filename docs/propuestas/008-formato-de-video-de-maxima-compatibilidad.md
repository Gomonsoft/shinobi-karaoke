# 008 — Formato de video de máxima compatibilidad (MP4 con H.264 y AAC)

- Estado: Idea
- Origen: estudio de la fase 6 de 0.2.0 ([ADR 0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md))
- Fecha: 2026-11-20
- Relacionadas: feature 7 (exportar a video), [pregunta 0050](../preguntas/0050-perfiles-y-concurrencia-exportacion.md), [ADR 0002](../adr/0002-licencia-del-proyecto.md)

## Problema
El usuario eligió un formato libre (0050). Los formatos libres de 0.2.0 (AV1 y VP9 con Opus) no se abren con el reproductor de serie de macOS (QuickTime) ni en muchos televisores y reproductores antiguos. Quien quiera llevar el karaoke a uno de esos aparatos tiene que convertir el archivo con otra herramienta.

## Propuesta
Añadir un formato opcional «MP4 (H.264 + AAC)», marcado como no libre, para los casos en que haga falta máxima compatibilidad.

## Valor y coste
- Valor: el archivo se abre prácticamente en cualquier aparato.
- Coste estimado: S en código (las ruedas de PyAV traen `libx264` y el codificador `aac` de FFmpeg), pero exige una decisión de producto y legal.
- Riesgos o dudas abiertas:
  - H.264 y AAC están cubiertos por patentes con licencias de pago (Via LA, Access Advance). Un programa libre que los codifica puede exponer al usuario o al proyecto, según el país.
  - `libx264` es GPL-2.0-or-later: compatible con la licencia del proyecto, pero solo porque PyAV lo trae ya enlazado (ADR 0002, revisión 2026-11-04).
  - Contradice la preferencia del usuario por un formato libre: debe decidirlo él.

## Decisión
(la rellena el usuario o la sesión principal con su respuesta)
