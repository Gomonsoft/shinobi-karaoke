# 0060 — Vista Letra y controles de sonido durante la sesión en otra pantalla

- De: disenador-ux
- Para: usuario
- Estado: Respondida
- Bloquea: no. Las specs de la fase 4 aplican la opción propuesta. Cambiarla afecta a una sola regla de las specs [06](../ux/06-editor.md#fase-4-de-020--ventana-secundaria-y-cola) y [02](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola).
- Relacionadas: [0048](0048-escucha-editor-durante-evento.md), [0049](0049-politica-cola-de-reproduccion.md), [0059](0059-conductas-de-la-sesion-en-vivo-ante-incidencias.md) y [ADR 0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §9.

## Contexto

En 0048 decidiste que, mientras el reproductor está abierto en otra pantalla, no se puede editar y aparece el aviso «No se puede editar mientras el reproductor está abierto en otra ventana». La biblioteca y la cola siguen disponibles. Quedan dos detalles.

## Pregunta

1. **Vista Letra.** En Letra se busca la letra, se pega y se corrige el texto de una canción. ¿Se bloquea también durante la sesión, igual que el editor?
   - A. **Sí.** «Editar» abarca Letra y Editor, y el aviso es el mismo. Añadir canciones y ver el progreso de la separación siguen disponibles.
   - B. No. Solo se bloquea el editor y se puede preparar la letra de otras canciones durante el evento.
2. **Volumen y voz guía desde la ventana principal.** Hoy se controlan en el propio reproductor, en la otra pantalla, al mover el ratón allí. ¿Hace falta controlarlos también desde el panel de la cola?
   - A. **No por ahora.** El panel tiene pausa, siguiente, reiniciar, la cuenta entre canciones y cerrar. El volumen y la voz guía se ajustan en el reproductor o con el volumen del sistema.
   - B. Sí. Se añaden al panel el volumen general y el nivel de la voz guía, sincronizados con el reproductor.

## Propuesta para decidir

1 A y 2 A. Son las opciones aplicadas: menos controles en la ventana del operador y ningún cambio de contenido mientras suena el evento.

## Respuesta

Respuesta del usuario (2026-11-11):

1. **A.** La vista Letra también se bloquea durante la sesión, con el mismo aviso que el Editor.
2. **A.** No por ahora. El volumen y la voz guía se ajustan en el reproductor o con el volumen del sistema.

