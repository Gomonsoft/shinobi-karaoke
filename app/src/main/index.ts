import { release, type as tipoSO } from 'node:os'
import { join, resolve } from 'node:path'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  Notification,
  protocol,
  session,
  shell,
  type MenuItemConstructorOptions
} from 'electron'
import { estiloPredeterminado } from '@shared/estilo'
import { CANALES } from '@shared/canales'
import { ID_APP_WINDOWS, TITULO_APP } from '@shared/titulo'
import { ServicioBiblioteca } from './biblioteca'
import {
  ejecutarConCerrojo,
  elegirArchivoAudio,
  entornoYtdlpFalso,
  ServicioImportacionArchivo,
  ServicioYoutube,
  YOUTUBE_ACTIVO
} from './fuente'
import { shellConPapeleraDePruebas } from './biblioteca/papelera'
import { dialogoConDoblePruebas } from './fuente/dialogoPruebas'
import { ServicioConfig } from './configuracion'
import { registrarIpc } from './ipc'
import { plantillaMenu } from './menu'
import { ESQUEMA_APP, ORIGEN_APP, servirRenderer } from './appProtocolo'
import { ESQUEMA_MEDIOS, servirMedio } from './medios'
import { flush } from './persistencia'
import { RegistroArchivo } from './registro'
import {
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
import { crearControlCierre, hayAlgoEnCurso } from './cierre'
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
  versionSistema,
  versionYtDlp,
  type RuntimeReal
} from './runtime'
import { configurarWorker, ejecutar, GestorTrabajos } from './trabajos'
import { crearPuertoModelos, entornoSeparadorFalso, ServicioSeparacion } from './separacion'
import { puertosDeElectron, puertosDePruebas, ServicioAvisos, ventanaDeElectron } from './avisos'

/** Servicio de configuración (0008); lo usarán los demás servicios y la IPC (0011). */
export let servicioConfig: ServicioConfig | null = null

/** Servicio de biblioteca (0009); lo usará la IPC (0011). */
export let servicioBiblioteca: ServicioBiblioteca | null = null

/** Importación de archivo local (0042). */
export let importacionArchivo: ServicioImportacionArchivo | null = null

/** Servicio de YouTube (0049); `null` con el módulo desactivado. */
export let servicioYoutube: ServicioYoutube | null = null

/** Runtime de audio (0034/0036): gestor de instalación y fachada de la IPC. `null` si falla el arranque. */
export let runtime: RuntimeReal | null = null

/** Servicio de separación (0065): cola pesada, pistas y factor medido. */
export let servicioSeparacion: ServicioSeparacion | null = null

/** Avisos del sistema al terminar o fallar un trabajo (0072). */
let servicioAvisos: ServicioAvisos | null = null

/** Actualización de yt-dlp y su cerrojo de lectura/escritura (0050). */
export let actualizadorYtDlp: ActualizadorYtDlp | null = null
/** Venv donde vive yt-dlp (para la información de soporte, 0054). */
let dirVenvYtdlp: string | null = null

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

const controlCierre = crearControlCierre({
  // Instalación del runtime o trabajos de la cola (0073). Las consultas interactivas no cuentan.
  hayAlgoEnCurso: () =>
    hayAlgoEnCurso({
      instalando: () => runtime?.servicio.instalando() ?? false,
      hayTrabajos: () => gestorTrabajos?.hayPendientes() ?? false
    }),
  pedirConfirmacion: () => {
    for (const v of BrowserWindow.getAllWindows())
      v.webContents.send(CANALES.eventos.solicitudCierre)
  },
  // Tras confirmar, los trabajos se cancelan como `interrumpido` y no queda ningún proceso hijo.
  // Sin `cancelarTodos()`: en macOS cerrar la ventana no sale de la app y el gestor debe seguir vivo.
  pausar: async () => {
    const g = gestorTrabajos
    await Promise.allSettled([
      runtime?.servicio.pausar(),
      ...(g?.listar().map((t) => g.cancelar(t.id, 'cierre')) ?? [])
    ])
  },
  cerrarVentana: () => BrowserWindow.getAllWindows()[0]?.close(),
  salir: () => app.quit()
})

function crearVentana(): BrowserWindow {
  const ventana = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: TITULO_APP,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Con una instalación en curso, cerrar pide confirmación al renderer (0036).
  ventana.on('close', (evento) => controlCierre.alCerrarVentana(evento))
  ventana.on('focus', () => servicioAvisos?.alRecuperarFoco())
  ventana.once('ready-to-show', () => ventana.show())

  const urlDev = process.env.ELECTRON_RENDERER_URL
  if (!app.isPackaged && urlDev) {
    void ventana.loadURL(urlDev)
  } else {
    void ventana.loadURL(`${ORIGEN_APP}/index.html`)
  }
  return ventana
}

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
if (process.platform === 'win32') app.setAppUserModelId(ID_APP_WINDOWS)
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
  const ventana = BrowserWindow.getAllWindows()[0]
  if (!ventana) return
  if (ventana.isMinimized()) ventana.restore()
  ventana.show()
  ventana.focus()
})

if (instanciaUnica)
  void app.whenReady().then(async () => {
    instalarPermisos(session.defaultSession, origenRenderer())
    const registro = new RegistroArchivo(join(rutaDatos(), 'registros'))
    try {
      servicioConfig = await ServicioConfig.abrir(rutaDatos(), { registro })
    } catch (e) {
      registro.escribir('error', 'arranque', `no se pudo abrir la configuración: ${String(e)}`)
    }
    try {
      servicioBiblioteca = new ServicioBiblioteca(rutaDatos(), {
        registro,
        // `SHINOBI_PAPELERA_PRUEBAS` sustituye la papelera real en E2E; se ignora empaquetada (0023).
        shell: shellConPapeleraDePruebas(shell, { env: process.env, empaquetada: app.isPackaged }),
        estiloPredeterminado: () =>
          servicioConfig?.obtener().estilo_predeterminado ?? estiloPredeterminado(),
        // Eliminar una canción cancela antes sus trabajos (0014).
        antesDeEliminar: (id) => gestorTrabajos?.cancelarDeCancion(id) ?? Promise.resolve()
      })
      await servicioBiblioteca.arrancar()
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
      gestorTrabajos = new GestorTrabajos({
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
          actualizarYtDlp,
          alEstadoInfo: (ev) => {
            for (const v of BrowserWindow.getAllWindows())
              v.webContents.send(CANALES.eventos.estadoInfo, ev)
          },
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
        hayTrabajoVivo: (id) => gestorTrabajos?.listar().some((t) => t.cancionId === id) ?? false,
        // Archivo local: al crear la canción se encadena la separación (0065).
        alFuenteLista: (id) => void servicioSeparacion?.alCompletarFuente(id),
        registrar: (nivel, mensaje) => registro.escribir(nivel, 'importacion', mensaje)
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
          versionApp: app.getVersion(),
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
        const v = BrowserWindow.getAllWindows()[0]
        if (!v) return null
        const real = ventanaDeElectron(v)
        return pruebas ? pruebas.ventana(real) : real
      }
      servicioAvisos = new ServicioAvisos({
        plataforma: process.platform,
        ventana: ventanaPrincipal,
        notificador: puertos.notificador,
        dock: puertos.dock,
        difundirAviso: (a) => {
          for (const v of BrowserWindow.getAllWindows())
            v.webContents.send(CANALES.eventos.avisoTrabajo, a)
        },
        difundirAbrir: (e) => {
          for (const v of BrowserWindow.getAllWindows())
            v.webContents.send(CANALES.eventos.abrirCancion, e)
        },
        obtenerCancion: (id) => biblioteca.obtener(id),
        registrar: (nivel, mensaje) => registro.escribir(nivel, 'avisos', mensaje)
      })
      gestorTrabajos.suscribir((t) => servicioAvisos?.alCambiarTrabajo(t))
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
      registrarIpc(
        ipcMain,
        {
          biblioteca: servicioBiblioteca,
          runtime: runtime.servicio,
          confirmarCierre: () => controlCierre.confirmar(),
          salir: () => app.quit(),
          trabajos: gestorTrabajos,
          ...(servicioSeparacion ? { separacion: servicioSeparacion } : {}),
          fuente: importacionArchivo,
          ...(servicioYoutube ? { youtube: servicioYoutube } : {}),
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
          remitenteValido: (evento) =>
            remitenteIpcValido(
              evento,
              BrowserWindow.getAllWindows().map((v) => v.webContents),
              origenRenderer()
            ),
          difundir: (canal, carga) => {
            for (const v of BrowserWindow.getAllWindows()) v.webContents.send(canal, carga)
          }
        }
      )
    }
    Menu.setApplicationMenu(
      Menu.buildFromTemplate(
        plantillaMenu(
          process.platform,
          (accion) => {
            BrowserWindow.getFocusedWindow()?.webContents.send(CANALES.eventos.menu, accion)
          },
          // Durante el primer arranque no se puede salir de él por menú ni atajos (ux/01 criterio 1).
          () => runtime?.servicio.completa() ?? false
        )
      )
    )
    if (!app.isPackaged) instalarMenuDesarrollo()
    crearVentana()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) crearVentana()
    })
  })

let escriturasVolcadas = false
app.on('before-quit', (evento) => {
  if (escriturasVolcadas) return
  controlCierre.alSalir(evento)
  if (evento.defaultPrevented) return
  // Se espera a las escrituras pendientes (0010) antes de salir de verdad.
  evento.preventDefault()
  escriturasVolcadas = true
  // Primero se cancelan los trabajos (sin procesos hijos vivos, 0014) y luego se vuelca todo.
  const cierre = Promise.allSettled([
    gestorTrabajos?.cancelarTodos(),
    // "Volver a Calidad" y Rápido sueltos: se abortan sin preguntar y queda el `.descarga` (0057).
    runtime?.servicio.cerrar(),
    importacionArchivo?.cerrar(),
    servicioSeparacion?.cerrar(),
    servicioYoutube?.cerrar(),
    // Espera a uv ≤ 10 s y después mata el árbol de procesos (0050).
    actualizadorYtDlp?.cerrar()
  ]).then(() => Promise.allSettled([servicioBiblioteca?.flushTodo(), flush()]))
  // Cierre acotado: 10 s de espera a uv más el tiempo de matar su árbol (si no, se registra y se sale).
  void conPlazo(cierre, 15_000, () =>
    console.error('[cierre] plazo de 10 s agotado; se sale sin terminar de volcar')
  ).then(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
