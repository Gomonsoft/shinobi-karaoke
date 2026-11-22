import { describe, expect, it } from 'vitest'
import {
  PANTALLA_PREDETERMINADA,
  pantallaEstrictaSchema,
  pantallaSchema,
  pasadasEfectivas,
  pasadasMaximas,
  type Pantalla
} from './pantalla'

describe('pantalla', () => {
  it('pasadas máximas: 0 con 2-3 líneas, 1 con 4-5 y 2 con 6-7', () => {
    expect([2, 3, 4, 5, 6, 7].map(pasadasMaximas)).toEqual([0, 0, 1, 1, 2, 2])
  })
  it('pasadasEfectivas es mín(elegidas, máximo) y no toca lo elegido', () => {
    const p: Pantalla = { lineas: 3, pasadas: 2, transicion: 'fundido' }
    expect(pasadasEfectivas(p)).toBe(0)
    expect(p.pasadas).toBe(2)
    expect(pasadasEfectivas({ ...p, lineas: 7 })).toBe(2)
    expect(pasadasEfectivas(PANTALLA_PREDETERMINADA)).toBe(1)
  })
  it('lectura tolerante por campo: lo inválido cae a su valor por defecto', () => {
    expect(pantallaSchema.parse({ lineas: 9, pasadas: 1, transicion: 'ninguna' })).toEqual({
      lineas: 5,
      pasadas: 1,
      transicion: 'ninguna'
    })
    expect(pantallaSchema.parse({ lineas: 3, pasadas: -1, transicion: 'zoom' })).toEqual({
      lineas: 3,
      pasadas: 1,
      transicion: 'desplazamiento'
    })
    expect(pantallaSchema.parse({})).toEqual(PANTALLA_PREDETERMINADA)
  })
  it('zonas (reservado para 0.2.3) se conserva, es tolerante y no se añade si falta', () => {
    expect(pantallaSchema.parse({ ...PANTALLA_PREDETERMINADA, zonas: 'una' }).zonas).toBe('una')
    expect(
      pantallaEstrictaSchema.parse({ ...PANTALLA_PREDETERMINADA, zonas: 'por_parte' })
    ).toEqual({
      ...PANTALLA_PREDETERMINADA,
      zonas: 'por_parte'
    })
    expect(pantallaSchema.parse({ zonas: 'mitades' }).zonas).toBeUndefined()
    expect(pantallaSchema.parse({})).toEqual(PANTALLA_PREDETERMINADA)
    expect(
      pantallaEstrictaSchema.safeParse({ ...PANTALLA_PREDETERMINADA, zonas: 'x' }).success
    ).toBe(false)
  })
})
