# 0030 — ¿Se puede cantar con la voz original en el reproductor?
- De: disenador-ux
- Para: usuario
- Estado: Respondida
- Bloquea: no. `ux/07-reproductor.md` lleva la opción recomendada (A) como provisional, en un bloque aparte (§"Voz original", criterio 19) que se quita sin tocar el resto si eliges C.

## Contexto
El alcance del MVP dice "Reproductor: instrumental + letra". Pero quien aún no se sabe bien una canción suele querer oír la voz de vez en cuando como guía. La app ya tiene la canción original (`fuente/mezcla.flac`) y el motor de audio del editor ya sabe cambiar de pista sin perder la posición.

## Pregunta
¿El reproductor ofrece la voz como ayuda?

| Opción | Qué ve el usuario | Coste |
|--------|-------------------|-------|
| **A. Interruptor "Voz" (tecla V) que cambia a la canción original** | Un botón 🎤 en los controles y la tecla V. Suena la canción tal cual (voz a volumen normal) en el mismo punto; otra pulsación vuelve al instrumental. Empieza siempre desactivado y no se recuerda. | Casi nulo: usa lo que ya hace el editor. |
| B. Voz guía a volumen bajo sobre el instrumental | Igual, pero la voz suena más baja (p. ej. al 30 %), como en los karaokes comerciales. | Hay que reproducir dos pistas a la vez y sincronizadas: trabajo técnico nuevo para el arquitecto. |
| C. Sin voz | El reproductor solo reproduce el instrumental, como dice el alcance. | Ninguno. |

## Recomendación
**A** en el MVP: da la ayuda que se pide con un coste mínimo y no cambia nada si no se usa. B puede llegar más adelante sin cambiar la interfaz (el mismo botón).

## Opción provisional tomada (si no bloquea)
A, tal como está en `ux/07-reproductor.md`.

## Respuesta
Decisión del usuario (2026-11-06): **voz guía con volumen ajustable**, no la opción A.
- El reproductor mezcla la **voz separada** (`voz.flac`) sobre el **instrumental**, con un **control de volumen de la voz** independiente del volumen general, para que cada uno elija mucha, poca o ninguna guía.
- Una **tecla** silencia y reactiva la voz al momento (sin perder el nivel elegido).
- El nivel de voz elegido se recuerda (como el volumen general).
- No se usa la mezcla original; el instrumental sigue sonando siempre.
