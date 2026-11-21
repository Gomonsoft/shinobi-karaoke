# 0130 — Decisiones de producto de la exportación de video

- De: disenador-ux
- Para: usuario
- Estado: Abierta
- Bloquea: no (la spec [10 · Exportar a video](../ux/10-exportacion.md) usa las opciones provisionales)

## Contexto
La fase 6 de 0.2.0 añade «Exportar video…» ([plan](../versiones/0.2.0/plan-2.md#fase-6--exportación), [0050](0050-perfiles-y-concurrencia-exportacion.md)). Al escribir la spec quedan cinco decisiones que cambian lo que ve el usuario. Ninguna impide empezar: hay una opción provisional en cada una.

## Pregunta
1. **¿Se puede exportar un borrador?** Desde la Biblioteca solo se ofrece en canciones Lista. ¿Lo permitimos también desde el Editor para un borrador que ya tiene pistas y alguna línea sincronizada (útil para ver cómo queda o compartir una prueba)?
2. **Con «Instrumental y voz», ¿a qué volumen va la voz?** A) Al 100 %: el video suena como la canción original. B) Al nivel de la voz guía del reproductor (30 % por defecto). C) Con un deslizador en el diálogo.
3. **¿El video empieza con unos segundos de espera?** En el reproductor, si la voz empieza antes de 6 s, se añade un silencio previo para que dé tiempo a ver el título y la cuenta `●●●`. ¿Lo añadimos también al video (dura unos segundos más que la canción) o el video dura exactamente lo que la canción, como la vista previa del editor?
4. **Si exportar y un evento no pueden ir a la vez** (lo dirá la prueba técnica): con una exportación en marcha, ¿qué pasa al abrir el reproductor en otra pantalla? A) Se avisa y se ofrece «Cancelar la exportación y abrir». B) No se puede abrir el reproductor hasta que termine. C) La exportación se pausa durante el evento y sigue después (si es técnicamente posible).
5. **¿Recordamos las opciones?** ¿El diálogo propone la próxima vez el mismo audio, proporción, resolución, FPS y carpeta que la última exportación, o siempre los valores por defecto (solo instrumental, 16:9, 1920 × 1080, 30 FPS, carpeta de vídeos)?

## Opción provisional tomada
1. **Sí desde el Editor**, con la nota «Esta canción aún es un borrador. El video se hará con lo que tiene ahora.» No desde la Biblioteca.
2. **A, al 100 %**: «Instrumental y voz» es la canción reconstruida. No se aplican el volumen general ni la voz guía del reproductor.
3. **Sin silencio previo**: el video dura lo mismo que la canción; título y `●●●` como en la vista previa del editor.
4. **A**: aviso en el diálogo de pantallas y botón «Cancelar la exportación y abrir»; las exportaciones en cola esperan a que termine la sesión. El evento tiene prioridad.
5. **Recordar** audio, proporción, resolución, FPS y carpeta (no el nombre del archivo).

## Respuesta
