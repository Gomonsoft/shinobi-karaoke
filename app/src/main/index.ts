import { release, type as tipoSO } from 'node:os'
import { join, resolve } from 'node:path'
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  protocol,
  session,
  shell,
  type MenuItemConstructorOptions
} from 'electron'
import { estiloPredeterminado } from '@shared/estilo'
import { CANALES } from '@shared/canales'
import { TITULO_APP } from '@shared/titulo'
import { ServicioBiblioteca } from './biblioteca'
import { shellConPapeleraDePruebas } from './biblioteca/papelera'
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
import { configurarWorker, ejecutar, GestorTrabajos, resolverLanzador } from './trabajos'

/** Servicio de configuración (0008); lo usarán los demás servicios y la IPC (0011). */
export let servicioConfig: ServicioConfig | null = null

/** Servicio de biblioteca (0009); lo usará la IPC (0011). */
export let servicioBiblioteca: ServicioBiblioteca | null = null

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
    if (servicioBiblioteca) {
      configurarWorker({
        lanzador: resolverLanzador({
          modo: 'desarrollo',
          raizRepo: resolve(app.getAppPath(), '..'),
          env: process.env
        }),
        dirRegistros: join(rutaDatos(), 'registros')
      })
      gestorTrabajos = new GestorTrabajos({ biblioteca: servicioBiblioteca, ejecutar, registro })
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
    if (servicioConfig && servicioBiblioteca && gestorTrabajos) {
      registrarIpc(
        ipcMain,
        {
          biblioteca: servicioBiblioteca,
          trabajos: gestorTrabajos,
          config: servicioConfig,
          infoSistema: () => ({
            version: app.getVersion(),
            so: `${tipoSO()} ${release()}`,
            plataforma: process.platform
          }),
          abrirExterno: (url) => shell.openExternal(url),
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
        plantillaMenu(process.platform, (accion) => {
          BrowserWindow.getFocusedWindow()?.webContents.send(CANALES.eventos.menu, accion)
        })
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
  // Se espera a las escrituras pendientes (0010) antes de salir de verdad.
  evento.preventDefault()
  escriturasVolcadas = true
  // Primero se cancelan los trabajos (sin procesos hijos vivos, 0014) y luego se vuelca todo.
  const cierre = Promise.allSettled([gestorTrabajos?.cancelarTodos()]).then(() =>
    Promise.allSettled([servicioBiblioteca?.flushTodo(), flush()])
  )
  // Cierre acotado: como máximo 10 s (si no, se registra y se sale igualmente).
  void conPlazo(cierre, 10_000, () =>
    console.error('[cierre] plazo de 10 s agotado; se sale sin terminar de volcar')
  ).then(() => app.quit())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
