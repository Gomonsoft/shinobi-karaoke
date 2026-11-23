import { describe, expect, it } from 'vitest'
import { cuantasCaben, estimarEspacioLote, estimarTiempoLote } from './lote'

describe('estimaciones del lote (ADR 0026 §1; spec 03)', () => {
  it('100 MB por canción de 4 minutos, proporcional a la duración, más un 10 %', () => {
    const MB = 1024 * 1024
    expect(estimarEspacioLote([240_000])).toBeCloseTo(110 * MB, -1)
    expect(estimarEspacioLote([120_000, 120_000])).toBeCloseTo(110 * MB, -1)
    expect(estimarEspacioLote([])).toBe(0)
    // Duración desconocida: una canción media.
    expect(estimarEspacioLote([null])).toBe(estimarEspacioLote([240_000]))
  })

  it('cuenta cuántas caben con el margen de 1 GB', () => {
    const GB = 1024 ** 3
    const tres = [240_000, 240_000, 240_000]
    expect(cuantasCaben(tres, 100 * GB)).toBe(3)
    expect(cuantasCaben(tres, GB + estimarEspacioLote([240_000, 240_000]))).toBe(2)
    expect(cuantasCaben(tres, GB)).toBe(0)
  })

  it('el tiempo es la duración total por el factor, y dice si alguna duración se desconoce', () => {
    expect(estimarTiempoLote([120_000, 180_000], 0.5)).toEqual({ minutos: 2.5, conocida: true })
    expect(estimarTiempoLote([120_000, null], 0.5)).toEqual({ minutos: 1, conocida: false })
    expect(estimarTiempoLote([120_000], null)).toBeNull()
  })
})
