import { describe, expect, it } from 'vitest'
import {
  ARRANQUE_MAX_S,
  ARRANQUE_MIN_S,
  estimarSegundosSeparacion,
  minutosMedios,
  textoEstimacionPrevia
} from './estimacion'
import type { Manifiesto } from './manifiesto'

// Solo importan los factores: el resto del manifiesto no interviene en la estimación.
const m = {
  factores: {
    mps: { calidad: [1.08, 1.27], rapido: [0.7, 0.79] },
    cpu: { rapido: null, calidad: null }
  },
  estimacion: { cpu: { rapido: [0.75, 1.75], calidad: [1.5, 4] } }
} as unknown as Manifiesto
const cuatroMin = 4 * 60000

describe('estimarSegundosSeparacion', () => {
  it('mps con Calidad: factor de referencia más el coste de arranque', () => {
    const r = estimarSegundosSeparacion(cuatroMin, 'mps', 'calidad', {}, m)
    expect(r?.origen).toBe('referencia_medida')
    expect(r?.min).toBeCloseTo(4 * 1.08 * 60 + ARRANQUE_MIN_S)
    expect(r?.max).toBeCloseTo(4 * 1.27 * 60 + ARRANQUE_MAX_S)
    expect(textoEstimacionPrevia(r)).toBe('Tardará unos 5 minutos')
  })

  it('cpu sin medir usa la estimación del manifiesto', () => {
    const r = estimarSegundosSeparacion(cuatroMin, 'cpu', 'calidad', {}, m)
    expect(r?.origen).toBe('estimado')
    expect(r?.min).toBeCloseTo(4 * 1.5 * 60 + ARRANQUE_MIN_S)
    expect(r?.max).toBeCloseTo(4 * 4 * 60 + ARRANQUE_MAX_S)
  })

  it('un factor medido en el equipo prevalece sobre el del manifiesto', () => {
    const r = estimarSegundosSeparacion(cuatroMin, 'mps', 'calidad', { calidad: 2 }, m)
    expect(r?.origen).toBe('medido_equipo')
    expect(r?.min).toBeCloseTo(480 + ARRANQUE_MIN_S)
    expect(r?.max).toBeCloseTo(480 + ARRANQUE_MAX_S)
    expect(textoEstimacionPrevia(r)).toBe('Tardará unos 9 minutos')
  })

  it('menos de 1 minuto', () => {
    const r = estimarSegundosSeparacion(10_000, 'mps', 'calidad', {}, m)
    expect(r?.origen).toBe('referencia_medida')
    expect(textoEstimacionPrevia(r)).toBe('Tardará menos de 1 minuto')
  })

  it('sin datos para el perfil y el modo devuelve null y no hay texto', () => {
    expect(estimarSegundosSeparacion(cuatroMin, 'cuda', 'calidad', {}, m)).toBeNull()
    expect(textoEstimacionPrevia(null)).toBeNull()
  })
})

describe('textoEstimacionPrevia', () => {
  it('entre 1 y 2 minutos: 1 minuto aprox.', () => {
    expect(textoEstimacionPrevia({ min: 70, max: 90 })).toBe('Tardará 1 minuto aprox.')
  })
  it('redondea hacia arriba el punto medio', () => {
    expect(textoEstimacionPrevia({ min: 120, max: 190 })).toBe('Tardará unos 3 minutos')
    expect(textoEstimacionPrevia({ min: 120, max: 120 })).toBe('Tardará unos 2 minutos')
  })
  it('minutosMedios devuelve el punto medio en minutos', () => {
    expect(minutosMedios({ min: 60, max: 180 })).toBe(2)
  })
})
