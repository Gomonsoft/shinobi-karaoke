# 0026 — Menú contextual en portal, con volteo hacia arriba (bloqueante B1)
- Estado: Hecha — **prioritaria: hacer antes que el resto de correcciones**
- Paso del pipeline: — (transversal; afecta a la Biblioteca)
- Depende de: 0016, 0020
- ADRs: 0007
- Spec UX: docs/ux/sistema-visual.md §6 (Menú contextual), docs/ux/02-biblioteca.md (menú ⋯), docs/preguntas/0008-ajustes-ui-tras-revision-fase-1.md (B1), capturas `docs/ux/revision-fase-1/05*.png`

## Objetivo
Que el menú ⋯ de las tarjetas no quede recortado por `.tarjeta { overflow: hidden }` y se pueda usar con el ratón en cualquier fila y tamaño de ventana.

## Criterios de aceptación
- [ ] `componentes/MenuContextual.tsx` pinta la lista del menú en un **portal** (`createPortal` a `document.body`) con `position: fixed`, colocada a partir de `getBoundingClientRect()` del disparador. No se toca el `overflow: hidden` de la tarjeta (lo necesita la portada).
- [ ] **Volteo**: si no cabe debajo del disparador dentro del viewport (margen `--e-2`), se abre hacia arriba; horizontalmente se alinea al borde derecho del disparador y se desplaza para no salirse. Si no cabe ni arriba ni abajo, se coloca donde haya más espacio con `max-height` y desplazamiento interno.
- [ ] Mientras está abierto: se cierra con Esc, clic fuera, `resize`, desplazamiento de la rejilla/ventana y pérdida de foco de la ventana; el foco va al primer ítem al abrir y vuelve al disparador al cerrar (comportamiento actual de 0016 conservado: flechas, Inicio/Fin, ítems destructivos, `aria-haspopup`/`aria-expanded`/`role="menu"`).
- [ ] Al abrirse oculta el **tooltip** de su disparador y no lo vuelve a mostrar hasta que el puntero salga y vuelva a entrar o el foco vuelva a llegar (`05d`).
- [ ] Sigue sin usar colores ni medidas fuera de los tokens; `z-index` por encima de tarjetas y barra superior, por debajo de diálogos modales y toasts.
- [ ] Tests de componente: posición hacia abajo y hacia arriba (simulando `getBoundingClientRect` y `innerHeight`), cierre con desplazamiento/`resize`, tooltip oculto al abrir, teclado sin regresiones.
- [ ] E2E (`e2e/biblioteca-acciones.spec.ts`, semilla) con la ventana a **1024×640**: en una tarjeta de la primera fila y en una de la última fila visible (tras desplazar), abrir ⋯ con clic; cada ítem es `toBeVisible()`, su caja está completamente dentro del viewport y se puede pulsar (p. ej. «Mostrar en la carpeta» con un doble de `shell` o comprobando solo que el clic llega).

## Notas de implementación
- Hecho: `MenuContextual` pinta la lista con `createPortal` en `document.body` (`position: fixed`). La posición se calcula en `useLayoutEffect` con la función pura exportada `calcularPosicionMenu` (abajo si cabe; si no, arriba; si no, el lado con más espacio con `maxHeight` y scroll interno; alineado al borde derecho del disparador y limitado al viewport; márgenes leídos de los tokens `--e-2`/`--e-1`). Se cierra con Esc (foco al disparador), clic fuera, `resize`, `scroll` en captura (salvo dentro del propio menú) y `blur` de la ventana. El foco entra al primer ítem una vez colocado el menú (antes es `visibility: hidden`). Los eventos del portal que burbujean por React al envoltorio se ignoran en `teclaDisparador`.
- Tooltip: `Tooltip` gana `suprimir` y `BotonIcono` gana `ocultarTooltip`; al abrir el menú el tooltip se oculta y no reaparece hasta que el puntero reentre o el foco vuelva a llegar (al cerrar con Esc el foco vuelve al disparador, lo que lo permite por spec).
- Archivos: `app/src/renderer/src/componentes/{MenuContextual.tsx,MenuContextual.test.tsx,Tooltip.tsx,BotonIcono.tsx,componentes.module.css}`, `app/e2e/menu-contextual.spec.ts`.
- E2E: en archivo propio (`menu-contextual.spec.ts`, no en `biblioteca-acciones.spec.ts`) para no chocar con la tarea 0023 en paralelo. Ventana a 1024×640 vía `setContentSize`; primera fila, última fila y «Canción lista»: cada ítem visible, dentro del viewport y con `click({ trial: true })` (sin pulsar «Mostrar en la carpeta» para no abrir el explorador real); Esc devuelve el foco.
- Probar: `npm run lint && npm run typecheck && npm run format:check && npm test && npm run test:e2e` (en `app/`).
- Deuda: el cierre por `scroll` es en captura global; si en el futuro hay otro scroller dentro de un diálogo con menú, valorar anclar al scroller.
