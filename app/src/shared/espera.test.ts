import { describe, expect, it } from 'vitest'
import { CUENTA_MS, ESPERA_LEGADA, UMBRAL_PRIMERA_ENTRADA_MS, esperaSchema } from './espera'

describe('esperaSchema', () => {
  it('acepta la espera legada y fija las constantes', () => {
    expect(esperaSchema.parse(ESPERA_LEGADA)).toEqual(ESPERA_LEGADA)
    expect(CUENTA_MS).toBe(3000)
    expect(UMBRAL_PRIMERA_ENTRADA_MS).toBe(4000)
  })
  it('umbral_ms: entero de 1000 a 60000', () => {
    const ok = (umbral_ms: number) =>
      esperaSchema.safeParse({ ...ESPERA_LEGADA, umbral_ms }).success
    expect([ok(999), ok(1000), ok(60000), ok(60001), ok(1500.5)]).toEqual([
      false,
      true,
      true,
      false,
      false
    ])
  })
})
