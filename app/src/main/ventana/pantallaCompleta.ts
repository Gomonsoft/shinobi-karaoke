type EventoVentana = 'enter-full-screen' | 'leave-full-screen' | 'closed'

export interface VentanaPantallaCompleta {
  isFullScreen(): boolean
  setFullScreen(activa: boolean): void
  on(evento: EventoVentana, cb: () => void): void
  removeListener(evento: string, cb: () => void): void
}

interface Opciones {
  /**
   * Se llama cuando el estado deseado ya es el real (al terminar de aplicarlo). Lo usa el
   * reproductor local para restaurar la maximización.
   */
  alEstabilizar?: (deseado: boolean) => void
}

/**
 * Pantalla completa de una ventana (ADR 0011 §1, ADR 0017 §2): estado deseado, transiciones
 * asíncronas de macOS y suscripción a los cambios reales. Se extrajo de `ControlModoReproductor`.
 */
export class ControlPantallaCompleta {
  private ventana: VentanaPantallaCompleta | null = null
  private deseado: boolean | null = null
  private transicion = false
  private readonly suscriptores = new Set<(activa: boolean) => void>()

  constructor(private readonly opciones: Opciones = {}) {}

  vincular(ventana: VentanaPantallaCompleta | null): void {
    if (this.ventana === ventana) return
    this.ventana?.removeListener('enter-full-screen', this.alEntrar)
    this.ventana?.removeListener('leave-full-screen', this.alSalir)
    this.ventana?.removeListener('closed', this.alCerrar)
    this.ventana = ventana
    this.deseado = null
    this.transicion = false
    ventana?.on('enter-full-screen', this.alEntrar)
    ventana?.on('leave-full-screen', this.alSalir)
    ventana?.on('closed', this.alCerrar)
  }

  fijar(activa: boolean): void {
    if (!this.ventana) return
    this.deseado = activa
    this.aplicarPendiente()
  }

  estaEnPantallaCompleta(): boolean {
    return this.ventana?.isFullScreen() ?? false
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
    for (const cb of [...this.suscriptores]) cb(activa)
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
    const deseado = this.deseado
    this.deseado = null
    this.opciones.alEstabilizar?.(deseado)
  }
}
