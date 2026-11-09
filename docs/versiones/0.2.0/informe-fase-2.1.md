# Informe de subfase 2.1 · Estabilización del editor

Las tareas 0154–0162 del [backlog](backlog.md) corrigen el desbordamiento horizontal de la línea de tiempo y entregan el layout adaptable del editor: cabecera, tres columnas y dock a alto completo, divisores accesibles, modos minimizados con controles rápidos, panel angosto y persistencia global de la distribución. La spec es [Subfase 2.1 · Layout adaptable y paneles](../../ux/06-editor.md#subfase-21--layout-adaptable-y-paneles) (criterios 1–25). El origen es el [reporte de Windows](reporte-editor-fase-2.md).

## Qué se entregó

- **0154 · Ancho estable.** Los lienzos de la forma de onda y del minimapa viven dentro de un contenedor con `min-width: 0` y `contain: inline-size`; el `ResizeObserver` mide el contenedor, no el canvas, y el cabezal fuera de `[inicio, fin]` usa `display: none`. Cubierto con DPR 1, 1,25 y 1,5.
- **0155 · Preferencias y ventana mínima.** `config.editor.paneles` (lectura tolerante campo a campo) y ventana con contenido mínimo de 1024 × 576 (`useContentSize` más `setMinimumSize` con el marco real).
- **0156 · Modelo puro** `calcularDistribucion`, con teclas y arrastre de los divisores.
- **0157–0158 · Layout y transporte.** Rejilla a alto completo, modo compacto bajo 800 px, disposición B bajo 1024 px de ancho, transporte en dos filas y fila del desplazamiento en un solo renglón.
- **0159 · Divisores** (`role="separator"`, patrón *Window Splitter*, arrastre con captura, Esc, doble clic, tooltip propio) y «Restablecer distribución de paneles».
- **0160 · Modos minimizados** (rieles de 72 y 120 px, fila de 44/40 px con minimapa informativo, minimización temporal sin espacio y anuncios).
- **0161 · Persistencia** de tamaños y estados, con guardado diferido y recorte sin sobrescribir.
- **0162 · Cierre.** Matriz de seis viewports, casos extra, capturas, el único cambio de CI (pantalla de xvfb a 3840 × 2160) y este informe.

### Cambios hechos al cerrar la subfase

- **Histéresis de la disposición B.** Con `bajoMinimo = 'alto'` el scroll vertical de `main` reservaba una barra de ~15 px; el ancho de la raíz bajaba de 992 a ~977 y el modelo cruzaba el umbral de 1024 y pasaba a B sin volver. Reproducido en Electron con 1024 × 400 CSS (ventana 1536 × 600 y `setZoomFactor(1.5)`) y corregido: `MedidasEditor` tiene `barraVertical` (que `useDistribucion` mide como `main.offsetWidth − main.clientWidth`) y el umbral del ancho se decide con el ancho de la ventana, no con el de la raíz. Pruebas en `distribucion.test.ts` (con barra se mantiene A; sin informar de la barra se reproduce el fallo; por debajo de 1024 reales sigue siendo B) y en E2E.
- **Tooltip del divisor.** La spec lo pide (`edi.layout.divisor.tooltip`, a los 500 ms de *hover*). Ya estaba implementado como elemento propio (`role="tooltip"`) dentro del divisor, para no envolver el separador en un `span` y romper la rejilla. Se añade un E2E que comprueba el texto y que los tamaños de la rejilla no cambian al aparecer.
- **Otras vistas.** Nuevo caso que revisa a 1024 × 576 Biblioteca, los diálogos «Editar datos» y «¿Eliminar…?», Ajustes, Añadir y Letra.

## Verificación

Equipo: Windows 11 Pro (compilación 26200), usuario Gogo, monitor de 3440 × 1440 a escala 100 % del sistema; las escalas de 125 % se simularon con `--force-device-scale-factor=1.25`. `worker/.venv` presente (`uv` en el PATH), por lo que la forma de onda tiene picos reales.

| Comprobación | Resultado |
|---|---|
| `npm run lint` | Correcto |
| `npm run typecheck` | Correcto |
| `npm run format:check` | Correcto |
| `npm run build` | Correcto |
| `npx vitest run` (Windows) | 2003 correctas, 13 omitidas y 8 fallos (2024 en total) |
| `npx playwright test --workers=1` (app completa) | 140 casos: 130 correctos, 10 omitidos, 0 fallos, 0 *flaky* (ninguno repetido) |

- Los 8 fallos de Vitest son los conocidos de Windows: `EPERM` al crear enlaces simbólicos (6 en `appProtocolo.test.ts` y 2 en `medios.test.ts`). Se verifican en CI. Son ajenos a la subfase y siguen igual que en la fase 1 y la fase 2.
- Los 10 omitidos son: las 6 capturas (opt-in con `SHINOBI_CAPTURAS_2_1=1`), el perfil de una hora de voz (opt-in), la búsqueda real de letra y la descarga real de YouTube (necesitan red) y el caso de muerte del proceso por `SIGKILL` (no aplica en Windows).
- Los casos de la matriz no se omitieron: cada uno comprueba `devicePixelRatio`, `innerWidth` e `innerHeight` al empezar y, si el sistema no concede el viewport, deja la anotación `viewport omitido` y se omite sin darlo por bueno. En este equipo se concedieron los seis.

### Viewports y dónde se verificaron

Todos en este equipo (monitor de 3440 × 1440). A 125 % Windows entrega hasta 4 px de contenido de más (p. ej. 1285 × 723 en lugar de 1280 × 720) y los casos usan el `innerWidth`/`innerHeight` reales. Falta verificarlos en CI (Linux con xvfb a 3840 × 2160, ya ajustado en `ci.yml`); no hay otro equipo.

| Ventana física | Escala | Viewport CSS pedido | Equipo | Resultado |
|---|---|---|---|---|
| 1280 × 720 | 100 % | 1280 × 720 | Este equipo | Correcto |
| 1280 × 720 | 125 % | 1024 × 576 | Este equipo | Correcto |
| 1720 × 1440 | 100 % | 1720 × 1440 | Este equipo | Correcto |
| 1720 × 1440 | 125 % | 1376 × 1152 | Este equipo | Correcto |
| 1920 × 1080 | 100 % | 1920 × 1080 | Este equipo | Correcto |
| 1920 × 1080 | 125 % | 1536 × 864 | Este equipo | Correcto |

Casos extra: bajo mínimo (zoom 150 % en 1280 × 720), sin espacio (1024 × 500 CSS), histéresis (1024 × 400 CSS) y panel a 300, 360 y 480 px, todos correctos.

### Resultado por criterio

Los casos están en `app/e2e/editor-layout.spec.ts` salvo indicación.

| Criterio | Verificación | Resultado |
|---|---|---|
| 1 · Sin scroll de página en los seis viewports (pausa, reproduciendo 5 s, Estilo, crecer y encoger) | Matriz de seis casos | Correcto |
| 2, 4, 5 · Todo visible; lienzo 16:9 centrado; modo compacto y zona ≥ 136 px | Matriz (`medir` y `comprobarLayout`) | Correcto |
| 3 · Solo lista y panel hacen scroll | Caso de 64 líneas | Correcto |
| 6 · Filas del transporte y controles de la línea de tiempo sin partir; barra ≥ 240 px | Matriz y caso de 1024 y 1280 px | Correcto |
| 7 · Estilo sin línea de tiempo y alto recuperado | Matriz y caso de modo sincronizar | Correcto |
| 8 · Modo sincronizar sin scroll y estado restaurado | Matriz (seis viewports) y caso a 1280 × 720 | Correcto |
| 9 · Arrastre hasta mínimos y máximos; Esc; no escribe la canción | Casos a 1280 × 720 y 1920 × 1080, y caso de Esc | Correcto |
| 10, 11 · ARIA del separador y teclado | Caso de teclado y Vitest (`Divisor.test.tsx`) | Correcto |
| 12 · Doble clic y «Restablecer distribución de paneles» | Caso de restablecer y caso de panel angosto | Correcto |
| 13 · Cursor, *hover*, foco y agarre; tooltip | Vitest, caso de tooltip y captura `foco-divisor` | Correcto |
| 14, 15, 16, 17 · Rieles, fila minimizada, foco y anuncios | Casos de minimizados (0160) | Correcto |
| 18 · Sin espacio (1024 × 500 CSS) | Caso con ventana 1280 × 625 y zoom 1,25 | Correcto |
| 19 · Disposición B bajo 1024 px | Caso de zoom 150 % y caso de histéresis | Correcto |
| 20 · Panel a 300, 360 y 480 px | Caso de panel angosto | Correcto |
| 21, 22, 23 · Persistencia, recorte sin sobrescribir y preferencias corruptas | Casos de 0161 | Correcto |
| 24 · Sin regresiones del editor | `editor.spec.ts` completo (seguimiento, tiradores, zoom, bucle y atajos) | Correcto |
| 25 · Capturas | Caso opt-in, 28 capturas en `docs/ux/revision-fase-2.1/` | Correcto |
| 0154 · Ancho estable con DPR 1, 1,25 y 1,5 | `editor.spec.ts` (con picos) | Correcto |

### Estado de la forma de onda

Con picos: `worker/.venv` existe en este equipo y la forma de onda y el minimapa se dibujaron con picos en las capturas `defecto` (anotación `picos: true`) y en los casos de 0153 y 0154. Los casos de layout no esperan a la onda.

### Otras vistas a 1024 × 576

Biblioteca, Ajustes, Añadir canción y Letra no tienen scroll horizontal a 1024 × 576. Los diálogos «Editar datos» y «¿Eliminar…?» quedan dentro del viewport o se alcanzan con scroll, y su botón «Cancelar» es pulsable. Caso: «otras vistas a 1024 × 576».

### Capturas

28 PNG en [`docs/ux/revision-fase-2.1/`](../../ux/revision-fase-2.1/README.md), con el nombre pedido por la spec, tamaño físico y picos. Se abrieron varias para revisarlas: defecto a 1280 × 720 y 1720 × 1440, sync, foco, todo minimizado, timeline minimizada, panel a 300 y bajo mínimo. Observaciones, que no son defectos de layout, en el README de la carpeta.

Comando: `SHINOBI_CAPTURAS_2_1=1 npx playwright test e2e/editor-layout.spec.ts --workers=1 -g "capturas de revisión"` desde `app/`.

## Desviaciones

- **Ventana mínima con marco.** En Windows `minHeight` con `useContentSize` no descuenta la barra de menú: `setMinimumSize` se llama con el mínimo más el marco real, al crear y en `ready-to-show`. No se recalcula si el marco cambia al mover la ventana entre pantallas con otra escala.
- **Holgura a 125 %.** Hasta 4 px de contenido de más.
- **Disposición B** reutiliza la estructura anterior (pestañas, lista y panel apilados a la izquierda), no pestañas Líneas/Sincronía/Estilo.
- **Variables CSS en px**, no en rem (con `setZoomFactor` los px CSS ya escalan).

## Decisiones a confirmar por UX

1. **«Expandir» deshabilitado en el modo sincronizar.** En el modo sincronizar la fila minimizada sustituye a la línea de tiempo y su botón «Expandir línea de tiempo» queda `aria-disabled` con el motivo «Sincronizando al ritmo». La spec no lo define.
2. **Arrastre desde un estado minimizado.** Arrastrar un divisor con la zona minimizada estira el riel al tamaño en vivo y no expande visualmente la zona hasta soltar. La spec dice que minimizar nunca ocurre por arrastre, pero no cómo se ve el arrastre desde minimizado.
3. **Doble «Fijar inicio aquí (I)».** Con el riel de la lista y el panel de Sincronía visibles a la vez, hay dos botones con el mismo nombre accesible. Revisar si el del riel necesita un nombre distinto (p. ej. «de la línea seleccionada») o si es correcto que coincidan porque hacen lo mismo.
4. **Lienzo mínimo.** Con la zona superior en su mínimo de 136 px y el panel a 300 px (1024 × 576 CSS), el lienzo 16:9 es pequeño y su texto se recorta por abajo dentro del propio lienzo. Confirmar si debe reducir la tipografía en ese caso.

## Pendientes y seguimiento

- **Pregunta [0051](../../preguntas/0051-seguimiento-automatico-del-cabezal.md) abierta** (para el usuario, no bloquea). El seguimiento del cabezal sigue siendo manual: «Centrar en el cabezal», zoom, paneo y minimapa, según la spec. No se implementa sin tarea propia.
- **CI.** Comprobar en el PR los seis viewports con xvfb (3840 × 2160) y que los 8 casos de Vitest con enlaces simbólicos (`EPERM` solo en Windows) pasan allí.
- **Recorte del triángulo `.cabezal::before` en el 0 %**, no revisado a ojo en 0154.
- **Marco con otra escala.** El mínimo de ventana no se recalcula al mover la ventana entre pantallas.
