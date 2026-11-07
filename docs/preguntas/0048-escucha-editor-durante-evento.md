# 0048 — Escucha del editor durante un evento

- De: arquitecto y disenador-ux
- Para: usuario
- Estado: Respondida
- Bloquea: no.

## Contexto

La secundaria emite el karaoke y su monitor se elige aparte de la salida de audio. La principal queda disponible para navegar y editar. Ambas ventanas en el mismo dispositivo podrían mezclar audio de edición con el evento. Ver [ronda cruzada UX](../versiones/0.2.0/discusion/r2-disenador-ux.md).

## Pregunta

¿Durante un evento basta con editar en silencio o necesitas escuchar ajustes del editor a la vez, por ejemplo por auriculares en un dispositivo de salida separado?

## Propuesta para decidir

Un solo transporte audible. La principal informa que la escucha está ocupada y permite editar en silencio. Si necesitas un dispositivo aparte, hay que concretar plataformas y validar el enrutamiento antes de comprometer la experiencia.

## Respuesta
Lo cierto es que idealmente quien tenga el software con canciones listas solo reproducira y pondra en cola. Hagamos esto, dejemos por ahora una ventana que diga "No se puede editar kminetras se reproduce en la ventana emergente" o algo asi y en alhun momento este modal/alerta sera un selector para los dispositivos de audio para que se pueda hacer este trabajo auqnue seria poco realista asi que es prioridad baja este selector. Aqui seria bueno uan feature de que en caso de que tengamos una letra bien sincronizada de internet poner un tema que no contraste la letra (porque no habra sincronizacion de tiempos a mano) y que su estado sea solo "Lyrics" y dejar opcion adicional a "marcar como listo" a "marcar como letra lista" y poner este tema

### Respuesta ampliada

> Este estado lo puede marcar el usuario si ya agrego la letra con todos sus tiempos y fines (Aunque ean los temporales dados por la API), me refiero a barrido y contarste como lo mismo, si el usuario decide marcar como letra lista por primera vez saltara una aletar que le dira que en el reproductor no habra barrido y/o contras con un checkbox para no volver a mostrar esto. Es decir en el editor si hay barrido/contarste pues se esta creando esta sincronizacion correcta, pero si el usuario solo quiere la letra reproduciendose que ya tiene inicios y fines aunque sean marcados temporalmete eso esta bien, si permite reproducir encolar y exportar.

## Decisión para el plan

Bloquear edición mientras esté activa la sesión en ventana emergente y mostrar un aviso. El selector de dispositivos queda para más adelante. «Letra lista» requiere tiempos completos, incluidos los efectivos de la API. Mantiene el barrido en el editor y lo omite en reproducción y exportación. Permite reproducir, encolar y exportar. La primera activación explica el efecto y ofrece no volver a mostrar el aviso. Ver [ronda 4](../versiones/0.2.0/discusion/r4-arquitecto.md) y [plan de la alfa](../versiones/0.2.0/plan-2.md).
