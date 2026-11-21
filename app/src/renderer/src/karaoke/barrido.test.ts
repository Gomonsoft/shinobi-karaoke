import { expect, it } from 'vitest'
import { anchosPintados } from './barrido'

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
