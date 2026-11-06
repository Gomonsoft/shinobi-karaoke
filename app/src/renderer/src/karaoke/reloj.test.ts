import { describe, expect, it } from 'vitest'
import { ctxOidoEn, msCancionEn, reanclar } from './reloj'

describe('reloj de salida', () => {
  it.each([0.5, 0.75, 1])('mide el mismo punto del audio a %s×', (velocidad) => {
    const inicial = { ctxInicio: 1, posInicioMs: 3000, velocidad: 1 }
    const anclaje = reanclar(inicial, 2, velocidad)
    expect(anclaje.posInicioMs).toBe(4000)
    // Se hizo seek a 10 s y el evento llegó cuando ya habían sonado 1,5 s de la pista.
    const trasSeek = { ...anclaje, ctxInicio: 4, posInicioMs: 10_000 }
    const ctxEvento = 4 + 1.5 / velocidad
    const perfEvento = 1000 * (ctxEvento + 0.04)
    const ahora = { ctx: ctxEvento + 0.09, perf: perfEvento + 50 }
    for (const marca of [
      { contextTime: ctxEvento + 0.025, performanceTime: perfEvento + 25 },
      null,
      { contextTime: 0, performanceTime: 0 }
    ]) {
      const oido = ctxOidoEn(perfEvento, marca, ahora, 0.04)
      expect(Math.abs(msCancionEn(oido, trasSeek) - 11_500)).toBeLessThanOrEqual(20)
    }
  })
})
