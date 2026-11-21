import type { EstadoSesionIpc } from '@shared/sesion'
import { SES } from './textos'

/**
 * Aplica un estado recibido (evento o respuesta de un canal): se descartan las revisiones menores
 * o iguales a la vigente (ADR 0017 §11), así que una respuesta tardía nunca pisa a una más nueva.
 */
export function aplicarEstado(
  actual: EstadoSesionIpc | null,
  nuevo: EstadoSesionIpc
): EstadoSesionIpc {
  return actual === null || nuevo.revision > actual.revision ? nuevo : actual
}

export const haySesion = (estado: EstadoSesionIpc | null): boolean => estado?.sesion != null

/** La sesión bloquea la edición desde que se abre hasta que la secundaria se cierra (spec 06). */
export const edicionBloqueada = haySesion

export type TipoIndicador = 'otraPantalla' | 'pausa' | 'cuenta' | 'espera' | 'atencion' | 'cola'

export interface DatosIndicador {
  tipo: TipoIndicador
  /** Texto visible (`ses.ind`). */
  texto: string
  /** Estado para el nombre accesible (`ses.ind.aria`). */
  aria: string
  /** Segundos de la cuenta, para refrescarlos con un reloj local. */
  restanteMs?: number
  congelada?: boolean
}

const segundos = (ms: number): number => Math.max(0, Math.ceil(ms / 1000))

/** Texto de «Siguiente en {n} s» para un `restanteMs`. */
export const textoCuenta = (restanteMs: number): string => SES.ind.siguienteEn(segundos(restanteMs))

/**
 * Qué muestra el indicador de la barra superior (spec 02, «Indicador de sesión»); `null` si no
 * hay sesión ni cola ni incidencia que enseñar.
 */
export function datosIndicador(estado: EstadoSesionIpc | null): DatosIndicador | null {
  if (!estado) return null
  const { sesion } = estado
  const atencion = (): DatosIndicador => ({
    tipo: 'atencion',
    texto: SES.ind.atencion,
    aria: SES.ind.atencion
  })
  if (sesion) {
    if (sesion.fase === 'error' || sesion.error || sesion.incidencia) return atencion()
    switch (sesion.fase) {
      case 'pausada':
        return { tipo: 'pausa', texto: SES.ind.enPausa, aria: SES.ind.enPausa }
      case 'transicion': {
        const t = sesion.transicion
        if (!t) return { tipo: 'espera', texto: SES.ind.enEspera, aria: SES.ind.enEspera }
        const texto = textoCuenta(t.restanteMs)
        return {
          tipo: 'cuenta',
          texto,
          aria: texto,
          restanteMs: t.restanteMs,
          congelada: t.congelada
        }
      }
      case 'espera':
      case 'fin_de_cola':
        return { tipo: 'espera', texto: SES.ind.enEspera, aria: SES.ind.enEspera }
      default:
        return {
          tipo: 'otraPantalla',
          texto: SES.ind.enOtraPantalla,
          aria: SES.ind.enOtraPantalla
        }
    }
  }
  if (estado.incidencia) return atencion()
  const n = estado.pendientes.length
  if (n === 0) return null
  return { tipo: 'cola', texto: SES.ind.cola(n), aria: SES.ind.ariaSinSesion(n) }
}
