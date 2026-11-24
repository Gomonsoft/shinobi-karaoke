import { finEfectivo, type Letra } from './letra'
import { parteDe } from './reparto'

/*
 * Voz original en las líneas de coro (ADR 0030 §2). Una función pura del tiempo que comparten el
 * reproductor, la vista previa del editor y la exportación: mismo instante, mismo nivel. Los tiempos son
 * de audio (`inicio_ms + offset_ms`). Las constantes son provisionales (se ajustan a oído en la guía
 * manual) y cambiarlas no cambia el contrato.
 */

/** Cuánto antes del inicio de la línea de coro empieza el tramo. */
export const CORO_ANTES_MS = 150
/** Cuánto después de su fin efectivo termina el tramo. */
export const CORO_DESPUES_MS = 300
/** Tramos separados por menos de esto se unen en uno. */
export const CORO_UNIR_MS = 1000
/** Duración de cada rampa de subida y de bajada. */
export const CORO_RAMPA_MS = 150

export interface TramoCoro {
  desdeMs: number
  hastaMs: number
}

/** Punto de la envolvente: `[ms, nivel]`, nivel de 0 a 1. */
export type PuntoEnvolvente = [number, number]

/**
 * Tramos de audio en los que suena la voz por ser coro: de `inicio − 150 ms` a `finEfectivo + 300 ms` de
 * cada línea `coro` con inicio; los separados por menos de 1 s se unen y todo se recorta a
 * `[0, duracionMs]`. Las líneas sin inicio no cuentan.
 */
export function tramosCoro(
  letra: Pick<Letra, 'lineas' | 'offset_ms' | 'partes'>,
  duracionMs: number
): TramoCoro[] {
  const sueltos: TramoCoro[] = []
  for (const l of letra.lineas) {
    if (l.tipo !== 'linea' || l.inicio_ms === null || parteDe(l, letra) !== 'coro') continue
    const fin = finEfectivo(letra, l.id, duracionMs)
    if (fin === null) continue
    sueltos.push({
      desdeMs: Math.max(0, l.inicio_ms + letra.offset_ms - CORO_ANTES_MS),
      hastaMs: Math.min(duracionMs, fin + letra.offset_ms + CORO_DESPUES_MS)
    })
  }
  sueltos.sort((a, b) => a.desdeMs - b.desdeMs)
  const unidos: TramoCoro[] = []
  for (const t of sueltos) {
    const ultimo = unidos[unidos.length - 1]
    if (ultimo && t.desdeMs - ultimo.hastaMs < CORO_UNIR_MS) {
      ultimo.hastaMs = Math.max(ultimo.hastaMs, t.hastaMs)
    } else {
      unidos.push({ ...t })
    }
  }
  return unidos.filter((t) => t.hastaMs > t.desdeMs)
}

/**
 * Curva lineal a trozos del nivel: sube en `[desde, desde + 150]` y baja en `[hasta − 150, hasta]`
 * (en un tramo más corto de 300 ms, cada rampa dura la mitad). Con `nivel = 0` o sin tramos, `[]`.
 * Los `ms` son estrictamente crecientes.
 */
export function envolvente(tramos: readonly TramoCoro[], nivel: number): PuntoEnvolvente[] {
  if (!(nivel > 0) || tramos.length === 0) return []
  const puntos: PuntoEnvolvente[] = []
  const poner = (ms: number, n: number): void => {
    const ultimo = puntos[puntos.length - 1]
    if (!ultimo || ms > ultimo[0]) puntos.push([ms, n])
  }
  for (const { desdeMs, hastaMs } of tramos) {
    if (hastaMs - desdeMs < 2) continue
    const rampa = Math.min(CORO_RAMPA_MS, Math.floor((hastaMs - desdeMs) / 2))
    poner(desdeMs, 0)
    poner(desdeMs + rampa, nivel)
    poner(hastaMs - rampa, nivel)
    poner(hastaMs, 0)
  }
  return puntos
}

/** Nivel en `ms` por interpolación lineal; 0 fuera de los puntos. */
export function nivelEn(puntos: readonly PuntoEnvolvente[], ms: number): number {
  const primero = puntos[0]
  const ultimo = puntos[puntos.length - 1]
  if (!primero || !ultimo || ms <= primero[0] || ms >= ultimo[0]) return 0
  let i = 1
  while (puntos[i]![0] < ms) i++
  const [x0, y0] = puntos[i - 1]!
  const [x1, y1] = puntos[i]!
  return y0 + ((y1 - y0) * (ms - x0)) / (x1 - x0)
}
