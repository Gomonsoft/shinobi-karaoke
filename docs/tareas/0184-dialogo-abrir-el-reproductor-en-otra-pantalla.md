# 0184 — Diálogo «Abrir el reproductor en otra pantalla»

- Estado: Pendiente
- Paso del pipeline: 6
- Depende de: [0183](0183-estado-de-sesion-en-la-principal-bloqueo-de-edicion-e-indicador.md). Para integrarse en Electron necesita [0181](0181-servicio-de-sesion-e-ipc-en-main.md).
- ADRs: [0017](../adr/0017-ventana-secundaria-sesion-en-vivo-y-cola-de-reproduccion.md) §2, §5 (apertura) y §11 (`pantallas.listar`, `sesion.abrir`), respuesta [0061](../preguntas/0061-reproductor-en-otra-pantalla-con-wayland.md)
- Spec UX: [Biblioteca · Fase 4](../ux/02-biblioteca.md#fase-4-de-020--ventana-secundaria-y-cola) («Abrir el reproductor en otra pantalla», «Cabecera de la vista», S1, S2 y S15b)

## Objetivo

Construir el diálogo de apertura y el botón de la cabecera de la Biblioteca, y exponer `abrirDialogoPantallas({ inicio })` en `useSesion` para que lo usen el panel ([0185](0185-panel-de-cola-sesion-controles-recuperacion-y-cierre.md): P5, P6 y «Volver a abrir»), el ⋯ de la tarjeta ([0187](0187-tarjetas-y-menus-de-la-biblioteca-durante-la-sesion.md): «Reproducir en otra pantalla…») y «Cambiar de pantalla…» / «Mover a…» (variante sin «Empezará con» que llama a `sesion.moverAPantalla`).

## Contrato

- **`vistas/biblioteca/sesion/DialogoPantallas.tsx`** (560 px):
  - grupo de radio con `ListaPantallasIpc`, actualizado en vivo; si desaparece la elegida, `ses.pantalla.desaparecida`;
  - nota `ses.unaPantalla` cuando hay una sola pantalla;
  - casilla «Pantalla completa», desmarcada por defecto si se elige la de la principal, con la nota `ses.completa.misma`;
  - nota fija `ses.audio`;
  - `ses.empieza.*` según el inicio y el estado de la cola (vacía, con pendientes, interrumpida, terminada y con canción). Con canción e interrumpida, avisa de que esta ya no se retomará;
  - `ses.bloqueo.nota`;
  - preselección con la preferencia guardada (la regla de §2 la aplica main y llega en la lista, o se calcula aquí con la misma función pura de `shared/`).
- **Wayland** (`colocacion: 'sistema'`): sin lista ni casilla y con la nota `ses.wayland`.
- **Abrir**:
  - el botón pasa a «Abriendo…»;
  - si funciona, el diálogo se cierra, se abre el panel con el foco dentro y aparece el indicador;
  - errores en línea: `ses.error.abrir` con [Reintentar] (también con `PANTALLA_NO_DISPONIBLE`, que además recarga la lista), `ses.error.guardando` (`GUARDADO_PENDIENTE`) y `ses.error.noDisponible` (`CANCION_NO_DISPONIBLE`). Con `SESION_EN_CURSO`, se cierra y se muestra el panel.
- **Cabecera de la Biblioteca**: «Abrir en otra pantalla…» (oculto durante la sesión y con la biblioteca vacía) y el hueco para «Cola {n}», que rellena [0185](0185-panel-de-cola-sesion-controles-recuperacion-y-cierre.md).

## Archivos

`app/src/renderer/src/vistas/biblioteca/sesion/DialogoPantallas.tsx` (y su prueba), la cabecera en `Biblioteca.tsx` (pocas líneas, que se coordinan con 0185) y la función de preselección. Los textos ya están en `sesion/textos.ts` ([0183](0183-estado-de-sesion-en-la-principal-bloqueo-de-edicion-e-indicador.md)).

## Criterios de aceptación

- [ ] S1, S2 y S15b (la parte del diálogo) de la spec 02 en Vitest, con las pantallas falsas.
- [ ] Cada código de error muestra su banner y mantiene la selección. [Reintentar] vuelve a llamar con la misma selección.
- [ ] Con «Reproducir en otra pantalla…» y una interrumpida en el contexto, el texto incluye «ya no seguirá desde {mm:ss}», y `sesion.abrir` recibe `inicio: { tipo: 'cancion', donde: 'ahora' }`.
- [ ] Solo con teclado: ↑ y ↓ cambian la pantalla y Esc cancela.

## Notas de implementación
