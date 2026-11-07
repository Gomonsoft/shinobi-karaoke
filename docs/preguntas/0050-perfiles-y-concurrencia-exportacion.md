# 0050 — Perfiles de video y concurrencia

- De: arquitecto y disenador-ux
- Para: usuario
- Estado: Respondida
- Bloquea: no como pregunta de producto. La prueba técnica sigue pendiente.

## Contexto

El render y la mezcla se pueden hacer localmente. La prueba técnica debe comprobar los códecs, las licencias de los builds y el tiempo, la memoria y el espacio usados en Windows, macOS y Linux. Ver [ronda de arquitectura](../versiones/0.2.0/discusion/r1-arquitecto.md) y [ronda cruzada UX](../versiones/0.2.0/discusion/r2-disenador-ux.md).

## Pregunta

¿Qué reproductores o dispositivos tienen que abrir el resultado? Tras la prueba, ¿qué combinaciones de formato, resolución y FPS deben ofrecerse? ¿Hace falta exportar mientras el reproductor está emitiendo un evento?

## Propuesta para decidir

Comparar WebM VP9/Opus y MP4 H.264/AAC si la build y las licencias lo permiten. Medir primero perfiles de 720p/30 y 1080p/30 con una canción de prueba. Probar interferencia durante un evento antes de ofrecer simultaneidad. Los perfiles medidos son candidatos.

## Respuesta
Vamos a usar un formato libre segun nuestra licencia, los formatos con los que exporta el software OBS serian ideales. De moemnto usemos formato 4:3 y 16:9, con sus resoluciones más comunes hasta maximo 4k, fps el estandar es 24, 30 y 60 maximo. Pues seria raro exportar video en un evento, si hay alguan razon tecnica (que no sea por recursos que se puedan paralelizar), no dejemos exportar, si se puede hacer paralelo no veo problema mienytars tenga el hardware.

Cómo aplicar el límite de 4K al formato 4:3? para 4:3 el limite real es menor a 4k el cual es un formato 16:9 asi que usemos los pixeles maximos que se usan comunmente qme parece que 2880×2160 es correcto

## Decisión para el plan

Elegir formato libre con OBS como referencia. Ofrecer 4:3 hasta 2880×2160 y 16:9 hasta 3840×2160, con 24, 30 y hasta 60 FPS. Permitir exportación durante un evento si es técnicamente viable en paralelo y el equipo la sostiene. La decisión de producto está respondida. Quedan por verificar combinación de contenedor y códec, compatibilidad de builds, matriz de perfiles y no interferencia con el reproductor en los tres sistemas. Ver [ronda 4](../versiones/0.2.0/discusion/r4-arquitecto.md) y [plan de la alfa](../versiones/0.2.0/plan-2.md).
