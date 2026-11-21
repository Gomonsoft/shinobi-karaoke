import type { EstadoSesionIpc } from '@shared/sesion'
import { SES } from '../../../sesion/textos'

/** Canción con la que se pide empezar (`Reproducir en otra pantalla…`). */
export interface CancionDeInicio {
  cancionId: string
  titulo: string
  artista: string
}

/** Última reproducida interrumpida (con posición), si la hay: la que `inicio: cancion` descarta. */
export function interrumpidaDe(
  estado: EstadoSesionIpc | null
): { titulo: string; ms: number } | null {
  const c = estado?.contexto
  if (!c || c.terminada || c.posicionMs === null) return null
  return { titulo: c.entrada.titulo, ms: c.posicionMs }
}

/**
 * `ses.empieza.*` según el inicio y la cola (spec 02, «Empezará con»): cola vacía, con
 * pendientes, con una última reproducida interrumpida o terminada y con canción.
 */
export function textoEmpieza(
  estado: EstadoSesionIpc | null,
  cancion: CancionDeInicio | null
): string {
  const pendientes = estado?.pendientes ?? []
  const interrumpida = interrumpidaDe(estado)
  if (cancion) {
    return SES.empieza.conCancion(cancion.titulo, cancion.artista, pendientes.length, interrumpida)
  }
  const contexto = estado?.contexto ?? null
  if (interrumpida) return SES.empieza.interrumpida(interrumpida.titulo, interrumpida.ms)
  const primera = pendientes[0]
  if (contexto) {
    return primera
      ? SES.empieza.terminada(contexto.entrada.titulo, primera.titulo)
      : SES.empieza.terminadaSinPendientes(contexto.entrada.titulo)
  }
  return primera ? SES.empieza.conCola(primera.titulo, primera.artista) : SES.empieza.vacia
}
