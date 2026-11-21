import { describe, expect, it } from 'vitest'
import { fraccionDeCuenta, numeroDeCuenta, RelojCuenta, type TransicionVista } from './cuenta'

const t = (extra: Partial<TransicionVista> = {}): TransicionVista => ({
  transicionId: 'a',
  restanteMs: 4000,
  duracionMs: 4000,
  congelada: false,
  ...extra
})

describe('RelojCuenta', () => {
  it('baja con el reloj local y no pasa de cero', () => {
    let ahora = 0
    const r = new RelojCuenta(() => ahora)
    r.actualizar(t(), false)
    ahora = 1500
    expect(r.restanteMs()).toBe(2500)
    ahora = 9000
    expect(r.restanteMs()).toBe(0)
  })

  it('se congela con cierre pendiente y sigue desde el mismo valor', () => {
    let ahora = 0
    const r = new RelojCuenta(() => ahora)
    r.actualizar(t(), false)
    ahora = 1000
    r.actualizar(t(), true)
    ahora = 6000
    expect(r.restanteMs()).toBe(3000)
    r.actualizar(t(), false)
    ahora = 6500
    expect(r.restanteMs()).toBe(2500)
  })

  it('una candidata nueva reinicia la cuenta', () => {
    let ahora = 0
    const r = new RelojCuenta(() => ahora)
    r.actualizar(t(), false)
    ahora = 3000
    r.actualizar(t({ transicionId: 'b' }), false)
    expect(r.restanteMs()).toBe(4000)
  })

  it('números y fracción', () => {
    expect(numeroDeCuenta(4000)).toBe(4)
    expect(numeroDeCuenta(3001)).toBe(4)
    expect(numeroDeCuenta(0)).toBe(1)
    expect(fraccionDeCuenta(1000, 4000)).toBe(0.25)
    expect(fraccionDeCuenta(1000, 0)).toBe(0)
  })
})
