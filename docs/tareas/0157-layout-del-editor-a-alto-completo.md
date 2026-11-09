# 0157 — Layout del editor a alto completo: cabecera, columnas, dock y scroll interno

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: [0154](0154-ancho-estable-de-forma-de-onda-y-minimapa.md), [0156](0156-modelo-puro-de-distribucion-del-editor.md)
- ADRs: [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--layout-adaptable-y-paneles), [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md)
- Specs: [Editor, subfase 2.1](../ux/06-editor.md#subfase-21--layout-adaptable-y-paneles) («Unidades», «Distribución», «Qué cede primero», «Por debajo del mínimo»), [Sistema visual](../ux/sistema-visual.md)
- Plan: [Subfase 2.1, punto 2](../versiones/0.2.0/plan-2.md#subfase-21--estabilización-del-editor) · [Reporte, Bug 2](../versiones/0.2.0/reporte-editor-fase-2.md)

## Objetivo

El editor ocupa exactamente `100vh − 56 px` y la página nunca hace scroll. La cabecera va arriba (normal o compacta), las tres columnas en el centro y el dock abajo con el transporte y la línea de tiempo. Solo la lista y el contenido del panel tienen scroll propio. Los tamaños son los **efectivos** de `calcularDistribucion` (0156), con las preferencias por defecto en memoria. Divisores, rieles y persistencia llegan en 0159–0161.

## Cabecera (verificado en el código)

`CabeceraCancion` (`vistas/cancion/cabecera.module.css`) mide hoy **80 px de contenido**: una fila de 36 px (`--alto-boton`), un hueco de 12 px (`--e-3`) y el stepper de 32 px (`--objetivo-minimo`). Además tiene `margin-bottom: 24px`, y `.editor` añade un `gap` de 12 px. En total ocupa ≈ 116 px antes del cuerpo. Con el nuevo layout:

- Nueva prop `variante?: 'vista' | 'editor' | 'editor-compacta'`, con `'vista'` por defecto. Biblioteca, Añadir, Progreso y Letra no cambian y sus tests siguen verdes.
- `'editor'`: las dos filas actuales sin `margin-bottom`. El hueco de 8 px lo pone la rejilla del editor. El slot mide 80 px, dentro del presupuesto de ≈ 96 px de la spec. El stepper puede partirse: el modelo usa la altura **medida**, y con alto ≥ 800 sobra espacio.
- `'editor-compacta'` (alto < 800): una fila de 48 px con ‹ Biblioteca, título · artista con elipsis y `title`, insignia, guardado, stepper compacto, ⟲ ⟳ y ⋯. El stepper compacto muestra los cuatro círculos y solo la etiqueta del paso actual. Los demás pasos conservan su `aria-label` completo y ganan un tooltip con la etiqueta, combinado con el `motivo` si lo tienen. La navegación no cambia.
- Con 48 px de cabecera compacta, a 1024 × 576 la zona superior mide ≈ 160 px, por encima del mínimo de 136. **No hace falta cambiar el mínimo.**

## Enfoque

- **Marco**: `main` recibe `data-vista` y la clase `contenidoEditor` en la ruta del editor: `height: calc(100vh - 3.5rem)`, `overflow: hidden`, `padding: 0 1rem` y `min-width: 0`. `body` tiene `min-width: 1024px` (`estilos/base.css`), lo que provocaría scroll horizontal por debajo de 1024. Se anula solo con el editor activo (`body:has(main[data-vista='editor']) { min-width: 0 }`). Las demás vistas no cambian.
- **Rejilla del editor**: `grid-template-rows: auto minmax(0, 1fr) auto`, con margen superior de 12 px (8 en compacto) y sin margen inferior. Zona superior: `grid-template-columns: var(--ancho-lista) 12px minmax(0, 1fr) 12px var(--ancho-panel)`. De momento las franjas de 12 px quedan vacías: los divisores llegan en 0159. No usar pistas `auto`, `max-content` ni `fit-content` en columnas ni en el dock, y dejar `min-width: 0` en el dock y en sus ancestros (condición de 0154).
- **Hook** `useDistribucion.ts`: un `ResizeObserver` sobre la raíz, la cabecera y el transporte, y `matchMedia('(max-height: 799.98px)')`. Llama a `calcularDistribucion` y escribe `--ancho-lista`, `--ancho-panel`, `--alto-linea-tiempo` y `--alto-pista-voz` en la raíz. Solo vuelve a renderizar si cambia el resultado (misma regla que 0154).
- **Lista**: fila de título de 32 px (título, contador y hueco reservado para «Minimizar» de 0160), banner y filas en el **mismo** contenedor con scroll (el banner se desplaza con las filas) y pie «Corregir la letra» de 32 px. Se retiran `min-height`/`max-height` en función de `vh` de `.lista` y `.panel`.
- **Vista previa**: el lienzo es el mayor 16:9 que cabe en la columna, descontando el encabezado (visible solo en normal; en compacto `soloLector`) y el botón. Va centrado en ambos ejes y el botón queda justo debajo, con el ancho del lienzo. Se puede calcular con *container queries* (`cqw`/`cqh`) o con el `ResizeObserver` del hook, sin realimentación: la columna no depende del lienzo.
- **Panel**: pestañas «Sincronía / Estilo» (36 px, con hueco para «Minimizar» de 0160) y contenido con `overflow-y: auto` y `scrollbar-gutter: stable`.
- **Dock**: `fondo-1`, borde superior y relleno de 8 px (4 en compacto). Contiene `Transporte` (las dos filas llegan en 0158; aquí solo se coloca y se le quita el `position: sticky`) y, en Sincronía, `PistaSincronia` con alto `--alto-linea-tiempo`. La pista de voz y líneas toma `--alto-pista-voz` (76 por defecto, 48 mínimo) en `pistaSincronia.module.css`/`picosVoz.module.css`. Ni la regla ni la vista general cambian de alto.
- **Estilo**: sin línea de tiempo en el dock y la zona superior se queda el alto.
- **Modo sincronizar**: el banner E (`BannerSincronizar`) va en el dock en lugar de la línea de tiempo. Debajo, la línea de tiempo queda inactiva a su alto mínimo (la fila minimizada llega en 0160 y la sustituye). El dock crece sin bajar la zona superior de 136. Al salir vuelve el estado anterior.
- **Bajo mínimo**: si `bajoMinimo = 'ancho'`, se usa la disposición B (columna izquierda con pestañas Líneas/Sincronía/Estilo y la previa a la derecha) con el dock abajo. Si `'alto'`, `main` pasa a `overflow-y: auto`. Nunca `overflow-x`.
- **Seguimiento del cabezal**: sin cambios (pregunta [0051](../preguntas/0051-seguimiento-automatico-del-cabezal.md)).

## Archivos

- `app/src/renderer/src/navegacion/Marco.tsx`, `navegacion/marco.module.css`, `estilos/base.css` (regla `:has` del editor).
- `app/src/renderer/src/vistas/cancion/CabeceraCancion.tsx`, `cabecera.module.css`, `CabeceraCancion.test.tsx`.
- `app/src/renderer/src/vistas/editor/Editor.tsx`, `editor.module.css` (reglas de `.editor`, `.cuerpo`, `.lista*`, `.previa`, `.pantalla`, `.accionPrueba`, `.pestanas` y `.panel`). **No** edita el bloque del transporte ni el de `.desplazamiento`/`.ajustesTiempo`, que son de 0158.
- `app/src/renderer/src/vistas/editor/ListaLineas.tsx`.
- `app/src/renderer/src/vistas/editor/useDistribucion.ts` (nuevo) y `Editor.layout.test.tsx` (nuevo, con un doble de `ResizeObserver` y `matchMedia`).
- `app/src/renderer/src/vistas/editor/pistaSincronia.module.css`, `picosVoz.module.css` (alto variable de la pista de voz). Solo después de integrar 0154.
- `app/src/renderer/src/vistas/editor/transporte.module.css` (de 0158): retirar `position: sticky`, si 0158 ya está integrada. Si no, en `editor.module.css`.
- `app/e2e/fixtures/editor.ts` (nuevo): extraer de `editor.spec.ts` los ayudantes `lanzar` (con DPR), `conEditor` y `abrirEditor`, y añadir `alargarLetra(datos, id, n)`, que reescribe la letra de la semilla 19 con *n* líneas. `editor.spec.ts` pasa a importarlos sin cambiar sus casos.
- `app/e2e/editor-layout.spec.ts` (nuevo).

## Criterios de aceptación

- [ ] Criterios 1–5 y 7 de la spec en los seis viewports de la matriz con valores por defecto (Sincronía y Estilo, en pausa, reproduciendo 5 s y tras crecer y encoger): `scrollHeight <= innerHeight`, `scrollWidth <= innerWidth`, ningún `getBoundingClientRect()` fuera del viewport, previa 16:9 centrada (±1 px) y zona superior ≥ 136 con título, una fila y pie visibles a 1280 × 720 y 1024 × 576.
- [ ] Con 64 líneas (`alargarLetra`), la lista hace scroll y la página no. El banner de la lista se desplaza con las filas.
- [ ] La cabecera compacta solo aparece en el editor y con alto < 800, y mide 48 px. La cabecera de las otras cuatro vistas es idéntica a la de antes (tests de `CabeceraCancion` y capturas manuales).
- [ ] Modo sincronizar sin scroll de página en los seis viewports. Al salir vuelven el alto y el estado anteriores.
- [ ] Con zoom 150 % en 1280 × 720 (`webContents.setZoomFactor(1.5)`) se usa la disposición B, solo con scroll vertical.
- [ ] Ningún caso de `editor.spec.ts`, `reproductor.spec.ts` ni de Vitest del editor cambia de resultado. La onda sigue alineada con el eje y los canvas conservan el ancho estable de 0154.
- [ ] **Los E2E de layout no esperan a la onda.** Funcionan igual con «Forma de onda no disponible» (sin `worker/.venv`) que con picos, porque los altos no dependen del estado de la onda.

## Verificación

Desde `app/`: `npm test -- src/renderer/src/vistas`, `npm run lint`, `npm run typecheck` y `npm run test:e2e -- e2e/editor-layout.spec.ts e2e/editor.spec.ts`. Los seis viewports se lanzan con `--force-device-scale-factor` 1 o 1,25 y `setContentSize(anchoCss, altoCss)`. Hay que comprobar `innerWidth`/`innerHeight`. Si la pantalla del equipo no admite el tamaño, el caso se omite con una anotación y no se da por bueno (ver 0162).

## Notas de implementación

- Hecho: marco (`Marco.tsx`, `marco.module.css`, `base.css`: `main[data-vista='editor']` a `100vh − 3.5rem`, `overflow: hidden`, `body:has(...) { min-width: 0 }`), rejilla `auto / minmax(8.5rem, 1fr) / auto` en `Editor.tsx` y `editor.module.css`, `useDistribucion.ts` (ResizeObserver sobre raíz, cabecera, dock, transporte y extra del modo sincronizar, `matchMedia` y variables `--ancho-lista`, `--ancho-panel`, `--alto-linea-tiempo`, `--alto-pista-voz`; solo re-renderiza si cambian las medidas), `CabeceraCancion` con `variante` (`vista` por defecto, `editor`, `editor-compacta` de 48 px con stepper compacto y tooltips), lista con banner dentro del mismo scroll (`ListaLineas.tsx`), vista previa con lienzo 16:9 por *container queries* y botón justo debajo, pestañas de 36 px, dock con transporte y línea de tiempo, disposición B por debajo de 1024 px de ancho (`data-bajo-minimo`), y `main` con scroll vertical en `bajoMinimo = 'alto'`.
- Franjas de 12 px vacías (`data-divisor`) reservadas para los divisores de 0159. Se retiró el `position: sticky` del transporte.
- Línea de tiempo: la forma de onda pasa a ir **dentro** de la pista (`.pista`), detrás de las regiones, porque la sección de 216/204 px de la spec solo cuenta una banda de «pista de voz y líneas» de 76 px. La pista es lo único que crece (`flex`, mínimo 48 px) y las regiones se centran en vertical. El aviso de límite flota sobre la vista general y la fila de controles ya no se parte (el texto de ayuda se recorta con elipsis).
- Modo sincronizar: banner y línea de tiempo (a su alto natural, pista de 48 px) en el dock; `Transporte` recibe `sincronizando` y su fila 2 conserva solo «Escuchar». El modelo recibe `altoBannerSync = alto(banner + línea de tiempo) − fila minimizada` para no contarla dos veces.
- Pruebas: `Editor.layout.test.tsx` (3), `CabeceraCancion.test.tsx` (+2), `e2e/editor-layout.spec.ts` (11 casos: 6 viewports con pausa, reproduciendo 5 s, Estilo, crecer y encoger y modo sincronizar; 64 líneas; sincronizar; zoom 150 %; transporte y desplazamiento a 1024 y 1280). `e2e/fixtures/editor.ts` con `lanzar`, `conEditor`, `abrirEditor`, `idSemilla` y `alargarLetra`. Los E2E de layout no esperan a la onda.
- Cómo probarlo, desde `app/`: `npm test -- src/renderer/src/vistas`, `npm run build` y `npx playwright test e2e/editor-layout.spec.ts e2e/editor.spec.ts e2e/ventana.spec.ts e2e/reproductor.spec.ts`.
- Desviaciones y deuda: (1) con alto < 720 (p. ej. 1024 × 576) el modo sincronizar no cabe sin la fila minimizada de 0160: `main` hace scroll vertical interno (la página no); el test solo exige «sin elementos fuera» desde 720 de alto. (2) Con densidad 1,25 Windows entrega hasta 4 px de más en el contenido (1028 × 578 en lugar de 1024 × 576): los E2E aceptan esa holgura y usan `innerWidth`/`innerHeight` reales. (3) Las variables se escriben en px, no en rem (con `setZoomFactor` los px CSS ya escalan). (4) `minimizadoPorEspacio` se trata como «bajo mínimo por alto» (scroll de `main`) hasta que 0160 cree la fila minimizada. (5) La disposición B reutiliza la estructura anterior (pestañas, lista y panel apilados a la izquierda), no pestañas Líneas/Sincronía/Estilo. (6) El encabezado «Vista previa» se pinta en normal y es solo para lectores en compacto, como pide la spec.
