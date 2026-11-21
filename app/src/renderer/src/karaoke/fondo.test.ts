import type { Estilo } from '@shared/estilo'

import { geometriaFondoEn } from './fondo'

type Deg = Extract<Estilo['fondo'], { tipo: 'degradado' }>
const base: Deg = {
  tipo: 'degradado',
  angulo_grados: 90,
  paradas: [
    { color: '#000000', posicion: 0 },
    { color: '#FFFFFF', posicion: 1 }
  ]
}
const mov = (sentido: 'horario' | 'antihorario', forma: Deg['forma'] = 'lineal'): Deg => ({
  ...base,
  forma,
  movimiento: { periodo_s: 10, sentido }
})

describe('geometriaFondoEn', () => {
  it('es periódica y admite t negativo', () => {
    const f = mov('horario')
    expect(geometriaFondoEn(f, 2500).anguloGrados).toBe(180)
    expect(geometriaFondoEn(f, 12500).anguloGrados).toBe(180)
    expect(geometriaFondoEn(f, -2500).anguloGrados).toBe(0)
  })

  it('antihorario invierte el ángulo', () => {
    expect(geometriaFondoEn(mov('antihorario'), 2500).anguloGrados).toBe(0)
  })

  it('devuelve la configurada sin movimiento o con estatico', () => {
    expect(geometriaFondoEn(base, 3000).anguloGrados).toBe(90)
    expect(geometriaFondoEn(mov('horario'), 3000, { estatico: true }).anguloGrados).toBe(90)
    expect(geometriaFondoEn({ tipo: 'solido', color: '#000000' }, 3000).centro).toEqual({
      x: 0.5,
      y: 0.5
    })
  })

  it('radial: fase 0 en el centro y a mitad de periodo (0, 2A)', () => {
    const f = mov('horario', 'radial')
    expect(geometriaFondoEn(f, 0).centro).toEqual({ x: 0.5, y: 0.5 })
    expect(geometriaFondoEn(f, 5000).centro).toEqual({ x: 0.5, y: 0.7 })
  })
})
