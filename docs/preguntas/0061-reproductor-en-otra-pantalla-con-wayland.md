# 0061 — Reproductor en otra pantalla con Linux y Wayland

- De: arquitecto
- Para: disenador-ux
- Estado: Respondida (disenador-ux, 2026-11-11)
- Bloquea: no. Afecta solo al diálogo «Abrir el reproductor en otra pantalla» (spec 02) y a los textos de recuperación. El contrato ya existe en el [ADR 0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §2, §11 y Consecuencias.
- Relacionadas: [0058](0058-interfaz-de-la-sesion-en-vivo-y-la-cola.md) (interfaz de la sesión) y [0059](0059-conductas-de-la-sesion-en-vivo-ante-incidencias.md) (conductas ante incidencias).

## Contexto

Electron usa Wayland por defecto en Linux desde la versión 38.2, y la app usa la 45. En Wayland el sistema, y no la aplicación, decide en qué pantalla aparece una ventana nueva. La aplicación no puede moverla. Por eso, en una sesión Wayland:

- elegir una pantalla en el diálogo no garantiza que el reproductor aparezca en ella;
- la ventana se abre en modo ventana, donde la ponga el sistema (normalmente en la pantalla activa);
- main puede no saber en qué pantalla está, así que `pantalla` puede valer `null` y no se puede mostrar «Reproduciendo en {pantalla}»;
- «Cambiar de pantalla…» y «Llevar el reproductor allí» tampoco pueden mover la ventana.

`pantallas.listar` devuelve `colocacion: 'sistema'` en este caso y `'libre'` en Windows, macOS y Linux con X11. Con `'sistema'` el usuario tiene que arrastrar la ventana a la pantalla del público y pulsar F, o usar el atajo del escritorio (en GNOME, Súper + Mayús + ← / →).

## Pregunta

Con `colocacion: 'sistema'`:

1. ¿El diálogo de apertura sigue mostrando la lista de pantallas o la sustituye por una instrucción?
2. ¿Qué texto muestra el indicador de sesión cuando la pantalla es desconocida?
3. ¿Qué se hace con las acciones «Cambiar de pantalla…» y «Llevar el reproductor allí»: se ocultan o se cambian por la instrucción?

## Propuesta para decidir

1. Ocultar la lista y la casilla de pantalla completa, y mostrar la nota «En este escritorio el sistema decide dónde se abre el reproductor. Arrástralo a la pantalla del público y pulsa F para verlo a pantalla completa». El botón queda como «Abrir reproductor».
2. «Reproduciendo en otra ventana».
3. Sustituir ambas acciones por la misma instrucción, mostrada como información.

## Respuesta

Se acepta la propuesta, con un cambio en el punto 2. Está recogida en la [spec 02](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) (diálogo, panel y recuperación) y en la [spec 07](../ux/07-reproductor.md#fase-4-de-020--ventana-secundaria-y-cola).

1. Sin lista ni casilla de pantalla completa. Se muestra la nota `info` `ses.wayland`: «En este escritorio el sistema decide dónde se abre el reproductor. Arrástralo a la pantalla del público y pulsa F para verlo a pantalla completa.» El botón sigue siendo «Abrir reproductor».
2. El indicador de la barra superior no nombra la pantalla y sus textos no cambian («En otra pantalla», «En pausa»…). En el panel, la línea de estado de la pantalla dice `cola.pantalla.desconocida`, «En otra ventana». Así no se habla de «reproduciendo» cuando está en pausa.
3. «Cambiar de pantalla…», «Mover a…» y «Llevar el reproductor allí» se sustituyen por `ses.wayland` como texto informativo, sin botón. El aviso de pantalla desconectada no se muestra si main no conoce la pantalla.
