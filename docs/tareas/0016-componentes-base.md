# 0016 — Componentes base de la interfaz
- Estado: Hecha
- Paso del pipeline: — (transversal)
- Depende de: 0015
- ADRs: 0007
- Spec UX: docs/ux/sistema-visual.md §6 y §7

## Objetivo
Los componentes reutilizables que necesitan la Biblioteca y el resto de vistas, accesibles con teclado y lector de pantalla desde el principio.

## Criterios de aceptación
- [x] En `renderer/src/componentes/`, con sus estados de §6: **Botón** (primario, secundario, fantasma, destructivo; tamaños normal 36 px y grande 44 px; estado cargando; `aria-disabled` que sigue siendo enfocable y muestra el motivo, según "Acciones no disponibles"), **BotónIcono** (con `aria-label` y tooltip obligatorios), **Insignia de estado** (Lista, Borrador, En curso, En cola, Interrumpido, Error, Dañada; icono + texto), **Barra de progreso** (determinada/indeterminada/error; `role="progressbar"`, `aria-valuetext`), **Campo de texto** y **Área de texto** (etiqueta visible, ayuda, error con `aria-describedby`), **Control segmentado** (`role="radiogroup"`, flechas, opción no disponible con motivo), **Aviso en línea** (info/aviso/error/éxito con el `role` indicado), **Toast** (gestor global: máx. 3, 6 s, no se cierra con acción o ratón encima, `aria-live="polite"`), **Diálogo modal** (atrapa el foco, Esc cancela, devuelve el foco al disparador), **Menú contextual** (flechas, Esc, ítems destructivos), **Tooltip** (500 ms al pasar el ratón, inmediato con foco).
- [x] Ninguno usa colores ni medidas fuera de los tokens de 0015.
- [x] Todos aparecen en el "Muestrario" de desarrollo con todas sus variantes y estados.
- [x] Tests de componentes (Testing Library): navegación con teclado del control segmentado y del menú, trampa de foco y retorno del diálogo, toasts apilados y caducidad, `aria-disabled` muestra el motivo.
- [x] Revisión de accesibilidad: sin errores de `eslint-plugin-jsx-a11y`; contraste de cada variante coincide con los valores de la spec.
- [x] Fuera de esta tarea (fases posteriores): selector de color, selector de fuente, stepper, indicador de actividad.

## Notas de implementación
- **Qué se hizo**: Boton (4 variantes, 36/44 px, cargando con ancho fijo, `noDisponible` = `aria-disabled` enfocable que muestra el motivo al enfocar/pulsar), BotonIcono (`etiqueta` obligatoria = `aria-label` + tooltip), InsigniaEstado, BarraProgreso, CampoTexto/AreaTexto, ControlSegmentado, AvisoEnLinea, Toasts (gestor global con `useSyncExternalStore`: `mostrarToast`/`cerrarToast`, `<ContenedorToasts/>` montado en `App`), Dialogo (portal, trampa de foco, Esc, devuelve foco), MenuContextual, Tooltip. Estilos en un único CSS Module (`componentes.module.css`) que solo usa tokens. Añadido el token `--texto-sobre-acento` (#fff) en `tokens.css`. Muestrario (`#/muestrario`) ahora usa los componentes reales y muestra todas las variantes y estados; se eliminaron los botones/insignias provisionales de 0015.
- **Archivos clave**: `app/src/renderer/src/componentes/*` (`Boton`, `BotonIcono`, `Tooltip`, `InsigniaEstado`, `BarraProgreso`, `Campos`, `ControlSegmentado`, `AvisoEnLinea`, `gestorToasts.ts`, `Toasts`, `Dialogo`, `MenuContextual`, `componentes.module.css`), `vistas/Muestrario.tsx`, `App.tsx`.
- **Cómo probarlo** (desde `app/`): `npm run lint`, `typecheck`, `test` (258 tests; incluye teclado del control segmentado y del menú, trampa/retorno de foco del diálogo, toasts apilados/caducidad/pausa, `aria-disabled` con motivo, y `contraste.test.ts` que recalcula los ratios WCAG de las variantes desde `tokens.css` y los compara con la spec); `npm run dev` y abrir `#/muestrario`.
- **Decisiones menores**: en el control segmentado, las opciones no disponibles reciben foco con flechas (para poder leer el motivo) pero no se eligen. `aviso` en AvisoEnLinea usa `role="status"` (la spec solo fija `alert` para error). Clic fuera del diálogo no lo cierra (conservador). Los tests usan `fireEvent` (no se añadió `user-event`, no está en ADR 0007).
- **Deuda técnica**: sin revisión visual en ventana real; el tooltip no se reposiciona si se sale del viewport; el menú no tiene búsqueda por letra; el diálogo no marca el resto de la app como `inert`; fuera de alcance según la tarea: selector de color/fuente, stepper, indicador de actividad.
