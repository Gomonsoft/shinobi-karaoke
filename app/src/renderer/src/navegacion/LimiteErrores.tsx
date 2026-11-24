import { Component, type ErrorInfo, type ReactNode } from 'react'
import { informarError, leerContextoError } from '../soporte/erroresInterfaz'
import { iniciarSalvamento, reiniciarSalvamento } from '../soporte/salvamento'
import { PantallaError, type DetallesError, type VarianteError } from './PantallaError'

/** Un segundo fallo antes de este plazo tras «Volver a cargar» se trata como repetido (spec: 10 s). */
export const PLAZO_REPETIDO_MS = 10_000

interface Props {
  variante: VarianteError
  /** Identifica la vista: al cambiar, el límite se reinicia (ERR-3). */
  clave?: string
  /** Texto de la vista para `app.log` y los detalles (`cancion/editor`). */
  vista?: string
  cancionId?: string
  /** La vista que falló es el editor. */
  esEditor?: boolean
  alBiblioteca?: () => void
  alSalir?: () => void
  /** G: qué hace «Volver a cargar la ventana» (por defecto, recargar). */
  alRecargarVentana?: () => void
  children: ReactNode
}

interface Estado {
  fallo: { error: Error; componentes: string; hora: string } | null
  repetido: boolean
}

/**
 * Límite de errores de dibujo (ux/00 · «Pantalla de error de la interfaz»). Atrapa lo que lanza el árbol de
 * debajo, lo escribe en `app.log` con su pila de componentes, intenta enviar lo pendiente del editor y muestra la
 * pantalla de error en lugar de dejar la ventana en negro.
 */
export class LimiteErrores extends Component<Props, Estado> {
  state: Estado = { fallo: null, repetido: false }
  private ultimoReinicio = -Infinity

  static getDerivedStateFromError(error: unknown): Partial<Estado> {
    const e = error instanceof Error ? error : new Error(String(error))
    // Lo antes posible: antes de que React ejecute las limpiezas de la vista caída, con su sesión aún abierta.
    void iniciarSalvamento()
    return { fallo: { error: e, componentes: '', hora: new Date().toISOString() } }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    informarError('react', error, info.componentStack)
    // Antes de que React ejecute las limpiezas de la vista caída: el guardado pendiente se envía, no se descarta.
    void iniciarSalvamento()
    if (this.props.variante === 'publico') console.error(error)
    this.setState((s) =>
      s.fallo
        ? {
            fallo: { ...s.fallo, componentes: info.componentStack ?? '' },
            repetido: performance.now() - this.ultimoReinicio < PLAZO_REPETIDO_MS
          }
        : null
    )
  }

  componentDidUpdate(previas: Props): void {
    if (previas.clave !== this.props.clave && this.state.fallo) this.reiniciar(false)
  }

  private reiniciar(recarga: boolean): void {
    reiniciarSalvamento()
    if (recarga) this.ultimoReinicio = performance.now()
    this.setState({ fallo: null, repetido: false })
  }

  render(): ReactNode {
    const { fallo, repetido } = this.state
    if (!fallo) return this.props.children
    const { variante, esEditor } = this.props
    const contexto = leerContextoError()
    const vista = this.props.vista ?? contexto.vista ?? 'desconocida'
    const cancionId = this.props.cancionId ?? contexto.cancionId
    const detalles: DetallesError = {
      hora: fallo.hora,
      vista,
      ...(cancionId ? { cancionId } : {}),
      mensaje: `${fallo.error.name}: ${fallo.error.message}`.slice(0, 500),
      pila: (fallo.error.stack ?? '').slice(0, 3000),
      componentes: fallo.componentes
    }
    return (
      <PantallaError
        variante={variante}
        detalles={detalles}
        esEditor={esEditor}
        repetido={repetido}
        alRecargar={
          variante === 'vista'
            ? () => this.reiniciar(true)
            : variante === 'global'
              ? (this.props.alRecargarVentana ?? (() => window.location.reload()))
              : undefined
        }
        alBiblioteca={this.props.alBiblioteca}
        alSalir={this.props.alSalir}
      />
    )
  }
}
