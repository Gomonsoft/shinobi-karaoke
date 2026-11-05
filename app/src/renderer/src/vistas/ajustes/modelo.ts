import type { Config } from '@shared/config'
import type { EstadoRuntimeIpc } from '@shared/ipc'
import { intervalo } from '../primer-arranque/modelo'
import { AJ } from './textos'

/**
 * Modelo efectivo (el que usará la próxima separación, `ux/08`): Rápido solo con modo `rapido`,
 * consentimiento y modelo verificado; un `automatico` guardado o cualquier carencia es Calidad.
 */
export function modeloEfectivo(config: Config): 'calidad' | 'rapido' {
  const s = config.separacion
  return s.modo === 'rapido' &&
    s.rapido_aceptado !== null &&
    s.modelos_descargados.includes('rapido')
    ? 'rapido'
    : 'calidad'
}

/** `aj.sep.equipo` (preguntas/0021 §4) a partir del estado del runtime y la GPU detectada. */
export function descripcionEquipo(
  estado: Pick<EstadoRuntimeIpc, 'perfil' | 'perfilPrevisto'>,
  vramMb: number | null
): string {
  if (estado.perfilPrevisto === 'cuda' && estado.perfil === 'cpu') return AJ.equipoNvidiaRebajada
  if (estado.perfil === 'cuda') {
    return vramMb === null ? AJ.equipoNvidia : AJ.equipoNvidiaVram(Math.round(vramMb / 1024))
  }
  if (estado.perfil === 'mps') return AJ.equipoApple
  return AJ.equipoCpu
}

export interface EstimacionAj {
  min: number
  max: number
  origen: 'medido_equipo' | 'referencia_medida' | 'estimado'
}

/** `aj.sep.tiempo` / `.aprox`; `null` sin estimación (no se muestra la frase). */
export function textoTiempo(e: EstimacionAj | null): string | null {
  if (e === null) return null
  const [a, b] = intervalo(e)
  const aprox = e.origen === 'estimado'
  if (a === b) return aprox ? AJ.tiempoIgualAprox(a) : AJ.tiempoIgual(a)
  return aprox ? AJ.tiempoAprox(a, b) : AJ.tiempo(a, b)
}

/** Intervalo `{a} y {b}` para `aj.sep.calidad.info` y el diálogo. */
export function rangoMinutos(e: EstimacionAj | null): [number, number] | null {
  return e === null ? null : intervalo(e)
}

export const textoMb = (bytes: number): string => `${String(Math.round(bytes / 1e6))} MB`

export const fechaLarga = (iso: string): string =>
  new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
