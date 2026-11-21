/**
 * Ventana offscreen de exportación (ADR 0019 §2 y §10): pinta el fotograma `n` que le pide main
 * y devuelve su captura BGRA a escala 1. Las dependencias de Electron llegan por parámetro para
 * poder probarla con dobles.
 */
import { CANALES } from '../../shared/canales'
import type { InicialExportacionIpc } from '../../shared/exportacion'
import { bloquearNavegacionTotal } from '../seguridad'

/** Capturas extra para asentar un cuadro (ver `capturar`). */
const REINTENTOS_CAPTURA = 4

/** Tiempo máximo que main espera a que el renderer confirme un fotograma (ADR 0019 §2). */
export const PLAZO_FOTOGRAMA_MS = 10_000

export interface ImagenLike {
  getSize(): { width: number; height: number }
  toBitmap(): Buffer
}

export interface WebContentsOffscreen {
  send(canal: string, ...args: unknown[]): void
  on(evento: string, cb: (...args: never[]) => void): unknown
  setWindowOpenHandler(cb: (d: { url: string }) => { action: 'deny' }): void
  setAudioMuted(silenciar: boolean): void
  setZoomFactor(factor: number): void
  setVisualZoomLevelLimits(minimo: number, maximo: number): unknown
  setFrameRate(fps: number): void
  getOSProcessId(): number
  capturePage(): Promise<ImagenLike>
  isDestroyed(): boolean
}

export interface BrowserWindowOffscreen {
  readonly webContents: WebContentsOffscreen
  loadURL(url: string): Promise<void>
  once(evento: 'closed', cb: () => void): unknown
  destroy(): void
  isDestroyed(): boolean
  setContentSize(ancho: number, alto: number): void
  getContentSize(): number[]
}

export interface OpcionesVentanaOffscreen {
  show: false
  width: number
  height: number
  useContentSize: true
  enableLargerThanScreen: true
  webPreferences: {
    offscreen: { useSharedTexture: false; deviceScaleFactor: 1 }
    sandbox: true
    contextIsolation: true
    nodeIntegration: false
    backgroundThrottling: false
    zoomFactor: 1
    preload: string
  }
}

export interface DepsVentanaExportacion {
  crear(opciones: OpcionesVentanaOffscreen): BrowserWindowOffscreen
  /** Documento de la ventana (`…/exportacion.html`). */
  url: string
  /** Ruta absoluta de `out/preload/exportacion.js`. */
  preload: string
  /** Registra el rol `exportacion` (el registro quita la ventana al cerrarse). */
  registrarRol(ventana: BrowserWindowOffscreen): void
  /** Prioridad baja del proceso del renderer (`os.setPriority`). */
  bajarPrioridad(pid: number): void
  /** Da la ventana a quien responde `exportacion.inicial/listo`, antes de cargar el documento. */
  publicar?(ventana: VentanaExportacion): void
  registrar?(nivel: 'info' | 'aviso' | 'error', mensaje: string): void
  plazoMs?: number
}

export interface OpcionesExportacion {
  ancho: number
  alto: number
  trabajoId: string
  /** Lo que la instantánea aporta a `exportacion.inicial()`; lo fija 0237. */
  inicial?: Pick<InicialExportacionIpc, 'instantanea' | 'fps' | 'total'>
  /** El renderer offscreen murió: el trabajo falla con `ERROR_INTERNO`. */
  alCaer?: (error: Error) => void
}

export interface CapturaAsentada {
  imagen: Buffer
  /** Dos capturas seguidas iguales; si no, `imagen` es la última de las `intentos`. */
  asentada: boolean
  /** Capturas hechas (2 a 5). */
  intentos: number
}

export interface VentanaExportacion {
  readonly trabajoId: string
  /** Respuesta de `exportacion.inicial`; falla si no hay instantánea. */
  inicial(): InicialExportacionIpc
  /** Se cumple cuando el documento ya llamó a `inicial()` (tiene el oyente de fotogramas). */
  readonly lista: Promise<void>
  /** Envía el fotograma `n` y espera su confirmación. */
  pintar(n: number): Promise<void>
  /** Captura la página (BGRA, `ancho × alto × 4` bytes) y dice si quedó asentada (ver `CapturaAsentada`). */
  capturar(): Promise<CapturaAsentada>
  /** `exportacion.listo`: valida el trabajo y el fotograma pendiente. */
  confirmarListo(carga: { trabajoId: string; n: number }): void
  destruir(): void
}

const errorConCodigo = (codigo: string, mensaje: string): Error =>
  Object.assign(new Error(mensaje), { codigo })

interface Pendiente {
  n: number
  resolver: () => void
  rechazar: (e: Error) => void
  temporizador: NodeJS.Timeout
}

export async function crearVentanaExportacion(
  opciones: OpcionesExportacion,
  deps: DepsVentanaExportacion
): Promise<VentanaExportacion> {
  const { ancho, alto, trabajoId } = opciones
  const ventana = deps.crear({
    show: false,
    width: ancho,
    height: alto,
    useContentSize: true,
    enableLargerThanScreen: true,
    webPreferences: {
      offscreen: { useSharedTexture: false, deviceScaleFactor: 1 },
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      zoomFactor: 1,
      preload: deps.preload
    }
  })
  // Windows recorta la ventana al área de trabajo al crearla: se fija el tamaño después y,
  // si aun así no coincide, se falla pronto. Nunca se escala (ADR 0019, revisión alpha.2).
  ventana.setContentSize(ancho, alto)
  const [anchoReal, altoReal] = ventana.getContentSize()
  if (anchoReal !== ancho || altoReal !== alto) {
    const mensaje = `La ventana de captura es de ${anchoReal}×${altoReal} y se esperaba ${ancho}×${alto}.`
    deps.registrar?.('error', `exportacion: ${mensaje}`)
    ventana.destroy()
    throw errorConCodigo('PERFIL_NO_SOPORTADO', mensaje)
  }
  const wc = ventana.webContents
  deps.registrarRol(ventana)
  bloquearNavegacionTotal(wc)
  wc.setWindowOpenHandler(() => ({ action: 'deny' }))
  wc.setAudioMuted(true)
  wc.setFrameRate(240)

  let pendiente: Pendiente | null = null
  let destruida = false
  let marcarLista: () => void = () => undefined
  const lista = new Promise<void>((res) => {
    marcarLista = res
  })

  const capturarUna = async (): Promise<Buffer> => {
    const imagen = await wc.capturePage()
    const { width, height } = imagen.getSize()
    if (width !== ancho || height !== alto) {
      throw errorConCodigo(
        'PERFIL_NO_SOPORTADO',
        `La captura es de ${width}×${height} y se esperaba ${ancho}×${alto}.`
      )
    }
    const bytes = imagen.toBitmap()
    if (bytes.length !== ancho * alto * 4) {
      throw errorConCodigo('ERROR_INTERNO', 'La captura no tiene el tamaño esperado.')
    }
    return bytes
  }

  const rechazarPendiente = (error: Error): void => {
    const p = pendiente
    if (!p) return
    pendiente = null
    clearTimeout(p.temporizador)
    p.rechazar(error)
  }

  wc.on('render-process-gone', (() => {
    const error = errorConCodigo('ERROR_INTERNO', 'El renderer de exportación terminó.')
    deps.registrar?.('error', 'exportacion: el renderer offscreen terminó inesperadamente')
    rechazarPendiente(error)
    opciones.alCaer?.(error)
  }) as never)
  ventana.once('closed', () => {
    destruida = true
    rechazarPendiente(errorConCodigo('ERROR_INTERNO', 'La ventana de exportación se cerró.'))
  })

  const api: VentanaExportacion = {
    trabajoId,
    lista,
    inicial() {
      if (!opciones.inicial) throw errorConCodigo('ERROR_INTERNO', 'Sin datos de exportación.')
      marcarLista()
      return { trabajoId, ancho, alto, ...opciones.inicial }
    },
    pintar(n) {
      if (destruida || wc.isDestroyed()) {
        return Promise.reject(errorConCodigo('ERROR_INTERNO', 'La ventana ya no existe.'))
      }
      if (pendiente) return Promise.reject(errorConCodigo('ERROR_INTERNO', 'Fotograma en curso.'))
      return new Promise<void>((resolver, rechazar) => {
        const temporizador = setTimeout(() => {
          pendiente = null
          rechazar(errorConCodigo('ERROR_INTERNO', `El fotograma ${n} no llegó a tiempo.`))
        }, deps.plazoMs ?? PLAZO_FOTOGRAMA_MS)
        pendiente = { n, resolver, rechazar, temporizador }
        wc.send(CANALES.eventos.exportacionFotograma, { trabajoId, n })
      })
    },
    async capturar() {
      // A veces (≈ 1 de cada 200 a 3840 × 2160) `capturePage` entrega el cuadro anterior al
      // fotograma confirmado, porque el compositor va por detrás de `requestAnimationFrame`.
      // Dos capturas seguidas iguales indican un cuadro asentado; si difieren, se repite.
      let previa = await capturarUna()
      for (let intento = 0; intento < REINTENTOS_CAPTURA; intento++) {
        const actual = await capturarUna()
        if (actual.equals(previa)) return { imagen: actual, asentada: true, intentos: intento + 2 }
        previa = actual
      }
      return { imagen: previa, asentada: false, intentos: REINTENTOS_CAPTURA + 1 }
    },

    confirmarListo(carga) {
      if (carga.trabajoId !== trabajoId) {
        throw errorConCodigo('ARGUMENTOS_NO_VALIDOS', 'Trabajo de exportación ajeno.')
      }
      const p = pendiente
      if (!p || p.n !== carga.n) return
      pendiente = null
      clearTimeout(p.temporizador)
      p.resolver()
    },
    destruir() {
      if (destruida) return
      destruida = true
      rechazarPendiente(errorConCodigo('ERROR_INTERNO', 'La ventana de exportación se destruyó.'))
      if (!ventana.isDestroyed()) ventana.destroy()
    }
  }

  // El documento llama a `inicial()` al cargar: main ya debe poder responderle.
  deps.publicar?.(api)
  await ventana.loadURL(deps.url)
  // El zoom necesita un documento cargado; `zoomFactor: 1` ya lo fija al crear.
  wc.setZoomFactor(1)
  wc.setVisualZoomLevelLimits(1, 1)
  try {
    deps.bajarPrioridad(wc.getOSProcessId())
  } catch (e) {
    deps.registrar?.('aviso', `exportacion: no se pudo bajar la prioridad (${String(e)})`)
  }
  return api
}
