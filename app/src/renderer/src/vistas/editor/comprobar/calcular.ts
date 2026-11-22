import { evaluarEncaje, MIN_LINEAS_ENCAJE, type ResultadoEncaje } from '@shared/encaje'
import type { ApiShinobi, EstadoPicos } from '@shared/ipc'
import type { Letra } from '@shared/letra'
import { tienePalabrasManuales } from '@shared/letra'
import { detectarVoz } from '@shared/silencios'
import { leerPicosBase } from '../picosBase'

export type MotivoComprobar =
  | { tipo: 'lineas' }
  | { tipo: 'separacion' }
  | { tipo: 'preparando' }
  | { tipo: 'error' }
  | { tipo: 'noDisponible' }

export interface EntradaMotivosComprobar {
  letra: Letra
  separacionDisponible: boolean
  /** Estado de los picos si el editor los está leyendo; `null` si no se sabe. */
  picos: EstadoPicos['estado'] | null
}

/** Líneas con inicio (con menos de `MIN_LINEAS_ENCAJE` la medida es `no_comprobable`, ADR 0024 §1). */
export const lineasConInicio = (letra: Letra): number =>
  letra.lineas.filter((l) => l.tipo === 'linea' && l.inicio_ms !== null).length

/** Qué falta para comprobar la letra, en el orden en que se muestra (spec 06 · F4, «Precondición»). */
export function motivosComprobar(e: EntradaMotivosComprobar): MotivoComprobar[] {
  const motivos: MotivoComprobar[] = []
  if (lineasConInicio(e.letra) < MIN_LINEAS_ENCAJE) motivos.push({ tipo: 'lineas' })
  if (!e.separacionDisponible) motivos.push({ tipo: 'separacion' })
  else if (e.picos === 'generando') motivos.push({ tipo: 'preparando' })
  else if (e.picos === 'error') motivos.push({ tipo: 'error' })
  else if (e.picos === 'no_disponible') motivos.push({ tipo: 'noDisponible' })
  return motivos
}

export type ResultadoComprobacion =
  | { ok: true; encaje: ResultadoEncaje }
  | { ok: false; motivo: 'preparando' | 'error' | 'noDisponible' }

/** Lee el nivel base de los picos (con su memo) y evalúa el encaje de la letra en memoria. */
export async function calcularEncajeEditor(e: {
  api: Pick<ApiShinobi, 'picos'>
  cancionId: string
  letra: Letra
  duracionMs: number
}): Promise<ResultadoComprobacion> {
  const picos = await leerPicosBase(e.api, e.cancionId, e.duracionMs)
  if (picos.estado !== 'lista') {
    return {
      ok: false,
      motivo:
        picos.estado === 'generando'
          ? 'preparando'
          : picos.estado === 'error'
            ? 'error'
            : 'noDisponible'
    }
  }
  const voz = detectarVoz({ pasoMs: picos.pasoMs, pares: picos.pares })
  return { ok: true, encaje: evaluarEncaje(e.letra, voz, { duracionMs: e.duracionMs }) }
}

/** Líneas con tiempos por palabra hechos a mano (el diálogo avisa de que se mueven con la letra). */
export const lineasConPalabrasManuales = (letra: Letra): number =>
  letra.lineas.filter((l) => l.tipo === 'linea' && tienePalabrasManuales(l)).length

/** ¿La corrección sigue valiendo? Mismo veredicto y desfase a ≤ 50 ms (spec 06 · F4, «Si cambia algo…»). */
export const mismaPropuesta = (a: ResultadoEncaje, b: ResultadoEncaje): boolean =>
  b.veredicto === 'desfasada' &&
  a.veredicto === 'desfasada' &&
  Math.abs(a.desfaseMs - b.desfaseMs) <= 50
