# Backlog / hoja de ruta del MVP

## Fase 0 — Fundamentos (arquitecto + diseñador) — **completamente cerrada (2026-11-04)**: sin preguntas abiertas; specs UX y tareas ajustadas tras 0006
- [x] ADR 0001: Plataforma (web local / escritorio) y stack. → [Electron + worker Python con uv](adr/0001-plataforma-y-stack.md)
- [x] ADR 0002: Licencia del proyecto. → [GPL-3.0-or-later](adr/0002-licencia-del-proyecto.md)
- [x] ADR 0003: Fuente de audio (archivo local + YouTube) y riesgos legales. → [PyAV + yt-dlp/Deno](adr/0003-fuente-de-audio.md)
- [x] ADR 0004: Separación de voz/instrumental. → [audio-separator: MelBand RoFormer / MDX-Net](adr/0004-separacion-voz-instrumental.md)
- [x] ADR 0005: Servicio de letras y formato de sincronía. → [LRCLIB + manual, JSON propio](adr/0005-letras-y-formato-de-sincronia.md)
- [x] ADR 0006: Persistencia y modelo de datos (borradores). → [carpeta por canción + cancion.json](adr/0006-persistencia-y-modelo-de-datos.md)
- [x] [`docs/arquitectura.md`](arquitectura.md) (incluye "Restricciones e implicaciones para UX").
- [x] ADR 0007: Herramientas de desarrollo y calidad. → [npm + Vitest + ESLint/Prettier + Zod; uv + pytest + ruff](adr/0007-herramientas-de-desarrollo-y-calidad.md)
- [x] Preguntas de Fase 0 respondidas: [0001](preguntas/0001-firma-de-codigo-instaladores.md) (usuario: sin firma en el MVP), [0002](preguntas/0002-sincronia-por-palabra-en-mvp.md) (usuario: sincronía solo por línea en el editor), [0005](preguntas/0005-viabilidad-detalles-ux-fase-0.md) (arquitecto: viabilidad de detalles UX; ADR 0001, 0003, 0004, 0005, 0006 y `arquitectura.md` revisados).
- [x] Preguntas de Fase 0 para el diseñador UX respondidas: [0003](preguntas/0003-elegir-calidad-o-rapidez-separacion.md) (modo informativo + ajuste global) y [0004](preguntas/0004-fuentes-tipograficas-incluidas-y-del-sistema.md) (8 familias OFL incluidas, sin fuentes del sistema).
- [x] UX: [mapa de vistas](ux/00-mapa-de-vistas.md) + [sistema visual](ux/sistema-visual.md).
- [x] UX: specs de [Primer arranque](ux/01-primer-arranque.md) (incl. guía de instalación sin firma), [Biblioteca](ux/02-biblioteca.md), [Añadir canción](ux/03-anadir-cancion.md), [Progreso del pipeline](ux/04-progreso-pipeline.md), [Letra](ux/05-letra.md), [Editor](ux/06-editor.md), [Reproductor](ux/07-reproductor.md) y [Ajustes y Acerca de](ux/08-ajustes-y-acerca.md).
- [x] UX: ajustar specs tras 0001, 0002 y 0005 → [0006](preguntas/0006-ajustes-specs-ux-tras-0005.md) respondida (disenador-ux, 2026-11-04): specs 01–08 y sistema visual actualizadas; "lista incompleta" definida en `ux/02`, `ux/06` y `ux/07`. Tareas ajustadas por el arquitecto (2026-11-04): 0019 (lista incompleta y singular), 0020 (filtro *Listas* incluye incompletas) y 0006 (palabras que se mueven y se borran con su línea; ADR 0005/0006 y `arquitectura.md` revisados).

## Fase 1 — Esqueleto
Proyecto base, comunicación con el worker, persistencia de canciones, sistema visual y biblioteca. Orden sugerido (las tareas sin dependencia entre sí pueden ir en paralelo; **0005 conviene hacerla cuanto antes** porque sus datos alimentan las fases 2–3 y la UX).

| Tarea | Título | Depende de |
|-------|--------|-----------|
| [0001](tareas/0001-estructura-del-repositorio.md) | Estructura del repositorio y archivos de licencia | — |
| [0002](tareas/0002-esqueleto-app-electron.md) | Esqueleto de la app Electron con tooling | 0001 |
| [0003](tareas/0003-esqueleto-worker-python.md) | Esqueleto del worker Python: CLI, JSON Lines y `demo` | 0001 |
| [0004](tareas/0004-integracion-continua.md) | Integración continua en Windows, macOS y Linux | 0002, 0003 |
| [0005](tareas/0005-spike-separacion-y-runtime.md) | **Spike**: separación sin ffmpeg, tiempos y tamaños del runtime | 0001 |
| [0006](tareas/0006-esquemas-y-reglas-compartidas.md) | Esquemas y reglas de dominio compartidas | 0002 |
| [0007](tareas/0007-persistencia-atomica-json.md) | Escritura atómica y lectura robusta de JSON | 0006 |
| [0008](tareas/0008-servicio-de-configuracion.md) | Servicio de configuración y directorio de datos | 0007 |
| [0009](tareas/0009-biblioteca-escaneo-y-lectura.md) | Biblioteca: escaneo, índice y recuperación al arrancar (+ `semilla`) | 0007, 0008 |
| [0010](tareas/0010-biblioteca-operaciones-de-escritura.md) | Biblioteca: crear, materializar, actualizar, eliminar | 0009 |
| [0011](tareas/0011-api-ipc-y-preload.md) | API IPC tipada y preload | 0008, 0010 |
| [0012](tareas/0012-protocolo-de-medios.md) | Protocolo `shinobi-media://` | 0009 |
| [0013](tareas/0013-cliente-del-worker.md) | Cliente del worker: lanzar, JSON Lines, cancelar | 0003, 0006 |
| [0014](tareas/0014-gestor-de-trabajos.md) | Gestor de trabajos: colas, ETA, cancelación, eventos | 0010, 0011, 0013 |
| [0015](tareas/0015-sistema-visual-tokens-tipografia-iconos.md) | Sistema visual: tokens, tipografía, iconos, foco | 0002 |
| [0016](tareas/0016-componentes-base.md) | Componentes base de la interfaz | 0015 |
| [0017](tareas/0017-fuentes-de-karaoke-incluidas.md) | Fuentes de karaoke incluidas (8 familias OFL) | 0006, 0015 |
| [0018](tareas/0018-estructura-de-la-ventana-y-navegacion.md) | Estructura de la ventana, navegación y atajos | 0011, 0016 |
| [0019](tareas/0019-vista-biblioteca.md) | Vista Biblioteca: vacío, carga, tarjetas borrador/lista/dañada | 0009, 0012, 0017, 0018 |
| [0020](tareas/0020-biblioteca-filtros-busqueda-y-acciones.md) | Biblioteca: filtros, búsqueda, menú ⋯, diálogos, teclado | 0010, 0019 |

Al cerrar 0005, el arquitecto actualiza ADR 0001/0004, `arquitectura.md` (tiempos, tamaños, espacio) y el manifiesto de runtime.

## Fase 2 — Fuente
- [ ] Gestor de runtime y primer arranque (detección previa, manifiesto, uv, diagnóstico, modelo) — `ux/01`.
- [ ] Importar archivo local.
- [ ] Importar desde YouTube.

## Fase 3 — Separación de pistas
- [ ] Separación en segundo plano con progreso (vista de progreso, indicador de actividad, líneas de trabajo activo en las tarjetas, avisos al terminar).
- [ ] Ajustes: modo de separación y Acerca de — `ux/08`.

## Fase 4 — Letras
- [ ] Búsqueda de letra + entrada manual.

## Fase 5 — Editor
- [ ] Sincronización de letra (usa `moverInicioLinea` / `borrarTiemposLinea` de 0006 para la regla de palabras de `ux/06` criterio 7d).
- [ ] Estilo: fondo (sólido/degradado), color de letra, fuente.
- [ ] Guardado de borrador / marcar como lista.

## Fase 6 — Reproductor
- [ ] Reproducción a pantalla completa desde la biblioteca.
