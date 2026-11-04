# 0016 — Componentes base de la interfaz
- Estado: Pendiente
- Paso del pipeline: — (transversal)
- Depende de: 0015
- ADRs: 0007
- Spec UX: docs/ux/sistema-visual.md §6 y §7

## Objetivo
Los componentes reutilizables que necesitan la Biblioteca y el resto de vistas, accesibles con teclado y lector de pantalla desde el principio.

## Criterios de aceptación
- [ ] En `renderer/src/componentes/`, con sus estados de §6: **Botón** (primario, secundario, fantasma, destructivo; tamaños normal 36 px y grande 44 px; estado cargando; `aria-disabled` que sigue siendo enfocable y muestra el motivo, según "Acciones no disponibles"), **BotónIcono** (con `aria-label` y tooltip obligatorios), **Insignia de estado** (Lista, Borrador, En curso, En cola, Interrumpido, Error, Dañada; icono + texto), **Barra de progreso** (determinada/indeterminada/error; `role="progressbar"`, `aria-valuetext`), **Campo de texto** y **Área de texto** (etiqueta visible, ayuda, error con `aria-describedby`), **Control segmentado** (`role="radiogroup"`, flechas, opción no disponible con motivo), **Aviso en línea** (info/aviso/error/éxito con el `role` indicado), **Toast** (gestor global: máx. 3, 6 s, no se cierra con acción o ratón encima, `aria-live="polite"`), **Diálogo modal** (atrapa el foco, Esc cancela, devuelve el foco al disparador), **Menú contextual** (flechas, Esc, ítems destructivos), **Tooltip** (500 ms al pasar el ratón, inmediato con foco).
- [ ] Ninguno usa colores ni medidas fuera de los tokens de 0015.
- [ ] Todos aparecen en el "Muestrario" de desarrollo con todas sus variantes y estados.
- [ ] Tests de componentes (Testing Library): navegación con teclado del control segmentado y del menú, trampa de foco y retorno del diálogo, toasts apilados y caducidad, `aria-disabled` muestra el motivo.
- [ ] Revisión de accesibilidad: sin errores de `eslint-plugin-jsx-a11y`; contraste de cada variante coincide con los valores de la spec.
- [ ] Fuera de esta tarea (fases posteriores): selector de color, selector de fuente, stepper, indicador de actividad.

## Notas de implementación
(las rellena el programador al terminar)
