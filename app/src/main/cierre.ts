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
  /** Hay una sesión abierta en la ventana secundaria (ADR 0017 §9). */
  sesionActiva?(): boolean
  /** Hay entradas pendientes o una activa en la cola de reproducción. */
  colaNoVacia?(): boolean
  /** Hay exportaciones de video en curso o en cola (0237); en macOS, cerrar la ventana no las detiene. */
  exportando?(): boolean
}

/** Qué hay en curso, para que el renderer elija el texto (`app:solicitudCierre`). */
export interface MotivoCierre {
  trabajos: boolean
  sesion: boolean
  cola: boolean
}

export function motivoDeCierre(fuentes: FuentesEnCurso): MotivoCierre {
  return {
    trabajos:
      fuentes.instalando() ||
      fuentes.hayTrabajos() ||
      (fuentes.guardadoPendiente?.() ?? false) ||
      (fuentes.exportando?.() ?? false),
    sesion: fuentes.sesionActiva?.() ?? false,
    cola: fuentes.colaNoVacia?.() ?? false
  }
}

export function hayAlgoEnCurso(fuentes: FuentesEnCurso): boolean {
  const m = motivoDeCierre(fuentes)
  return m.trabajos || m.sesion || m.cola
}

/** Qué se pidió: cerrar la ventana principal o salir de la aplicación. */
export type IntencionCierre = 'ventana' | 'salir'

export interface EventoCancelable {
  preventDefault(): void
}

export interface DependenciasCierre {
  /** Hay algo que no debe interrumpirse sin preguntar (instalación, trabajos, sesión o cola). */
  hayAlgoEnCurso(intencion: IntencionCierre): boolean
  /** Envía `app:solicitudCierre` al renderer, con el motivo y la variante. */
  pedirConfirmacion(intencion: IntencionCierre): void
  /** Pausa lo que esté en curso y espera a que no queden procesos (con la intención, p. ej. macOS conserva las exportaciones al cerrar la ventana). */
  pausar(intencion: IntencionCierre): Promise<void>
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
  let pendiente: IntencionCierre | null = null
  let confirmando = false
  let reentrada = false

  function interceptar(evento: EventoCancelable, intencion: IntencionCierre): void {
    if (reentrada || !deps.hayAlgoEnCurso(intencion)) return
    evento.preventDefault()
    if (confirmando) return
    pendiente = intencion
    deps.pedirConfirmacion(intencion)
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
        await deps.pausar(intencion)
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
