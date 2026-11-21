/** Generador de picos de voz sintéticos (formato de 0015: bloques de 10 ms, pares [min, max] int16). */
import type { PicosVoz } from '../silencios'

const PASO_MS = 10

const amplitud = (dbfs: number): number => Math.min(32767, Math.round(32768 * 10 ** (dbfs / 20)))

export interface EspecificacionPicos {
  duracionMs: number
  /** Ruido residual de fondo. Por defecto −70 dBFS. */
  ruidoDbfs?: number
  /** Voz a nivel constante en [desdeMs, hastaMs). */
  tramos?: { desdeMs: number; hastaMs: number; dbfs: number }[]
  /** Cola con decaimiento lineal en dB desde `dbfsInicial` hasta `dbfsFinal` en `duracionMs`. */
  colas?: { desdeMs: number; duracionMs: number; dbfsInicial: number; dbfsFinal: number }[]
  /** Ráfagas breves a un nivel dado. */
  rafagas?: { desdeMs: number; duracionMs: number; dbfs: number }[]
}

export function generarPicos({
  duracionMs,
  ruidoDbfs = -70,
  tramos = [],
  colas = [],
  rafagas = []
}: EspecificacionPicos): PicosVoz {
  const bloques = Math.ceil(duracionMs / PASO_MS)
  const pares = new Int16Array(bloques * 2)
  for (let i = 0; i < bloques; i++) {
    const ini = i * PASO_MS
    const fin = ini + PASO_MS
    let a = amplitud(ruidoDbfs)
    for (const t of tramos) {
      if (t.desdeMs < fin && t.hastaMs > ini) a = Math.max(a, amplitud(t.dbfs))
    }
    for (const r of rafagas) {
      if (r.desdeMs < fin && r.desdeMs + r.duracionMs > ini) a = Math.max(a, amplitud(r.dbfs))
    }
    for (const c of colas) {
      if (c.desdeMs < fin && c.desdeMs + c.duracionMs > ini) {
        // El pico del bloque es el nivel de su comienzo.
        const x = Math.max(0, ini - c.desdeMs) / c.duracionMs
        a = Math.max(a, amplitud(c.dbfsInicial + (c.dbfsFinal - c.dbfsInicial) * x))
      }
    }
    pares[2 * i] = -a
    pares[2 * i + 1] = a
  }
  return { pasoMs: PASO_MS, pares }
}
