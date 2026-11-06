import { describe, expect, it } from 'vitest'
import { ESTILO_PREDETERMINADO, estiloPredeterminado, estiloSchema } from './estilo'
import { FUENTE_PREDETERMINADA, FUENTES_INCLUIDAS } from './fuentes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const estilo = () => structuredClone(ESTILO_PREDETERMINADO) as Record<string, any>

describe('estiloSchema', () => {
  it('acepta el estilo predeterminado (sistema-visual §8)', () => {
    expect(estiloSchema.parse(ESTILO_PREDETERMINADO)).toEqual(ESTILO_PREDETERMINADO)
    expect(ESTILO_PREDETERMINADO.letra.color_resaltado).toBe('#FFD400')
  })
  it('estiloPredeterminado devuelve copias independientes', () => {
    const a = estiloPredeterminado()
    a.letra.color = '#000000'
    expect(estiloPredeterminado().letra.color).toBe('#FFFFFF')
  })
  it('acepta fondo sólido', () => {
    const e = estilo()
    e.fondo = { tipo: 'solido', color: '#0E0F14' }
    expect(estiloSchema.safeParse(e).success).toBe(true)
  })
  it('degradado: 2 a 4 paradas', () => {
    const parada = (p: number) => ({ color: '#112233', posicion: p })
    const con = (n: number) => {
      const e = estilo()
      e.fondo.paradas = Array.from({ length: n }, (_, i) => parada(i / Math.max(1, n - 1)))
      return estiloSchema.safeParse(e).success
    }
    expect([con(1), con(2), con(3), con(4), con(5)]).toEqual([false, true, true, true, false])
  })
  it('degradado: ángulo entero 0–359', () => {
    const con = (a: number) => {
      const e = estilo()
      e.fondo.angulo_grados = a
      return estiloSchema.safeParse(e).success
    }
    expect([con(0), con(359), con(360), con(-1), con(10.5)]).toEqual([
      true,
      true,
      false,
      false,
      false
    ])
  })
  it('posición de parada 0..1', () => {
    const e = estilo()
    e.fondo.paradas[1].posicion = 1.1
    expect(estiloSchema.safeParse(e).success).toBe(false)
  })
  it('colores #RRGGBB', () => {
    for (const malo of ['FFFFFF', '#FFF', '#GGGGGG', '#FFFFFFFF', 'rojo']) {
      const e = estilo()
      e.letra.color = malo
      expect(estiloSchema.safeParse(e).success, malo).toBe(false)
    }
    const e = estilo()
    e.letra.color = '#ffd400'
    expect(estiloSchema.safeParse(e).success).toBe(true)
  })
  it('rechaza origen de fuente "sistema" en el MVP', () => {
    const e = estilo()
    e.letra.fuente.origen = 'sistema'
    expect(estiloSchema.safeParse(e).success).toBe(false)
  })
  it('familia incluida desconocida cae a la predeterminada; las conocidas se conservan', () => {
    const e = estilo()
    e.letra.fuente.familia = 'Comic Sans'
    expect(estiloSchema.parse(e).letra.fuente.familia).toBe(FUENTE_PREDETERMINADA)
    for (const f of FUENTES_INCLUIDAS) {
      e.letra.fuente.familia = f
      expect(estiloSchema.parse(e).letra.fuente.familia).toBe(f)
    }
  })
  it('rechaza versión distinta de 1 y tipo de fondo desconocido', () => {
    expect(estiloSchema.safeParse({ ...estilo(), version: 2 }).success).toBe(false)
    expect(estiloSchema.safeParse({ ...estilo(), fondo: { tipo: 'radial' } }).success).toBe(false)
  })
  it('hay 8 familias incluidas', () => {
    expect(FUENTES_INCLUIDAS).toHaveLength(8)
  })
})

it.each([
  { posiciones: [0, 1], valida: true },
  { posiciones: [0, 1 / 3, 2 / 3, 1], valida: true },
  { posiciones: [0, 0.5, 0.5, 1], valida: true },
  { posiciones: [1, 0], valida: false }
])('valida el orden de las paradas $posiciones', ({ posiciones, valida }) => {
  const e = estilo()
  e.fondo.paradas = posiciones.map((posicion) => ({ color: '#112233', posicion }))
  expect(estiloSchema.safeParse(e).success).toBe(valida)
})
