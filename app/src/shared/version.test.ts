import { describe, expect, it } from 'vitest'
import { analizarEtiqueta, compararVersiones, esPrevia } from './version'

describe('compararVersiones', () => {
  it.each([
    ['0.2.2-alpha.1', '0.2.2-alpha.2'],
    ['0.2.2-alpha.9', '0.2.2-alpha.10'],
    ['0.2.2-alpha.2', '0.2.2-beta.1'],
    ['0.2.2-beta.1', '0.2.2-rc.1'],
    ['0.2.2-rc.1', '0.2.2'],
    ['0.2.1', '0.2.2-alpha.1'],
    ['0.2.9', '0.2.10'],
    ['0.9.0', '0.10.0'],
    ['0.2.2', '1.0.0'],
    ['1.0.0-alpha', '1.0.0-alpha.1'],
    ['1.0.0-1', '1.0.0-alpha']
  ])('%s < %s', (menor, mayor) => {
    expect(compararVersiones(menor, mayor)).toBeLessThan(0)
    expect(compararVersiones(mayor, menor)).toBeGreaterThan(0)
  })

  it('iguales, también con metadatos de compilación', () => {
    expect(compararVersiones('0.2.2', '0.2.2')).toBe(0)
    expect(compararVersiones('0.2.2-alpha.1', '0.2.2-alpha.1+5')).toBe(0)
  })

  it('rechaza versiones mal formadas', () => {
    expect(() => compararVersiones('0.2', '0.2.2')).toThrow(RangeError)
    expect(() => compararVersiones('0.2.2', 'v0.2.2')).toThrow(RangeError)
  })
})

describe('analizarEtiqueta', () => {
  it.each([
    ['v0.2.2', '0.2.2', false],
    ['v10.20.30', '10.20.30', false],
    ['v0.2.2-alpha.1', '0.2.2-alpha.1', true],
    ['v0.2.2-beta.12', '0.2.2-beta.12', true],
    ['v1.0.0-rc.3', '1.0.0-rc.3', true]
  ])('%s es válida', (etiqueta, version, previa) => {
    expect(analizarEtiqueta(etiqueta)).toEqual({ version, previa })
  })

  it.each([
    '0.2.2',
    'v0.2',
    'v01.2.3',
    'v0.2.2-alpha',
    'v0.2.2-alpha.0',
    'v0.2.2-nightly.1',
    'v0.2.2-alpha.1+x',
    'v0.2.2 ',
    ''
  ])('%j se ignora', (etiqueta) => {
    expect(analizarEtiqueta(etiqueta)).toBeNull()
  })
})

describe('esPrevia', () => {
  it('detecta el sufijo', () => {
    expect(esPrevia('0.2.2-alpha.1')).toBe(true)
    expect(esPrevia('0.2.2')).toBe(false)
  })
})
