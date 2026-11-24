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
  confirmar(opciones?: { comoSalir?: boolean }): Promise<void>
  /** Lo que se pidió y aún no se confirmó (`null` si nada). Para reenviarlo a un renderer que llegó tarde. */
  pendiente(): IntencionCierre | null
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
    pendiente: () => (confirmando ? null : pendiente),
    async confirmar(opciones) {
      // Una confirmación sin solicitud previa no cierra nada.
      if (pendiente === null) return
      // La red de seguridad (0374) siempre sale de la app: no hay ventana a la que volver.
      const intencion: IntencionCierre = opciones?.comoSalir ? 'salir' : pendiente
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

/** Tiempo sin responder del renderer, con una solicitud pendiente, antes de salir sin él (0374, ADR 0025 §5). */
export const PLAZO_RENDERER_MUERTO_MS = 10_000

/** Lo mínimo que se vigila del `webContents` de la ventana principal. */
export interface ContenidoVigilable {
  on(
    evento: 'render-process-gone' | 'destroyed' | 'unresponsive' | 'responsive',
    cb: () => void
  ): unknown
}

/**
 * Red de seguridad del cierre (0374): mientras el renderer responda, la solicitud espera al usuario sin límite.
 * Si se cae, se destruye o no responde durante más de 10 s con una solicitud pendiente, se actúa como si se
 * hubiera confirmado «Salir»: se cancelan los trabajos con motivo `cierre` y el diario se conserva.
 */
export function vigilarRenderer(
  contenido: ContenidoVigilable,
  control: Pick<ControlCierre, 'pendiente' | 'confirmar'>,
  registrar: (mensaje: string) => void,
  plazoMs = PLAZO_RENDERER_MUERTO_MS
): void {
  let temporizador: ReturnType<typeof setTimeout> | null = null
  const parar = (): void => {
    if (temporizador) clearTimeout(temporizador)
    temporizador = null
  }
  const salir = (causa: string): void => {
    if (control.pendiente() === null) return
    parar()
    registrar(
      `[cierre] ${causa} con una solicitud de cierre pendiente: se sale como si se confirmara`
    )
    void control
      .confirmar({ comoSalir: true })
      .catch((e) => registrar(`[cierre] fallo al salir: ${e}`))
  }
  const armar = (): void => {
    temporizador = setTimeout(() => {
      temporizador = null
      // Sin solicitud todavía: se sigue contando mientras no responda.
      if (control.pendiente() === null) armar()
      else salir(`el renderer no responde desde hace ${plazoMs / 1000} s`)
    }, plazoMs)
  }
  contenido.on('render-process-gone', () => salir('el renderer se cayó'))
  contenido.on('destroyed', () => {
    salir('la ventana principal se destruyó')
    parar()
  })
  contenido.on('unresponsive', () => {
    if (!temporizador) armar()
  })
  contenido.on('responsive', parar)
}
