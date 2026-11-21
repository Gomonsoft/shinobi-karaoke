import { finEfectivo, type Letra } from './letra'
import { tiempoMostrado } from './letras/tiempos'

/** Antelación y margen final al escuchar una línea (doble clic en su región, Mayús + L; ADR 0021 §8). */
export const MARGEN_ESCUCHA_LINEA_MS = 500
/** Antelación y margen final al escuchar una palabra en el editor preciso (ADR 0021 §9). */
export const MARGEN_ESCUCHA_PALABRA_MS = 250

export interface TramoEscucha {
  desdeMs: number
  hastaMs: number
}

/**
 * Tramo de audio (en tiempo de audio, con `offset_ms` aplicado) que se oye al escuchar una línea:
 * de `máx(0, inicio − margen)` a `mín(duración, fin efectivo + margen)`.
 * `null` si la línea no existe, no tiene inicio o cae por completo fuera del audio.
 */
export function tramoEscuchaLinea(
  letra: Pick<Letra, 'lineas' | 'offset_ms'>,
  id: string,
  duracionMs: number,
  margenMs: number = MARGEN_ESCUCHA_LINEA_MS
): TramoEscucha | null {
  const linea = letra.lineas.find((el) => el.id === id)
  if (linea?.tipo !== 'linea' || linea.inicio_ms === null) return null
  const fin = finEfectivo(letra, id, duracionMs)
  if (fin === null) return null
  const inicioAudio = tiempoMostrado(linea.inicio_ms, letra.offset_ms)
  const finAudio = tiempoMostrado(fin, letra.offset_ms)
  if (inicioAudio >= duracionMs || finAudio <= 0) return null
  return {
    desdeMs: Math.max(0, inicioAudio - margenMs),
    hastaMs: Math.min(duracionMs, finAudio + margenMs)
  }
}
