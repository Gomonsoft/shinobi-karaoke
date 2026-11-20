import { ESTILO_PREDETERMINADO, type Estilo } from '../../shared/estilo'
import type {
  EntradaIpc,
  EstadoSecundariaIpc,
  EstadoSesionIpc,
  TransicionIpc
} from '../../shared/sesion'
import { candidata } from './cola'
import { posicionActual, restanteTransicion, type EstadoMaquina, type Sesion } from './maquina'

/**
 * Proyecciones del estado de la máquina a lo que cruza la IPC (ADR 0017 §5 y §10). Puras: el reloj
 * llega como argumento. `restanteMs` queda congelado si hay un cierre pendiente.
 */

function transicionIpc(s: Sesion, ahoraMs: number): TransicionIpc | null {
  const t = s.transicion
  if (!t) return null
  return {
    transicionId: t.transicionId,
    candidataId: t.candidataId,
    restanteMs: restanteTransicion(t, ahoraMs),
    duracionMs: t.duracionMs,
    congelada: t.restanteCongeladoMs !== null
  }
}

export function aIpcPrincipal(estado: EstadoMaquina, ahoraMs: number): EstadoSesionIpc {
  const { cola, sesion } = estado
  return {
    revision: estado.revision,
    sesion: sesion && {
      sesionId: sesion.sesionId,
      fase: sesion.fase,
      pantalla: sesion.pantalla,
      pantallaCompleta: sesion.pantallaCompleta,
      cierrePendiente: sesion.cierrePendiente,
      transicion: transicionIpc(sesion, ahoraMs),
      error: sesion.error,
      incidencia: sesion.incidencia
    },
    activa:
      cola.activa && sesion
        ? {
            ...cola.activa,
            posicionMs: posicionActual(sesion, ahoraMs),
            duracionMs: sesion.reproduccion.duracionMs
          }
        : null,
    pendientes: [...cola.pendientes],
    contexto: cola.contexto && { ...cola.contexto },
    incidencia: estado.incidencia
  }
}

/** `null` sin sesión: la secundaria no existe. `estiloDe` resuelve el estilo vigente de la candidata. */
export function aIpcSecundaria(
  estado: EstadoMaquina,
  ahoraMs: number,
  estiloDe: (cancionId: string) => Estilo = () => structuredClone(ESTILO_PREDETERMINADO)
): EstadoSecundariaIpc | null {
  const { cola, sesion } = estado
  if (!sesion) return null
  const verCandidata = sesion.fase === 'transicion' || sesion.fase === 'espera'
  const c: EntradaIpc | null = verCandidata ? candidata(cola) : null
  const t = transicionIpc(sesion, ahoraMs)
  return {
    revision: estado.revision,
    sesionId: sesion.sesionId,
    fase: sesion.fase,
    candidata: c && { titulo: c.titulo, artista: c.artista, estilo: estiloDe(c.cancionId) },
    transicion: t && {
      transicionId: t.transicionId,
      restanteMs: t.restanteMs,
      duracionMs: t.duracionMs,
      congelada: t.congelada
    },
    hayPendientes: cola.pendientes.length > 0,
    cierrePendiente: sesion.cierrePendiente,
    motivoFallo: sesion.fase === 'error' ? (sesion.error?.motivo ?? 'otro') : null
  }
}
