import { detectarDudosas } from '../../shared/dudosas'
import type { Letra } from '../../shared/letra'
import { detectarVoz } from '../../shared/silencios'
import type { NivelBase } from '../picos/formato'

export interface DepsDudosas {
  picos: { nivelBase(cancionId: string): Promise<NivelBase | null> }
}

/**
 * Líneas dudosas pendientes de la letra guardada (ADR 0024 §3): lo que se guarda en
 * `preparacion.dudosas` para la tarjeta de la Biblioteca. Dato derivado y regenerable. Lee el nivel base
 * de la caché de picos; sin picos solo cuentan los motivos que no necesitan la voz (se recalcula en la
 * siguiente escritura de la letra). `null` si la canción no tiene letra.
 */
export async function contarDudosasGuardadas(
  deps: DepsDudosas,
  cancion: { id: string; letra: Letra | null; metadatos: { duracion_ms: number } }
): Promise<number | null> {
  if (!cancion.letra) return null
  const nivel = await deps.picos.nivelBase(cancion.id)
  const voz = nivel ? detectarVoz({ pasoMs: nivel.pasoMs, pares: nivel.pares }) : null
  const duracionMs = nivel?.duracionMs ?? cancion.metadatos.duracion_ms
  return detectarDudosas(cancion.letra, voz, { duracionMs }).length
}
