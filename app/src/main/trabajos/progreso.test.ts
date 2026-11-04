import { describe, expect, it } from 'vitest'
import { EstimadorProgreso, SEGUNDOS_MINIMOS_ETA, UmbralProgreso } from './progreso'

describe('EstimadorProgreso', () => {
  it('fase indeterminada: sin valor ni ETA', () => {
    const e = new EstimadorProgreso()
    expect(e.registrar('cargando', null, 0)).toEqual({
      fase: 'cargando',
      valor: null,
      etaSegundos: null
    })
  })

  it('no da ETA durante los primeros 15 s de la fase determinada y luego usa la velocidad observada', () => {
    const e = new EstimadorProgreso()
    e.registrar('separando', 0, 0)
    expect(e.registrar('separando', 0.1, 10_000).etaSegundos).toBeNull()
    expect(SEGUNDOS_MINIMOS_ETA).toBe(15)
    // 0.2 en 20 s -> 0.01/s -> quedan 0.8 -> 80 s
    expect(e.registrar('separando', 0.2, 20_000).etaSegundos).toBe(80)
  })

  it('el ETA cuenta desde que empezó la parte determinada, no desde la fase indeterminada', () => {
    const e = new EstimadorProgreso()
    e.registrar('separando', null, 0)
    e.registrar('separando', null, 14_000)
    e.registrar('separando', 0, 15_000)
    expect(e.registrar('separando', 0.1, 20_000).etaSegundos).toBeNull()
    // 0.5 en 25 s desde el inicio determinado -> 0.02/s -> 25 s
    expect(e.registrar('separando', 0.5, 40_000).etaSegundos).toBe(25)
  })

  it('el valor suavizado nunca retrocede y llega a 1', () => {
    const e = new EstimadorProgreso()
    const vistos = [0.1, 0.5, 0.3, 0.6, 0.6, 1].map((v, i) => e.registrar('f', v, i * 1000).valor)
    for (let i = 1; i < vistos.length; i++)
      expect(vistos[i]!).toBeGreaterThanOrEqual(vistos[i - 1]!)
    expect(vistos.at(-1)).toBe(1)
  })

  it('un cambio de fase reinicia el cálculo', () => {
    const e = new EstimadorProgreso()
    e.registrar('a', 0, 0)
    e.registrar('a', 0.9, 30_000)
    const r = e.registrar('b', 0.1, 31_000)
    expect(r.etaSegundos).toBeNull()
    expect(r.valor).toBeLessThan(0.1)
  })
})

describe('UmbralProgreso', () => {
  it('acepta cada avance de al menos 5 % y el 100 %', () => {
    const u = new UmbralProgreso(0.05)
    expect(u.aceptar(0.02)).toBe(false)
    expect(u.aceptar(0.05)).toBe(true)
    expect(u.aceptar(0.09)).toBe(false)
    expect(u.aceptar(0.1)).toBe(true)
    expect(u.aceptar(0.99)).toBe(true)
    expect(u.aceptar(1)).toBe(true)
    expect(u.aceptar(1)).toBe(false)
  })
})
