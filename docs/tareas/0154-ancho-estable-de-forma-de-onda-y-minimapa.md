# 0154 — Ancho estable de forma de onda y minimapa

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: [0152](0152-dibujar-forma-de-onda-y-minimapa.md), [0153](0153-verificar-linea-de-tiempo-bucle-y-picos.md)
- ADRs: [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md)
- Specs: [Editor](../ux/06-editor.md) (sin cambios de interacción)
- Plan: [Subfase 2.1, punto 1](../versiones/0.2.0/plan-2.md#subfase-21--estabilización-del-editor) · [Reporte, Bug 1](../versiones/0.2.0/reporte-editor-fase-2.md)

## Objetivo

La ventana del editor no debe tener desplazamiento horizontal en ningún momento. La regla, la forma de onda y el minimapa ocupan el ancho disponible y se adaptan al crecer o encoger la ventana, con cualquier densidad de pantalla.

Esta tarea solo corrige el ancho. El nuevo layout (cabecera, columnas, dock, divisores y modos minimizados) se hará en las tareas 0155 y siguientes, cuando UX cierre la spec.

## Causa confirmada

La reproducción se hizo en Electron con el build actual, la semilla `Editor: lista incompleta` y `--force-device-scale-factor` en 1, 1,25 y 1,5. El ancho de la ventana se midió en tres situaciones: en espera, reproduciendo y tras redimensionar a 1300, 1700 y 1250 px.

**1. Causa real: el cabezal posicionado fuera de la vista (con cualquier DPR).**

- `app/src/renderer/src/vistas/editor/PistaSincronia.tsx:225-238`: el efecto `pintar` asigna `left = tiempoAPixel({ inicioMs, finMs }, 100, actual)%` sin acotar el valor. Cuando el tiempo de audio sale de la ventana visible, solo pone `visibility: hidden` (línea 233).
- `PistaSincronia.tsx:374` y `pistaSincronia.module.css:106-113`: `.cabezal` es `position: absolute` dentro de `.eje` (`pistaSincronia.module.css:20-25`). Ni `.eje`, ni `.timeline` (`pistaSincronia.module.css:1-9`), ni `.editor` (`editor.module.css:1-6`), ni `main.contenido` (`navegacion/marco.module.css:44-47`) recortan el desbordamiento.
- Un elemento con `visibility: hidden` sigue ocupando espacio en el área desplazable. Con `left` por encima del 100 %, el cabezal invisible ensancha `document.documentElement.scrollWidth`. Al reproducir, el valor crece en cada fotograma, la página se ensancha sin parar y el pulgar de la barra encoge. Coincide con la captura del reporte: con el cabezal en 03:20 y la vista en 00:00–00:24, `left` vale aproximadamente un 830 %.
- Medición (DPR 1,25, zoom ×6, «Centrar en el cabezal» y reproducir): `scrollWidth` se mantiene en 1253 px mientras el cabezal está dentro de la vista. Al salir sube unos 150 px por segundo: 1395, 1545, 1695, 1846 y 1998 px, con `innerWidth` = 1268 px. El elemento más ancho de la página es `div.cabezal`, con `left` del 115 % al 167 % y `visibility: hidden`. El resultado es el mismo **sin ningún canvas en la página**. El canvas no interviene.
- Las pruebas no lo detectaron porque 0153 nunca reproduce con zoom más allá de `finMs`. Con la canción completa visible, el cabezal no sale de la vista.

**2. La hipótesis del reporte no se reproduce con el CSS actual, pero conviene blindarla.**

- `PistaOndaVoz.tsx:115-143` (`LienzoPicosVoz`) mide el propio canvas con `getBoundingClientRect()` (l. 119), le asigna `width = ancho_css × DPR` (l. 122 y 181) y observa ese mismo canvas con `device-pixel-content-box` (l. 136).
- Con DPR 1,25 y 1,5, el canvas de la onda y el del minimapa conservan un ancho CSS estable (por ejemplo 1171,2 px con el atributo a 1464 px). Siguen el resize en ambos sentidos tras un fotograma de retraso. La razón es que `width: 100%` (`picosVoz.module.css:18-24`) se resuelve contra contenedores de ancho definido: un ítem de rejilla con `min-width: 0` dentro de un ítem flex en columna, y un `position: absolute; inset: 0` en el minimapa.
- El riesgo sigue latente. El tamaño intrínseco del canvas es el atributo `width` en px CSS, que ya incluye el DPR, y entra en la contribución max-content. Si el layout de 0155+ coloca la línea de tiempo en una pista `auto`, `max-content` o `fit-content`, o en un ítem flex sin `min-width: 0`, aparece la realimentación descrita en el reporte. Además, cada notificación del observer vuelve a leer el layout con `getBoundingClientRect` en vez de usar el tamaño que trae la entrada.

## Enfoque de corrección

**A. Cabezal (corrige el bug).**

- En `PistaSincronia.tsx`, efecto `pintar` (l. 225-238): si el tiempo queda fuera de `[inicioMs, finMs]`, usar `display: none` en lugar de `visibility: hidden`. Dentro de la vista, `left` se acota a `[0, 100]`. Ninguna rama puede dejar `left` fuera de ese rango. El cabezal se sigue actualizando por fotograma sin redibujar la onda (ADR 0015).
- Defensa en profundidad en `pistaSincronia.module.css`: `.timeline { overflow-x: clip; }`. `clip` no crea contenedor de desplazamiento, así que no afecta al `sticky` del transporte ni a la rueda. El tirador más ancho (`max(24px, 2rem)` centrado con `translateX(-50%)`) sobresale como máximo 16 px de `.eje`. Ese espacio coincide con el margen de `.eje` (`--e-2`) más el padding de `.timeline` (`--e-2`), así que el tirador no se recorta en los extremos. Hay que comprobar visualmente el triángulo `.cabezal::before` (`left: -6px`) en el 0 %.
- No añadir seguimiento automático del cabezal. Sigue pendiente de la [pregunta 0051](../preguntas/0051-seguimiento-automatico-del-cabezal.md).

**B. Medición de los lienzos (blindaje).**

- `LienzoPicosVoz` renderiza un contenedor (`<div>`) y, dentro, el `<canvas>`. Se observa el **contenedor**, no el canvas. CSS del contenedor en `picosVoz.module.css`: `min-width: 0; overflow: hidden; contain: inline-size;`. Para la vista general, el contenedor toma `position: absolute; inset: 0` y el canvas ocupa el 100 % de su alto. El contenedor de la onda conserva el alto de 32 px.
- El canvas lleva `display: block; width: 100%; max-width: 100%; height: 100%`. Los atributos `width` y `height` solo fijan la resolución del bitmap y nunca influyen en el layout.
- Extraer una función pura (por ejemplo `tamanoLienzo(entrada, dpr)` en `PistaOndaVoz.tsx` o en un módulo hermano) que, a partir de una `ResizeObserverEntry`, calcule `{ ancho, alto, presupuesto }`:
  - Ancho y alto del bitmap: `devicePixelContentBoxSize[0]` (`inlineSize`/`blockSize`) si existe. Si no, `contentBoxSize[0] × devicePixelRatio`, redondeado.
  - Presupuesto: `min(MAX_BLOQUES_PICOS, ceil(contentBoxSize[0].inlineSize))`, en px CSS, sin cambios respecto a 0152.
  - Si `contentBoxSize` no existe, usar `contentRect`.
- El observer usa esa función con la entrada recibida, sin volver a llamar a `getBoundingClientRect`. Si `ancho`, `alto` y `presupuesto` no cambian, se devuelve el estado previo y no hay re-render. Esto ya existe en l. 126-132 y se conserva.
- La medición inicial y el cambio de densidad sin cambio de ancho CSS (mover la ventana a otro monitor) siguen cubiertos. Hay que observar el contenedor con `{ box: 'device-pixel-content-box' }` y, si el navegador no lo admite, con `content-box`. El listener de `resize` de `window` (l. 137) solo hace falta como respaldo cuando no hay `ResizeObserver`. Si se mantiene, debe pasar por la misma comparación sin re-render.
- `PistaSincronia.tsx:376-377` (`.vistaGeneral`) y `:313` (`onda`): sin cambios de estructura. El minimapa sigue midiendo su propio `div` para el arrastre (l. 419).

**C. Ancestros.** Con el layout actual, `.editor`, `.timeline`, `.eje`, `.vistaGeneral` y `.pista` ya tienen `min-width: 0`, y `.transporte` (`editor.module.css:130-139`) no contiene canvas. Aquí no se cambian. Las tareas de layout de 0155+ deberán mantener `min-width: 0` en el dock y en la pista de rejilla que lo contenga. Esa condición se anotará en ellas.

## Archivos

- `app/src/renderer/src/vistas/editor/PistaSincronia.tsx` (cabezal).
- `app/src/renderer/src/vistas/editor/pistaSincronia.module.css` (`overflow-x: clip` en `.timeline`).
- `app/src/renderer/src/vistas/editor/PistaOndaVoz.tsx` (contenedor, medición por entrada, función pura).
- `app/src/renderer/src/vistas/editor/picosVoz.module.css` (contenedor y canvas).
- `app/src/renderer/src/vistas/editor/PistaOndaVoz.test.tsx`, `Editor.test.tsx` o un test nuevo de `PistaSincronia` (Vitest).
- `app/e2e/editor.spec.ts` (regresión en Electron).

## Pruebas

**Vitest** (jsdom, con un doble de `ResizeObserver` que permita emitir entradas a mano):

- `tamanoLienzo` usa `devicePixelContentBoxSize` si existe, recurre a `contentBoxSize × dpr` y luego a `contentRect`, redondea, y calcula el presupuesto en px CSS acotado a 4096.
- Emitir dos veces la misma entrada no cambia el atributo `width`, no provoca un segundo `picos.leer` y no re-renderiza. Una entrada de distinto ancho o densidad sí actualiza.
- El observer se registra sobre el contenedor y no sobre el canvas. No se llama a `getBoundingClientRect` del canvas.
- Cabezal: con el tiempo de audio por debajo de `inicioMs` o por encima de `finMs`, el nodo queda en `display: none`. Dentro de la vista, `left` siempre está entre `0%` y `100%`.

**E2E en Electron** (`editor.spec.ts`, con la semilla de picos de 0153):

- Parametrizar con DPR 1, 1,25 y 1,5 lanzando Electron con `args: ['--force-device-scale-factor=<f>', '.']`. `electron.launch` no admite `deviceScaleFactor`. Comprobar `window.devicePixelRatio === f` al inicio.
- Escenario: abrir el editor en Sincronía, esperar a la onda (`esperarOnda`) y registrar el ancho CSS de ambos canvas. Esperar 3 s y comprobar que el ancho no cambia. Acercar (×6) y «Centrar en el cabezal». Reproducir unos 10 s, hasta que el cabezal salga por la derecha de la vista, muestreando cada 500 ms. Después redimensionar con `setContentSize` a 1300×800, 1700×900 y 1250×800.
- En cada muestra: `document.documentElement.scrollWidth <= window.innerWidth`. Sin redimensionar, el ancho CSS de cada canvas no cambia entre muestras. Tras cada resize, ese ancho termina igual al del contenedor (diferencia de 1 px como máximo) y crece o decrece con la ventana.
- Nota de entorno: la generación de picos necesita `worker/.venv`. Sin ese entorno local, la onda queda en «Forma de onda no disponible» y 0153 también falla, pero la regresión del cabezal se reproduce igual. La comprobación de `scrollWidth` durante la reproducción no debe depender de que haya picos. Se recomienda separarla en un caso que no espere a `esperarOnda`.

## Criterios de aceptación

- [ ] Con DPR 1, 1,25 y 1,5, en espera, reproduciendo con el cabezal fuera de la vista y tras redimensionar en ambos sentidos, `scrollWidth <= innerWidth` en todo momento.
- [ ] El ancho CSS de la forma de onda y del minimapa es estable sin redimensionar y sigue al contenedor al crecer o encoger la ventana.
- [ ] Fuera de la vista visible, el cabezal no ocupa espacio en el layout. Dentro, se sigue pintando por fotograma sin redibujar la onda.
- [ ] Los lienzos se miden por la entrada del `ResizeObserver` sobre un contenedor. Los atributos del canvas no influyen en el layout y una medición igual no cambia el estado.
- [ ] Los tiradores, el triángulo del cabezal y la ventana del minimapa se ven completos en los extremos (0 % y 100 %).
- [ ] No cambia el comportamiento de zoom, minimapa, bucle ni carga de picos (0149-0153 en verde).
- [ ] No se modifica el layout del editor fuera de lo indicado: columnas, dock y paneles quedan para 0155+.

## Verificación

Desde `app/`: `npm test -- src/renderer/src/vistas/editor`, `npm run lint`, `npm run typecheck` y `npm run test:e2e -- e2e/editor.spec.ts`.

## Notas de implementación

- Cabezal (`PistaSincronia.tsx`): fuera de `[inicioMs, finMs]` usa `display: none`; dentro, `left` acotado a `[0, 100]` %. Lleva `data-cabezal` (el E2E ya no lo localiza por `style*="visibility:"`). `.timeline` con `overflow-x: clip`.
- Lienzos (`PistaOndaVoz.tsx`, `picosVoz.module.css`): `LienzoPicosVoz` renderiza un `div` (`.marco` / `.marcoGeneral`, con `min-width: 0; overflow: hidden; contain: inline-size`) y el `canvas` dentro (100 % del contenedor). El `ResizeObserver` observa el contenedor (`device-pixel-content-box`, con respaldo a `content-box`) y calcula con la función pura exportada `tamanoLienzo(entrada, dpr)`. Sin `ResizeObserver` se mide el contenedor con `resize` de `window`. Misma medición no cambia el estado.
- Pruebas: `PistaOndaVoz.test.tsx` (función pura y observer con doble), `PistaSincronia.test.tsx` (cabezal) y E2E en `app/e2e/editor.spec.ts` con DPR 1, 1,25 y 1,5 (`scrollWidth` con cabezal fuera de la vista y tras redimensionar, sin depender de picos; ancho de canvas estable y siguiendo al contenedor con picos). `lanzar` de `e2e/fixtures/separacion.ts` admite argumentos de Electron.
- Cómo probarlo: desde `app/`, `npm test -- src/renderer/src/vistas/editor` y `npm run test:e2e -- e2e/editor.spec.ts` (los E2E con picos necesitan `uv sync --locked` en `worker/`).
- Deuda: en Windows Vitest tiene 8 fallos conocidos por enlaces simbólicos (`EPERM`), ajenos a esta tarea. No se comprobó a ojo el recorte del triángulo `.cabezal::before` en el 0 %.
