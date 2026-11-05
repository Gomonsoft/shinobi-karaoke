# 0071 — Panel de actividad desplegable (y deuda del marco: parpadeo del título y doble `listar()`)
- Estado: Hecha
- Paso del pipeline: transversal (1 y 2)
- Depende de: 0059, 0067, 0068 (diálogos de cancelar); 0020 (Hecha: indicador informativo y líneas en vivo)
- ADRs: —
- Spec UX: docs/ux/04-progreso-pipeline.md §2 (panel de actividad; textos de fase según `preguntas/0020` §2 y §4) y criterios 11, 18 y 19; docs/ux/02-biblioteca.md (`bib.paso.modelo`, `bib.paso.reintento.*`)
- Cuándo: en paralelo con 0069, 0070 y 0072

## Objetivo
Convertir el indicador de actividad de la barra superior (`navegacion/IndicadorActividad.tsx`, hoy solo informativo) en el botón con panel desplegable de `ux/04` §2.

## Criterios de aceptación
- [x] Botón visible solo con trabajos en curso o en cola: spinner + `act.boton` ("1 en curso", "1 en curso · 2 en cola"). Al pulsarlo se abre un panel de 360 px (portal, como el menú de 0026), titulado `act.titulo`.
- [x] Una fila por trabajo: icono de estado, título de la canción y texto de la fase.
  - "Separando 42 %", "Descargando 80 %", "En cola para separar", "Actualizando el descargador…";
  - los mismos textos que la tarjeta: "{título} — Descargando el modelo 34 %" (barra determinada, `bib.paso.modelo`), "{título} — Reintentando la separación…" (indeterminada, `bib.paso.reintento.memoria`) y "{título} — Reintentando en {n} s…" (sin barra, con cuenta atrás, `bib.paso.reintento.red`).
  - Barra con ETA abreviada (`bib.eta`) y botones [Ir] (abre la vista de progreso de esa canción) y [✕] (en cola, cancela sin diálogo; en curso, también durante la descarga del modelo o la espera de un reintento, el diálogo de 0045/0068 según el paso).
- [x] Teclado y foco: se abre con Enter/Espacio y se recorre con las flechas. Esc o un clic fuera lo cierran y el foco vuelve al botón. `aria-expanded` y `aria-controls` en el botón.
- [x] Al terminar todos los trabajos, el botón muestra "✓ Terminado" (`act.terminado`) 4 s y desaparece. Si el panel estaba abierto, se cierra.
- [x] **Deuda del marco** (0018, backlog "Fase 1 → Fase 3"):
  - el título de la Biblioteca no parpadea mientras responde `listar()`;
  - `listar()` se llama una sola vez al montar `App` + `Biblioteca`: un único estado compartido o un contexto.
  Anotar en las notas cómo se resolvió.
- [x] "Volver a Calidad" de Ajustes **no** aparece en el panel: es una operación del runtime, no un trabajo (`preguntas/0021` §2).
- [x] Tests de componente: visibilidad, texto del botón, filas por fase (incluidas la descarga del modelo y los dos reintentos), Ir, ✕ en cola y en curso, teclado, "Terminado" 4 s (reloj falso), una sola llamada a `listar()`.

## Notas de implementación
- **Panel**: `navegacion/IndicadorActividad.tsx` (botón con `aria-expanded`/`aria-controls`, panel de 360 px en portal bajo el botón, filas `FilaActividad`, diálogos `DialogoCancelarDescarga`/`DialogoCancelarSeparacion` de 0067/0068 reutilizados). `navegacion/actividad.ts` (`faseDeTrabajo`) decide texto y barra por fase: cola, descarga, separación, `descargando_modelo`, reintento de memoria (indeterminada) y de red (cuenta atrás con `useCuentaAtras`, sin barra) y actualización de yt-dlp; ETA corta con `textoEta` de la tarjeta. Las flechas/Inicio/Fin recorren [Ir] y [✕]; Esc o clic fuera cierran (con un diálogo abierto el clic fuera se ignora); el panel se cierra si no quedan trabajos y entonces solo se ve "Terminado" 4 s. "Volver a Calidad" no aparece (no es un trabajo).
- **Deuda del marco**: `useBiblioteca()` se eleva a `App` (`Aplicacion`) y se comparte con `BibliotecaContexto` (en `useBiblioteca.ts`). `listar()` se llama una vez; la barra (`bibliotecaVacia`), el panel (títulos) y `Biblioteca` leen el mismo estado, que además persiste al navegar (sin esqueletos ni cambio de título al volver). La barra mantiene el botón "Añadir canción" mientras carga o si hay error. `Biblioteca` sin proveedor (tests sueltos) usa su propia lectura.
- **Pruebas**: `navegacion/IndicadorActividad.test.tsx` (visibilidad, texto, filas por fase, Ir, ✕ en cola y en curso, teclado, Terminado) y `App.test.tsx` (una sola llamada a `listar()`, panel integrado, Terminado 4 s ya existente).
- **Deuda**: la línea de la tarjeta (`tarjeta.ts`) aún no muestra `bib.paso.modelo` ni `bib.paso.reintento.memoria` (el panel sí); `faseDeTrabajo` podría compartirse con ella cuando se aborde. Los trabajos sin canción (actualización de yt-dlp, si los hubiera) se mostrarían como "Canción".
