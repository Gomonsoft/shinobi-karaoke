import type { PantallaIpc } from '../../shared/sesion'
import { ControlPantallaCompleta } from '../ventana/pantallaCompleta'
import { simularPantallaCompleta } from '../ventana/modoReproductor'
import {
  observarPantallas,
  type PantallaRecordada,
  type PantallaSistema,
  type Rectangulo,
  type ScreenLike
} from './pantallas'

export const TITULO_SECUNDARIA = 'Shinobi Karaoke · Reproductor'

/** La pantalla pedida no existe (ADR 0017 §2); lleva el código que mapea la IPC. */
export class ErrorPantallaNoDisponible extends Error {
  readonly codigo = 'PANTALLA_NO_DISPONIBLE'
  constructor() {
    super('La pantalla ya no está disponible.')
    this.name = 'ErrorPantallaNoDisponible'
  }
}

/** Subconjunto de `webContents` que usa la secundaria. */
export interface WebContentsSecundaria {
  on(evento: string, cb: (...args: unknown[]) => void): unknown
  setZoomFactor(factor: number): void
  isDestroyed?(): boolean
}

/** Subconjunto de `BrowserWindow` que usa la secundaria. */
export interface VentanaSecundariaLike {
  readonly webContents: WebContentsSecundaria
  isFullScreen(): boolean
  setFullScreen(activa: boolean): void
  isMaximized(): boolean
  maximize(): void
  removeListener(evento: string, cb: () => void): void
  on(evento: string, cb: (...args: unknown[]) => void): void
  once(evento: string, cb: (...args: unknown[]) => void): unknown
  setBounds(bounds: Rectangulo): void
  getBounds(): Rectangulo
  setMenu(menu: null): void
  show(): void
  showInactive(): void
  isMinimized(): boolean
  restore(): void
  close(): void
  destroy(): void
  isDestroyed(): boolean
}

/** Opciones de `BrowserWindow` (ADR 0017 §2); `crear` las pasa al constructor. */
export interface OpcionesVentanaSecundaria {
  x?: number
  y?: number
  width: number
  height: number
  title: string
  backgroundColor: string
  show: false
  webPreferences: {
    preload: string
    sandbox: true
    contextIsolation: true
    nodeIntegration: false
    backgroundThrottling: false
    autoplayPolicy: 'no-user-gesture-required'
  }
}

export interface PeticionSecundaria {
  pantalla: PantallaIpc | null
  pantallaCompleta: boolean
  colocacion: 'libre' | 'sistema'
}

export interface DepsSecundaria {
  screen: ScreenLike
  /** Crea la ventana (y, en main, la registra con el rol `secundaria` y carga el documento). */
  crear(opciones: OpcionesVentanaSecundaria): VentanaSecundariaLike
  rutaPreload: string
  /** `SHINOBI_PANTALLA_COMPLETA_SIMULADA` (solo sin empaquetar). */
  pantallaCompletaSimulada?: boolean
}

/** 80 % del área útil, centrado (ADR 0017 §2). */
export function limitesAl80(area: Rectangulo): Rectangulo {
  const width = Math.round(area.width * 0.8)
  const height = Math.round(area.height * 0.8)
  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    width,
    height
  }
}

function contenido(area: Rectangulo, r: Rectangulo): boolean {
  return (
    r.x >= area.x &&
    r.y >= area.y &&
    r.x + r.width <= area.x + area.width &&
    r.y + r.height <= area.y + area.height
  )
}

const recordada = (d: PantallaSistema, etiqueta?: string): PantallaRecordada => ({
  id: d.id,
  etiqueta: etiqueta ?? d.label,
  ancho: d.bounds.width,
  alto: d.bounds.height
})

export interface ManejadorSecundaria {
  readonly ventana: VentanaSecundariaLike
  /** Lleva la ventana a otra pantalla; restaura la pantalla completa si la tenía. */
  moverA(pantalla: PantallaIpc): void
  fijarPantallaCompleta(activa: boolean): void
  estaEnPantallaCompleta(): boolean
  /** Restaura si estaba minimizada y la muestra, sin darle el foco. */
  mostrar(): void
  cerrar(): void
  destruir(): void
  /** Intercepta `close`; el callback decide con `evento.preventDefault()`. */
  alCerrarSolicitado(cb: (evento: { preventDefault(): void }) => void): void
  alCambiarPantallaCompleta(cb: (activa: boolean) => void): () => void
  alCaer(cb: (motivo: string) => void): void
  alNoResponder(cb: () => void): void
  alResponder(cb: () => void): void
  alPantallaPerdida(cb: (pantalla: PantallaRecordada) => void): void
  alPantallaReconectada(cb: (pantalla: PantallaRecordada) => void): void
}

/** Crea la ventana secundaria en la pantalla elegida (ADR 0017 §2 y §3). */
export function abrirSecundaria(
  peticion: PeticionSecundaria,
  deps: DepsSecundaria
): ManejadorSecundaria {
  const libre = peticion.colocacion === 'libre'
  let destino: PantallaSistema | null = null
  if (libre) {
    destino = deps.screen.getAllDisplays().find((d) => d.id === peticion.pantalla?.id) ?? null
    if (!destino) throw new ErrorPantallaNoDisponible()
  }
  const limites = destino ? limitesAl80(destino.workArea) : null
  const ventana = deps.crear({
    ...(limites ?? { width: 960, height: 540 }),
    title: TITULO_SECUNDARIA,
    backgroundColor: '#000000',
    show: false,
    webPreferences: {
      preload: deps.rutaPreload,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  })
  ventana.setMenu(null)
  ventana.webContents.setZoomFactor(1)
  ventana.webContents.on('zoom-changed', (() => ventana.webContents.setZoomFactor(1)) as never)
  ventana.on('page-title-updated', ((evento: { preventDefault(): void }) =>
    evento.preventDefault()) as never)

  // En `sistema` (Wayland) el estado no se conoce: no se pide pantalla completa ni hay avisos.
  const quierePantallaCompleta = libre && peticion.pantallaCompleta
  const control = new ControlPantallaCompleta()
  control.vincular(deps.pantallaCompletaSimulada ? simularPantallaCompleta(ventana) : ventana)

  let idActual = destino?.id ?? null
  let perdida: { pantalla: PantallaRecordada; completa: boolean } | null = null
  const avisos = {
    perdida: [] as ((p: PantallaRecordada) => void)[],
    reconectada: [] as ((p: PantallaRecordada) => void)[]
  }

  /** Coloca la ventana en `pantalla` y, si hace falta, vuelve a pantalla completa. */
  const colocar = (pantalla: PantallaSistema, completa: boolean): void => {
    const poner = (): void => {
      if (ventana.isDestroyed()) return
      ventana.setBounds(limitesAl80(pantalla.workArea))
      if (completa) control.fijar(true)
    }
    if (control.estaEnPantallaCompleta()) {
      // Primero hay que salir de pantalla completa (asíncrono en macOS) y después mover.
      const baja = control.suscribir((activa) => {
        if (activa) return
        baja()
        poner()
      })
      control.fijar(false)
    } else {
      poner()
    }
  }

  ventana.once('ready-to-show', (() => {
    if (limites) ventana.setBounds(limites)
    // En la pantalla de la principal y a pantalla completa cubre a la principal: toma el foco.
    if (quierePantallaCompleta && peticion.pantalla?.conVentanaPrincipal) ventana.show()
    else ventana.showInactive()
    if (quierePantallaCompleta) control.fijar(true)
  }) as never)

  let bajaPantallas: (() => void) | null = null
  if (libre) {
    bajaPantallas = observarPantallas(deps.screen, (cambio) => {
      if (ventana.isDestroyed()) return
      const d = cambio.pantalla
      if (cambio.tipo === 'quitada' && d.id === idActual) {
        const completa = control.estaEnPantallaCompleta()
        perdida = { pantalla: recordada(d), completa }
        const primaria = deps.screen.getPrimaryDisplay()
        idActual = primaria.id
        colocar(primaria, false)
        for (const cb of avisos.perdida) cb(perdida.pantalla)
      } else if (cambio.tipo === 'anadida' && perdida) {
        const p = perdida.pantalla
        const misma =
          d.id === p.id ||
          (d.bounds.width === p.ancho && d.bounds.height === p.alto && d.label === p.etiqueta)
        if (misma) for (const cb of avisos.reconectada) cb(recordada(d))
      } else if (cambio.tipo === 'metricas' && d.id === idActual) {
        if (!control.estaEnPantallaCompleta() && !contenido(d.workArea, ventana.getBounds())) {
          ventana.setBounds(limitesAl80(d.workArea))
        }
      }
    })
  }
  ventana.on('closed', (() => bajaPantallas?.()) as never)

  return {
    ventana,
    moverA(pantalla) {
      const d = libre ? deps.screen.getAllDisplays().find((x) => x.id === pantalla.id) : null
      if (!d) throw new ErrorPantallaNoDisponible()
      const completa = (perdida?.completa ?? false) || control.estaEnPantallaCompleta()
      perdida = null
      idActual = d.id
      colocar(d, completa)
    },
    fijarPantallaCompleta: (activa) => control.fijar(activa),
    estaEnPantallaCompleta: () => control.estaEnPantallaCompleta(),
    mostrar() {
      if (ventana.isDestroyed()) return
      if (ventana.isMinimized()) ventana.restore()
      ventana.showInactive()
    },
    cerrar() {
      if (!ventana.isDestroyed()) ventana.close()
    },
    destruir() {
      if (!ventana.isDestroyed()) ventana.destroy()
    },
    alCerrarSolicitado: (cb) => ventana.on('close', cb as never),
    alCambiarPantallaCompleta: (cb) => control.suscribir(cb),
    alCaer(cb) {
      ventana.webContents.on('render-process-gone', ((_e: unknown, detalles: { reason: string }) =>
        cb(detalles?.reason ?? 'desconocido')) as never)
      // Una recarga del documento (no la carga inicial) también termina la sesión (ADR 0017 §3).
      let cargada = false
      ventana.webContents.on('did-finish-load', (() => {
        cargada = true
      }) as never)
      ventana.webContents.on('did-start-navigation', ((detalles: {
        isMainFrame: boolean
        isSameDocument: boolean
      }) => {
        if (cargada && detalles.isMainFrame && !detalles.isSameDocument) cb('recarga')
      }) as never)
    },
    alNoResponder: (cb) => void ventana.webContents.on('unresponsive', cb as never),
    alResponder: (cb) => void ventana.webContents.on('responsive', cb as never),
    alPantallaPerdida: (cb) => void avisos.perdida.push(cb),
    alPantallaReconectada: (cb) => void avisos.reconectada.push(cb)
  }
}
