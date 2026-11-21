import { describe, expect, it } from 'vitest'
import { paradasRepartidas, repartirParadas } from './paradas'

describe('repartirParadas (G4)', () => {
  it('reparte el cónico en i/n', () => {
    expect(repartirParadas(2, 'conico')).toEqual([0, 0.5])
    expect(repartirParadas(3, 'conico')).toEqual([0, 1 / 3, 2 / 3])
    expect(repartirParadas(4, 'conico')).toEqual([0, 0.25, 0.5, 0.75])
  })
  it('reparte el lineal y el radial de 0 a 1', () => {
    expect(repartirParadas(2, 'lineal')).toEqual([0, 1])
    expect(repartirParadas(3, 'radial')).toEqual([0, 0.5, 1])
    expect(repartirParadas(4, 'lineal')[3]).toBe(1)
  })
  it('asocia los colores', () => {
    expect(paradasRepartidas(['#111111', '#222222'], 'conico')[1]).toEqual({
      color: '#222222',
      posicion: 0.5
    })
  })
})
