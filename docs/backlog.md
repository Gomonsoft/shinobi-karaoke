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

## Fase 1 — Esqueleto — **cerrada (2026-11-04)**, salvo mediciones pendientes en NVIDIA/Windows/Linux
Proyecto base, comunicación con el worker, persistencia de canciones, sistema visual y biblioteca. 20 de 20 tareas hechas. Spike 0005 cerrado con datos medidos en un MacBook Air M1 8 GB; preguntas [0009](preguntas/0009-audio-separator-exige-ffmpeg.md) (parche + soundfile, sin ffmpeg) y [0010](preguntas/0010-apple-silicon-cpu-mas-rapida-que-mps.md) (Apple Silicon en CPU) respondidas; ADR 0001–0004 y `arquitectura.md` actualizados. Abierta para el **usuario**: [0012](preguntas/0012-licencia-no-declarada-del-modelo-rapido.md) (licencia no declarada del modelo Rápido; bloquea solo la elección del modelo Rápido en la Fase 3). Revisión técnica de cierre: decisiones de los programadores aceptadas y recogidas en ADR 0003, 0005 y 0006; seguridad en el nuevo [ADR 0008](adr/0008-seguridad-de-electron-y-protocolos-propios.md); textos y comportamientos de UI no definidos por la spec enviados a UX en [0007](preguntas/0007-textos-y-comportamientos-de-ui-no-definidos-fase-1.md) (respondida por disenador-ux el mismo día, con revisión visual en `ux/revision-fase-1/`); sus cambios de código ([pregunta 0008](preguntas/0008-ajustes-ui-tras-revision-fase-1.md), respondida) son las tareas 0026 y 0027.

| Tarea | Título | Depende de | Estado |
|-------|--------|-----------|--------|
| [0001](tareas/0001-estructura-del-repositorio.md) | Estructura del repositorio y archivos de licencia | — | Hecha |
| [0002](tareas/0002-esqueleto-app-electron.md) | Esqueleto de la app Electron con tooling | 0001 | Hecha |
| [0003](tareas/0003-esqueleto-worker-python.md) | Esqueleto del worker Python: CLI, JSON Lines y `demo` | 0001 | Hecha |
| [0004](tareas/0004-integracion-continua.md) | Integración continua en Windows, macOS y Linux | 0002, 0003 | Hecha (sin ejecución real en GitHub → 0024) |
| [0005](tareas/0005-spike-separacion-y-runtime.md) | **Spike**: separación sin ffmpeg, tiempos y tamaños del runtime | 0001 | Hecha (solo macOS arm64; resto → mediciones pendientes) |
| [0006](tareas/0006-esquemas-y-reglas-compartidas.md) | Esquemas y reglas de dominio compartidas | 0002 | Hecha |
| [0007](tareas/0007-persistencia-atomica-json.md) | Escritura atómica y lectura robusta de JSON | 0006 | Hecha |
| [0008](tareas/0008-servicio-de-configuracion.md) | Servicio de configuración y directorio de datos | 0007 | Hecha |
| [0009](tareas/0009-biblioteca-escaneo-y-lectura.md) | Biblioteca: escaneo, índice y recuperación al arrancar (+ `semilla`) | 0007, 0008 | Hecha |
| [0010](tareas/0010-biblioteca-operaciones-de-escritura.md) | Biblioteca: crear, materializar, actualizar, eliminar | 0009 | Hecha |
| [0011](tareas/0011-api-ipc-y-preload.md) | API IPC tipada y preload | 0008, 0010 | Hecha |
| [0012](tareas/0012-protocolo-de-medios.md) | Protocolo `shinobi-media://` | 0009 | Hecha (CORS a restringir → 0022) |
| [0013](tareas/0013-cliente-del-worker.md) | Cliente del worker: lanzar, JSON Lines, cancelar | 0003, 0006 | Hecha |
| [0014](tareas/0014-gestor-de-trabajos.md) | Gestor de trabajos: colas, ETA, cancelación, eventos | 0010, 0011, 0013 | Hecha |
| [0015](tareas/0015-sistema-visual-tokens-tipografia-iconos.md) | Sistema visual: tokens, tipografía, iconos, foco | 0002 | Hecha |
| [0016](tareas/0016-componentes-base.md) | Componentes base de la interfaz | 0015 | Hecha |
| [0017](tareas/0017-fuentes-de-karaoke-incluidas.md) | Fuentes de karaoke incluidas (8 familias OFL) | 0006, 0015 | Hecha |
| [0018](tareas/0018-estructura-de-la-ventana-y-navegacion.md) | Estructura de la ventana, navegación y atajos | 0011, 0016 | Hecha |
| [0019](tareas/0019-vista-biblioteca.md) | Vista Biblioteca: vacío, carga, tarjetas borrador/lista/dañada | 0009, 0012, 0017, 0018 | Hecha |
| [0020](tareas/0020-biblioteca-filtros-busqueda-y-acciones.md) | Biblioteca: filtros, búsqueda, menú ⋯, diálogos, teclado (+ indicador de actividad) | 0010, 0019 | Hecha |

Hecho tras cerrar 0005: ADR 0001/0002/0003/0004 y `arquitectura.md` actualizados; el borrador del manifiesto está en la tarea 0005 §9 (el archivo real se genera en la Fase 2).

**Mediciones pendientes (no bloquean la Fase 2; necesarias antes de publicar)**: NVIDIA/CUDA en Windows y Linux (factor Calidad, VRAM, MB descargados y disco del venv); Windows y Linux sin GPU (factor Rápido/Calidad en CPU x86, `where`/`which ffmpeg` vacío, `taskkill /T /F`); Apple Silicon M2–M4 Pro/Max (CPU frente a MPS); escucha humana FLAC vs WAV y de la calidad con música actual. Cómo medirlo: tarea 0005, "Sin medir". El test "sin ffmpeg en el PATH" en los 3 SO va en la CI (0024 o primera tarea de la Fase 3).

### Correcciones de la revisión de cierre (antes de empezar la Fase 2; pueden ir en paralelo con 0005)
| Tarea | Título | Depende de | Estado |
|-------|--------|-----------|--------|
| [0026](tareas/0026-menu-contextual-en-portal-y-con-volteo.md) | **Primero (bloqueante B1)**: menú ⋯ en portal, con volteo hacia arriba | 0016, 0020 | Pendiente |
| [0027](tareas/0027-ajustes-de-biblioteca-tras-revision-visual.md) | Ajustes de la Biblioteca tras la revisión visual (I1–I4, miniatura, M1, M3) | 0019, 0020, 0026 | Pendiente |
| [0021](tareas/0021-endurecimiento-de-electron.md) | Endurecimiento de Electron: navegación con lista blanca, permisos, instancia única, remitente IPC, cierre acotado, `userData` aparte | 0011, 0018 | Pendiente |
| [0022](tareas/0022-renderer-en-protocolo-propio-y-cors-restringido.md) | Renderer en `shinobi-app://` y CORS exacto en `shinobi-media://` | 0012, 0021 | Pendiente |
| [0023](tareas/0023-papelera-inyectable-en-e2e.md) | Papelera inyectable en E2E (no tocar la papelera real) | 0020 | Pendiente |
| [0024](tareas/0024-ci-integracion-del-worker-en-los-tres-so.md) | CI: integración real con el worker en los 3 SO (`taskkill`), `format:check`, primera ejecución en GitHub | 0004, 0013, 0014 | Pendiente |

### Deuda técnica menor de la Fase 1 (sin tarea propia; se resuelve en la fase indicada)
- Revisión visual (0015–0020): la Biblioteca está revisada (`ux/revision-fase-1/`, tareas 0026–0027); falta otra pasada de UX sobre el Muestrario (`npm run dev`) y los esqueletos de carga (Fase 1) y sobre el indicador de actividad con trabajos reales (Fase 3).
- Componentes (0016): el diálogo no marca el resto de la app como `inert`; el tooltip no se reposiciona en los bordes; el menú sin búsqueda por letra → **Fase 5** (el editor es la vista que más los usa).
- Marco (0018): parpadeo del título de la Biblioteca hasta que responde `listar()`, y doble `listar()` (`App` y `Biblioteca`) → **Fase 3** (al tocar el indicador de actividad); zoom sin persistir → post-MVP.
- Semilla (0009) sin miniaturas → **Fase 2** (YouTube), junto con un E2E de la miniatura vía `shinobi-media://`.
- `jsonAtomico` (0007): si el principal está corrupto, el siguiente guardado podría copiarlo a `.bak` → aceptado (la lectura recupera y reescribe antes); revisar si aparece en pruebas de la Fase 5 (autoguardado).
- `config.json.danado` (0008) se sobrescribe si ya existía → aceptado en el MVP.
- Orden de `paradas` del degradado no validado (0006) → **Fase 5** (el editor de estilo las mantiene ordenadas; añadir la validación allí).
- E2E de eventos IPC y del indicador de actividad (0011, 0014, 0020) → **Fase 3**, con trabajos reales.

## Fase 2 — Fuente
- [ ] Gestor de runtime y primer arranque (detección previa, manifiesto con los datos de la tarea 0005 §9, uv, `uv cache clean` tras instalar, versiones fijadas por perfil incl. `audioread` explícito, borrar `*.partial` de `modelos/`, diagnóstico, modelo) — `ux/01`. Incluye: `resolverLanzador` en modo producción y ruta real del venv/código del worker (deuda de 0013; hoy `index.ts` usa siempre el modo desarrollo); detectar y **reutilizar** un runtime y modelos ya válidos si `config.json` se recreó desde cero (ADR 0006, revisión 2026-11-04); sustituir el marcador de Primer arranque y su botón provisional (0018).
- [ ] Importar archivo local (incluye la importación real del archivo arrastrado a la Biblioteca, 0020).
- [ ] Importar desde YouTube (miniatura convertida a JPEG con PyAV, ADR 0003 revisión 2026-11-04; semilla y E2E con miniatura).

## Fase 3 — Separación de pistas
- [ ] Separación en segundo plano con progreso (interfaz `Separador` con el parche sin ffmpeg y `use_soundfile=True` de `preguntas/0009`, CPU forzada en Apple Silicon de `preguntas/0010`, renombrado de stems, test "sin ffmpeg en el PATH"; modelo Rápido según `preguntas/0012`; vista de progreso, **panel** del indicador de actividad —el indicador informativo y las líneas en vivo ya están, 0020—, avisos al terminar: toasts de fin/error y notificaciones del sistema).
- [ ] Trabajos (deuda de 0014/0019/0020): reintentos automáticos según `reintentable` (`arquitectura.md` §6), estimación previa "Tardará unos N minutos", "Reintentar" que relanza el paso (hoy navega como "Continuar"), "Cancelar trabajo" y "Re-separar pistas" en el menú ⋯, diálogo de cierre con trabajos (`trabajos.hayPendientes()` ya existe).
- [ ] Ajustes: modo de separación y Acerca de — `ux/08`.

## Fase 4 — Letras
- [ ] Búsqueda de letra + entrada manual (conversores con la normalización de ADR 0005, revisión 2026-11-04: inicios repetidos +1 ms, ids únicos, `palabras: null`).

## Fase 5 — Editor
- [ ] Sincronización de letra (usa `moverInicioLinea` / `borrarTiemposLinea` de 0006 para la regla de palabras de `ux/06` criterio 7d).
- [ ] Estilo: fondo (sólido/degradado), color de letra, fuente.
- [ ] Guardado de borrador / marcar como lista (incluye resalte 2 s y toast al volver del editor a la Biblioteca, deuda de 0019/0020).

## Fase 6 — Reproductor
- [ ] Reproducción a pantalla completa desde la biblioteca.

## Fase 7 — Empaquetado y distribución
| Tarea | Título | Depende de | Estado |
|-------|--------|-----------|--------|
| [0025](tareas/0025-empaquetado-e-instaladores.md) | Empaquetado: electron-builder, *fuses* (ADR 0008) e instaladores sin firma | 0022, 0024 (+ gestor de runtime, Fase 2) | Pendiente |
