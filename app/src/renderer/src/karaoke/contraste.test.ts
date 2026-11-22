import { describe, expect, it } from 'vitest'
import { estiloPredeterminado, type Fondo } from '@shared/estilo'
import {
  aDegradado,
  aHex,
  aSolido,
  canalesRgb,
  repartirParadas,
  variarLuminosidad30
} from './colores'
import {
  deltaE76,
  evaluarContraste,
  grisDeLetra,
  luminancia,
  muestrasFondo,
  ratio,
  sugerirResaltado,
  suelosDeOpacidad
} from './contraste'
import { objetivoOpacidad } from './pantalla'

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
    expect(muestrasFondo(estilo.fondo)).toHaveLength(9)
    expect(muestrasFondo(estilo.fondo)[4]).toBe('#808080')
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
    expect(muestrasFondo(fondo)).toEqual(['#000000', '#FFFFFF'])
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

describe('muestras por tramos', () => {
  const estiloCon = (fondo: Fondo) => {
    const estilo = estiloPredeterminado()
    estilo.letra.color = '#808080'
    estilo.fondo = fondo
    return estilo
  }

  it('un tramo estrecho entre paradas próximas aporta sus grises', () => {
    const fondo: Fondo = {
      tipo: 'degradado',
      angulo_grados: 0,
      paradas: [
        { posicion: 0, color: '#000000' },
        { posicion: 0.5, color: '#000000' },
        { posicion: 0.52, color: '#FFFFFF' },
        { posicion: 1, color: '#FFFFFF' }
      ]
    }
    // Con 11 muestras globales el tramo 0,50-0,52 no tenía gris (ratio 3,9); ahora sí.
    expect(evaluarContraste(estiloCon(fondo)).ratioLetra).toBe(1)
  })

  it('el cierre del cónico avisa y el lineal no', () => {
    const fondo: Fondo = {
      tipo: 'degradado',
      angulo_grados: 0,
      paradas: [
        { posicion: 0.5, color: '#000000' },
        { posicion: 0.5, color: '#FFFFFF' }
      ]
    }
    expect(evaluarContraste(estiloCon(fondo)).avisos).not.toContain('letra')
    expect(evaluarContraste(estiloCon({ ...fondo, forma: 'conico' })).avisos).toContain('letra')
  })
})

describe('gris de la letra y suelos de opacidad (ADR 0022 §4)', () => {
  it('el gris tiene la luminancia de la letra (± 1 por canal en los ejemplos del sistema visual)', () => {
    comprobarColor(grisDeLetra('#FFFFFF'), '#FFFFFF')
    comprobarColor(grisDeLetra('#FFD400'), '#D8D8D8')
    comprobarColor(grisDeLetra('#111111'), '#111111')
    expect(luminancia(grisDeLetra('#FFD400'))).toBeCloseTo(luminancia('#FFD400'), 2)
  })

  it('con #F2E8D5 y letra #111111 cada puesto atenuado llega a 3:1 con su suelo (F1-R24)', () => {
    const estilo = estiloPredeterminado()
    estilo.fondo = { tipo: 'solido', color: '#F2E8D5' }
    estilo.letra.color = '#111111'
    const pantalla = { lineas: 7, pasadas: 2, transicion: 'desplazamiento' } as const
    const suelos = suelosDeOpacidad(estilo, pantalla)
    expect(
      Object.keys(suelos)
        .map(Number)
        .sort((a, b) => a - b)
    ).toEqual([-2, -1, 2, 3, 4])
    for (const [puesto, alfa] of Object.entries(suelos)) {
      const color = Number(puesto) < 0 ? grisDeLetra('#111111') : '#111111'
      expect(alfa).toBeGreaterThan(0)
      expect(alfa).toBeLessThanOrEqual(1)
      const compuesto = aHex(
        canalesRgb(color).map((c, i) => alfa * c + (1 - alfa) * canalesRgb('#F2E8D5')[i]!)
      )
      expect(ratio(compuesto, '#F2E8D5')).toBeGreaterThanOrEqual(3)
      if (alfa > 0.01) {
        const menos = aHex(
          canalesRgb(color).map(
            (c, i) => (alfa - 0.01) * c + (1 - alfa + 0.01) * canalesRgb('#F2E8D5')[i]!
          )
        )
        expect(ratio(menos, '#F2E8D5')).toBeLessThan(3)
      }
    }
  })

  it('con el tema Shinobi el suelo no actúa (queda por debajo del objetivo)', () => {
    const pantalla = { lineas: 7, pasadas: 2, transicion: 'desplazamiento' } as const
    const suelos = suelosDeOpacidad(estiloPredeterminado(), pantalla)
    for (const [puesto, alfa] of Object.entries(suelos)) {
      expect(alfa).toBeLessThanOrEqual(objetivoOpacidad(Number(puesto), 2, 4) + 1e-9)
    }
    // el puesto −2 queda cerca de 3,1:1 en la zona más clara: el suelo está justo por debajo de 0,40
    expect(suelos[-2]).toBeGreaterThan(0.3)
  })

  it('si la letra no llega a 3:1 al 100 %, el suelo es 1 y los avisos de siempre cubren el caso', () => {
    const estilo = estiloPredeterminado()
    estilo.fondo = { tipo: 'solido', color: '#777777' }
    estilo.letra.color = '#808080'
    const suelos = suelosDeOpacidad(estilo, { lineas: 5, pasadas: 1, transicion: 'ninguna' })
    expect(Object.values(suelos).every((v) => v === 1)).toBe(true)
  })

  it('el color de los suelos es un parámetro: otro color cambia el resultado', () => {
    const estilo = estiloPredeterminado()
    const pantalla = { lineas: 5, pasadas: 1, transicion: 'ninguna' } as const
    const conLetra = suelosDeOpacidad(estilo, pantalla)
    const conOscuro = suelosDeOpacidad(estilo, pantalla, '#444444')
    expect(conOscuro[2]).toBeGreaterThan(conLetra[2]!)
  })
})
