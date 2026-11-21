# 0050 — Perfiles de video y concurrencia

- De: arquitecto y disenador-ux
- Para: usuario
- Estado: Respondida
- Bloquea: no. Prueba técnica hecha el 2026-11-20 ([ADR 0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md)); queda la verificación en Windows, Linux y dos pantallas reales (guía manual de la fase 6).

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

## Estudio técnico (arquitecto, 2026-11-20)

Detalle, mediciones y fuentes en el [ADR 0019](../adr/0019-exportacion-de-video-render-por-fotograma-y-worker-pyav.md) («Prueba técnica») y en [`docs/poc/0019-exportacion/`](../poc/0019-exportacion/).

- **Códecs y licencias.** Las 6 ruedas de PyAV 19.0.2 que ya instala el primer arranque (macOS arm64, Windows y Linux, CPU y CUDA) traen SVT-AV1, libvpx (VP9) y libopus, sin componentes no libres (`worker/scripts/inspeccionar_av.py`). Todos son compatibles con GPL-3.0-or-later. **No hace falta ninguna dependencia nueva.**
- **Contenedor y códecs** (respuesta a «formato libre como OBS»): **MKV con AV1 y Opus** por defecto (el contenedor por defecto y el códec más nuevo de OBS) y **WebM con VP9 y Opus** como alternativa más compatible con navegadores y equipos antiguos. Ninguno se abre en QuickTime. Si se prefiere uno solo: [0120](0120-formatos-y-resoluciones-de-la-exportacion.md).
- **Reproductores**: VLC, OBS (como fuente), Chrome y Firefox abren los dos; Safari y el reproductor de serie de Windows abren WebM (y MKV/AV1 con la extensión AV1 gratuita); QuickTime ninguno. Se comprueba a mano en la guía de la fase (M3).
- **Matriz de perfiles**: 16:9 con 1280 × 720, 1920 × 1080, 2560 × 1440 y 3840 × 2160; 4:3 con 640 × 480, 1024 × 768, 1600 × 1200 y 2880 × 2160; todas con 24, 30 y 60 FPS y en los dos formatos. Todas se sostienen porque la exportación **no es en tiempo real**: un equipo lento tarda más pero no pierde fotogramas. Medido en un MacBook Air M1: hasta 1080p30 en torno a la duración de la canción; 4K/60 de 5 a 20 veces la duración (20–80 min para 4 min), con la nota de «perfil costoso» de la spec. El cuello de botella es el traslado de los mapas de bits (captura y tubería), no el códec. Pico de memoria del codificador: < 1 GB hasta 1080p y 1–1,6 GB a 2160 líneas (por eso 2160 líneas pide un equipo de 8 GB).
- **Tamaño**: el karaoke comprime mucho: unos 2–5 MB por minuto a 1080p y 5–9 MB/min a 4K (incluido el audio Opus).
- **Exportar durante un evento**: **se permite**. No hay ninguna incompatibilidad técnica: la exportación pinta en una ventana invisible y silenciada con su propio proceso, el worker va con prioridad baja y el audio del evento sigue en la ventana secundaria, que no depende del proceso que hace la exportación. La competencia por CPU, GPU y memoria es de recursos paralelizables, que según tu respuesta no justifican bloquear. Se verifica en la guía manual con dos pantallas reales (cortes de audio y tirones con un perfil modesto y con 4K/60); si apareciera un corte, se bloquearía solo ese perfil en esa plataforma, con motivo.
- **Lo que no se ha podido medir aquí**: Windows y Linux (la codificación de los dos formatos se comprueba en la CI de los 3 sistemas con las pruebas del worker; los tiempos reales, en la guía manual), equipos x86 y la convivencia con dos pantallas reales.

