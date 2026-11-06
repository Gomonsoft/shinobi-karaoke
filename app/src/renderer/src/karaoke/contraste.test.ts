import { describe, expect, it } from 'vitest'
import { estiloPredeterminado } from '@shared/estilo'
import { aDegradado, aSolido, canalesRgb, repartirParadas, variarLuminosidad30 } from './colores'
import { deltaE76, evaluarContraste, muestrasFondo, ratio, sugerirResaltado } from './contraste'

function comprobarColor(real: string, esperado: string): void {
  const a = canalesRgb(real)
  const b = canalesRgb(esperado)
  a.forEach((canal, i) => expect(Math.abs(canal - b[i]!)).toBeLessThanOrEqual(1))
}

describe('contraste de karaoke', () => {
  it('reproduce los valores de referencia del sistema visual', () => {
    expect(ratio('#FFFFFF', '#1B1033')).toBeCloseTo(17.97, 2)
    expect(ratio('#FFFFFF', '#5A1E6E')).toBeCloseTo(11.38, 2)
    expect(ratio('#000000', '#FFFFFF')).toBe(21)
    expect(deltaE76('#000000', '#FFFFFF')).toBeCloseTo(100)
    expect(evaluarContraste(estiloPredeterminado())).toMatchObject({ nivel: 'ok', avisos: [] })
  })

  it('avisa por letra o diferencia y sugiere alternativas', () => {
    const estilo = estiloPredeterminado()
    estilo.letra.color = '#5A1E6E'
    expect(evaluarContraste(estilo)).toMatchObject({
      nivel: 'aviso',
      avisos: ['letra'],
      accionesLetra: ['blanca'],
      sugerirFondo: false
    })
    estilo.letra.color = '#FFFFFF'
    estilo.letra.color_resaltado = '#F2F3F7'
    expect(evaluarContraste(estilo).avisos).toEqual(['diferencia'])
    const sugerido = sugerirResaltado(estilo)
    expect(deltaE76(sugerido, estilo.letra.color)).toBeGreaterThanOrEqual(25)
    expect(sugerido).toBe('#7CFF6B')
  })

  it('considera el peor caso del degradado y recomienda cambiar el fondo', () => {
    const estilo = estiloPredeterminado()
    estilo.fondo = {
      tipo: 'degradado',
      angulo_grados: 0,
      paradas: repartirParadas(['#000000', '#FFFFFF'])
    }
    estilo.letra.color = '#808080'
    expect(muestrasFondo(estilo.fondo)).toHaveLength(11)
    expect(muestrasFondo(estilo.fondo)[5]).toBe('#808080')
    expect(evaluarContraste(estilo)).toMatchObject({
      nivel: 'aviso',
      ratioLetra: 1,
      sugerirFondo: true,
      accionesLetra: expect.arrayContaining(['blanca', 'negra'])
    })
  })

  it('distingue contraste justo y las paradas con posición repetida', () => {
    const estilo = estiloPredeterminado()
    estilo.fondo = { tipo: 'solido', color: '#000000' }
    estilo.letra.color = '#777777'
    estilo.letra.color_resaltado = '#5555FF'
    expect(evaluarContraste(estilo).nivel).toBe('justo')
    const fondo = aDegradado(estilo.fondo)
    fondo.paradas = [
      { posicion: 0, color: '#000000' },
      { posicion: 0.5, color: '#000000' },
      { posicion: 0.5, color: '#FFFFFF' },
      { posicion: 1, color: '#FFFFFF' }
    ]
    expect(muestrasFondo(fondo).slice(4, 6)).toEqual(['#000000', '#FFFFFF'])
  })
})

describe('variantes de color', () => {
  it.each([
    ['#1B1033', '#5935A7'],
    ['#000000', '#4D4D4D'],
    ['#FFFFFF', '#B3B3B3'],
    ['#B2B3B3', '#FFFFFF'], // L = 70 % exacto.
    ['#B5B5B5', '#696969'] // L ≈ 71 %.
  ])('varía la luminosidad de %s', (base, esperado) => {
    comprobarColor(variarLuminosidad30(base), esperado)
  })

  it('cambia de tipo de fondo y reparte las paradas por igual', () => {
    const solido = { tipo: 'solido', color: '#1B1033' } as const
    const fondo = aDegradado(solido)
    expect(fondo.angulo_grados).toBe(135)
    expect(fondo.paradas[0]).toEqual({ color: solido.color, posicion: 0 })
    expect(fondo.paradas[1]?.posicion).toBe(1)
    comprobarColor(fondo.paradas[1]!.color, '#5935A7')
    expect(aSolido(fondo)).toEqual(solido)
    expect(repartirParadas(['a', 'b', 'c', 'd']).map((p) => p.posicion)).toEqual([
      0,
      1 / 3,
      2 / 3,
      1
    ])
  })
})
