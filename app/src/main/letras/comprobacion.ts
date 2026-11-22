import { evaluarEncajeConPicos, type VeredictoEncaje } from '../../shared/encaje'
import { AVISOS, type AvisoTrabajoIpc } from '../../shared/avisos'
import type { ServicioBiblioteca } from '../biblioteca/servicio'
import type { NivelBase } from '../picos/formato'
import type { ServicioLetras } from './servicio'

export interface DepsComprobacion {
  biblioteca: Pick<ServicioBiblioteca, 'obtener'>
  letras: Pick<ServicioLetras, 'corregirDesfaseDiferido'>
  picos: { nivelBase(cancionId: string): Promise<NivelBase | null> }
  /** Aviso con [Deshacer] al renderer; no se llama dentro de una tanda de varias canciones. */
  avisar?: (aviso: AvisoTrabajoIpc) => void
  /** `true` si la canción forma parte de una tanda de varias (spec 04, feature 7: sin toast por canción). */
  enTandaDeVarias?: (cancionId: string) => boolean
}

export interface ResultadoComprobacionGuardada {
  veredicto: VeredictoEncaje
  desfaseMs: number
  /** Desfase aplicado a la letra; `null` si no se tocó. */
  corregido: number | null
}

/**
 * Comprueba la letra guardada contra la voz (ADR 0024 §2, F4-L7) y, si está `desfasada` y la regla de
 * corrección automática lo permite (letra intacta, sin corrección, canción en borrador), la corrige.
 * La llama main cuando los picos quedan listos; la reutiliza la preparación desatendida. Con la letra
 * ya tocada no hace nada: la vista Letra y el editor muestran la propuesta.
 */
export async function comprobarLetraGuardada(
  deps: DepsComprobacion,
  cancionId: string
): Promise<ResultadoComprobacionGuardada | null> {
  const cancion = deps.biblioteca.obtener(cancionId)
  if (!cancion?.letra) return null
  const nivel = await deps.picos.nivelBase(cancionId)
  if (!nivel) return null
  const r = evaluarEncajeConPicos(
    cancion.letra,
    { pasoMs: nivel.pasoMs, pares: nivel.pares },
    { duracionMs: nivel.duracionMs }
  )
  const resultado: ResultadoComprobacionGuardada = {
    veredicto: r.veredicto,
    desfaseMs: r.desfaseMs,
    corregido: null
  }
  if (r.veredicto !== 'desfasada') return resultado
  const aplicado = await deps.letras.corregirDesfaseDiferido(cancionId, r.desfaseMs)
  if (aplicado === null) return resultado
  resultado.corregido = aplicado
  if (!deps.enTandaDeVarias?.(cancionId)) {
    deps.avisar?.({
      cancionId,
      tipo: 'desfase',
      texto: AVISOS.desfase(cancion.metadatos.titulo, aplicado),
      etiqueta: AVISOS.etiquetaDesfase,
      destino: 'editor'
    })
  }
  return resultado
}
