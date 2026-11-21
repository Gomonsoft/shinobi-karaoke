# 007 — Codificar el video con la GPU cuando el equipo la tenga

- Estado: Idea
- Origen: estudio de la fase 6 de 0.2.0 ([ADR 0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md), prueba técnica)
- Fecha: 2026-11-20
- Relacionadas: feature 7 (exportar a video), [pregunta 0050](../preguntas/0050-perfiles-y-concurrencia-exportacion.md)

## Problema
En 0.2.0 la exportación codifica por software (SVT-AV1 o libvpx en la CPU). Con perfiles grandes (2160 líneas a 60 FPS) y en equipos modestos tarda varias veces la duración de la canción, y mientras tanto la CPU está ocupada.

## Propuesta
Si el equipo tiene un codificador AV1 por hardware (NVIDIA RTX 40 o posterior con NVENC, AMD con AMF, Intel con Quick Sync), ofrecer usarlo para exportar más rápido, con el codificador por software como respaldo.

## Valor y coste
- Valor: exportaciones 4K/60 mucho más rápidas en equipos con GPU reciente, y menos carga de CPU durante un evento.
- Coste estimado: M. Las ruedas de PyAV 19.0.2 de Windows y Linux ya traen `nvenc`, `amf` y `libvpl` (comprobado con `worker/scripts/inspeccionar_av.py`), pero dependen del controlador del equipo. Hay que detectar qué funciona de verdad, medir la calidad a igual tamaño y añadir una matriz de pruebas con hardware que la CI no tiene.
- Riesgos o dudas abiertas: resultados distintos según el controlador; el render deja de ser idéntico entre equipos a igual perfil (no afecta a la sincronía); en macOS, VideoToolbox no codifica AV1 ni VP9, así que no aporta nada con un formato libre.

## Decisión
(la rellena el usuario o la sesión principal con su respuesta)
