/**
 * Solicitud de cierre (tarea 0036): con una instalación en curso, cerrar la ventana o salir no se
 * hace al momento; main pide confirmación al renderer (`app:solicitudCierre`) y solo actúa cuando
 * este responde con `app.confirmarCierre()`. Desde la 0073 también cubre los trabajos de la cola
 * (ux/04 §3).
 */

/** Qué impide cerrar sin preguntar: la instalación del runtime o algún trabajo de la cola. */
export interface FuentesEnCurso {
  instalando(): boolean
  /** Trabajos en curso o en cola (`GestorTrabajos.hayPendientes`). No incluye consultas interactivas. */
  hayTrabajos(): boolean
  guardadoPendiente?(): boolean
}

export function hayAlgoEnCurso(fuentes: FuentesEnCurso): boolean {
  return fuentes.instalando() || fuentes.hayTrabajos() || (fuentes.guardadoPendiente?.() ?? false)
}

export interface EventoCancelable {
  preventDefault(): void
}

export interface DependenciasCierre {
  /** Hay algo que no debe interrumpirse sin preguntar (hoy, la instalación del runtime). */
  hayAlgoEnCurso(): boolean
  /** Envía `app:solicitudCierre` al renderer. */
  pedirConfirmacion(): void
  /** Pausa lo que esté en curso y espera a que no queden procesos. */
  pausar(): Promise<void>
  cerrarVentana(): void
  salir(): void
}

export interface ControlCierre {
  /** Evento `close` de la ventana. */
  alCerrarVentana(evento: EventoCancelable): void
  /** Evento `before-quit` de la app (Salir, Cmd+Q). */
  alSalir(evento: EventoCancelable): void
  /** El renderer confirmó: pausa y vuelve a cerrar o salir según lo que se pidió. */
  confirmar(): Promise<void>
}

export function crearControlCierre(deps: DependenciasCierre): ControlCierre {
  let pendiente: 'ventana' | 'salir' | null = null
  let confirmando = false
  let reentrada = false

  function interceptar(evento: EventoCancelable, intencion: 'ventana' | 'salir'): void {
    if (reentrada || !deps.hayAlgoEnCurso()) return
    evento.preventDefault()
    if (confirmando) return
    pendiente = intencion
    deps.pedirConfirmacion()
  }

  return {
    alCerrarVentana: (evento) => interceptar(evento, 'ventana'),
    alSalir: (evento) => interceptar(evento, 'salir'),
    async confirmar() {
      // Una confirmación sin solicitud previa no cierra nada.
      const intencion = pendiente
      if (intencion === null) return
      pendiente = null
      confirmando = true
      try {
        await deps.pausar()
        reentrada = true
        if (intencion === 'salir') deps.salir()
        else deps.cerrarVentana()
      } finally {
        reentrada = false
        confirmando = false
      }
    }
  }
}
