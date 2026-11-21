# 0051 — ¿La línea de tiempo debe seguir sola al cabezal al reproducir?

- De: disenador-ux
- Para: usuario
- Estado: Respondida
- Bloquea: no

## Contexto

En el [reporte de Windows](../versiones/0.2.0/reporte-editor-fase-2.md) (observación aparte) el cabezal estaba en 03:20 mientras la línea de tiempo mostraba 00:00–00:24 y el minimapa marcaba el inicio de la canción. No es un fallo: la [spec del editor, segunda fase](../ux/06-editor.md#zoom-vista-general-y-picos-de-voz) decidió que **el intervalo visible es independiente del audio** y que la vista solo se mueve con «Centrar en el cabezal», zoom, paneo o la vista general. El [plan, subfase 2.1](../versiones/0.2.0/plan-2.md#subfase-21--estabilización-del-editor) pide mantener ese criterio mientras se decide si se quiere seguimiento automático.

Lo que está en juego: con zoom alto (p. ej. 24 s visibles), al reproducir el cabezal sale de la vista en segundos y hay que pulsar «Centrar en el cabezal» a menudo. Pero si la vista se mueve sola, puede desplazarse justo cuando el usuario va a agarrar un tirador de inicio o fin.

## Pregunta

¿Cómo quieres que se comporte la línea de tiempo mientras suena la canción?

- **A. Mantener manual** (lo actual). La vista no se mueve sola; «Centrar en el cabezal» la lleva al cabezal. Predecible para editar; el cabezal se pierde de vista con zoom.
- **B. Manual con aviso en el borde.** Como A, pero cuando el cabezal sale de la vista aparece en el borde correspondiente una marca «◂ Cabezal» / «Cabezal ▸» que, al pulsarla, centra la vista. No mueve nada solo.
- **C. Seguimiento por páginas (como en los DAW).** Al reproducir, cuando el cabezal llega cerca del borde derecho, la vista salta una «página» para que vuelva a quedar a la izquierda. Se suspende mientras arrastras un tirador, haces zoom o paneas, y durante 5 s después de mover la vista a mano (la misma regla que ya usa la lista de líneas). En el bucle de «Bloquear enunciado» no salta si la línea cabe en la vista.
- **D. Seguimiento continuo.** El cabezal queda fijo en el centro y la onda y las regiones se desplazan por debajo. Es lo más fluido de mirar, pero todo se mueve constantemente: cuesta más agarrar tiradores y con «movimiento reducido» habría que desactivarlo.
- **E. Conmutador «Seguir el cabezal».** Un interruptor en la fila de controles de la línea de tiempo para activar o desactivar el seguimiento (con el estilo C), guardado como preferencia global junto a los tamaños de paneles.

## Recomendación de UX

**E con el estilo C, activado por defecto.** Saltar por páginas mantiene la vista quieta casi todo el tiempo (se puede apuntar a un tirador) y evita perder el cabezal con zoom. La suspensión al interactuar evita que la vista se mueva bajo el puntero. El conmutador deja volver al comportamiento actual a quien lo prefiera. Los saltos de página no tienen animación, así que no hay conflicto con «movimiento reducido». Si prefieres no añadir controles, la alternativa es **C sin conmutador**.

Si se elige C, D o E, cambia la regla «el cabezal sigue el audio sin seguimiento automático de la ventana» de la segunda fase y habrá que añadir criterios de aceptación y una tarea nueva. Hacerlo después de la subfase 2.1 no bloquea nada.

## Opción provisional tomada (si no bloquea)

A (manual), tal como dicen la spec vigente y el plan. La subfase 2.1 conserva este criterio: minimizar, expandir o redimensionar la línea de tiempo no mueve la vista.

## Respuesta

C (respuesta del usuario en la sesión principal, 2026-11-09): seguimiento por páginas, como en los DAW. Al reproducir, cuando el cabezal llega cerca del borde derecho, la vista salta una página. Se suspende mientras se arrastra un tirador, se hace zoom o se panea, y durante 5 s después de mover la vista a mano. En el bucle de «Bloquear enunciado» no salta si la línea cabe en la vista. Sin conmutador.

Pendiente: actualizar la spec del editor y crear la tarea de implementación.
