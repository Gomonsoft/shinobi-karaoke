import { expect, it } from 'vitest'
import { casiCoinciden, vistaPrecisa } from './vistaPrecisa'

it('vista: línea ± margen, mínimo 250 ms por lado y recortada a la canción', () => {
  expect(vistaPrecisa(12000, 14000, 500, 200000)).toEqual({ inicioMs: 11500, finMs: 14500 })
  expect(vistaPrecisa(12000, 14000, 0, 200000)).toEqual({ inicioMs: 11750, finMs: 14250 })
  expect(vistaPrecisa(100, 14000, 1000, 14500)).toEqual({ inicioMs: 0, finMs: 14500 })
})

it('detecta tiradores que casi coinciden', () => {
  const v = { inicioMs: 0, finMs: 1000 }
  expect(casiCoinciden(v, 1000, 500, 510)).toBe(true)
  expect(casiCoinciden(v, 1000, 500, 600)).toBe(false)
})
