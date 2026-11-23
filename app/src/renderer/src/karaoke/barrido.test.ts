import { describe, expect, it } from 'vitest'
import { anchosPintados, recorteBarrido } from './barrido'

it.each([
  [0, [0, 0]],
  [0.5, [90, 0]],
  [0.75, [120, 15]],
  [1, [120, 60]]
])('reparte el progreso %s entre renglones de distinto ancho', (progreso, esperado) => {
  expect(anchosPintados([120, 60], progreso)).toEqual(esperado)
})

it('completa cada renglón antes de pasar al siguiente', () => {
  expect(anchosPintados([40, 30, 10, 20], 0.75)).toEqual([40, 30, 5, 0])
})

it('mantiene el reparto de un renglón y admite texto sin ancho visible', () => {
  expect(anchosPintados([80], 0.25)).toEqual([20])
  expect(anchosPintados([], 1)).toEqual([])
})

describe('margenInferior (subrayado)', () => {
  const cajas = [new DOMRect(0, 0, 120, 20), new DOMRect(0, 24, 60, 20)]
  it('no cambia nada sin margen y no mueve el borde horizontal', () => {
    expect(recorteBarrido(cajas, 0.75, { margenInferior: 0 })).toBe(recorteBarrido(cajas, 0.75))
    expect(recorteBarrido(cajas, 0.75)).toContain('120px 20px')
  })
  it('amplía hacia abajo solo lo que cabe antes del renglón siguiente', () => {
    expect(recorteBarrido(cajas, 1, { margenInferior: 3 })).toContain('120px 23px')
    expect(recorteBarrido(cajas, 1, { margenInferior: 9 })).toContain('120px 24px')
    expect(recorteBarrido(cajas, 1, { margenInferior: 9 })).toContain('60px 53px')
  })
})
