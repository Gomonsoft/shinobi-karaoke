# 0152 — Cambio de modalidad en una Lista incompleta y semántica de las pestañas del panel

- De: programador (lote D, tarea [0270](../tareas/0270-dock-pestana-funciones-y-menu-de-la-cabecera.md))
- Para: arquitecto
- Estado: Abierta
- Bloquea: no (la tarea 0270 aplica las opciones provisionales)

## Contexto

1. **Cambio de modalidad en una Lista con líneas sin inicio.** La spec [06 · 8.6](../ux/06-editor.md#86--estados-y-acciones-dock-pestaña-funciones-y-menú-) dice que «Marcar como letra lista» / «Marcar como lista» del dock (y «Cambiar a …» de «Funciones») «no exigen que todas las líneas tengan inicio (la canción ya está terminada)». Pero `ServicioBiblioteca.marcarLista` (`app/src/main/biblioteca/servicio.ts`, ~l. 469) comprueba `puedeMarcarseLista` / `puedeMarcarseLetraLista`, que incluyen `LINEAS_SIN_INICIO`, y responde `ARGUMENTOS_NO_VALIDOS` aunque la canción ya sea `lista`. Con una Lista incompleta, la UI hace la llamada y el usuario ve el toast de error «No se pudo cambiar la modalidad de la canción.». Lo mismo le pasaba al ítem del ⋯ de 0.2.0 (la spec de la fase 5 también lo daba por válido).
2. **Pestañas.** La spec pide que las tres pestañas sean un `tablist`/`tab`, pero el control actual del panel es un `ControlSegmentado` (`radiogroup`/`radio`, ←/→/↑/↓ y Inicio/Fin eligen), y los E2E y las pruebas lo consultan por `role="radio"`. Cambiar el rol obliga a rehacer ese componente compartido (Ajustes, Estilo, etc.) y las pruebas que lo usan.

## Preguntas

1. ¿Se relaja `marcarLista` para una canción que **ya está lista** (cambio de modalidad: solo exigir pistas y fuente, no `LINEAS_SIN_INICIO`)? Es un cambio en `main/biblioteca/` (fuera del lote D).
2. ¿Se mantiene el `radiogroup` para las tres pestañas o se pasa a `tablist` con `tabpanel`?

## Opción provisional tomada

1. La UI sigue la spec (el aviso `edi.hecho.incompleta` sale en la primera pulsación y «Salir igualmente» intenta el cambio); si `main` lo rechaza, se muestra el toast de error habitual y no se pierde nada.
2. Se añade «Funciones» como tercera opción del `ControlSegmentado` existente (misma navegación por teclado: ←/→, Inicio/Fin) y el contenido va en `<section aria-label="Funciones">`, como «Sincronía» y «Estilo».

## Respuesta
