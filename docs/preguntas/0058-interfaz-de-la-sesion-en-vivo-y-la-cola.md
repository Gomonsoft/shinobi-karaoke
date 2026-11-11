# 0058 — Interfaz de la sesión en vivo y la cola (fase 4)

- De: arquitecto
- Para: disenador-ux
- Estado: Respondida (disenador-ux, 2026-11-11)
- Bloquea: no. Los contratos del [ADR 0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) admiten cualquiera de las respuestas.
- Nota: las specs de la fase 4 en curso (02, 06, 07, 08 y el mapa, 2026-11-11) ya responden a la mayoría de los puntos, y el ADR 0017 se alineó con ellas. Falta registrar aquí la respuesta. Wayland se trata aparte, en [0061](0061-reproductor-en-otra-pantalla-con-wayland.md).

## Contexto

El ADR 0017 fija la ventana secundaria, la sesión en main, la cola y el bloqueo del editor. Quedaban detalles de interfaz que ni el plan ni las rondas de discusión cerraban.

## Pregunta

1. **Puntos de entrada.** ¿Dónde se ofrece «Abrir reproductor en otra pantalla…»? El contrato admite tres inicios: una canción al momento, la cola tal como está o reanudar lo que se conservó.
2. **«Reproducir» durante una sesión.** El reproductor local no puede abrirse, porque duplicaría el audio. ¿Se oculta la acción, se deshabilita o se sustituye por otra?
3. **Panel de cola.** ¿En qué vistas de la principal está?
4. **Controles de la principal.** El contrato ofrece pausar, reanudar, reiniciar, siguiente, empezar ya, detener la cuenta, mover a otra pantalla, pantalla completa, mostrar el reproductor, cerrar y forzar el cierre. ¿Cuáles se muestran y dónde?
5. **Diálogo «Hay canciones en cola».** ¿En qué ventana aparece?
6. **Edición bloqueada.** ¿Cómo se presenta? ¿Qué pasa si al iniciar la sesión hay un borrador de «Editar tema» sin guardar?
7. **Selector de pantalla.** ¿Qué datos muestra cada pantalla y qué se avisa al elegir la pantalla de la principal?
8. **Incidencias en la principal.** Textos y acciones para la pantalla perdida, el cierre inesperado, la falta de respuesta y el fallo al abrir.
9. **Fin de la cola.** ¿Qué se muestra? ¿Qué pasa si se añaden canciones después?
10. **Duración de la cuenta en Ajustes.** ¿Qué control y qué valores se ofrecen?

## Propuesta para decidir

Las specs en curso ya lo resuelven así, y el ADR 0017 lo recoge:

1. Ambos puntos de entrada.
2. Mientras hay sesión, la acción principal de una canción Lista es «A la cola».
3. El panel de cola está en la principal.
4. Controles de la sesión en el panel.
5. El diálogo aparece en la ventana donde se pide el cierre.
6. Diálogo de bloqueo en el editor y en Letra. El borrador de tema se resuelve con el diálogo de salida.
7. Pantalla con número, nombre y resolución, y la nota `ses.completa.misma` al elegir la de la principal.
8. Toasts `ses.rec.*`.
9. S3 «Fin de la cola», que no arranca solo al añadir.
10. Selector con 3, 4, 5, 8, 10 y 15 s.

## Respuesta

Se aceptan los diez puntos de la propuesta, con los matices siguientes. Todo está en las secciones «Fase 4 de 0.2.0 — ventana secundaria y cola» de [02](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola), [06](../ux/06-editor.md#fase-4-de-020--ventana-secundaria-y-cola), [07](../ux/07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola) y [08](../ux/08-ajustes-y-acerca.md#fase-4-de-020--ventana-secundaria-y-cola), en el [mapa](../ux/00-mapa-de-vistas.md) y en el [sistema visual](../ux/sistema-visual.md).

1. **Puntos de entrada**: «Abrir en otra pantalla…» en la cabecera de la Biblioteca y en el panel de la cola (`inicio: cola` o `reanudar`), y «Reproducir en otra pantalla…» en el ⋯ de una Lista sin sesión (`inicio: cancion, donde: 'ahora'`). Si había un contexto interrumpido, el diálogo avisa de que ya no se retomará; confirmad en el ADR que `ahora` descarta el contexto.
2. **Durante la sesión**, la acción principal de una Lista es **«A la cola»** (Agregar al final). Interrumpir la canción en curso exige dos acciones explícitas: «Reproducir a continuación» y «Siguiente».
3. **Panel de cola** solo en la Biblioteca, con un **indicador de sesión** en la barra superior del resto de vistas que lleva a ella. La sesión solo se inicia desde la Biblioteca, así que la interfaz nunca la inicia con un editor montado. La salida normal del editor ya vacía el guardado y pasa por `tema.dialogo.salir`. El orden de §9 queda como defensa. `GUARDADO_PENDIENTE` aparece en línea en el diálogo de apertura, con reintento.
4. **Controles** en el panel: pausa/reanudar, siguiente, reiniciar, empezar ya, detener cuenta, iniciar la candidata, pantalla completa/ventana y cerrar. «Mostrar» y «Cambiar de pantalla…» van en un ⋯. El cierre forzado solo aparece en el aviso de falta de respuesta. Hay «Vaciar…» (durante la sesión, con ≥ 2 pendientes) y «Eliminar cola…» (sin sesión), los dos con `cola.vaciar` y confirmación. El progreso de la principal es de solo lectura. «Siguiente» y «Pasar a la siguiente canción» empiezan la cuenta. «Iniciar» (en espera o en fin de cola con candidata) y «Empezar ya» empiezan al momento. Para esos dos hace falta una operación que consuma sin cuenta, o `siguiente` con una marca. Sin pendientes, en un fallo, el botón es «Descartar» y deja la sesión en espera sin candidata.
5. **Diálogo de cierre** en la ventana donde se pide. Si se pide en la secundaria, la principal muestra «Esperando tu respuesta en la otra pantalla…» y desactiva los controles de sesión. Esc **no** pide el cierre en la secundaria: a pantalla completa pasa a ventana y en ventana no hace nada. `CONFIRMACION_OBSOLETA` actualiza el diálogo con `ses.cierre.obsoleto` y pide confirmar otra vez.
6. **Edición bloqueada**: no hay editor en solo lectura (ver el punto 3). Los puntos de entrada al Editor y a Letra quedan `aria-disabled` con un candado y abren el diálogo «No se puede editar mientras el reproductor está abierto en otra ventana» con [Cerrar el reproductor…] y [Entendido]. El usuario confirmó el bloqueo de Letra en [0060](0060-letra-y-controles-de-sonido-durante-la-sesion.md) §1 A, y que el panel no lleva volumen ni voz guía (§2 A). La escucha de la vista de progreso también se desactiva. El borrador de tema usa el diálogo de salida.
7. **Selector**: «Pantalla {n} · {etiqueta} · {ancho} × {alto}», y en la de `conVentanaPrincipal` también «Principal · Aquí está esta ventana». Se permite elegirla con la nota `ses.completa.misma`; «Pantalla completa» aparece desmarcada en ese caso. Con una sola pantalla hay otra nota. Wayland, en [0061](0061-reproductor-en-otra-pantalla-con-wayland.md).
8. **Incidencias**: banners dentro del panel, no toasts (no caducan ni se apilan, y el indicador lleva hasta ellos desde cualquier vista). El indicador pasa a «⚠ Requiere atención». Las claves `ses.rec.*` están en la spec 02: pantalla perdida con [Mover a…] (la música sigue), pantalla de vuelta con [Llevar el reproductor allí], caída con [Volver a abrir], sin respuesta con [Esperar] y [Cerrar y volver a abrir], y fallo al abrir en el diálogo con [Reintentar].
9. **Fin de la cola**: S3 con el último título, «Fin de la cola», [Otra vez] y [Cerrar reproductor], sin cuenta de salida. Una pendiente nueva **empieza la cuenta** configurada, como al terminar una canción con cola, con «Detener cuenta» y «Empezar ya» (decisión del usuario en [0059](0059-conductas-de-la-sesion-en-vivo-ante-incidencias.md) §3 B; actualizado el 2026-11-11). En espera (tras «Detener cuenta», «Descartar» o abrir con la cola vacía), añadir no arranca nada y se empieza con «Iniciar».
10. **Duración**: selector con 2 · 3 · 4 (predeterminado) · 5 · 8 · 10 · 15 s. Un valor válido del esquema que no esté en la lista se añade como opción extra.

Además:
- «Eliminar…» y «Volver a borrador» de la canción activa quedan deshabilitados con su motivo. En las pendientes se permiten y avisan del efecto en la cola.
- Quitar una pendiente no pide confirmación y el toast ofrece [Deshacer].
- La secundaria no muestra `rep.incompleta`; el aviso está en la fila de la cola.
- Reanudar respeta el estado: si se cerró en pausa, abre en pausa en ese segundo.
