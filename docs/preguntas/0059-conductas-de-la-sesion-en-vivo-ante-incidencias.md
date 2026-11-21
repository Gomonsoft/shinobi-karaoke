# 0059 — Conductas de la sesión en vivo ante incidencias

- De: arquitecto
- Para: usuario
- Estado: Respondida
- Bloquea: no. El [ADR 0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) y las specs 02 y 07 aplican de momento la opción propuesta en cada punto. Cambiarla solo afecta a esa regla.

## Contexto

Las respuestas a [0048](0048-escucha-editor-durante-evento.md) y [0049](0049-politica-cola-de-reproduccion.md) deciden el bloqueo del editor, la cuenta entre canciones, los fallos y el cierre de la ventana con cola. Quedan sin decidir cuatro situaciones que pueden ocurrir en un evento real.

## Pregunta

1. **Se desconecta la pantalla del reproductor** en mitad de una canción, por ejemplo porque se suelta el cable del proyector. La ventana vuelve a la pantalla principal en una ventana pequeña.
   - A. Pausar hasta que decidas. El público deja de ver la letra, así que se para todo.
   - B. **Seguir sonando**, porque el audio no depende de la pantalla, y avisarte para que muevas la ventana.
2. **Pantalla encendida.** Mientras el reproductor está abierto en la otra pantalla, ¿se impide que la pantalla se apague también en pausa y entre canciones?
   - A. **Sí, durante toda la sesión**, hasta cerrar el reproductor.
   - B. Solo mientras suena, como en el reproductor normal.
3. **Cola agotada.** Termina la última canción y se muestra «Fin de la cola». Si después añades canciones:
   - A. **No empieza sola**: la inicias tú.
   - B. Empieza la cuenta de 4 s, como al terminar una canción con cola.
4. **Salir de la app** (cerrar la ventana principal o Salir) con el reproductor abierto en la otra pantalla o con canciones en cola:
   - A. **Pedir confirmación**, porque se corta el evento y se pierde la cola.
   - B. Salir directamente.

## Propuesta para decidir

1 B, 2 A, 3 A y 4 A, que son las opciones aplicadas de momento. Ninguna corta la música y nada arranca sin una acción tuya.

## Respuesta

Respuesta del usuario (2026-11-11):

1. **B.** Sigue sonando y se avisa para mover la ventana.
2. **A.** La pantalla se mantiene encendida durante toda la sesión, también en pausa y entre canciones.
3. **B (cambia la propuesta).** Con «Fin de la cola» en pantalla, al añadir canciones empieza la cuenta configurada (4 s por defecto), como al terminar una canción con cola. Se aplican las mismas reglas de la cuenta: se puede detener, «Empezar ya» y reinicio solo si cambia la candidata.
4. **A.** Se pide confirmación antes de salir de la app con el reproductor abierto o con canciones en cola.

