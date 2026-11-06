import { EventEmitter } from 'node:events'

type EventoVentana = 'enter-full-screen' | 'leave-full-screen' | 'closed'
type EstadoVentana = 'normal' | 'maximizada' | 'pantalla_completa'

export interface VentanaModo {
  isFullScreen(): boolean
  setFullScreen(activa: boolean): void
  isMaximized(): boolean
  maximize(): void
  on(evento: EventoVentana, cb: () => void): void
  removeListener(evento: string, cb: () => void): void
}

interface Bloqueador {
  start(tipo: 'prevent-display-sleep'): number
  stop(id: number): void
  isStarted(id: number): boolean
}

interface Dependencias {
  bloqueador: Bloqueador
  fijarZoomActivo(activo: boolean): void
}

export class ControlModoReproductor {
  private ventana: VentanaModo | null = null
  private previo: EstadoVentana | null = null
  private deseado: boolean | null = null
  private transicion = false
  private restauracion: EstadoVentana | null = null
  private bloqueo: number | null = null
  private readonly suscriptores = new Set<(activa: boolean) => void>()

  constructor(private readonly deps: Dependencias) {}

  vincular(ventana: VentanaModo | null): void {
    if (this.ventana === ventana) return
    if (this.ventana) {
      this.ventana.removeListener('enter-full-screen', this.alEntrar)
      this.ventana.removeListener('leave-full-screen', this.alSalir)
      this.ventana.removeListener('closed', this.alCerrar)
      this.evitarReposo(false)
      this.deps.fijarZoomActivo(true)
    }
    this.ventana = ventana
    this.previo = null
    this.deseado = null
    this.transicion = false
    this.restauracion = null
    ventana?.on('enter-full-screen', this.alEntrar)
    ventana?.on('leave-full-screen', this.alSalir)
    ventana?.on('closed', this.alCerrar)
  }

  modoReproductor(activo: boolean): void {
    const ventana = this.ventana
    if (!ventana) return
    if (activo) {
      if (this.previo !== null) return
      if (this.restauracion !== null) this.previo = this.restauracion
      else if (ventana.isFullScreen()) this.previo = 'pantalla_completa'
      else this.previo = ventana.isMaximized() ? 'maximizada' : 'normal'
      this.restauracion = null
      this.deps.fijarZoomActivo(false)
      this.fijarPantallaCompleta(true)
    } else {
      this.reiniciar()
    }
  }

  fijarPantallaCompleta(activa: boolean): void {
    if (!this.ventana) return
    this.deseado = activa
    this.aplicarPendiente()
  }

  estaEnPantallaCompleta(): boolean {
    return this.ventana?.isFullScreen() ?? false
  }

  evitarReposo(activo: boolean): void {
    const { bloqueador } = this.deps
    const id = this.bloqueo
    if (activo && this.ventana) {
      if (id === null || !bloqueador.isStarted(id)) {
        this.bloqueo = bloqueador.start('prevent-display-sleep')
      }
    } else {
      if (id !== null && bloqueador.isStarted(id)) bloqueador.stop(id)
      this.bloqueo = null
    }
  }

  reiniciar(): void {
    this.evitarReposo(false)
    this.deps.fijarZoomActivo(true)
    const previo = this.previo
    this.previo = null
    if (previo !== null) {
      this.restauracion = previo
      this.fijarPantallaCompleta(previo === 'pantalla_completa')
    }
  }

  suscribir(cb: (activa: boolean) => void): () => void {
    this.suscriptores.add(cb)
    return () => this.suscriptores.delete(cb)
  }

  private readonly alEntrar = (): void => this.alCambiarPantalla(true)
  private readonly alSalir = (): void => this.alCambiarPantalla(false)
  private readonly alCerrar = (): void => this.vincular(null)

  private alCambiarPantalla(activa: boolean): void {
    const ventana = this.ventana
    // Si un suscriptor pide otro cambio, aplícalo después de difundir el estado real.
    this.transicion = true
    for (const cb of this.suscriptores) cb(activa)
    if (this.ventana !== ventana) return
    this.transicion = false
    this.aplicarPendiente()
  }

  private aplicarPendiente(): void {
    const ventana = this.ventana
    if (!ventana || this.transicion || this.deseado === null) return
    if (ventana.isFullScreen() !== this.deseado) {
      this.transicion = true
      ventana.setFullScreen(this.deseado)
      return
    }
    const maximizar = !this.deseado && this.restauracion === 'maximizada'
    this.deseado = null
    this.restauracion = null
    if (maximizar && !ventana.isMaximized()) ventana.maximize()
  }
}

/** Simula solo la pantalla completa. El cierre y la maximización siguen siendo los reales. */
export function simularPantallaCompleta(ventana: VentanaModo): VentanaModo {
  const eventos = new EventEmitter()
  let pantallaCompleta = false
  return {
    isFullScreen: () => pantallaCompleta,
    setFullScreen: (activa) => {
      setImmediate(() => {
        if (pantallaCompleta === activa) return
        pantallaCompleta = activa
        eventos.emit(activa ? 'enter-full-screen' : 'leave-full-screen')
      })
    },
    isMaximized: () => ventana.isMaximized(),
    maximize: () => ventana.maximize(),
    on: (evento, cb) => {
      if (evento === 'closed') ventana.on(evento, cb)
      else eventos.on(evento, cb)
    },
    removeListener: (evento, cb) => {
      if (evento === 'closed') ventana.removeListener(evento, cb)
      else eventos.removeListener(evento, cb)
    }
  }
}
