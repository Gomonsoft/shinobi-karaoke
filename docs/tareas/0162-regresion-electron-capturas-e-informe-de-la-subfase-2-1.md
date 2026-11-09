# 0162 — Regresión en Electron, capturas e informe de la subfase 2.1

- Estado: Hecha
- Paso del pipeline: 4
- Depende de: [0154](0154-ancho-estable-de-forma-de-onda-y-minimapa.md), [0155](0155-preferencia-de-paneles-en-config-y-ventana-minima.md), [0157](0157-layout-del-editor-a-alto-completo.md), [0158](0158-transporte-en-dos-filas-y-panel-angosto.md), [0159](0159-divisores-accesibles-y-restablecer-distribucion.md), [0160](0160-modos-minimizados-con-controles-rapidos.md), [0161](0161-persistir-la-distribucion-de-paneles.md)
- ADRs: [0010](../adr/0010-editor-motor-de-audio-reloj-y-guardado.md#revisión-para-020--layout-adaptable-y-paneles), [0015](../adr/0015-linea-de-tiempo-y-picos-de-voz.md)
- Specs: [Editor, subfase 2.1 · Criterios 1–25](../ux/06-editor.md#subfase-21--layout-adaptable-y-paneles)
- Plan: [Subfase 2.1](../versiones/0.2.0/plan-2.md#subfase-21--estabilización-del-editor) · [Reporte](../versiones/0.2.0/reporte-editor-fase-2.md)

## Objetivo

Cerrar la subfase. Verificar en Electron los criterios 1–25 de la spec y los de 0154 en la matriz de seis viewports. Guardar las capturas de revisión y escribir el informe de la subfase.

## Matriz y forma de lanzarla

| Ventana física | Escala | `--force-device-scale-factor` | `setContentSize` (DIP = CSS) |
|---|---|---|---|
| 1280 × 720 | 100 % | 1 | 1280 × 720 |
| 1280 × 720 | 125 % | 1.25 | 1024 × 576 |
| 1720 × 1440 | 100 % | 1 | 1720 × 1440 |
| 1720 × 1440 | 125 % | 1.25 | 1376 × 1152 |
| 1920 × 1080 | 100 % | 1 | 1920 × 1080 |
| 1920 × 1080 | 125 % | 1.25 | 1536 × 864 |

- Cada caso comprueba al empezar `devicePixelRatio`, `innerWidth` e `innerHeight`. Si el sistema operativo no concede el tamaño porque la pantalla del equipo es menor, el caso se **omite con una anotación** (`test.info().annotations`), no se da por bueno, y el informe indica en qué equipo se verificó cada viewport. Los seis tienen que quedar verificados en al menos un equipo antes del PR.
- CI (Linux con xvfb): ampliar la pantalla virtual del paso E2E a `-s "-screen 0 3840x2160x24"` en `.github/workflows/ci.yml` para que quepan todos los viewports. Es el único cambio de CI de la subfase.
- Casos extra fuera de la matriz:
  - Bajo mínimo: zoom 150 % en 1280 × 720 con `setZoomFactor(1.5)`.
  - Sin espacio: 1024 × 500 CSS (ventana 1280 × 625 y zoom 1,25).
  - Panel a 300, 360 y 480 px (criterio 20).

## Sin `worker/.venv`

En esta máquina no hay `worker/.venv`, así que la onda queda en «Forma de onda no disponible». Reglas:

- Los casos de layout, divisores, minimizados y persistencia **no** llaman a `esperarOnda`. Esperan a que la línea de tiempo esté montada, sea cual sea el estado de la onda. Los altos no dependen de ella.
- El ancho estable de los canvas (0154) y los casos de 0153 que necesitan picos se ejecutan donde haya entorno (CI o un equipo con `uv sync`). El informe registra dónde.
- Las capturas `defecto` de la matriz se toman con picos si hay entorno. Si no, se toman igual, se indica en el informe y se repiten con picos antes de fusionar el PR, o se deja constancia de por qué no fue posible.
- La canción de prueba es la semilla 19 con 64 líneas (`alargarLetra` de 0157), con separación completada.

## Capturas

- En `docs/ux/revision-fase-2.1/`, en PNG, con el nombre `editor-{ancho}x{alto}-{escala}-{estado}.png` (tamaño físico).
- Se usa `page.screenshot()` del área de contenido: con DPR 1,25 sale al tamaño físico, sin el marco del SO.
- Conjunto mínimo del criterio 25:
  - Seis viewports × `defecto` y `estilo`.
  - A 1280 × 720 en 100 % y 125 %: `lista-min`, `panel-min`, `timeline-min`, `todo-min`, `sync` y `foco-divisor`.
  - `panel-300` y `bajo-minimo`.
- `README.md` en esa carpeta con la tabla de capturas y lo que muestra cada una, igual que `revision-fase-1/`.
- Generarlas con un caso opcional (`SHINOBI_CAPTURAS_2_1=1`) para que no se escriban en CI.

## Informe

`docs/versiones/0.2.0/informe-fase-2.1.md`, con el formato de [informe-fase-2.md](../versiones/0.2.0/informe-fase-2.md):

- Equipo, SO, escala y monitor. Comandos para repetir.
- Resultado por criterio (spec 1–25 y 0154) y viewport.
- Viewports omitidos y dónde se verificaron.
- Estado de la onda (con o sin picos).
- Comprobación rápida de las otras vistas a 1024 × 576: Biblioteca, Ajustes, Añadir, Letra y diálogos, que ahora pueden tener ese mínimo de ventana. Sin scroll horizontal y con los diálogos alcanzables.
- Fallos de Vitest o E2E ajenos y su seguimiento. Estado de la pregunta [0051](../preguntas/0051-seguimiento-automatico-del-cabezal.md).

## Archivos

- `app/e2e/editor-layout.spec.ts` (matriz parametrizada y caso de capturas).
- `app/e2e/fixtures/editor.ts`.
- `.github/workflows/ci.yml` (solo el tamaño de pantalla de xvfb).
- `docs/ux/revision-fase-2.1/*.png` y `README.md`.
- `docs/versiones/0.2.0/informe-fase-2.1.md`.
- `docs/versiones/0.2.0/backlog.md` (estados de la subfase).

## Criterios de aceptación

- [ ] Criterios 1–24 de la spec en verde en los viewports de la matriz que aplican, y los de 0154 con DPR 1, 1,25 y 1,5. Cada viewport verificado al menos en un equipo, con constancia en el informe.
- [ ] Criterio 25: capturas completas, con nombres correctos y sin recortes.
- [ ] Suite completa sin regresiones: `npm test`, `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build` y `npx playwright test --workers=1`. Los fallos que dependan de `worker/.venv` se registran y se contrastan con CI.
- [ ] Informe escrito y backlog actualizado. Si [0051](../preguntas/0051-seguimiento-automatico-del-cabezal.md) se respondió durante la subfase, se anota y no se implementa sin tarea propia.

## Verificación

Desde `app/`: lo anterior más `SHINOBI_CAPTURAS_2_1=1 npx playwright test e2e/editor-layout.spec.ts --workers=1` para las capturas.

## Notas de implementación

- Hecho: matriz de seis viewports con `exigirViewport` (comprueba `devicePixelRatio`, `innerWidth` e `innerHeight`; si no se concede, anotación `viewport omitido` y se omite), casos extra, caso de tooltip del divisor, caso de otras vistas a 1024 × 576, caso de histéresis, caso opt-in de capturas (`SHINOBI_CAPTURAS_2_1=1`, 28 PNG), `ci.yml` con `xvfb-run -s "-screen 0 3840x2160x24"` y el informe `docs/versiones/0.2.0/informe-fase-2.1.md`.
- Corrección de la deuda de 0160 (histéresis): `MedidasEditor.barraVertical` (medida en `useDistribucion`) suma el ancho de la barra de `main` al decidir la disposición B. Prueba en `distribucion.test.ts` y E2E.
- Archivos clave: `app/e2e/editor-layout.spec.ts`, `app/src/renderer/src/vistas/editor/distribucion.ts`, `useDistribucion.ts`, `distribucion.test.ts`, `.github/workflows/ci.yml`, `docs/ux/revision-fase-2.1/`, `docs/versiones/0.2.0/informe-fase-2.1.md`, `backlog.md` y `plan-2.md`.
- Resultado: lint, typecheck, format:check y build correctos; Vitest 2003 correctas, 13 omitidas y 8 fallos `EPERM` conocidos; Playwright completo 130 correctos, 10 omitidos, 0 fallos.
- Cómo probarlo, desde `app/`: `npm run build`, `npx playwright test --workers=1` y, para las capturas, `SHINOBI_CAPTURAS_2_1=1 npx playwright test e2e/editor-layout.spec.ts --workers=1 -g "capturas de revisión"`.
- Deuda: los seis viewports se verificaron solo en un equipo (3440 × 1440); falta la confirmación en CI. Decisiones a confirmar por UX en el informe. Pregunta 0051 sigue abierta.
