# 0050 — Perfiles de video y concurrencia

- De: arquitecto y disenador-ux
- Para: usuario
- Estado: Abierta
- Bloquea: perfiles ofrecidos y política de concurrencia de la feature 7

## Contexto

El render y la mezcla se pueden hacer localmente. La prueba técnica debe comprobar los códecs, las licencias de los builds y el tiempo, la memoria y el espacio usados en Windows, macOS y Linux. Ver [ronda de arquitectura](../versiones/0.2.0/discusion/r1-arquitecto.md) y [ronda cruzada UX](../versiones/0.2.0/discusion/r2-disenador-ux.md).

## Pregunta

¿Qué reproductores o dispositivos tienen que abrir el resultado? Tras la prueba, ¿qué combinaciones de formato, resolución y FPS deben ofrecerse? ¿Hace falta exportar mientras el reproductor está emitiendo un evento?

## Propuesta para decidir

Comparar WebM VP9/Opus y MP4 H.264/AAC si la build y las licencias lo permiten. Medir primero perfiles de 720p/30 y 1080p/30 con una canción de prueba. Probar interferencia durante un evento antes de ofrecer simultaneidad. Los perfiles medidos son candidatos.

## Respuesta
