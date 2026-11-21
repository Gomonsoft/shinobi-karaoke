# 0120 — Formatos y resoluciones que ofrece la exportación

- De: arquitecto
- Para: usuario
- Estado: Abierta
- Bloquea: no (el [ADR 0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) y las tareas 0230–0241 usan la opción provisional)

## Contexto
La prueba técnica de la fase 6 ([0050](0050-perfiles-y-concurrencia-exportacion.md), ADR 0019) confirma que el motor de audio que ya se instala (PyAV) trae en Windows, macOS y Linux dos combinaciones libres:

- **MKV con AV1 y Opus**: la de OBS. Es la que más comprime y la más rápida de codificar en las pruebas. La abren VLC, OBS, Chrome y Firefox; en Windows, el reproductor de serie necesita una extensión gratuita de la Microsoft Store; los equipos anteriores a ~2020 pueden ir a tirones con 4K a 60 FPS.
- **WebM con VP9 y Opus**: la más compatible entre los formatos libres (todos los navegadores, también Safari; reproductor de serie de Windows; Android). Archivos algo más grandes.

Ninguna de las dos la abre QuickTime (el reproductor de serie del Mac): ahí hace falta VLC o IINA. Un formato que se abra en todas partes (MP4 con H.264) no es libre y queda como [propuesta 008](../propuestas/008-formato-de-video-de-maxima-compatibilidad.md).

Sobre las resoluciones: pediste «las más comunes hasta 4K». La spec proponía 3 en 16:9 y 4 en 4:3.

## Pregunta
1. ¿Ofrecemos **los dos formatos** (MKV por defecto y WebM como alternativa) o **solo uno**? Si solo uno, ¿cuál?
2. ¿Añadimos **2560 × 1440** (QHD, muy común en monitores) a las de 16:9 (1280 × 720, 1920 × 1080 y 3840 × 2160)?

## Opción provisional tomada
1. **Los dos**, con MKV (AV1 + Opus) por defecto. En el diálogo es un control de dos opciones con una ayuda de compatibilidad.
2. **Sí**: 16:9 con 1280 × 720, 1920 × 1080, 2560 × 1440 y 3840 × 2160; 4:3 con 640 × 480, 1024 × 768, 1600 × 1200 y 2880 × 2160. Todas con 24, 30 y 60 FPS.

Quitar un formato o una resolución después es un cambio de una línea del catálogo (`shared/exportacion.ts`) y de la spec.

## Respuesta
