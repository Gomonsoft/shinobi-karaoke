# 0184 — Diálogo «Abrir el reproductor en otra pantalla»

- Estado: Hecha
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

**Qué se hizo.**
- `useSesion` expone `abrirDialogoPantallas({ inicio })`, `cerrarDialogoPantallas` y `dialogoPantallas`. `inicio` es `'cola'`, `'reanudar'`, `'mover'` (variante «Cambiar de pantalla…» / «Mover a…» sin «Empezará con», con `sesion.moverAPantalla`) o `{ cancionId }` («Reproducir en otra pantalla…»). El estado vive en `ProveedorSesion` (único cambio en `sesion/`) y el diálogo lo pinta la Biblioteca con `DialogoPantallasPedido`.
- `DialogoPantallas.tsx`: grupo de radio con la lista en vivo (`pantallas` del contexto), aviso `ses.pantalla.desaparecida` (también si desaparece la preseleccionada), nota de una pantalla, casilla «Pantalla completa» con su regla por defecto y `ses.completa.misma`, notas `ses.audio` y `ses.bloqueo.nota`, `ses.empieza.*` (`empieza.ts`, función pura probada), Wayland (sin lista ni casilla, `pantallaCompleta: false`), «Abriendo…», errores en línea (`abrir`, `guardando`, `noDisponible`, con [Reintentar] sobre la misma selección; `PANTALLA_NO_DISPONIBLE` recarga la lista; `SESION_EN_CURSO` cierra y abre el panel). Al abrir con éxito se abre el panel y se pide el foco con `enfocarPanelColaCuandoEste`.
- `preseleccion.ts`: preselección (guardada por `id` o por etiqueta y tamaño; si no, la primera que no es la de la ventana principal) y valor por defecto de la casilla.
- Cabecera de `Biblioteca.tsx`: contenedor `.cabecera` con «Abrir en otra pantalla…» (oculto con sesión y con la biblioteca vacía). 0185 añade «Cola {n}» en `.cabeceraAcciones`.
- `montarConSesion.tsx` (solo pruebas): monta la Biblioteca con los dobles de sesión; lo reutilizan 0185 y 0187.

**Cómo probarlo.** `npm test -- src/renderer/src/vistas/biblioteca`. No hay E2E propio (se delega al CI).

**Decisiones provisionales.**
- La función de preselección vive en `vistas/biblioteca/sesion/preseleccion.ts` y no en `shared/` (propiedad de 0177). `ListaPantallasIpc` no lleva la preselección: se calcula aquí con `config.reproductor.secundaria` leído con `config.obtener()`.
- Variante «mover»: título `ses.cambiar` y botón `ses.mover`; no hay texto específico para el botón en la spec y no se muestra la casilla (`sesion.moverAPantalla` solo recibe la pantalla).
- Wayland: `sesion.abrir` recibe la primera pantalla de la lista (o 0) como `pantallaId`; main la ignora con `colocacion: 'sistema'`.
- Las flechas ↑/↓ las resuelve el grupo de radio nativo (jsdom no lo emula; la prueba comprueba que es un solo grupo). Se verifica en E2E (0190).

**Deuda.** La integración real con main llega con 0181.
