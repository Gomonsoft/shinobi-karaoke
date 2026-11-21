import { EventEmitter } from 'node:events'
import { ControlPantallaCompleta, type VentanaPantallaCompleta } from './pantallaCompleta'
import { GestorReposo, type BloqueadorReposo } from './reposo'

type EstadoVentana = 'normal' | 'maximizada' | 'pantalla_completa'

export interface VentanaModo extends VentanaPantallaCompleta {
  isMaximized(): boolean
  maximize(): void
}

interface Dependencias {
  /** Gestor compartido con la sesión (ADR 0017 §4). Si falta, se crea uno con `bloqueador`. */
  reposo?: GestorReposo
  bloqueador?: BloqueadorReposo
  fijarZoomActivo(activo: boolean): void
}

export class ControlModoReproductor {
  private ventana: VentanaModo | null = null
  private previo: EstadoVentana | null = null
  private restauracion: EstadoVentana | null = null
  private readonly reposo: GestorReposo
  private readonly pantallaCompleta = new ControlPantallaCompleta({
    alEstabilizar: (deseado) => {
      const ventana = this.ventana
      const maximizar = !deseado && this.restauracion === 'maximizada'
      this.restauracion = null
      if (maximizar && ventana && !ventana.isMaximized()) ventana.maximize()
    }
  })

  constructor(private readonly deps: Dependencias) {
    const reposo = deps.reposo ?? (deps.bloqueador ? new GestorReposo(deps.bloqueador) : null)
    if (!reposo) throw new Error('Hace falta un GestorReposo o un bloqueador')
    this.reposo = reposo
  }

  vincular(ventana: VentanaModo | null): void {
    if (this.ventana === ventana) return
    if (this.ventana) {
      this.ventana.removeListener('closed', this.alCerrar)
      this.evitarReposo(false)
      this.deps.fijarZoomActivo(true)
    }
    this.ventana = ventana
    this.previo = null
    this.restauracion = null
    this.pantallaCompleta.vincular(ventana)
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
    this.pantallaCompleta.fijar(activa)
  }

  estaEnPantallaCompleta(): boolean {
    return this.pantallaCompleta.estaEnPantallaCompleta()
  }

  /** El reproductor local retiene el reposo como titular `local`. */
  evitarReposo(activo: boolean): void {
    if (activo && this.ventana) this.reposo.retener('local')
    else this.reposo.liberar('local')
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
    return this.pantallaCompleta.suscribir(cb)
  }

  private readonly alCerrar = (): void => this.vincular(null)
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
