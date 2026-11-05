# 0050 — Actualización de yt-dlp: comprobación semanal, reintento automático tras bloqueo y exclusión mutua
- Estado: Hecha
- Paso del pipeline: 1
- Depende de: 0035, 0049
- ADRs: 0001, 0003 ("Actualización de yt-dlp" y Revisiones), 0009 §3, §7 y Revisiones (2026-11-04 tras `preguntas/0014`)
- Spec UX: docs/ux/01-primer-arranque.md (estado "Actualización de yt-dlp", criterio 16); docs/ux/03-anadir-cancion.md (wireframe C1, `add.reintento.ytdlp`, criterio 15, `add.error.YOUTUBE_BLOQUEADO`); docs/ux/04-progreso-pipeline.md (`prog.reintento.ytdlp`, `prog.cola.descarga.mantenimiento`, criterio 16); docs/ux/02-biblioteca.md (`bib.paso.actualizando`); respuestas a `preguntas/0013` §1 y `preguntas/0014` §1

## Objetivo
Mantener yt-dlp al día sin publicar versiones de la app. En segundo plano se comprueba como mucho una vez por semana; cuando YouTube bloquea una consulta o una descarga, se actualiza y se reintenta una vez antes de mostrar el error. Todo es **automático y silencioso**: nunca se pregunta al usuario. La actualización tampoco coincide nunca con un proceso de yt-dlp en marcha y sobrevive a cancelaciones y cierres sin dejar el venv roto.

## Criterios de aceptación
- [x] **`app/src/main/runtime/ytdlp.ts`: `actualizarYtDlp({ reparar? })`**
  - Ejecuta `uv pip install --python <venv> -U "yt-dlp[default]" deno` (con `reparar`, añade `--reinstall-package yt-dlp --reinstall-package yt-dlp-ejs --reinstall-package deno`) con el entorno aislado de 0034.
  - Sin `--require-hashes`: es la única excepción a los requisitos bloqueados, y queda anotada en el registro.
  - Devuelve la versión anterior y la nueva (`importlib.metadata`). Errores clasificados como en 0034. Un fallo nunca rompe nada: se registra.
  - Es **de un solo vuelo**: una llamada mientras hay otra en curso recibe la misma promesa.
- [x] **Cerrojo lectores/escritor con prioridad al escritor** en el mismo módulo (ADR 0009 Revisiones §1). Sustituye al "trabajo interno sin canción" de la versión anterior de esta tarea: el gestor de 0014 **no** necesita trabajos sin `cancionId`.
  - Lectores: cada proceso `info-youtube` (0049) y `descargar-youtube` (gestor, cola `ligera`). El escritor es `actualizarYtDlp`.
  - El escritor espera a que terminen los lectores activos. Mientras está pendiente o en curso, no empieza ningún lector nuevo.
  - Una **consulta** que espera emite al renderer un evento `fuente.estadoInfo { consultaId, fase: 'actualizando' }`, y la vista 03 muestra `add.reintento.ytdlp`.
  - Una **descarga** que espera sigue `en_cola` con `motivo: 'mantenimiento'` en su `EstadoTrabajo`, y la vista 04 muestra `prog.cola.descarga.mantenimiento`.
- [x] **Cancelación y límites** (`preguntas/0014` §1a):
  - Cancelar la consulta o la descarga que provocó la actualización **no** aborta uv: la actualización sigue en silencio.
  - Límite duro de 5 min: si se supera, se mata el árbol de procesos (como 0034) y se trata como interrupción.
- [x] **Cierre de la app** (`preguntas/0014` §1b):
  - No hay diálogo ni entrada en `cierre.*`.
  - La ventana se cierra en el acto y main espera a uv **≤ 10 s**; después mata el árbol de procesos y sale.
  - `runtime/ytdlp-actualizando.json` (`{ inicio, motivo }`, escritura atómica de 0007) se escribe antes de lanzar uv y se borra **solo** si uv sale con código 0.
- [x] **Reparación al arrancar**:
  - Con la instalación `completa`, si existe `runtime/ytdlp-actualizando.json`, se lanza enseguida `actualizarYtDlp({ reparar: true })`, sin esperar los 60 s ni los 7 días. Mientras dura, las operaciones de YouTube esperan en el cerrojo.
  - Si falla, se registra y el marcador se conserva para el siguiente arranque.
  - yt-dlp **nunca** marca la instalación como `dañada` (B5).
- [x] **Comprobación semanal**:
  - Al arrancar, si la instalación está `completa`, YouTube está activo y `ultima_comprobacion_ytdlp` es nula o tiene más de 7 días, se lanza `actualizarYtDlp()` 60 s después del arranque.
  - Al terminar, con o sin cambio, se guarda la fecha en `ultima_comprobacion_ytdlp`. La versión no se guarda en config: se lee del venv (`versionYtDlp()` de 0054).
  - Sin conexión, se ignora y se reintenta en el siguiente arranque.
- [x] **Reintento automático** (`arquitectura.md` §6):
  - Si `descargar-youtube` termina con `YOUTUBE_BLOQUEADO` y es su primer intento, el gestor no marca `error`. Emite progreso `{ fase: 'actualizando', valor: null }` en ese trabajo (vista 04: `prog.reintento.ytdlp`; tarjeta: `bib.paso.actualizando`), libera su lectura, llama a `actualizarYtDlp()` y relanza la descarga **una vez** sin soltar su puesto en la cola `ligera`.
  - Si vuelve a fallar → `error` `YOUTUBE_BLOQUEADO`. Si el usuario cancela durante `actualizando`, el trabajo queda `pendiente` y la actualización sigue.
  - Para `info-youtube` funciona igual: la consulta emite `fuente.estadoInfo { fase: 'actualizando' }` y se repite una vez. Si se cancela, el campo vuelve a ser editable sin error (`ux/03` criterio 15).
- [x] Sin empaquetar, con el lanzador de desarrollo (`uv run --project worker`), la actualización no toca el entorno del repo: es un no-op registrado, salvo con `SHINOBI_LANZADOR=produccion` (0035). El cerrojo, el marcador y el reintento automático funcionan igual tras el no-op (los usa el E2E de 0053). Un retardo configurable del no-op solo para pruebas (`SHINOBI_YTDLP_ACTUALIZAR_MS`, ignorado si `app.isPackaged`) permite ver los estados de espera.
- [x] **Tests unitarios** con dobles (uv falso, worker falso):
  - semanal: nula, < 7 días, > 7 días, sin conexión;
  - de un solo vuelo;
  - cerrojo: la actualización espera a una descarga en curso; una consulta y una descarga esperan a la actualización (evento `actualizando` y `motivo: 'mantenimiento'`);
  - reintento con éxito y reintento que vuelve a fallar; `info-youtube` con reintento;
  - cancelar durante `actualizando` sin matar uv;
  - límite de 5 min;
  - cierre con espera ≤ 10 s y muerte del proceso; marcador presente → reparación al arrancar; marcador borrado solo con código 0;
  - no-op en desarrollo.

## Notas de implementación
- **Qué se hizo**:
  - `app/src/main/runtime/ytdlp.ts`: `CerrojoLecturaEscritura` (prioridad al escritor; `conLectura(fn, { alEsperar, señal })`, `conEscritura`, `enMantenimiento`, `alTerminarMantenimiento`), `ActualizadorYtDlp` (`actualizar({ reparar?, motivo? })` de un solo vuelo, límite de 5 min, `cerrar()` con espera ≤ 10 s y muerte del árbol vía la señal del `EjecutorUv`, marcador `runtime/ytdlp-actualizando.json` con escritura atómica, no-op en desarrollo con `SHINOBI_YTDLP_ACTUALIZAR_MS`), `versionYtDlp(dirVenv, plataforma)` (lee `yt_dlp-<v>.dist-info` sin lanzar Python, en vez de `importlib.metadata`; la reutilizará 0054), `iniciarMantenimientoYtdlp` (reparación inmediata si hay marcador; comprobación semanal a los 60 s).
  - `fuente/youtube.ts`: `CerrojoYtdlp.conLectura` admite `{ alEsperar, señal }`; `ejecutarConCerrojo` los reenvía (una lectura en espera se puede cancelar). `ServicioYoutube.info` genera el `consultaId` al empezar, emite `alEstadoInfo({ consultaId, fase: 'actualizando' })` si espera o provoca una actualización y reintenta una vez tras `YOUTUBE_BLOQUEADO` (`actualizarYtDlp`); cancelar durante la espera no aborta la actualización (`trabajos/cancelable.ts`, `esperarCancelable`).
  - `trabajos/gestor.ts`: opciones `mantenimiento` (puerto del cerrojo) y `actualizarYtDlp`. Una `descargar-youtube` no sale de `en_cola` mientras hay mantenimiento (`TrabajoIpc.motivo = 'mantenimiento'`, campo nuevo opcional en `shared/ipc.ts`); tras `YOUTUBE_BLOQUEADO` en el primer intento emite `actualizando` (valor null), actualiza y relanza sin soltar la cola; si la actualización falla, termina con el error original; cancelar durante `actualizando` deja el paso `pendiente`.
  - `main/index.ts`: el cerrojo real sustituye a `cerrojoTrivial`; `ActualizadorYtDlp` con `resolverUv`/`crearEjecutorUv`, no-op si el lanzador es de desarrollo (`modo !== 'produccion'`), guarda `ultima_comprobacion_ytdlp` al completar (incluido el no-op), arranca la reparación/comprobación antes de registrar la IPC, y en `before-quit` llama a `actualizadorYtDlp.cerrar()`; el plazo global de cierre sube de 10 a 15 s (10 s de espera a uv + matar el árbol).
  - IPC: canal `fuente:estadoInfo` (`CANALES.eventos.estadoInfo`), `ApiShinobi.alCambiarEstadoInfo(cb({ consultaId, fase }))` en preload (nombre que ya esperaba `PanelYoutube`, que ahora usa el tipo de la API en vez de un cast). Renderer: `progreso/modelo.ts` muestra `prog.cola.descarga.mantenimiento` cuando `motivo === 'mantenimiento'`.
- **Decisiones**: la fecha de comprobación solo se guarda cuando la actualización termina bien; el fallo (incluida la falta de conexión) se registra y se reintenta en el siguiente arranque. Una descarga cuya actualización falla no se relanza (volvería a fallar). `info-youtube` bloqueada espera a la actualización en curso aunque la haya lanzado otra causa (semanal/reparación).
- **Cómo probarlo** (desde `app/`): `npx vitest run src/main/runtime/ytdlp.test.ts src/main/trabajos/gestor.test.ts src/main/fuente/youtube.test.ts src/renderer/src/vistas/progreso`. Sin red ni uv real (uv falso). Prueba manual con retardo: `SHINOBI_YTDLP_FALSO=<dir> SHINOBI_YTDLP_ACTUALIZAR_MS=5000 npm run dev` y una descarga que devuelva `YOUTUBE_BLOQUEADO`.
- **Deuda / pendiente**: sin prueba con uv real ni E2E de los estados de espera (0053). La actualización real (`uv pip install -U` contra PyPI, sin hashes) no se ha ejecutado aquí. Una descarga en `en_cola` por mantenimiento bloquea la cola `ligera` hasta que termine (solo hay trabajos de fuente en ella).
- **Mantenimiento (tests intermitentes de `ytdlp.test.ts`)**: causa real: tres casos (no-op con `retardoNoopMs`, límite de 5 min con `limiteMs` y cierre con `esperaCierreMs`) medían tiempos de pared con `setTimeout` real y márgenes de ~5 ms; con la suite en paralelo el reloj de libuv (cacheado por iteración del bucle) hace que el temporizador dispare "antes" de lo que ve `Date.now()` (se observaron 54 ms para un temporizador de 60 ms). El `ENOTEMPTY` era una carrera del `rm` del directorio temporal con escrituras atómicas del marcador aún en vuelo bajo carga (ya mitigada con `maxRetries` en `afterEach`). Arreglo: esos tres tests usan `vi.useFakeTimers({ toFake: ['setTimeout','clearTimeout','Date'] })` y avanzan el reloj a mano (59 ms: aún no; +1 ms: ya), con un helper `hastaInmediato` basado en `setImmediate` para esperar la E/S real; se verifica lo mismo que antes (incluso con más precisión: justo antes y justo en el plazo) sin subir timeouts. Verificado: 10 ejecuciones seguidas del archivo en verde.
