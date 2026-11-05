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

describe('EstimadorProgreso con ritmo esperado (0064)', () => {
  const TOTAL = 19
  const FASE = 228 // 19 pasos de 12 s
  const nuevo = () => new EstimadorProgreso(undefined, { segundosFase: FASE })
  const real = (e: EstimadorProgreso, paso: number, ms: number) =>
    e.registrar('separando', paso / TOTAL, ms, { paso, total: TOTAL })

  it('eventos cada 12 s: el valor crece cada segundo y no cruza el siguiente límite', () => {
    const e = nuevo()
    real(e, 0, 0)
    let previo = 0
    for (let paso = 0; paso < TOTAL; paso++) {
      const base = paso * 12_000
      if (paso > 0) real(e, paso, base)
      for (let s = 1; s <= 11; s++) {
        const p = e.interpolar(base + s * 1000)!
        expect(p.valor!).toBeGreaterThanOrEqual(previo)
        expect(p.valor!).toBeLessThanOrEqual((paso + 1) / TOTAL - 0.005 + 1e-12)
        previo = p.valor!
      }
    }
    expect(previo).toBeGreaterThan(0.9)
  })

  it('un evento real atrasado no hace retroceder el valor', () => {
    const e = nuevo()
    real(e, 0, 0)
    const antes = e.interpolar(11_000)!.valor!
    expect(antes).toBeGreaterThan(0)
    const tras = real(e, 1, 16_000).valor!
    expect(tras).toBeGreaterThanOrEqual(antes)
    // Ya interpolado por encima de 1/19: sigue sin bajar hasta que el real lo alcance.
    const e2 = nuevo()
    real(e2, 0, 0)
    real(e2, 1, 12_000)
    const alto = e2.interpolar(23_000)!.valor!
    expect(real(e2, 1, 24_000).valor!).toBeGreaterThanOrEqual(alto)
    expect(e2.valorReal).toBeCloseTo(1 / TOTAL, 6)
  })

  it('ETA null antes de 15 s y converge a la observada', () => {
    const e = nuevo()
    expect(real(e, 0, 0).etaSegundos).toBeNull()
    expect(real(e, 1, 12_000).etaSegundos).toBeNull()
    // 2 pasos en 24 s: peso 0,4 -> mezcla de estimada (228*17/19) y observada (17*12)
    const estimada = FASE * (17 / 19)
    const observada = 17 * 12
    const mezcla = 0.4 * observada + 0.6 * estimada + 1
    expect(real(e, 2, 24_000).etaSegundos).toBeCloseTo(mezcla, 0)
    // Con >= 5 pasos, solo la observada (+1 s de guardado)
    expect(real(e, 5, 60_000).etaSegundos).toBeCloseTo(14 * 12 + 1, 0)
    expect(real(e, 19, 228_000).etaSegundos).toBe(0)
  })

  it('la ETA baja entre eventos con el temporizador', () => {
    const e = nuevo()
    real(e, 0, 0)
    const a = real(e, 2, 24_000).etaSegundos!
    expect(e.interpolar(29_000)!.etaSegundos).toBeCloseTo(a - 5, 1)
  })

  it('sin pasos, otra fase o sin ritmo: sin interpolación (comportamiento de 0014)', () => {
    const e = nuevo()
    e.registrar('separando', 0.1, 0)
    expect(e.interpolando).toBe(false)
    expect(e.interpolar(5000)).toBeNull()
    const f = nuevo()
    f.registrar('descargando_modelo', 0.1, 0, { paso: 1, total: 10 })
    expect(f.interpolar(5000)).toBeNull()
    const g = new EstimadorProgreso()
    g.registrar('separando', 0.1, 0, { paso: 2, total: 19 })
    expect(g.interpolando).toBe(false)
  })
})
