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
Proyecto base, comunicación con el worker, persistencia de canciones, sistema visual y biblioteca. 20 de 20 tareas hechas. Spike 0005 cerrado con datos medidos en un MacBook Air M1 8 GB; preguntas [0009](preguntas/0009-audio-separator-exige-ffmpeg.md) (parche + soundfile, sin ffmpeg) y [0010](preguntas/0010-apple-silicon-cpu-mas-rapida-que-mps.md) (Apple Silicon en CPU) respondidas; ADR 0001–0004 y `arquitectura.md` actualizados. Respondida por el **usuario**: [0012](preguntas/0012-licencia-no-declarada-del-modelo-rapido.md) (opción C: Rápido provisional, licencia no declarada, pedir aclaración a UVR). Revisión técnica de cierre: decisiones de los programadores aceptadas y recogidas en ADR 0003, 0005 y 0006; seguridad en el nuevo [ADR 0008](adr/0008-seguridad-de-electron-y-protocolos-propios.md); textos y comportamientos de UI no definidos por la spec enviados a UX en [0007](preguntas/0007-textos-y-comportamientos-de-ui-no-definidos-fase-1.md) (respondida por disenador-ux el mismo día, con revisión visual en `ux/revision-fase-1/`); sus cambios de código ([pregunta 0008](preguntas/0008-ajustes-ui-tras-revision-fase-1.md), respondida) son las tareas 0026 y 0027.

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

**Mediciones pendientes (no bloquean la Fase 2; necesarias antes de publicar)**: NVIDIA/CUDA en Windows y Linux (factor Calidad, VRAM, MB descargados y disco del venv); Windows y Linux sin GPU (factor Rápido/Calidad en CPU x86, `where`/`which ffmpeg` vacío, `taskkill /T /F`); Apple Silicon M2–M4 Pro/Max (CPU frente a MPS); escucha humana FLAC vs WAV y de la calidad con música actual. Cómo medirlo: tarea 0005, "Sin medir". El test "sin ffmpeg en el PATH" en los 3 SO va en la CI: tareas 0061/0062.

### Correcciones de la revisión de cierre (antes de empezar la Fase 2; pueden ir en paralelo con 0005)
| Tarea | Título | Depende de | Estado |
|-------|--------|-----------|--------|
| [0026](tareas/0026-menu-contextual-en-portal-y-con-volteo.md) | **Primero (bloqueante B1)**: menú ⋯ en portal, con volteo hacia arriba | 0016, 0020 | Hecha |
| [0027](tareas/0027-ajustes-de-biblioteca-tras-revision-visual.md) | Ajustes de la Biblioteca tras la revisión visual (I1–I4, miniatura, M1, M3) | 0019, 0020, 0026 | Hecha |
| [0021](tareas/0021-endurecimiento-de-electron.md) | Endurecimiento de Electron: navegación con lista blanca, permisos, instancia única, remitente IPC, cierre acotado, `userData` aparte | 0011, 0018 | Hecha |
| [0022](tareas/0022-renderer-en-protocolo-propio-y-cors-restringido.md) | Renderer en `shinobi-app://` y CORS exacto en `shinobi-media://` | 0012, 0021 | Hecha |
| [0023](tareas/0023-papelera-inyectable-en-e2e.md) | Papelera inyectable en E2E (no tocar la papelera real) | 0020 | Hecha |
| [0024](tareas/0024-ci-integracion-del-worker-en-los-tres-so.md) | CI: integración real con el worker en los 3 SO (`taskkill`), `format:check`, primera ejecución en GitHub | 0004, 0013, 0014 | Hecha |

### Deuda técnica menor de la Fase 1 (sin tarea propia; se resuelve en la fase indicada)
- Revisión visual (0015–0020): la Biblioteca está revisada (`ux/revision-fase-1/`, tareas 0026–0027); falta otra pasada de UX sobre el Muestrario (`npm run dev`) y los esqueletos de carga (Fase 1) y sobre el indicador de actividad con trabajos reales (Fase 3).
- Componentes (0016): el diálogo no marca el resto de la app como `inert`; el tooltip no se reposiciona en los bordes; el menú sin búsqueda por letra → **Fase 5** (el editor es la vista que más los usa).
- Marco (0018): parpadeo del título de la Biblioteca hasta que responde `listar()`, y doble `listar()` (`App` y `Biblioteca`) → **Fase 3** (al tocar el indicador de actividad); zoom sin persistir → post-MVP.
- Semilla (0009) sin miniaturas → **Fase 2**: tarea [0052](tareas/0052-semilla-con-miniaturas-y-e2e-de-miniatura.md).
- `jsonAtomico` (0007): si el principal está corrupto, el siguiente guardado podría copiarlo a `.bak` → aceptado (la lectura recupera y reescribe antes); revisar si aparece en pruebas de la Fase 5 (autoguardado).
- `config.json.danado` (0008) se sobrescribe si ya existía → aceptado en el MVP.
- Orden de `paradas` del degradado no validado (0006) → **Fase 5** (el editor de estilo las mantiene ordenadas; añadir la validación allí).
- E2E de eventos IPC y del indicador de actividad (0011, 0014, 0020) → **Fase 3**, con trabajos reales.

## Fase 2 — Fuente — desglosada (2026-11-04): tareas 0028–0054
Decisiones de detalle en el nuevo [ADR 0009](adr/0009-gestor-de-runtime-y-dobles-de-prueba.md) (requisitos fijados por plataforma × perfil, manifiesto, `runtime/`, descarga de modelos en main, reutilización, consultas interactivas fuera de las colas, dobles de prueba) y en la revisión de la Fase 2 del [ADR 0003](adr/0003-fuente-de-audio.md) (un solo trabajo `descargar-youtube`, miniatura JPEG desde `info-youtube`). Modelo Rápido provisional con licencia no declarada ([0012](preguntas/0012-licencia-no-declarada-del-modelo-rapido.md), opción C; **acción del usuario**: abrir la consulta a UVR, texto propuesto en su "Seguimiento"). [0013](preguntas/0013-huecos-ux-de-la-fase-2.md) respondida por el diseñador UX (B0, B6, yt-dlp automático, descarga pendiente, sin miniatura) y [0014](preguntas/0014-interrupcion-de-la-actualizacion-de-yt-dlp-y-plataformas-emuladas.md) respondida por el arquitecto: cerrojo de yt-dlp con reparación tras cierre, plataforma real (Rosetta → `darwin-arm64-mps`, Windows on ARM → B6) y sustitución de la fuente de la misma canción. Ver ADR 0009/0003/0006 (Revisiones). Tareas ajustadas: 0031, 0034, 0037, 0040, 0042, 0049, 0050, 0051, 0053 (0045, en curso, solo con una nota); nueva 0054. FFmpeg de PyAV con x264/x265 (GPL) compatible con GPL-3.0-or-later; se comprueban todas las ruedas en 0040 (ADR 0002, Revisiones).

**Plataformas (respuesta a [0015](preguntas/0015-macos-intel-sin-pytorch-y-macos-minimo.md), 2026-11-04)**: Apple Silicon exige **macOS 14+** (B6 por debajo); **Mac Intel sin runtime** (PyTorch ≥ 2.3 no existe para macOS x86_64): no compatible y solo DMG arm64, provisional hasta [0016](preguntas/0016-mac-intel-fuera-del-mvp.md) (**usuario**; recomendada: fuera del MVP). Textos de requisitos y B6 → [0017](preguntas/0017-textos-de-requisitos-macos-14-y-mac-intel.md) (**diseñador UX**). Ajustadas 0025, 0034 (`--index-strategy unsafe-best-match`, macOS < 14), 0037, 0040; nota para 0031 (en curso) en la respuesta de 0015.

**Pruebas sin red en CI**: audio generado en las pruebas; runtime falso (`SHINOBI_RUNTIME_FALSO`) y doble de yt-dlp (`SHINOBI_YTDLP_FALSO`), ignorados en la app empaquetada. Las pruebas que necesitan red o descargas grandes llevan el marcador `red`/`pesado` (pytest) o `SHINOBI_TESTS_RED=1` (Vitest/Playwright), se omiten por defecto y se ejecutan en el workflow manual de 0040.

- [ ] Gestor de runtime y primer arranque — `ux/01`: 0028–0040 (`resolverLanzador` en producción en 0035; reutilizar runtime tras recrear `config.json` en 0035; marcador de Primer arranque y su botón provisional sustituidos en 0037).
- [ ] Importar archivo local (incluida la importación real del archivo arrastrado a la Biblioteca, 0020): 0041–0046.
- [ ] Importar desde YouTube (miniatura JPEG con PyAV; semilla y E2E con miniatura): 0047–0053.

| Tarea | Título | Depende de | Paralelizable | Estado |
|-------|--------|-----------|---------------|--------|
| [0028](tareas/0028-worker-dependencias-y-audio-de-prueba.md) | Worker: dependencias de la Fase 2, marcadores `red`/`pesado` y audio de prueba generado | 0003, 0024 | Sí, con 0029, 0043, 0052 | Hecha |
| [0029](tareas/0029-contratos-compartidos-de-la-fase-2.md) | Contratos compartidos: manifiesto, resultados del worker, URL de YouTube, errores, config | 0006, 0013 | Sí, con 0028, 0043, 0052 | Hecha |
| [0030](tareas/0030-manifiesto-de-runtime-y-requisitos-por-perfil.md) | Manifiesto de runtime y requisitos bloqueados por plataforma y perfil | 0028, 0029 | Sí, con 0032, 0041, 0047 | Hecha (sin `darwin-x64-cpu`, `preguntas/0015`) |
| [0031](tareas/0031-deteccion-previa-de-hardware-y-espacio.md) | Runtime: detección previa de hardware y espacio libre | 0029, 0030 | Sí, con 0032, 0033 | Hecha |
| [0032](tareas/0032-worker-comando-diagnostico.md) | Worker: comando `diagnostico` | 0028, 0029 | Sí, con 0030, 0031, 0033, 0041, 0047 | Hecha |
| [0033](tareas/0033-descarga-y-verificacion-de-modelos.md) | Runtime: descarga reanudable de modelos con SHA-256 y limpieza de `*.partial` | 0029, 0030 | Sí, con 0031, 0032 | Hecha |
| [0034](tareas/0034-gestor-de-runtime-instalacion-con-uv.md) | Gestor de runtime: instalación con uv, progreso, pausa y errores | 0013, 0031, 0032, 0033 | No (núcleo del bloque) | Hecha |
| [0035](tareas/0035-reutilizacion-del-runtime-y-lanzador-de-produccion.md) | Runtime: comprobación al arrancar, reutilización y `resolverLanzador` en producción | 0034 | Sí, con 0036 | Hecha |
| [0036](tareas/0036-api-ipc-del-runtime-y-solicitud-de-cierre.md) | API IPC del runtime, solicitud de cierre y menú bloqueado en el primer arranque | 0011, 0021, 0034 | Sí, con 0035 | Hecha |
| [0037](tareas/0037-vista-primer-arranque.md) | Vista Primer arranque B1–B5 (sustituye el marcador) | 0016, 0018, 0036, 0038 | Sí, con 0035, 0040 | Hecha |
| [0038](tareas/0038-dialogo-acerca-de-y-licencias.md) | Bloque "Acerca de" y diálogos de licencias (reutilizable en Ajustes) | 0011, 0016 | Sí, en cualquier momento | Hecha |
| [0039](tareas/0039-e2e-primer-arranque-con-runtime-falso.md) | E2E del primer arranque con runtime falso (sin red) | 0035, 0037 | Sí, con 0040 | Hecha |
| [0040](tareas/0040-ci-manual-instalacion-real-del-runtime.md) | CI manual: instalación real del runtime en los 3 SO y mediciones (**red**) | 0030, 0035 | Sí, con 0037, 0039 | Hecha |
| [0041](tareas/0041-worker-importar-archivo.md) | Worker: `importar-archivo` (PyAV → `mezcla.flac` 16 bits, sonoridad, metadatos) | 0028, 0029 | Sí, con todo el bloque de runtime y con 0047 | Hecha |
| [0042](tareas/0042-main-importacion-de-archivo-local.md) | Main: importación de archivo local (`.importando`, materializar) | 0010, 0011, 0013, 0041 | Sí, con 0043, 0048 | Hecha |
| [0043](tareas/0043-cabecera-del-espacio-de-cancion-y-stepper.md) | Cabecera del espacio de canción con stepper | 0016, 0018, 0019 | Sí, en cualquier momento | Hecha |
| [0044](tareas/0044-vista-anadir-cancion-archivo-local.md) | Vista Añadir canción: archivo local y arrastrar a la Biblioteca | 0042, 0043 (+ 0036 para la estimación) | Sí, con 0045 | Hecha |
| [0045](tareas/0045-vista-progreso-subpasos-de-fuente.md) | Vista de progreso: subpasos de la fuente | 0014, 0020, 0043 | Sí, con 0044 | Hecha |
| [0046](tareas/0046-e2e-importar-archivo-local.md) | E2E: importar un archivo local (elegir y arrastrar) | 0044, 0045 | Sí, con el bloque de YouTube | Hecha |
| [0047](tareas/0047-worker-info-youtube.md) | Worker: `info-youtube`, miniatura JPEG y adaptador `FuenteYoutube` | 0028, 0029 | Sí, con 0041 y el bloque de runtime | Hecha |
| [0048](tareas/0048-worker-descargar-youtube.md) | Worker: `descargar-youtube` (descarga + normalización) | 0041, 0047 | Sí, con 0042 | Hecha |
| [0049](tareas/0049-main-servicio-de-youtube.md) | Main: servicio de YouTube (consulta, aviso, crear, encolar, reintentar) | 0014, 0042, 0048 | Sí, con 0044, 0045 | Hecha |
| [0050](tareas/0050-actualizacion-de-yt-dlp.md) | Actualización de yt-dlp: semanal y reintento tras bloqueo | 0035, 0049 | Sí, con 0051 | Hecha |
| [0051](tareas/0051-vista-anadir-cancion-youtube.md) | Vista Añadir canción: YouTube | 0044, 0049 | Sí, con 0050 | Hecha |
| [0052](tareas/0052-semilla-con-miniaturas-y-e2e-de-miniatura.md) | Semilla con miniaturas y E2E de la miniatura vía `shinobi-media://` | 0009, 0012, 0019, 0022 | Sí, en cualquier momento | Hecha |
| [0053](tareas/0053-e2e-importar-desde-youtube-sin-red.md) | E2E: YouTube sin red (doble de yt-dlp) + prueba opcional con red | 0045, 0050, 0051, 0052 | No (cierra el bloque) | Hecha |
| [0054](tareas/0054-informacion-para-soporte-completa.md) | "Copiar información para soporte" con arquitectura real, yt-dlp y `sin instalar` | 0038, 0031, 0050 | Sí, con 0051/0053 | Hecha |

Orden sugerido con dos o tres programadores: **(A) runtime** 0028/0029 → 0030 → 0031 ‖ 0032 ‖ 0033 → 0034 → 0035 ‖ 0036 → 0037 → 0039 (+ 0040); **(B) archivo local** 0041 → 0042 → 0044 ‖ 0045 → 0046 (0043 y 0038 en cualquier hueco); **(C) YouTube** 0047 → 0048 → 0049 → 0050 ‖ 0051 → 0053 (0052 en cualquier hueco; 0054 tras 0050). Los bloques B y C solo necesitan de A los contratos (0028, 0029) hasta 0050, que usa 0035.

## Fase 3 — Separación de pistas — **cerrada (2026-11-05)**: tareas 0055–0076 ([informe](informe-fase-3.md)); 0058 y 0062 siguen en curso hasta ejecutar `runtime-real` en GitHub
**Decisión del usuario ([0018](preguntas/0018-datos-reales-del-runtime-y-espacio-en-linux.md), 2026-11-05)**:
- **Calidad en todos los perfiles**, también solo CPU.
- **Rápido** solo con el consentimiento explícito del usuario (aviso de licencia no declarada, [0012](preguntas/0012-licencia-no-declarada-del-modelo-rapido.md)), solo tras un fallo definitivo de Calidad (no elegible en Ajustes, que permite volver a Calidad); nunca de forma automática.
- **4 GB** de espacio en CPU.

Revisiones 2026-11-05 en ADR [0004](adr/0004-separacion-voz-instrumental.md), [0006](adr/0006-persistencia-y-modelo-de-datos.md) y [0009](adr/0009-gestor-de-runtime-y-dobles-de-prueba.md). Detalles de implementación de la separación en la **Revisión 2026-11-05 bis** del ADR 0004 (salida en `pistas.tmp/`, modelo que falta descargado dentro del trabajo, reintentos por memoria, `PROCESO_TERMINADO`, progreso interpolado, "Rápido pendiente", pruebas sin PyTorch en la CI normal). UX respondida: [0019](preguntas/0019-calidad-por-defecto-y-rapido-con-consentimiento.md) y [0020](preguntas/0020-huecos-ux-de-la-separacion-fase-3.md) (diseñador UX; `ux/01`, `02`, `04` y `08` actualizadas). [0021](preguntas/0021-detalles-tecnicos-de-la-oferta-de-rapido-y-volver-a-calidad.md) respondida por el arquitecto. **Sin preguntas abiertas en la fase.**

**Pruebas**: la CI normal nunca instala PyTorch ni descarga modelos. Usa el separador falso (`SHINOBI_SEPARADOR_FALSO`) y un test de contrato del adaptador con el PATH sin ffmpeg en los 3 SO (0061/0062). El modelo real solo se usa en las pruebas `pesado` del workflow manual `runtime-real` (0062).

| Tarea | Título | Depende de | ¿Paralelizable? | Estado |
|-------|--------|-----------|-----------------|--------|
| [0055](tareas/0055-manifiesto-espacio-requerido-y-bytes-medidos.md) | Manifiesto: `espacio_requerido` 4 GB en CPU, `bytes_disco` medidos, `bytes_cache` para el progreso | 0030, 0034, 0040 | **Antes de la Fase 3**; ‖ 0056 | Hecha |
| [0056](tareas/0056-modelo-calidad-por-defecto-y-modo-de-separacion.md) | Modelo Calidad por defecto; sin elección de modo; `rapido_aceptado` | 0029, 0034, 0035 | **Antes de la Fase 3**; ‖ 0055 | Hecha |
| [0057](tareas/0057-alternativa-al-modelo-rapido-con-consentimiento.md) | Alternativa al modelo Rápido con consentimiento (B4, `aviso-rapido`, API reutilizable, "Rápido pendiente", "Volver a Calidad") | 0056 | Al inicio; ‖ 0059 | Hecha |
| [0058](tareas/0058-runtime-real-bytes-de-red-pico-de-disco-y-calidad-en-cpu.md) | `runtime-real`: bytes reales de descarga, pico de disco y Calidad en CPU | 0040, 0055, 0056 | Sí, durante toda la fase (coordinar con 0062) | En curso (falta `runtime-real` en GitHub) |
| [0059](tareas/0059-contratos-compartidos-de-la-fase-3.md) | Contratos compartidos: protocolo de `separar`, IPC de separación, fases y reintentos | 0055, 0056 | ‖ 0057; desbloquea el resto | Hecha |
| [0060](tareas/0060-worker-comando-separar-y-separador-falso.md) | Worker: comando `separar`, interfaz `Separador` y separador falso | 0059 | ‖ 0063, 0064, 0067 | Hecha |
| [0061](tareas/0061-worker-adaptador-audio-separator.md) | Worker: adaptador audio-separator (sin ffmpeg, soundfile, CPU en Apple Silicon, stems, `tqdm`) + test de contrato | 0060 | ‖ 0065 | Hecha |
| [0062](tareas/0062-ci-separacion-sin-ffmpeg-y-prueba-pesada-real.md) | CI: "sin ffmpeg en el PATH" en los 3 SO y prueba `pesado` real en `runtime-real` | 0061, 0056 | ‖ 0065–0068 | En curso (falta `runtime-real` en GitHub) |
| [0063](tareas/0063-gestor-reintentos-automaticos.md) | Gestor: reintentos automáticos según `reintentable`, fase `reintentando`, `PROCESO_TERMINADO` y reintento de red de YouTube | 0059 | ‖ 0060, 0064 | Hecha |
| [0064](tareas/0064-progreso-interpolado-y-eta-con-factor.md) | Progreso interpolado y ETA con el factor del manifiesto o el medido | 0059 | ‖ 0060, 0063 | Hecha |
| [0065](tareas/0065-main-servicio-de-separacion.md) | Main: servicio de separación (cola pesada, `pistas.tmp`, factor medido, limpieza, auto-encolar) | 0056, 0059, 0060, 0063, 0064 | ‖ 0061, 0062, 0067, 0068 | Hecha |
| [0066](tareas/0066-separacion-reintentos-modelo-y-oferta-de-rapido.md) | Separación: reintentos por memoria, modelo que falta y oferta de Rápido | 0057, 0065 | ‖ 0068–0072 | Hecha |
| [0067](tareas/0067-estimacion-previa-de-la-separacion.md) | Estimación previa "Tardará unos N minutos" (con `origen`) | 0056, 0059 | ‖ 0060, 0063, 0064 | Hecha |
| [0068](tareas/0068-vista-progreso-paso-de-separacion.md) | Vista de progreso: paso de separación (cola, fases, cancelar, pendiente, errores, oferta de Rápido) | 0045, 0057, 0059, 0067 | ‖ 0065, 0066 (API falsa) | Hecha |
| [0069](tareas/0069-vista-progreso-terminado-y-escucha.md) | Vista de progreso: terminado, duración real y escucha de voz/instrumental | 0068 | ‖ 0070, 0071, 0072 | Hecha |
| [0070](tareas/0070-biblioteca-reintentar-cancelar-trabajo-y-re-separar.md) | Biblioteca: "Reintentar" que relanza, "Cancelar trabajo", "Re-separar pistas" y línea de paso | 0059, 0068 (+ 0065) | ‖ 0069, 0071, 0072 | Hecha |
| [0071](tareas/0071-panel-de-actividad.md) | Panel de actividad (+ deuda del marco: parpadeo y doble `listar()`) | 0059, 0067, 0068 | ‖ 0069, 0070, 0072 | Hecha |
| [0072](tareas/0072-avisos-al-terminar-toasts-y-notificaciones.md) | Avisos al terminar: toasts, notificaciones, Dock y barra de tareas | 0059 (+ 0065) | ‖ 0069, 0070, 0071 | Hecha |
| [0073](tareas/0073-dialogo-de-cierre-con-trabajos.md) | Diálogo de cierre con trabajos pendientes | 0014, 0036 (Hechas) | **Sí, en cualquier momento** | Hecha |
| [0074](tareas/0074-vista-ajustes-separacion-informativa-y-volver-a-calidad.md) | Vista Ajustes: separación informativa, "Volver a Calidad", Acerca de y soporte | 0057, 0067 | ‖ 0068–0073 | Hecha |
| [0075](tareas/0075-e2e-separacion-con-separador-falso.md) | E2E: separación con el separador falso (feliz, cola, cancelar, cierre, panel, avisos) | 0065, 0068, 0069, 0071, 0072, 0073 | No (cierra el bloque principal) | Hecha |
| [0076](tareas/0076-e2e-errores-de-separacion-rapido-y-ajustes.md) | E2E: errores, reintentos, oferta de Rápido, Re-separar y "Volver a Calidad" | 0066, 0070, 0074, 0075 | No (cierra la fase) | Hecha |

**Orden sugerido con dos o tres programadores**:
- **Antes**: 0055 ‖ 0056. Después, 0057 ‖ 0059.
- **(A) Worker**: 0060 → 0061 → 0062. 0058 en cualquier hueco, coordinada con 0062.
- **(B) Main**: 0063 ‖ 0064 ‖ 0067 → 0065 → 0066.
- **(C) Interfaz**: 0068 (con la API falsa en cuanto estén 0057, 0059 y 0067) → 0069 ‖ 0070 ‖ 0071 ‖ 0072, y 0074.
- **0073** en cualquier momento.
- **Cierre**: 0075 → 0076.

**Notas tras las respuestas a 0019/0020/0021 (2026-11-05)**:
- **0056 está en curso y no se ha editado.** Su programador debe aplicar lo que pide la respuesta a [0019](preguntas/0019-calidad-por-defecto-y-rapido-con-consentimiento.md) ("Tareas que deben ajustarse → 0056"):
  - sustituir los "textos provisionales" por `pa.modo.calidad.*` (incluido `.cpu`), `pa.modo.rebajado.*`, `pa.listo.modelo`, `pa.listo.tiempo(.aprox)` y `pa.req.descarga.generica` de `ux/01`;
  - la rebaja no cambia los tamaños ni la barra total (criterio 5b);
  - B1 con 4 GB en CPU (5c).
  Para `pa.listo.tiempo.aprox` basta, hasta 0067, con la regla provisional de [0021](preguntas/0021-detalles-tecnicos-de-la-oferta-de-rapido-y-volver-a-calidad.md) §3: factor `null` en el manifiesto y ninguno medido.
- **0057 ajustada**: textos definitivos del diálogo `aviso-rapido`, criterios 18–22 de `ux/01`, "Rápido pendiente" y estado de "Volver a Calidad" (0021 §1–§2).
- **0058**: su criterio opcional de separar 60 s pasa a 0062.
- **0054 (Hecha)**: el cambio de "modo" a "modelo en uso + dispositivo" en "Copiar información para soporte" lo hace 0074.
- **README / página de descarga**: "entre 4 y 10 GB libres" (Parte A de `ux/01`); se comprueba en 0055.

Deuda de fases anteriores que se salda aquí:
- reintentos según `reintentable`, estimación previa, "Reintentar" que relanza y diálogo de cierre (0014/0019/0020 → 0063, 0067, 0070, 0073);
- panel de actividad, parpadeo del título y doble `listar()` (0018/0020 → 0071);
- E2E de eventos IPC y del indicador de actividad (→ 0075);
- test "sin ffmpeg en el PATH" en los 3 SO (0005/0024 → 0061/0062).

## Fase 4 — Letras — **cerrada (2026-11-05)**: tareas 0077–0089 hechas; pregunta 0024 abierta (UX, Fase 5)
**Decisiones técnicas** (Revisión 2026-11-05 de los ADR [0005](adr/0005-letras-y-formato-de-sincronia.md) y [0006](adr/0006-persistencia-y-modelo-de-datos.md)):
- **Búsqueda**:
  - LRCLIB `get` + `search` en serie (sin duplicados), con un presupuesto de 10 s y al menos 250 ms entre peticiones;
  - 429 con `Retry-After` y margen aleatorio;
  - `net.fetch` desde el main con `User-Agent: ShinobiKaraoke/<versión> (URL del repositorio)`, sin cookies ni datos del equipo o del usuario;
  - sin registrar App-Id.
- **Fuente de cada registro**: Lyricsfile si `hasWordSync`, luego `syncedLyrics` y luego `plainLyrics`. El YAML se lee con `yaml` (ISC), solo en el main.
- **Conversores puros** en `shared/letras/` (texto plano, LRC, LRC mejorado, normalización y exportación), que usa también el renderer.
- **Persistencia**: la letra vive en `cancion.json#letra` (no hay `letra.json`). `pasos.letra` está completado con ≥ 1 línea.
- **Edición del texto**: diff LCS por líneas en el main.
- **Licencias**: LRCLIB sigue sin declarar licencia ni términos de los textos. No cambia la mitigación: uso personal, no se redistribuye, atribución. Las fixtures y los E2E usan letras **inventadas**.

**Preguntas**: [0022](preguntas/0022-huecos-ux-de-la-vista-letra-fase-4.md) (para el diseñador UX; no bloquea: hay opción provisional en cada punto).

| Tarea | Título | Depende de | ¿Paralelizable? | Estado |
|-------|--------|-----------|-----------------|--------|
| [0077](tareas/0077-contratos-compartidos-de-la-fase-4.md) | Contratos: API `letras.*`, `CandidatoLetra`, `ARCHIVO_SIN_LETRA`, regla de `pasos.letra`, `SHINOBI_LRCLIB_URL`, API falsa y fixtures | 0006, 0011 (Hechas) | **Empieza ya**; ‖ 0078 | Hecha |
| [0078](tareas/0078-conversores-texto-plano-lrc-y-normalizacion.md) | Conversores puros: texto plano, LRC, LRC mejorado, normalización y exportación | 0006 (Hecha) | **Empieza ya**; ‖ 0077, 0081 | Hecha |
| [0079](tareas/0079-editar-texto-conservando-sincronia.md) | Editar el texto conservando la sincronía (diff LCS) | 0078 | ‖ 0080, 0081, 0084 | Hecha |
| [0080](tareas/0080-main-conversor-lyricsfile.md) | Main: conversor Lyricsfile con `yaml` (+ avisos de terceros) | 0078 | ‖ 0079, 0081 | Hecha |
| [0081](tareas/0081-main-cliente-http-de-lrclib.md) | Main: cliente HTTP de LRCLIB (User-Agent, presupuesto, 429, errores, URL de pruebas) | 0077 | ‖ 0078–0080 | Hecha |
| [0082](tareas/0082-main-busqueda-de-letras-y-candidatos.md) | Main: `letras.buscar` (estrategia, conversión, orden, instrumental, caché, cancelación) | 0077, 0078, 0080, 0081 | ‖ 0083, 0084–0086 | Hecha |
| [0083](tareas/0083-main-guardar-editar-e-importar-letra.md) | Main: guardar, editar texto e importar `.lrc`/`.txt` (persistencia y paso `letra`) | 0077, 0078, 0079 | ‖ 0081, 0082, 0084–0086 | Hecha |
| [0084](tareas/0084-vista-letra-busqueda-y-resultados.md) | Vista Letra: búsqueda, resultados, vista previa y estados (A) | 0077 (API falsa) | ‖ 0078–0083 | Hecha |
| [0085](tareas/0085-vista-letra-pegar-importar-y-sustituir.md) | Vista Letra: pegar, importar y confirmar sustitución (B) | 0084, 0078 | ‖ 0086, 0087 | Hecha |
| [0086](tareas/0086-vista-letra-letra-elegida-y-edicion.md) | Vista Letra: letra elegida y edición con autoguardado (C) | 0084, 0079 | ‖ 0085, 0087 | Hecha |
| [0087](tareas/0087-integracion-letra-stepper-progreso-y-biblioteca.md) | Integración: stepper, Progreso, "Continuar", Biblioteca y semilla | 0084, 0077 (+ 0083) | ‖ 0085, 0086 | Hecha |
| [0088](tareas/0088-e2e-letras-sin-red.md) | E2E sin red con un doble HTTP local de LRCLIB | 0082, 0083, 0085, 0086, 0087 | No (cierra la fase) | Hecha |
| [0089](tareas/0089-prueba-opcional-con-lrclib-real.md) | Prueba opcional con LRCLIB real (`SHINOBI_TESTS_RED=1`) | 0082, 0088 | La parte Vitest, ‖ 0088 | Hecha |

**Orden sugerido con dos o tres programadores**:
- **(A) Dominio**: 0078 → 0079 ‖ 0080.
- **(B) Main**: 0077 → 0081 → 0082, y 0083 en cuanto estén 0078 y 0079.
- **(C) Interfaz**: 0084 (API falsa en cuanto esté 0077) → 0085 ‖ 0086 ‖ 0087.
- **Cierre**: 0088 → 0089.

Deuda que se salda aquí:
- `hayLetra` de Progreso con `contarLineas` y motivos provisionales del stepper (0043/0068 → 0087);
- el test de `archivo.test.ts` que escribía un `letra.json` aparte (→ 0083).

## Fase 5 — Editor — **desglosada (2026-11-05)**: tareas 0090–0111
**Decisiones técnicas** en el nuevo [ADR 0010](adr/0010-editor-motor-de-audio-reloj-y-guardado.md), con revisiones de los ADR 0005 y 0006:
- **Audio**: Web Audio con `AudioBuffer` decodificado bajo demanda (como mucho 2, LRU). La velocidad baja el tono (sin *spike* de `preservesPitch`).
- **Reloj**: `getOutputTimestamp` para las pulsaciones.
- **Guardado de tiempos**: `letras.guardarTiempos` en `ServicioLetras` (único escritor; no cambia el texto).
- **Estilo y estado**: `biblioteca.guardarEstilo` y `biblioteca.marcarLista`.
- ***Debounce***: en el renderer, con escritura inmediata en el main, vaciado al salir y al cerrar la ventana (`app.guardadoPendiente`).
- **Desplazamiento**: ±30 s.
- **Validación**: orden de paradas del degradado.
- **Error nuevo**: `LETRA_DESACTUALIZADA`.

Spec `ux/06` reescrita por el diseñador UX (48 criterios). [0024](preguntas/0024-stepper-letra-actual-y-volver-a-letra-desde-el-editor.md) respondida (UX) y [0025](preguntas/0025-detalles-tecnicos-del-editor-fase-5.md) respondida (arquitecto). [0026](preguntas/0026-textos-pendientes-del-editor-fase-5.md) respondida (UX: `edi.toast.recargada` y `variarLuminosidad30`). Sin preguntas abiertas.

**Pasan a la Fase 6** (`preguntas/0025` §1): "Probar a pantalla completa" (criterio 42 de `ux/06`) y la acción [▶ Reproducir] del toast `bib.toast.lista`.

**Pruebas**:
- sin red ni modelos;
- precisión de la marca con marcas de tiempo simuladas (0094);
- semilla con audio de 30 s y pista de clics (0095);
- E2E con el audio de Chromium silenciado (`SHINOBI_SILENCIAR_AUDIO`, solo sin empaquetar);
- prueba manual en los 3 SO (0111).

| Tarea | Título | Depende de | ¿Paralelizable? | Archivos compartidos | Estado |
|-------|--------|-----------|-----------------|----------------------|--------|
| [0090](tareas/0090-contratos-compartidos-de-la-fase-5.md) | Contratos: IPC del editor, `LETRA_DESACTUALIZADA`, orden de paradas, API falsa | — | **Primera**; ‖ 0092–0102 | `canales.ts`, `ipc.ts`, `errores.ts`, `estilo.ts`, preload, `handlers.ts` | Hecha |
| [0091](tareas/0091-main-guardar-tiempos-de-la-letra.md) | Main: `ServicioLetras.guardarTiempos` | 0090 | ‖ interfaz | — | Pendiente |
| [0092](tareas/0092-operaciones-puras-de-tiempos-del-editor.md) | Operaciones puras de tiempos (`marcarInicioLinea`, límites, formatos) | — | **Empieza ya** | — | Hecha |
| [0093](tareas/0093-estado-del-editor-historial-y-sesion-de-sincronia.md) | Estado del editor, deshacer/rehacer y sesión de sincronía | 0092 | ‖ 0094–0102 | — | Pendiente |
| [0094](tareas/0094-reloj-y-motor-de-audio-web-audio.md) | Reloj de pulsaciones y motor de audio (Web Audio) | — | **Empieza ya** | `main/index.ts` (3 líneas) | Pendiente |
| [0095](tareas/0095-audio-de-prueba-largo-pista-de-clics-y-semilla-del-editor.md) | FLAC largo, pista de clics y canciones del editor en la semilla | — | **Empieza ya** | `semilla.ts` | Pendiente |
| [0096](tareas/0096-modelo-puro-de-render-de-la-letra.md) | Modelo puro de render de la letra | — | **Empieza ya** | — | Pendiente |
| [0097](tareas/0097-contraste-y-utilidades-de-color.md) | Contraste del estilo y utilidades de color | — | **Empieza ya** | — | Pendiente |
| [0098](tareas/0098-componente-pantalla-letra.md) | Componente `PantallaLetra` (vista previa y reproductor) | 0096 | ‖ resto | `Muestrario.tsx` | Pendiente |
| [0099](tareas/0099-componentes-de-estilo-color-fuente-angulo-y-deslizador.md) | Selector de color, de fuente, dial de ángulo y deslizador | — | **Empieza ya** (cuidado con 0100) | `componentes.module.css`, `Muestrario.tsx` | Pendiente |
| [0100](tareas/0100-popover-y-deuda-de-componentes-base.md) | Popover y deuda de 0016 (`inert`, tooltip en bordes, *type-ahead*) | — | **Empieza ya** (cuidado con 0099) | `componentes.module.css`, `Muestrario.tsx` | Pendiente |
| [0101](tareas/0101-stepper-paso-actual-completado.md) | Stepper: ✓ en el paso actual completado y subrayado (0024) | — | **Empieza ya; pequeña** | `CabeceraCancion.tsx`, `e2e/letras.spec.ts` | Pendiente |
| [0102](tareas/0102-vista-letra-texto-demasiado-largo.md) | Vista Letra: texto demasiado largo (`ux/05` §10) | — | **Empieza ya; pequeña** | — | Pendiente |
| [0103](tareas/0103-cabecera-del-espacio-de-cancion-para-el-editor.md) | Cabecera para el editor: guardado, incompleta, ⟲⟳, ⋯ | 0100, 0101 | ‖ 0104 | `CabeceraCancion.tsx` | Pendiente |
| [0104](tareas/0104-guardado-del-editor-salida-y-cierre-de-la-ventana.md) | Guardado del editor: *debounce*, vaciado al salir, diálogo y cierre de la ventana | 0090, 0092 | ‖ 0103 | `App.tsx`, `navegacion/estado.ts`, `DialogoCierre.tsx`, `main/index.ts`, `main/cierre.ts` | Pendiente |
| [0105](tareas/0105-vista-editor-estructura-lista-y-transporte.md) | Vista Editor: estructura, lista, transporte, vista previa y atajos base | 0090, 0093, 0094, 0098, 0099, 0103, 0104 | No (núcleo) | `App.tsx` | Pendiente |
| [0106](tareas/0106-panel-sincronia-ajuste-fino-y-desplazamiento.md) | Panel Sincronía: ajuste fino, campos, escucha de comprobación, desplazamiento | 0105, 0100 | ‖ 0108, 0109 | `Editor.tsx` (*callbacks*) | Pendiente |
| [0107](tareas/0107-modo-sincronizar-al-ritmo.md) | Modo "Sincronizar al ritmo" | 0105, 0106 | ‖ 0108, 0109 | `Editor.tsx` | Pendiente |
| [0108](tareas/0108-panel-estilo-con-vista-previa-y-contraste.md) | Panel Estilo con contraste y estilo predeterminado | 0097, 0099, 0105 | ‖ 0106, 0107, 0109 | `Editor.tsx` (punto de aviso) | Pendiente |
| [0109](tareas/0109-marcar-como-lista-hecho-y-vuelta-a-la-biblioteca.md) | Marcar como lista, Hecho, Volver a borrador y vuelta a la Biblioteca (resalte 2 s, filtro, toasts) | 0090, 0091, 0100, 0103, 0104, 0105 | ‖ 0106–0108 | `navegacion/estado.ts`, `Biblioteca.tsx`, `Editor.tsx` | Pendiente |
| [0110](tareas/0110-e2e-editor-sin-red.md) | E2E del editor sin red | 0091, 0095, 0101, 0102, 0105–0109 | No (cierra la fase) | — | Pendiente |
| [0111](tareas/0111-prueba-manual-de-precision-con-pista-de-clics.md) | Prueba manual de precisión con la pista de clics (3 SO) | 0095, 0107 | ‖ 0110; manual | — | Pendiente |

**Orden sugerido con tres o cuatro programadores**:
- **Ya, en paralelo**: 0090, 0092, 0094, 0095, 0096, 0097, 0099, 0100, 0101 y 0102.
- **(A) Main**: 0090 → 0091.
- **(B) Dominio**: 0092 → 0093.
- **(C) Motor y render**: 0094 ‖ 0096 → 0098, y 0097.
- **(D) Interfaz base**: 0099 ‖ 0100, 0101 → 0103; 0104 tras 0090 y 0092.
- **Núcleo**: 0105.
- **Después**: 0106 → 0107, en paralelo con 0108 ‖ 0109.
- **Cierre**: 0110 (y 0111, manual).

Los archivos compartidos van en este orden: `App.tsx` 0104 → 0105; `navegacion/estado.ts` 0104 → 0109; `CabeceraCancion.tsx` 0101 → 0103; `Editor.tsx` 0105 → 0106 → 0107, con 0108/0109 solo añadiendo líneas; `main/index.ts` 0094 ‖ 0104 (bloques distintos).

Deuda de fases anteriores que se salda aquí:
- resalte de 2 s y toast al volver del editor (0019/0020 → 0109);
- diálogo `inert`, tooltip en los bordes y búsqueda por letra en el menú (0016 → 0100);
- orden de las paradas del degradado (0006 → 0090);
- ✓ de Letra en el stepper (0024 → 0101);
- texto de 512 KB (0085 → 0102).
`jsonAtomico` con el principal corrupto (0007): se vigila en 0110 (autoguardado intenso); sin tarea propia.

## Fase 6 — Reproductor
- [ ] Reproducción a pantalla completa desde la biblioteca (reutiliza `MotorAudio` y `PantallaLetra` de la Fase 5).
- [ ] "Probar a pantalla completa" desde el editor (criterio 42 de `ux/06`) y [▶ Reproducir] en el toast `bib.toast.lista` (`preguntas/0025` §1).

## Fase 7 — Empaquetado y distribución
| Tarea | Título | Depende de | Estado |
|-------|--------|-----------|--------|
| [0025](tareas/0025-empaquetado-e-instaladores.md) | Empaquetado: electron-builder, *fuses* (ADR 0008) e instaladores sin firma | 0022, 0024 (+ 0035, 0038 de la Fase 2) | Pendiente |
