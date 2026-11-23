import { mkdir, statfs } from 'node:fs/promises'
import { cpus, release, setPriority, totalmem, type as tipoSO } from 'node:os'
import { basename, join, resolve } from 'node:path'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  net,
  Notification,
  powerMonitor,
  powerSaveBlocker,
  protocol,
  screen,
  session,
  shell,
  type MenuItemConstructorOptions
} from 'electron'
import { estiloPredeterminado } from '@shared/estilo'
import { CANALES } from '@shared/canales'
import { ENTORNO_LRCLIB_URL } from '@shared/letrasBusqueda'
import { hashCorto, identificador, lineaVersion, numeroVisible } from '@shared/compilacion'
import { ID_APP_WINDOWS, ID_APP_WINDOWS_DESARROLLO, TITULO_APP } from '@shared/titulo'
import { ServicioBiblioteca, ServicioLotes } from './biblioteca'
import { ServicioCopias } from './copias'
import { ExportadorLrc } from './letras/exportarLrc'
import {
  crearDialogoLote,
  ejecutarConCerrojo,
  elegirArchivoAudio,
  entornoYtdlpFalso,
  ServicioImportacionArchivo,
  ServicioLote,
  ServicioYoutube,
  YOUTUBE_ACTIVO
} from './fuente'
import { crearEspacioLibre } from './runtime/deteccion'
import { shellConPapeleraDePruebas } from './biblioteca/papelera'
import { dialogoConDoblePruebas, VARIABLE_DIALOGO_PRUEBAS } from './fuente/dialogoPruebas'
import {
  BusquedaLetras,
  ServicioLetras,
  comprobarLetraGuardada,
  crearClienteLrclib,
  type ResultadoComprobacionGuardada
} from './letras'
import { contarDudosasGuardadas } from './letras/dudosas'
import { RecuentoRevision } from './biblioteca/recuentoRevision'
import { ColaPreparacion, ServicioPreparacion } from './preparacion'
import { DiarioPendientes } from './trabajos/diario'
import { ServicioConfig } from './configuracion'
import { ServicioTemas } from './temas'
import { registrarIpc } from './ipc'
import { IDS_ZOOM, plantillaMenu } from './menu'
import { ESQUEMA_APP, ORIGEN_APP, servirRenderer } from './appProtocolo'
import { ESQUEMA_MEDIOS, servirMedio } from './medios'
import { flush } from './persistencia'
import { RegistroArchivo } from './registro'
import { COMPILACION } from './compilacion'
import { ServicioActualizaciones } from './actualizaciones'
import {
  bloquearNavegacionTotal,
  conPlazo,
  instalarPermisos,
  instalarPoliticaNavegacion,
  origenDePeticion,
  origenDelRenderer,
  remitenteIpcValido
} from './seguridad'
import { rutaDatos } from './rutas'
import { leerTextoLegal } from './textoLegal'
import { lanzadorDeApp } from './lanzadorApp'
import {
  crearControlCierre,
  hayAlgoEnCurso,
  motivoDeCierre,
  type FuentesEnCurso,
  vigilarRenderer,
  type IntencionCierre
} from './cierre'
import {
  ActualizadorYtDlp,
  CerrojoLecturaEscritura,
  crearEjecutorUv,
  cargarEscenarioFalso,
  crearRuntimeReal,
  hayMarcadorYtdlp,
  iniciarMantenimientoYtdlp,
  plataformaReal,
  resolverUv,
  rutasRecursosRuntime,
  versionSistema,
  versionYtDlp,
  type RuntimeReal
} from './runtime'
import { configurarWorker, ejecutar, GestorTrabajos } from './trabajos'
import { crearPuertoModelos, entornoSeparadorFalso, ServicioSeparacion } from './separacion'
import { ServicioPicos } from './picos/servicio'
import { puertosDeElectron, puertosDePruebas, ServicioAvisos, ventanaDeElectron } from './avisos'
import { ControlModoReproductor, simularPantallaCompleta } from './ventana/modoReproductor'
import { RegistroVentanas } from './ventana/registro'
import { rutaIcono } from './ventana/icono'
import {
  crearVentanaExportacion,
  type OpcionesExportacion,
  type VentanaExportacion,
  probarCaptura
} from './exportacion/ventana'
import { Destinos } from './exportacion/destinos'
import { DiarioExportacion } from './exportacion/diario'
import { ServicioExportacion } from './exportacion/servicio'
import { GestorReposo } from './ventana/reposo'
import { ServicioSesion } from './sesion/servicio'
import { listarPantallas, observarPantallas, type ScreenLike } from './sesion/pantallas'
import { pantallaCompletaSimulada, pantallasSimuladas } from './sesion/pantallasPrueba'
import {
  abrirSecundaria,
  type OpcionesVentanaSecundaria,
  type VentanaSecundariaLike
} from './sesion/ventanaSecundaria'

/** Roles de las ventanas de la app (ADR 0017 §1). */
const ventanas = new RegistroVentanas<BrowserWindow>()

/** Servicio de configuración (0008); lo usarán los demás servicios y la IPC (0011). */
export let servicioConfig: ServicioConfig | null = null

/** Servicio de biblioteca (0009); lo usará la IPC (0011). */
export let servicioBiblioteca: ServicioBiblioteca | null = null

/** Catálogo de temas (ADR 0016, 0168). */
export let servicioTemas: ServicioTemas | null = null

/** Envía un evento a la ventana principal (los eventos de datos y trabajos son solo suyos). */
function aPrincipal(canal: string, carga: unknown): void {
  ventanas.enviarA('principal', canal, carga)
}

/** Sesión en vivo y cola de reproducción (ADR 0017, 0181). */
export let servicioSesion: ServicioSesion | null = null

/** Importación de archivo local (0042). */
export let importacionArchivo: ServicioImportacionArchivo | null = null

/** Importación por lotes (0314): archivos, carpeta y listas. */
export let servicioLote: ServicioLote | null = null

/** Servicio de YouTube (0049); `null` con el módulo desactivado. */
export let servicioYoutube: ServicioYoutube | null = null

/** Runtime de audio (0034/0036): gestor de instalación y fachada de la IPC. `null` si falla el arranque. */
export let runtime: RuntimeReal | null = null

/** Servicio de separación (0065): cola pesada, pistas y factor medido. */
export let servicioSeparacion: ServicioSeparacion | null = null
let servicioPicos: ServicioPicos | null = null
/** Paquetes de canción y copias de seguridad (ADR 0027). */
let servicioCopias: ServicioCopias<BrowserWindow | null> | null = null
/** Exportar la letra a `.lrc` (ADR 0027 §4). */
let exportadorLrc: ExportadorLrc<BrowserWindow | null> | null = null
let busquedaLetras: BusquedaLetras | null = null
/** Preparación desatendida hasta «Lista para revisar» (ADR 0025, tarea 0308). */
let servicioPreparacion: ServicioPreparacion | null = null
/** Tanda, pausa, paradas y reanudar al abrir (tarea 0309). */
let colaPreparacion: ColaPreparacion | null = null
let recuentoRevision: RecuentoRevision | null = null
/** Diario `trabajos/pendientes.json` (ADR 0025 §5). */
let diarioPendientes: DiarioPendientes | null = null
/** `preparacion:reanudada` que salió antes de que la ventana terminara de cargar. */
let reanudadaPendiente: { total: number } | null = null
/** Comprobación diferida de la letra al quedar listos los picos (F4-L7, tarea 0367). */
let comprobarLetraDiferida: ((id: string) => Promise<ResultadoComprobacionGuardada | null>) | null =
  null
let servicioActualizaciones: ServicioActualizaciones | null = null

/** Avisos del sistema al terminar o fallar un trabajo (0072). */
let servicioAvisos: ServicioAvisos | null = null

/** Actualización de yt-dlp y su cerrojo de lectura/escritura (0050). */
export let actualizadorYtDlp: ActualizadorYtDlp | null = null
/** Venv donde vive yt-dlp (para la información de soporte, 0054). */
let dirVenvYtdlp: string | null = null

/** Exportación de video (0237, ADR 0019); `null` si falta algún servicio del que depende. */
export let servicioExportacion: ServicioExportacion<BrowserWindow | null> | null = null

/** Gestor de trabajos en segundo plano (0014). */
export let gestorTrabajos: GestorTrabajos | null = null

/** Menú "Desarrollo" (solo en `npm run dev`): encola un `demo` para probar progreso, cola y cancelación. */
function instalarMenuDesarrollo(): void {
  const lanzar = (cola: 'pesada' | 'ligera', segundos: number): void => {
    const cancion = servicioBiblioteca?.listar().find((c) => !c.danada)
    if (!gestorTrabajos || !cancion) return
    gestorTrabajos.encolar({
      cancionId: cancion.id,
      paso: cola === 'pesada' ? 'separacion' : 'fuente',
      cola,
      comando: 'demo',
      args: { segundos, indeterminado_s: 2 }
    })
  }
  const desarrollo: MenuItemConstructorOptions = {
    label: 'Desarrollo',
    submenu: [
      { label: 'Lanzar demo (cola pesada, 30 s)', click: () => lanzar('pesada', 30) },
      { label: 'Lanzar demo (cola ligera, 15 s)', click: () => lanzar('ligera', 15) }
    ]
  }
  const actual = Menu.getApplicationMenu()
  const plantilla = (actual?.items ?? []) as unknown as MenuItemConstructorOptions[]
  Menu.setApplicationMenu(Menu.buildFromTemplate([...plantilla, desarrollo]))
}

/** Origen del renderer vigente (dev: Vite; producción y E2E: `shinobi-app://app`). */
function origenRenderer(): string {
  return origenDelRenderer({
    urlDev: process.env.ELECTRON_RENDERER_URL,
    empaquetada: app.isPackaged,
    origenProduccion: ORIGEN_APP
  })
}

let guardadoEditorPendiente = false

/** Bloqueo de reposo compartido entre el reproductor local y la sesión (ADR 0017 §4). */
export const gestorReposo = new GestorReposo(powerSaveBlocker)

const modoReproductor = new ControlModoReproductor({
  reposo: gestorReposo,
  fijarZoomActivo: (activo) => {
    const menu = Menu.getApplicationMenu()
    for (const id of Object.values(IDS_ZOOM)) {
      const elemento = menu?.getMenuItemById(id)
      if (elemento) elemento.enabled = activo
    }
  }
})

/** En macOS cerrar la ventana principal no sale de la app: la cola se conserva (ADR 0017 §9). */
const cierraSoloLaVentana = (intencion: IntencionCierre): boolean =>
  intencion === 'ventana' && process.platform === 'darwin'

/** Qué impide cerrar sin preguntar, según se pida cerrar la ventana o salir. */
const fuentesDeCierre = (intencion: IntencionCierre): FuentesEnCurso => ({
  instalando: () => runtime?.servicio.instalando() ?? false,
  // Trabajos de la cola (0073). Las consultas interactivas no cuentan.
  hayTrabajos: () =>
    (gestorTrabajos?.hayPendientes() ?? false) ||
    // Un paquete o una copia en curso se cancela al salir (en macOS, cerrar la ventana no sale).
    (!cierraSoloLaVentana(intencion) && (servicioCopias?.hayTrabajos() ?? false)),
  guardadoPendiente: () => guardadoEditorPendiente,
  sesionActiva: () => servicioSesion?.sesionActiva() ?? false,
  colaNoVacia: () => !cierraSoloLaVentana(intencion) && (servicioSesion?.colaNoVacia() ?? false),
  // En macOS cerrar la principal no detiene las exportaciones (ADR 0019 §8).
  exportando: () => !cierraSoloLaVentana(intencion) && (servicioExportacion?.hayEnCurso() ?? false)
})

const controlCierre = crearControlCierre({
  hayAlgoEnCurso: (intencion) => hayAlgoEnCurso(fuentesDeCierre(intencion)),
  pedirConfirmacion: (intencion) =>
    aPrincipal(CANALES.eventos.solicitudCierre, {
      ...motivoDeCierre(fuentesDeCierre(intencion)),
      variante: cierraSoloLaVentana(intencion) ? 'cerrarVentanaMac' : 'salir'
    }),
  // Tras confirmar, los trabajos se cancelan como `interrumpido` y no queda ningún proceso hijo.
  // Sin `cancelarTodos()`: en macOS cerrar la ventana no sale de la app y el gestor debe seguir vivo.
  pausar: async (intencion) => {
    const g = gestorTrabajos
    // Primero la preparación (quedan `detenida` por cierre): luego las cancelaciones de la cola.
    colaPreparacion?.alCierre()
    await servicioPreparacion?.detenerPorCierre().catch(() => undefined)
    await Promise.allSettled([
      runtime?.servicio.pausar(),
      cierraSoloLaVentana(intencion) ? undefined : servicioExportacion?.cancelarTodas(),
      ...(g?.listar().map((t) => g.cancelar(t.id, 'cierre')) ?? [])
    ])
  },
  // La secundaria se cierra sin su diálogo de cola. En macOS la cola se conserva; en el resto, cerrar
  // la principal sale de la app y no se vuelve a preguntar.
  cerrarVentana: () => {
    if (process.platform === 'darwin') void servicioSesion?.cerrarConservando()
    else void servicioSesion?.prepararSalida()
    ventanas.principal()?.close()
  },
  salir: () => {
    void servicioSesion?.prepararSalida()
    app.quit()
  }
})

/** Mínimo de contenido de la ventana, px CSS (spec del editor, subfase 2.1). */
const ANCHO_MINIMO_VENTANA = 1024
const ALTO_MINIMO_VENTANA = 576

/** Icono de las ventanas (`undefined` donde lo da el ejecutable o el bundle). */
function iconoVentanas(): string | undefined {
  return rutaIcono({
    empaquetada: app.isPackaged,
    plataforma: process.platform,
    dirApp: app.getAppPath(),
    dirRecursos: process.resourcesPath
  })
}

function crearVentana(): BrowserWindow {
  const icon = iconoVentanas()
  const ventana = new BrowserWindow({
    ...(icon ? { icon } : {}),
    width: 1280,
    height: 800,
    minWidth: ANCHO_MINIMO_VENTANA,
    minHeight: ALTO_MINIMO_VENTANA,
    useContentSize: true,
    title: TITULO_APP,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Mínimo de diseño (1024 x 576) sobre el área de contenido. En Windows, `minWidth`/`minHeight`
  // con `useContentSize` no descuentan la barra de menú, así que se ajusta con el marco real.
  const ajustarMinimo = (): void => {
    if (ventana.isDestroyed() || ventana.isFullScreen() || ventana.isMaximized()) return
    const [w = 0, h = 0] = ventana.getSize()
    const [cw = 0, ch = 0] = ventana.getContentSize()
    ventana.setMinimumSize(ANCHO_MINIMO_VENTANA + (w - cw), ALTO_MINIMO_VENTANA + (h - ch))
  }
  ajustarMinimo()
  ventana.once('ready-to-show', ajustarMinimo)

  ventanas.registrar(ventana, 'principal')

  const simular = !app.isPackaged && process.env.SHINOBI_PANTALLA_COMPLETA_SIMULADA === '1'
  modoReproductor.vincular(simular ? simularPantallaCompleta(ventana) : ventana)
  ventana.webContents.on('render-process-gone', () => modoReproductor.reiniciar())
  ventana.webContents.on('did-start-navigation', ({ isMainFrame, isSameDocument }) => {
    if (isMainFrame && !isSameDocument) modoReproductor.reiniciar()
  })

  // Silencio en E2E con audio real de Chromium (0094, ADR 0010).
  if (!app.isPackaged && process.env.SHINOBI_SILENCIAR_AUDIO === '1') {
    ventana.webContents.setAudioMuted(true)
  }

  // Con una instalación en curso, cerrar pide confirmación al renderer (0036).
  ventana.on('close', (evento) => controlCierre.alCerrarVentana(evento))
  vigilarRenderer(ventana.webContents, controlCierre, (m) => console.warn(m))
  ventana.on('closed', () => {
    guardadoEditorPendiente = false
  })
  ventana.on('focus', () => servicioAvisos?.alRecuperarFoco())
  ventana.once('ready-to-show', () => {
    ventana.show()
    // El aviso de versión nueva espera a que la ventana se muestre (ADR 0023 §3).
    servicioActualizaciones?.iniciar()
  })

  const urlDev = process.env.ELECTRON_RENDERER_URL
  if (!app.isPackaged && urlDev) {
    void ventana.loadURL(urlDev)
  } else {
    void ventana.loadURL(`${ORIGEN_APP}/index.html`)
  }
  return ventana
}

/**
 * Crea la ventana de la sesión (ADR 0017 §2): rol `secundaria`, toda navegación bloqueada y
 * `reproductor.html` como documento. La colocación y los avisos los pone `abrirSecundaria`.
 */
function crearVentanaSecundaria(opciones: OpcionesVentanaSecundaria): VentanaSecundariaLike {
  const icon = iconoVentanas()
  const ventana = new BrowserWindow(icon ? { ...opciones, icon } : opciones)
  ventanas.registrar(ventana, 'secundaria')
  bloquearNavegacionTotal(ventana.webContents)
  const urlDev = process.env.ELECTRON_RENDERER_URL
  void ventana.loadURL(
    !app.isPackaged && urlDev ? `${urlDev}/reproductor.html` : `${ORIGEN_APP}/reproductor.html`
  )
  return ventana as unknown as VentanaSecundariaLike
}

/** Ventana offscreen de exportación vigente (la crea 0237; hasta entonces, solo las pruebas). */
let ventanaExportacionVigente: VentanaExportacion | null = null

// El esquema de medios debe registrarse como privilegiado antes de `app.ready` (0012).
protocol.registerSchemesAsPrivileged([
  { scheme: ESQUEMA_APP, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  {
    scheme: ESQUEMA_MEDIOS,
    // `corsEnabled`: Chromium aplica CORS; medios solo responde al origen del renderer (ADR 0008).
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
])

app.setName(TITULO_APP)
// Windows: el id del instalador, necesario para las notificaciones (0072, arquitectura §6).
if (process.platform === 'win32')
  app.setAppUserModelId(app.isPackaged ? ID_APP_WINDOWS : ID_APP_WINDOWS_DESARROLLO)
// Perfil de Chromium separado de los datos del usuario (ADR 0006).
app.setPath('userData', join(rutaDatos(), 'electron'))

// Una sola instancia: el servicio de biblioteca es el único escritor (ADR 0006/0008).
const instanciaUnica = app.requestSingleInstanceLock()
if (!instanciaUnica) app.quit()

// Política de navegación común a todos los webContents (ADR 0008).
app.on('web-contents-created', (_e, wc) => {
  instalarPoliticaNavegacion(wc as never, {
    abrirExterno: (url) => shell.openExternal(url),
    avisar: (m) => console.warn(`[seguridad] ${m}`),
    origenRenderer: origenRenderer()
  })
})

app.on('second-instance', () => {
  const ventana = ventanas.principal()
  if (!ventana) return
  if (ventana.isMinimized()) ventana.restore()
  ventana.show()
  ventana.focus()
})

if (instanciaUnica)
  void app.whenReady().then(async () => {
    instalarPermisos(session.defaultSession, origenRenderer())
    const registro = new RegistroArchivo(join(rutaDatos(), 'registros'))
    registro.escribir(
      'info',
      'arranque',
      `Shinobi Karaoke ${identificador(app.getVersion(), COMPILACION)}`
    )
    if (process.platform === 'darwin') {
      app.setAboutPanelOptions({
        applicationVersion: numeroVisible(app.getVersion(), COMPILACION),
        version: hashCorto(COMPILACION) ?? ''
      })
    }

    /**
     * Crea la ventana offscreen de exportación (ADR 0019 §2): rol `exportacion`, `exportacion.html`
     * y su propio preload. Hay una a la vez; la gobierna el servicio de exportación (0237).
     */
    async function crearExportacion(opciones: OpcionesExportacion): Promise<VentanaExportacion> {
      const urlDev = process.env.ELECTRON_RENDERER_URL
      return crearVentanaExportacion(opciones, {
        publicar: (v) => {
          ventanaExportacionVigente = v
        },
        crear: (o) => new BrowserWindow(o) as never,
        url:
          !app.isPackaged && urlDev
            ? `${urlDev}/exportacion.html`
            : `${ORIGEN_APP}/exportacion.html`,
        preload: join(__dirname, '../preload/exportacion.js'),
        registrarRol: (v) => ventanas.registrar(v as never, 'exportacion'),
        // Prioridad baja: el equipo sigue usable mientras se exporta.
        bajarPrioridad: (pid) => setPriority(pid, 10),
        registrar: (nivel, mensaje) => registro.escribir(nivel, 'exportacion', mensaje)
      })
    }

    // Solo para las pruebas E2E de la captura (0234): nunca en la app empaquetada.
    if (!app.isPackaged && process.env.SHINOBI_PRUEBA_EXPORTACION === '1') {
      ;(globalThis as { __shinobiExportacion?: unknown }).__shinobiExportacion = {
        crear: crearExportacion
      }
    }
    try {
      servicioConfig = await ServicioConfig.abrir(rutaDatos(), { registro })
    } catch (e) {
      registro.escribir('error', 'arranque', `no se pudo abrir la configuración: ${String(e)}`)
    }
    try {
      const biblioteca = new ServicioBiblioteca(rutaDatos(), {
        registro,
        // `SHINOBI_PAPELERA_PRUEBAS` sustituye la papelera real en E2E; se ignora empaquetada (0023).
        shell: shellConPapeleraDePruebas(shell, { env: process.env, empaquetada: app.isPackaged }),
        // Eliminar una canción cancela antes sus trabajos (0014).
        // Y las exportaciones de la canción, con limpieza, antes de la papelera (0237).
        antesDeEliminar: async (id) => {
          await Promise.all([
            // La preparación se detiene sin escribir más en una canción que se va a la papelera.
            servicioPreparacion?.alEliminar(id),
            gestorTrabajos?.cancelarDeCancion(id),
            servicioExportacion?.cancelarDeCancion(id)
          ])
        }
      })
      // El catálogo de temas se abre antes de escanear: los resúmenes salen ya resueltos (0168).
      const dirBiblioteca = join(rutaDatos(), 'biblioteca')
      await mkdir(dirBiblioteca, { recursive: true })
      servicioTemas = await ServicioTemas.abrir({
        dirBiblioteca,
        puerto: biblioteca.puerto(),
        estiloInicial: servicioConfig?.obtener().estilo_predeterminado ?? estiloPredeterminado(),
        registro,
        alCambiar: (catalogo) => aPrincipal(CANALES.eventos.temasCambiado, catalogo),
        alProgreso: (progreso) => aPrincipal(CANALES.eventos.temasProgreso, progreso)
      })
      biblioteca.conectarTemas(servicioTemas)
      servicioBiblioteca = biblioteca
      await biblioteca.arrancar()
    } catch (e) {
      registro.escribir('error', 'arranque', `no se pudo escanear la biblioteca: ${String(e)}`)
    }
    // Modo del lanzador del worker: la comprobación del runtime solo aplica en producción (0037).
    let modoLanzador: 'desarrollo' | 'produccion' = 'desarrollo'
    // `SHINOBI_RUNTIME_FALSO`: dobles del runtime en E2E; se ignora empaquetada (0039, ADR 0009 §8).
    let runtimeFalso: ReturnType<typeof cargarEscenarioFalso> = null
    try {
      runtimeFalso = cargarEscenarioFalso({ env: process.env, empaquetada: app.isPackaged })
    } catch (e) {
      registro.escribir('error', 'arranque', `escenario del runtime falso no válido: ${String(e)}`)
    }
    if (servicioBiblioteca) {
      // El doble de yt-dlp solo se honra sin empaquetar (ADR 0009 §8); empaquetada se quita del entorno.
      if (app.isPackaged) delete process.env.SHINOBI_YTDLP_FALSO
      // Igual con el doble del separador (0059): el main solo lo pasa al worker sin empaquetar.
      if (app.isPackaged) delete process.env.SHINOBI_SEPARADOR_FALSO
      // Y el doble de LRCLIB (0077/0081): empaquetada se ignora y se borra del entorno.
      if (app.isPackaged) delete process.env[ENTORNO_LRCLIB_URL]
      const { lanzador, modo } = lanzadorDeApp({
        empaquetada: app.isPackaged,
        dirRecursos: process.resourcesPath,
        raizRepo: resolve(app.getAppPath(), '..'),
        datos: rutaDatos(),
        plataforma: process.platform,
        env: process.env
      })
      modoLanzador = modo
      configurarWorker({
        lanzador: {
          ...lanzador,
          env: {
            ...lanzador.env,
            ...entornoYtdlpFalso(process.env, app.isPackaged),
            ...entornoSeparadorFalso(process.env, app.isPackaged)
          }
        },
        // Con el venv como intérprete, sin instalación completa no se lanza ningún proceso (0035).
        ...(modo === 'produccion'
          ? { disponible: () => servicioConfig?.obtener().instalacion.estado === 'completa' }
          : {}),
        dirRegistros: join(rutaDatos(), 'registros')
      })
      servicioPicos = new ServicioPicos({
        dirBiblioteca: join(rutaDatos(), 'biblioteca'),
        tieneVoz: (id) => servicioBiblioteca?.tieneVozSeparada(id) ?? false,
        ejecutar,
        alListos: (id) => {
          recuentoRevision?.recalcular(id)
          void busquedaLetras?.alPicosListos(id).catch(() => undefined)
          void comprobarLetraDiferida?.(id).catch(() => undefined)
        }
      })
      // Cerrojo lectores/escritor de yt-dlp (0050): `info-youtube` y `descargar-youtube` leen.
      const cerrojo = new CerrojoLecturaEscritura()
      const dirRuntime = join(rutaDatos(), 'runtime')
      dirVenvYtdlp =
        modo === 'produccion'
          ? join(dirRuntime, 'venv')
          : join(resolve(app.getAppPath(), '..'), 'worker', '.venv')
      const retardoNoop = Number(process.env.SHINOBI_YTDLP_ACTUALIZAR_MS)
      actualizadorYtDlp = new ActualizadorYtDlp({
        dirRuntime,
        rutaExclusiones: join(
          rutasRecursosRuntime({
            empaquetada: app.isPackaged,
            dirRecursos: process.resourcesPath,
            dirApp: app.getAppPath()
          }).rutaCodigoWorker,
          'requisitos',
          'exclusiones.txt'
        ),
        plataforma: process.platform,
        ejecutorUv: crearEjecutorUv({
          uv: resolverUv({
            empaquetada: app.isPackaged,
            dirRecursos: process.resourcesPath,
            plataforma: process.platform,
            env: process.env
          }),
          dirRegistros: join(rutaDatos(), 'registros'),
          plataforma: process.platform
        }),
        cerrojo,
        // Sin el runtime de producción, la actualización no toca el entorno del repo (no-op).
        noop: modo !== 'produccion' || runtimeFalso !== null,
        // El retardo del no-op solo para pruebas: se ignora empaquetada.
        ...(!app.isPackaged && Number.isFinite(retardoNoop) && retardoNoop > 0
          ? { retardoNoopMs: retardoNoop }
          : {}),
        alCompletar: async () => {
          await servicioConfig?.actualizar({
            ultima_comprobacion_ytdlp: new Date().toISOString()
          })
        },
        registrar: (nivel, mensaje) => registro.escribir(nivel, 'ytdlp', mensaje)
      })
      const actualizarYtDlp = (): Promise<unknown> =>
        actualizadorYtDlp!.actualizar({ motivo: 'bloqueo' })
      const ejecutarYtdlp = ejecutarConCerrojo(ejecutar, cerrojo)
      // Lo que estaba en curso o en cola al cerrar se retoma al abrir (ADR 0025 §5).
      diarioPendientes = new DiarioPendientes(rutaDatos(), (nivel, mensaje) =>
        registro.escribir(nivel, 'trabajos', mensaje)
      )
      await diarioPendientes.cargar()
      gestorTrabajos = new GestorTrabajos({
        diario: diarioPendientes,
        // Entre dos descargas de YouTube seguidas, de 3 a 8 s (reduce los bloqueos).
        pausaEntreDescargasMs: () => 3000 + Math.random() * 5000,
        biblioteca: servicioBiblioteca,
        ejecutar: ejecutarYtdlp,
        mantenimiento: cerrojo,
        actualizarYtDlp,
        registro
      })
      if (YOUTUBE_ACTIVO && servicioConfig) {
        servicioYoutube = new ServicioYoutube({
          biblioteca: servicioBiblioteca,
          gestor: gestorTrabajos,
          ejecutar: ejecutarYtdlp,
          config: servicioConfig,
          dirDatos: rutaDatos(),
          valoresDatos: () => servicioBiblioteca?.valoresDatos() ?? { artistas: [], albumes: [] },
          actualizarYtDlp,
          alEstadoInfo: (ev) => aPrincipal(CANALES.eventos.estadoInfo, ev),
          esDuplicado: (id) =>
            servicioBiblioteca?.indiceDuplicados().some((c) => c.youtubeId === id) ?? false,
          registrar: (nivel, mensaje) => registro.escribir(nivel, 'youtube', mensaje)
        })
      }
      // Reparación pendiente y comprobación semanal; la reparación toma el cerrojo antes que nadie.
      await iniciarMantenimientoYtdlp({
        actualizador: actualizadorYtDlp,
        completa: () => servicioConfig?.obtener().instalacion.estado === 'completa',
        youtubeActivo: YOUTUBE_ACTIVO,
        ultimaComprobacion: () => servicioConfig?.obtener().ultima_comprobacion_ytdlp ?? null,
        hayMarcador: () => hayMarcadorYtdlp(dirRuntime),
        registrar: (nivel, mensaje) => registro.escribir(nivel, 'ytdlp', mensaje)
      })
      importacionArchivo = new ServicioImportacionArchivo({
        biblioteca: servicioBiblioteca,
        ejecutar,
        dirDatos: rutaDatos(),
        valoresDatos: () => servicioBiblioteca?.valoresDatos() ?? { artistas: [], albumes: [] },
        hayTrabajoVivo: (id) => gestorTrabajos?.listar().some((t) => t.cancionId === id) ?? false,
        // Archivo local: al crear la canción se encadena la separación (0065).
        alFuenteLista: (id) => {
          void servicioSeparacion?.alCompletarFuente(id)
          // La preparación desatendida (con el interruptor activo) busca la letra en paralelo.
          servicioPreparacion?.alFuenteLista(id)
        },
        registrar: (nivel, mensaje) => registro.escribir(nivel, 'importacion', mensaje)
      })
      // Lotes (0314): canciones con la fuente pendiente en la cola `ligera`; al completarse encadenan la
      // separación y la preparación como las de YouTube.
      const espacio = crearEspacioLibre()
      servicioLote = new ServicioLote({
        biblioteca: servicioBiblioteca,
        gestor: gestorTrabajos,
        ejecutar,
        ...(servicioYoutube ? { youtube: servicioYoutube } : {}),
        // `SHINOBI_DIALOGO_PRUEBAS` sustituye los diálogos nativos en E2E; se ignora empaquetada (0046).
        dialogo: crearDialogoLote(
          dialogoConDoblePruebas(
            { showOpenDialog: (o) => dialog.showOpenDialog(o) },
            { env: process.env, empaquetada: app.isPackaged }
          )
        ),
        dirDatos: rutaDatos(),
        espacioLibre: (ruta) => espacio.bytesLibres(ruta).catch(() => null),
        // Minutos de proceso por minuto de audio: la pendiente de la estimación de separación (sin el arranque fijo).
        factorMinutos: () => {
          const uno = runtime?.servicio.estimarSeparacion(60_000)
          const diez = runtime?.servicio.estimarSeparacion(600_000)
          if (!uno || !diez) return null
          const f = ((diez.min + diez.max) / 2 - (uno.min + uno.max) / 2) / 9
          return f > 0 ? f : null
        },
        registrar: (nivel, mensaje) => registro.escribir(nivel, 'lote', mensaje)
      })
      gestorTrabajos.suscribir((t) => {
        if (
          t.estado === 'terminado' &&
          t.paso === 'fuente' &&
          t.comando === 'importar-archivo-cola' &&
          t.resultado === 'completado'
        ) {
          void servicioSeparacion?.alCompletarFuente(t.cancionId)
          servicioPreparacion?.alFuenteLista(t.cancionId)
        }
      })
    }
    if (servicioConfig) {
      try {
        runtime = crearRuntimeReal({
          datos: rutaDatos(),
          empaquetada: app.isPackaged,
          dirRecursos: process.resourcesPath,
          dirApp: app.getAppPath(),
          plataforma: process.platform,
          ejecutandoBajoTraduccionArm64: app.runningUnderARM64Translation,
          lineaVersion: lineaVersion(app.getVersion(), COMPILACION),
          descripcionSo: `${tipoSO()} ${release()}`,
          config: servicioConfig,
          registro,
          env: process.env,
          falso: runtimeFalso,
          // La oferta de Rápido de la separación (0066); el servicio nace justo después.
          ofertaSeparacionVigente: () => servicioSeparacion?.ofertaRapidoVigente() ?? false
        })
      } catch (e) {
        registro.escribir('error', 'arranque', `no se pudo preparar el runtime: ${String(e)}`)
      }
    }
    if (servicioConfig && servicioBiblioteca && gestorTrabajos && runtime) {
      const rt = runtime
      servicioSeparacion = new ServicioSeparacion({
        publicarPistas: (id, publicar) => servicioPicos?.duranteCambio(id, publicar) ?? publicar(),
        // Los picos no esperan al editor (ADR 0024 §2): se piden en cuanto la voz está separada.
        alSepararVoz: (id) => void servicioPicos?.generarTrasSeparar(id).catch(() => undefined),
        biblioteca: servicioBiblioteca,
        gestor: gestorTrabajos,
        config: servicioConfig,
        manifiesto: () => rt.manifiesto,
        dirDatos: rutaDatos(),
        estimarSeparacion: (d) => rt.servicio.estimarSeparacion(d),
        modelos: crearPuertoModelos({
          manifiesto: () => rt.manifiesto,
          dirModelos: join(rutaDatos(), 'modelos'),
          descargar: (id, señal, alProgreso) => rt.gestor.descargarModelo(id, señal, alProgreso)
        }),
        // `SHINOBI_INTENTO` solo con el separador falso y sin empaquetar (0060, 0066).
        intentoEnEntorno: !app.isPackaged && Boolean(process.env.SHINOBI_SEPARADOR_FALSO),
        alCambiarOferta: () => rt.servicio.refrescar(),
        alMotorIncompleto: () => {
          void rt.servicio
            .marcarDanada('componentes')
            .catch((e: unknown) =>
              registro.escribir(
                'error',
                'runtime',
                `no se pudo marcar el motor como dañado: ${String(e)}`
              )
            )
        },
        registrar: (nivel, mensaje) => registro.escribir(nivel, 'separacion', mensaje)
      })
      // Restos de una sesión anterior: `pistas.tmp/` y `modelos/*.partial`.
      await servicioSeparacion
        .limpiarAlArrancar()
        .catch((e: unknown) =>
          registro.escribir('aviso', 'separacion', `no se pudo limpiar al arrancar: ${String(e)}`)
        )
    }
    // Comprobación del runtime al arrancar (0035, ADR 0009 §6; cableada en 0037). Solo con el venv de
    // producción: en desarrollo y E2E la instalación "completa" es un dato de la configuración.
    // Con la instalación completa es barata y se espera (la ventana ya abre con el resultado); si hay
    // que verificar de verdad (B0), corre en segundo plano y la ventana la muestra mientras tanto.
    if (runtime && servicioConfig && modoLanzador === 'produccion') {
      const rt = runtime
      const cfg = servicioConfig
      const hayQueVerificar = cfg.obtener().instalacion.estado !== 'completa'
      if (hayQueVerificar) rt.servicio.fijarVerificando(true)
      const comprobacion = rt.gestor
        .comprobarAlArrancar()
        .catch(async (e) => {
          registro.escribir('error', 'arranque', `falló la comprobación del runtime: ${String(e)}`)
          // Error inesperado: la ventana muestra "Hay que reparar el motor de audio" (B5).
          await cfg.actualizar({ instalacion: { estado: 'dañada' } }).catch(() => undefined)
        })
        .finally(() => rt.servicio.fijarVerificando(false))
      if (!hayQueVerificar) await comprobacion
    }
    if (servicioBiblioteca && gestorTrabajos) {
      const biblioteca = servicioBiblioteca
      // `SHINOBI_AVISOS_PRUEBAS` sustituye los puertos del sistema por un registro en E2E (0072).
      const pruebas = puertosDePruebas({ env: process.env, empaquetada: app.isPackaged })
      const puertos = pruebas ?? puertosDeElectron({ Notification, dock: app.dock })
      const ventanaPrincipal = () => {
        const v = ventanas.principal()
        if (!v) return null
        const real = ventanaDeElectron(v)
        return pruebas ? pruebas.ventana(real) : real
      }
      servicioAvisos = new ServicioAvisos({
        plataforma: process.platform,
        ventana: ventanaPrincipal,
        notificador: puertos.notificador,
        dock: puertos.dock,
        difundirAviso: (a) => aPrincipal(CANALES.eventos.avisoTrabajo, a),
        difundirAbrir: (e) => aPrincipal(CANALES.eventos.abrirCancion, e),
        difundirAbrirResultado: () =>
          aPrincipal(CANALES.eventos.abrirResultadoPreparacion, undefined),
        obtenerCancion: (id) => biblioteca.obtener(id),
        // En una tanda de 2 o más canciones no hay aviso por canción: sale uno al terminar (0309).
        enTandaDeVarias: () => colaPreparacion?.enTandaDeVarias() ?? false,
        registrar: (nivel, mensaje) => registro.escribir(nivel, 'avisos', mensaje)
      })
      gestorTrabajos.suscribir((t) => servicioAvisos?.alCambiarTrabajo(t))
      biblioteca.suscribir((e) => servicioAvisos?.alCambiarCancion(e))
    }
    const dirBiblioteca = join(rutaDatos(), 'biblioteca')
    protocol.handle(ESQUEMA_MEDIOS, (peticion) =>
      servirMedio(dirBiblioteca, peticion.url, peticion.method, peticion.headers.get('range'), {
        origenRenderer: origenRenderer(),
        origenPeticion: origenDePeticion(peticion.headers.get('origin'), peticion.referrer)
      })
    )
    // El renderer compilado (en empaquetado, dentro del asar: `getAppPath()`).
    const dirRenderer = join(app.getAppPath(), 'out', 'renderer')
    protocol.handle(ESQUEMA_APP, (peticion) =>
      servirRenderer(dirRenderer, peticion.url, peticion.method)
    )
    if (servicioConfig && servicioBiblioteca && gestorTrabajos && importacionArchivo && runtime) {
      const servicioLetras = new ServicioLetras({
        biblioteca: servicioBiblioteca,
        // `SHINOBI_DIALOGO_PRUEBAS` sustituye el selector nativo en E2E; se ignora empaquetada (0046).
        dialogo: dialogoConDoblePruebas(
          { showOpenDialog: (o) => dialog.showOpenDialog(o) },
          { env: process.env, empaquetada: app.isPackaged }
        ),
        // La letra elegida en la vista Letra rellena el álbum y guarda `datos_lrclib` (ADR 0025 §6).
        datosLrclib: (cancionId, lrclibId) =>
          busquedaLetras?.datosDeCandidato(cancionId, lrclibId) ?? null
      })
      const bibliotecaLetras = servicioBiblioteca
      comprobarLetraDiferida = (id) =>
        comprobarLetraGuardada(
          {
            biblioteca: bibliotecaLetras,
            letras: servicioLetras,
            picos: { nivelBase: (c) => servicioPicos?.nivelBase(c) ?? Promise.resolve(null) },
            avisar: (a) => servicioAvisos?.avisar(a),
            // Dentro de una tanda de varias canciones no hay toast por canción (spec 04, F5-P8).
            enTandaDeVarias: (c) =>
              colaPreparacion?.enTandaDeVarias(c) ??
              servicioPreparacion?.enTandaDeVarias(c) ??
              false
          },
          id
        )
      app.on('browser-window-created', (_evento, ventana) => {
        ventana.once('closed', () => servicioLetras.liberarEdicion())
      })
      const clienteLrclib = crearClienteLrclib({
        fetch: (url, init) => net.fetch(url, init),
        version: app.getVersion(),
        registro,
        env: process.env,
        empaquetada: app.isPackaged,
        enLinea: () => net.isOnline()
      })
      busquedaLetras = new BusquedaLetras({
        biblioteca: servicioBiblioteca,
        cliente: clienteLrclib,
        registro,
        picos: { nivelBase: (id) => servicioPicos?.nivelBase(id) ?? Promise.resolve(null) },
        emitirEncaje: (e) => aPrincipal(CANALES.eventos.letrasEncaje, e),
        // Búsquedas automáticas solo con el interruptor activo (ADR 0025 §4; por defecto sí).
        automaticaActiva: () => servicioConfig?.obtener().preparacion.automatica ?? true
      })
      const busqueda = busquedaLetras
      const biblioteca = servicioBiblioteca
      const config = servicioConfig
      const picosPreparacion = {
        solicitar: (id: string) =>
          servicioPicos?.solicitar(id) ?? Promise.resolve({ estado: 'no_disponible' as const }),
        nivelBase: (id: string) => servicioPicos?.nivelBase(id) ?? Promise.resolve(null)
      }
      servicioPreparacion = new ServicioPreparacion({
        biblioteca,
        busqueda,
        letras: servicioLetras,
        picos: picosPreparacion,
        comprobar: (id) => comprobarLetraDiferida?.(id) ?? Promise.resolve(null),
        contarDudosas: (c) => contarDudosasGuardadas({ picos: picosPreparacion }, c),
        config,
        edicionBloqueada: () => servicioSesion?.edicionBloqueada() ?? false,
        // La separación pendiente que nadie lanzó se encola por el camino de siempre (pregunta 0223).
        separacion: {
          hayTrabajo: (id) =>
            gestorTrabajos?.listar().some((t) => t.cancionId === id && t.comando === 'separar') ??
            false,
          encolar: (id) => servicioSeparacion?.alCompletarFuente(id) ?? Promise.resolve()
        },
        retenida: () => colaPreparacion?.pausada() ?? false,
        emitir: (cambio) => aPrincipal(CANALES.eventos.preparacionCambio, cambio),
        registrar: (nivel, mensaje) => registro.escribir(nivel, 'preparacion', mensaje)
      })
      // YouTube: al completarse la descarga (la fuente) empieza la preparación, como la separación.
      gestorTrabajos.suscribir((t) => {
        if (
          t.estado === 'terminado' &&
          t.paso === 'fuente' &&
          t.comando === 'descargar-youtube' &&
          t.resultado === 'completado'
        ) {
          servicioPreparacion?.alFuenteLista(t.cancionId)
        }
      })
      // Recuento de líneas por revisar en memoria, para toda «Lista para revisar» con o sin registro
      // (pregunta 0241): en segundo plano y en serie, ya pasada la comprobación del runtime.
      recuentoRevision = new RecuentoRevision({
        biblioteca,
        contar: (c) => contarDudosasGuardadas({ picos: picosPreparacion }, c),
        registrar: (nivel, mensaje) => registro.escribir(nivel, 'biblioteca', mensaje)
      })
      recuentoRevision.arrancar()
      // Un registro `en_curso` de una caída no se queda «Preparando» para siempre.
      await servicioPreparacion.normalizarAlArrancar()
      const preparacionActual = servicioPreparacion
      if (diarioPendientes) {
        colaPreparacion = new ColaPreparacion({
          gestor: gestorTrabajos,
          preparacion: preparacionActual,
          biblioteca,
          config,
          diario: diarioPendientes,
          estimarMin: (id) => {
            const e = servicioSeparacion?.estimar(id)
            return e ? (e.min + e.max) / 2 : null
          },
          reintentarDescarga: async (id) => {
            // La fuente de una canción de lote de archivos se reimporta; la de YouTube se vuelve a descargar.
            if (await servicioLote?.reintentar(id)) return
            await servicioYoutube?.reintentar(id)
          },
          separar: (id) => servicioSeparacion?.separar(id) ?? Promise.resolve(),
          emitirTanda: (t) => aPrincipal(CANALES.eventos.preparacionTanda, t),
          emitirReanudada: (e) => {
            const v = ventanas.principal()
            if (v && !v.webContents.isLoading()) aPrincipal(CANALES.eventos.preparacionReanudada, e)
            else reanudadaPendiente = e
          },
          avisarTanda: (r) => servicioAvisos?.avisarTanda(r),
          registrar: (nivel, mensaje) => registro.escribir(nivel, 'preparacion', mensaje)
        })
        colaPreparacion.arrancar()
      }
      // `SHINOBI_PANTALLAS_SIMULADAS` sustituye `screen` en E2E; se ignora empaquetada (ADR 0017 §13).
      const pantallasSistema: ScreenLike =
        pantallasSimuladas({ env: process.env, empaquetada: app.isPackaged }) ??
        (screen as unknown as ScreenLike)
      const pantallaCompletaDePrueba = pantallaCompletaSimulada({
        env: process.env,
        empaquetada: app.isPackaged
      })
      servicioSesion = new ServicioSesion({
        biblioteca: {
          obtener: (id) => biblioteca.obtener(id),
          obtenerResumen: (id) => biblioteca.obtenerResumen(id),
          estiloDe: (cancion) => biblioteca.resolver(cancion).estilo,
          comprobarPistas: (id) => biblioteca.comprobarPistas(id),
          suscribir: (cb) => biblioteca.suscribir(cb)
        },
        config,
        abrirVentana: (peticion) =>
          abrirSecundaria(peticion, {
            screen: pantallasSistema,
            crear: crearVentanaSecundaria,
            rutaPreload: join(__dirname, '../preload/secundaria.js'),
            pantallaCompletaSimulada: pantallaCompletaDePrueba
          }),
        pantallas: {
          listar: () => listarPantallas(pantallasSistema, ventanas.principal()),
          observar: (cb) => observarPantallas(pantallasSistema, cb)
        },
        enviarA: (rol, canal, carga) => ventanas.enviarA(rol, canal, carga),
        // Silencio de la principal mientras dura la sesión; el valor previo se restaura (ADR 0017 §9).
        principal: {
          estaSilenciada: () => ventanas.principal()?.webContents.isAudioMuted() ?? false,
          silenciar: (silenciar) => ventanas.principal()?.webContents.setAudioMuted(silenciar)
        },
        reposo: gestorReposo,
        liberarVisitaLetra: () => servicioLetras.liberarEdicion(),
        registrar: (nivel, mensaje) => registro.escribir(nivel, 'sesion', mensaje)
      })
      const exportacionBiblioteca = servicioBiblioteca
      servicioExportacion = new ServicioExportacion<BrowserWindow | null>({
        biblioteca: {
          obtener: (id) => exportacionBiblioteca.obtener(id),
          estiloDe: (cancion) => exportacionBiblioteca.resolver(cancion).estilo
        },
        dirDatos: rutaDatos(),
        config,
        // Sondeo de captura real (0260): el diálogo no ofrece tamaños que el equipo no captura.
        probarCaptura: (ancho, alto) =>
          probarCaptura(ancho, alto, { crear: (o) => new BrowserWindow(o) as never }),
        destinos: new Destinos<BrowserWindow | null>({
          dialogoGuardar: async (ventana, o) => {
            const opciones = {
              defaultPath: o.defaultPath,
              filters: [{ name: o.nombreFiltro, extensions: [o.extension] }]
            }
            const r = ventana
              ? await dialog.showSaveDialog(ventana, opciones)
              : await dialog.showSaveDialog(opciones)
            return r.canceled || !r.filePath ? null : r.filePath
          },
          // Exportar varias canciones (ADR 0026 §5): el selector de carpetas del sistema.
          dialogoCarpeta: async (ventana, o) => {
            const opciones = {
              defaultPath: o.defaultPath,
              properties: ['openDirectory', 'createDirectory'] as (
                'openDirectory' | 'createDirectory'
              )[]
            }
            const r = ventana
              ? await dialog.showOpenDialog(ventana, opciones)
              : await dialog.showOpenDialog(opciones)
            return r.canceled || !r.filePaths[0] ? null : r.filePaths[0]
          },
          directorioDatos: rutaDatos(),
          carpetaVideos: () => app.getPath('videos'),
          carpetaHogar: () => app.getPath('home')
        }),
        diario: new DiarioExportacion(rutaDatos()),
        ejecutar,
        crearVentana: crearExportacion,
        ventanaPrincipal: () => ventanas.principal() ?? null,
        mostrarEnCarpeta: (ruta) => shell.showItemInFolder(ruta),
        libreBytes: async (carpeta) => {
          try {
            const s = await statfs(carpeta)
            return Number(s.bavail) * Number(s.bsize)
          } catch {
            return null
          }
        },
        avisarSistema: (texto) => servicioAvisos?.avisarSistema(texto),
        bloqueador: powerSaveBlocker,
        memoriaTotal: () => totalmem(),
        nucleos: () => cpus().length,
        registrar: (nivel, mensaje) => registro.escribir(nivel, 'exportacion', mensaje)
      })
      // Restos de una caída: el aviso espera a que la principal lo pida (antes de crearla).
      await servicioExportacion.recuperarAlArrancar()
      // Letra a `.lrc`, paquetes y copias (ADR 0027): main abre los diálogos del sistema.
      exportadorLrc = new ExportadorLrc<BrowserWindow | null>({
        biblioteca: exportacionBiblioteca,
        directorioDatos: rutaDatos(),
        ventana: () => ventanas.principal() ?? null,
        dialogoGuardar: async (ventana, o) => {
          // E2E: `SHINOBI_LRC_PRUEBAS` es la carpeta donde «elige» guardar; se ignora empaquetada.
          const carpetaPruebas = !app.isPackaged && process.env.SHINOBI_LRC_PRUEBAS
          if (carpetaPruebas) return join(carpetaPruebas, basename(o.defaultPath))
          const opciones = {
            defaultPath: o.defaultPath,
            filters: [{ name: 'Letra con tiempos (LRC)', extensions: ['lrc'] }]
          }
          const r = ventana
            ? await dialog.showSaveDialog(ventana, opciones)
            : await dialog.showSaveDialog(opciones)
          return r.canceled || !r.filePath ? null : r.filePath
        },
        dialogoCarpeta: async (ventana, o) => {
          const opciones = {
            defaultPath: o.defaultPath,
            properties: ['openDirectory', 'createDirectory'] as (
              'openDirectory' | 'createDirectory'
            )[]
          }
          const r = ventana
            ? await dialog.showOpenDialog(ventana, opciones)
            : await dialog.showOpenDialog(opciones)
          return r.canceled || !r.filePaths[0] ? null : r.filePaths[0]
        },
        carpetaDocumentos: () => app.getPath('documents'),
        mostrarEnCarpeta: (ruta) => shell.showItemInFolder(ruta)
      })
      if (servicioConfig) {
        const lrc = exportadorLrc
        servicioCopias = new ServicioCopias<BrowserWindow | null>({
          dirBiblioteca: join(rutaDatos(), 'biblioteca'),
          directorioDatos: rutaDatos(),
          biblioteca,
          ...(servicioTemas ? { temas: servicioTemas } : {}),
          config: servicioConfig,
          libreBytes: async (carpeta) => {
            try {
              const s = await statfs(carpeta)
              return Number(s.bavail) * Number(s.bsize)
            } catch {
              return null
            }
          },
          puedeSustituir: (id) => !(servicioSesion?.cancionActiva(id) ?? false),
          version: app.getVersion(),
          ventana: () => ventanas.principal() ?? null,
          dialogoGuardar: async (ventana, o) => {
            const opciones = {
              defaultPath: o.defaultPath,
              filters: [{ name: 'Paquete de Shinobi Karaoke', extensions: ['shinobi'] }]
            }
            const r = ventana
              ? await dialog.showSaveDialog(ventana, opciones)
              : await dialog.showSaveDialog(opciones)
            return r.canceled || !r.filePath ? null : r.filePath
          },
          dialogoAbrir: async (ventana) => {
            // E2E: `SHINOBI_DIALOGO_PRUEBAS` es el paquete que «elige» la persona (ADR 0009 §8; nunca empaquetada).
            const prueba = app.isPackaged ? undefined : process.env[VARIABLE_DIALOGO_PRUEBAS]
            if (prueba) return prueba === 'cancelar' ? null : (prueba.split('|')[0] ?? null)
            const opciones = {
              properties: ['openFile'] as 'openFile'[],
              filters: [{ name: 'Paquete de Shinobi Karaoke', extensions: ['shinobi'] }]
            }
            const r = ventana
              ? await dialog.showOpenDialog(ventana, opciones)
              : await dialog.showOpenDialog(opciones)
            return r.canceled || !r.filePaths[0] ? null : r.filePaths[0]
          },
          // E2E: `SHINOBI_DOCUMENTOS` sustituye a Documentos para no escribir en la carpeta real.
          carpetaDocumentos: () =>
            (!app.isPackaged && process.env.SHINOBI_DOCUMENTOS) || app.getPath('documents'),
          carpetaHogar: () => app.getPath('home'),
          recordarUbicacion: (ruta) => lrc.recordar(ruta),
          emitirCambio: (e) => aPrincipal(CANALES.eventos.copiasCambio, e),
          emitirProgreso: (e) => aPrincipal(CANALES.eventos.copiasProgreso, e),
          registrar: (nivel, mensaje) => registro.escribir(nivel, 'copias', mensaje)
        })
      }
      servicioActualizaciones = new ServicioActualizaciones({
        config,
        fetch: (url, init) => net.fetch(url, init),
        registro,
        version: app.getVersion(),
        canal: COMPILACION.canal,
        empaquetada: app.isPackaged,
        env: process.env,
        reposo: powerMonitor
      })
      // Acciones por lotes de la Biblioteca (0318).
      const sesionDeLotes = servicioSesion
      const bibliotecaDeLotes = servicioBiblioteca
      const trabajosDe = (id: string): number =>
        (gestorTrabajos?.listar().filter((t) => t.cancionId === id).length ?? 0) +
        (servicioPreparacion?.enCurso(id) ? 1 : 0) +
        (servicioExportacion?.estado().filter((e) => e.cancionId === id && e.resultado === null)
          .length ?? 0)
      const servicioLotes = new ServicioLotes({
        biblioteca: bibliotecaDeLotes,
        eliminar: (id) =>
          servicioPicos?.duranteCambio(id, () => bibliotecaDeLotes.eliminar(id)) ??
          bibliotecaDeLotes.eliminar(id),
        ...(sesionDeLotes ? { sesion: sesionDeLotes } : {}),
        trabajosDe,
        emitirProgreso: (p) => aPrincipal(CANALES.eventos.bibliotecaProgresoLote, p),
        registrar: (mensaje) => registro.escribir('error', 'biblioteca', mensaje)
      })
      registrarIpc(
        ipcMain,
        {
          lotes: servicioLotes,
          actualizaciones: servicioActualizaciones,
          preparacion: servicioPreparacion,
          ...(colaPreparacion ? { colaPreparacion } : {}),
          biblioteca: servicioBiblioteca,
          ...(recuentoRevision ? { recuentoRevision } : {}),
          exportacion: servicioExportacion,
          ...(exportadorLrc ? { lrc: exportadorLrc } : {}),
          ...(servicioCopias ? { copias: servicioCopias } : {}),
          ventanaExportacion: () => ventanaExportacionVigente,
          ...(servicioTemas ? { temas: servicioTemas } : {}),
          ventana: modoReproductor,
          sesion: servicioSesion,
          guardadoPendiente: () => guardadoEditorPendiente,
          runtime: runtime.servicio,
          solicitudCierrePendiente: () => {
            const intencion = controlCierre.pendiente()
            return intencion === null
              ? null
              : {
                  ...motivoDeCierre(fuentesDeCierre(intencion)),
                  variante: cierraSoloLaVentana(intencion) ? 'cerrarVentanaMac' : 'salir'
                }
          },
          confirmarCierre: async () => {
            await controlCierre.confirmar()
          },
          fijarGuardadoPendiente: (pendiente) => {
            guardadoEditorPendiente = pendiente
          },
          salir: () => app.quit(),
          trabajos: gestorTrabajos,
          ...(servicioPicos ? { picos: servicioPicos } : {}),
          ...(servicioSeparacion ? { separacion: servicioSeparacion } : {}),
          fuente: importacionArchivo,
          // 0083: guardar, editar e importar. La búsqueda (buscar) es de 0082.
          letras: {
            buscar: (p) => busqueda.buscar(p),
            candidatoPorId: (cancionId, lrclibId) => busqueda.candidatoPorId(cancionId, lrclibId),
            guardar: (p) => servicioLetras.guardar(p),
            abrirEdicion: (id) => servicioLetras.abrirEdicion(id),
            cerrarEdicion: (id) => servicioLetras.cerrarEdicion(id),
            guardarTiempos: (peticion, id) => servicioLetras.guardarTiempos(peticion, id),
            editarTexto: (p) => servicioLetras.editarTexto(p),
            editarTextoLinea: (p, id) => servicioLetras.editarTextoLinea(p, id),
            leerArchivo: () => servicioLetras.leerArchivo()
          },
          ...(servicioYoutube ? { youtube: servicioYoutube } : {}),
          ...(servicioLote ? { lote: servicioLote } : {}),
          elegirArchivoAudio: () =>
            // `SHINOBI_DIALOGO_PRUEBAS` sustituye el selector nativo en E2E; se ignora empaquetada (0046).
            elegirArchivoAudio(
              dialogoConDoblePruebas(
                { showOpenDialog: (o) => dialog.showOpenDialog(o) },
                { env: process.env, empaquetada: app.isPackaged }
              )
            ),
          config: servicioConfig,
          infoSistema: async () => {
            const emulada = app.runningUnderARM64Translation
            const version = dirVenvYtdlp
              ? await versionYtDlp(dirVenvYtdlp, process.platform).catch(() => null)
              : null
            return {
              version: app.getVersion(),
              compilacion: COMPILACION,
              so: `${tipoSO()} ${release()}`,
              plataforma: process.platform,
              youtube: YOUTUBE_ACTIVO,
              versionSo: versionSistema(),
              arquitectura: plataformaReal(process.platform, process.arch, emulada).arquitectura,
              emulada,
              ytdlp: {
                version,
                ultimaComprobacion: servicioConfig?.obtener().ultima_comprobacion_ytdlp ?? null
              }
            }
          },
          abrirExterno: (url) => shell.openExternal(url),
          textoLegal: (tipo) =>
            leerTextoLegal(tipo, {
              empaquetada: app.isPackaged,
              dirRecursos: process.resourcesPath,
              raizRepo: resolve(app.getAppPath(), '..')
            }),
          abrirCarpetaDatos: async () => {
            const error = await shell.openPath(rutaDatos())
            if (error) throw new Error(error)
          },
          registrar: (nivel, mensaje) => registro.escribir(nivel, 'ipc', mensaje)
        },
        {
          remitenteValido: (evento, canal) =>
            remitenteIpcValido(evento, canal, ventanas, origenRenderer()),
          rolDe: (evento) => ventanas.rolDe((evento as { sender?: unknown } | null)?.sender),
          enviarA: (rol, canal, carga) => ventanas.enviarA(rol, canal, carga)
        }
      )
    }
    Menu.setApplicationMenu(
      Menu.buildFromTemplate(
        plantillaMenu(
          process.platform,
          (accion) => {
            // La secundaria no recibe acciones del menú (ADR 0017 §1).
            aPrincipal(CANALES.eventos.menu, accion)
          },
          // Durante el primer arranque no se puede salir de él por menú ni atajos (ux/01 criterio 1).
          () => runtime?.servicio.completa() ?? false
        )
      )
    )
    if (!app.isPackaged) instalarMenuDesarrollo()
    const principalNueva = crearVentana()
    principalNueva.webContents.once('did-finish-load', () => {
      if (reanudadaPendiente) aPrincipal(CANALES.eventos.preparacionReanudada, reanudadaPendiente)
      reanudadaPendiente = null
    })
    // Retomar lo que quedó en curso o en cola (tras la comprobación del runtime: con el motor dañado o
    // sin instalar no se reanuda nada hasta repararlo, ADR 0025 §5).
    if (servicioConfig?.obtener().instalacion.estado === 'completa') {
      void colaPreparacion
        ?.reanudarAlAbrir()
        .catch((e: unknown) =>
          registro.escribir('error', 'preparacion', `no se pudo reanudar al abrir: ${String(e)}`)
        )
    }
    app.on('activate', () => {
      // Aunque siga abierta la secundaria, se recrea la principal si falta (ADR 0017 §1).
      const principal = ventanas.principal()
      if (!principal) crearVentana()
      else {
        if (principal.isMinimized()) principal.restore()
        principal.show()
        principal.focus()
      }
    })
  })

let escriturasVolcadas = false
app.on('before-quit', (evento) => {
  if (escriturasVolcadas) return
  controlCierre.alSalir(evento)
  if (evento.defaultPrevented) return
  // La secundaria se cierra sin su diálogo de cola y se sueltan bloqueos, silencio y reposo.
  void servicioSesion?.prepararSalida()
  gestorReposo.liberarTodo()
  servicioActualizaciones?.detener()
  // Se espera a las escrituras pendientes (0010) antes de salir de verdad.
  evento.preventDefault()
  escriturasVolcadas = true
  // Primero se cancelan los trabajos (sin procesos hijos vivos, 0014) y luego se vuelca todo.
  const cierre = Promise.allSettled([
    // La preparación va primero: quedan `detenida` por cierre antes de que se cancelen los trabajos.
    Promise.resolve(colaPreparacion?.alCierre())
      .then(() => servicioPreparacion?.cerrar())
      .catch(() => undefined)
      .then(() => gestorTrabajos?.cancelarTodos()),
    // Cancela las exportaciones con limpieza y suelta el bloqueo de suspensión (0237).
    servicioExportacion?.cerrar(),
    // Cancela los paquetes y copias en curso: su temporal se borra y el archivo anterior queda intacto.
    servicioCopias?.cerrar(),
    servicioPicos?.cerrar(),
    Promise.resolve(servicioTemas?.cerrar()),
    // "Volver a Calidad" y Rápido sueltos: se abortan sin preguntar y queda el `.descarga` (0057).
    runtime?.servicio.cerrar(),
    importacionArchivo?.cerrar(),
    servicioSeparacion?.cerrar(),
    Promise.resolve(busquedaLetras?.cerrar()),
    servicioYoutube?.cerrar(),
    servicioLote?.cerrar(),
    // Espera a uv ≤ 10 s y después mata el árbol de procesos (0050).
    actualizadorYtDlp?.cerrar()
  ]).then(() =>
    Promise.allSettled([servicioBiblioteca?.flushTodo(), diarioPendientes?.vaciar(), flush()])
  )
  // Cierre acotado: 10 s de espera a uv más el tiempo de matar su árbol (si no, se registra y se sale).
  void conPlazo(cierre, 15_000, () =>
    console.error('[cierre] plazo de 10 s agotado; se sale sin terminar de volcar')
  ).then(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
