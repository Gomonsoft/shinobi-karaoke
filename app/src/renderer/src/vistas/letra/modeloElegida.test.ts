import type { ElementoLetra } from '@shared/letra'
import { hayMarcasDeTiempo, sincroniaActual, tieneLineas } from './modeloElegida'

const l = (inicio: number | null, palabras = false): ElementoLetra => ({
  id: String(Math.random()),
  tipo: 'linea',
  texto: 'x',
  inicio_ms: inicio,
  fin_ms: null,
  palabras: palabras ? [{ texto: 'x', inicio_ms: 0, fin_ms: 1 }] : null
})
const pausa: ElementoLetra = {
  id: 'p',
  tipo: 'pausa',
  texto: '',
  inicio_ms: null,
  fin_ms: null,
  palabras: null
}

describe('sincroniaActual', () => {
  it('cubre las cuatro sincronías e ignora las pausas', () => {
    expect(sincroniaActual([l(null), pausa, l(null)])).toBe('ninguna')
    expect(sincroniaActual([l(1), pausa, l(null)])).toBe('parte')
    expect(sincroniaActual([l(1), pausa, l(2)])).toBe('linea')
    expect(sincroniaActual([l(1), l(2, true)])).toBe('palabra')
    expect(sincroniaActual([])).toBe('ninguna')
  })
})

describe('hayMarcasDeTiempo', () => {
  it('detecta marcas al principio de algún renglón', () => {
    expect(hayMarcasDeTiempo('hola\n[01:23.45] verso')).toBe(true)
    expect(hayMarcasDeTiempo('  [1:23] verso')).toBe(true)
    expect(hayMarcasDeTiempo('verso [01:23.45]')).toBe(false)
    expect(hayMarcasDeTiempo('[Estribillo]')).toBe(false)
  })
})

describe('tieneLineas', () => {
  it('ignora renglones vacíos', () => {
    expect(tieneLineas('\n  \n')).toBe(false)
    expect(tieneLineas('\na\n')).toBe(true)
  })
})
