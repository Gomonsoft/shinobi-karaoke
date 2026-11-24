import { describe, expect, it } from 'vitest'
import {
  PANTALLA_PREDETERMINADA,
  ZONAS_AREA_FIN,
  ZONAS_AREA_INICIO,
  ZONAS_SEPARACION_S,
  ZONA_CORO_ESCALA_MIN,
  ZONA_CORO_FRACCION_ALTO,
  ZONA_ESCALA_MIN,
  ZONA_ESCALA_SIGUIENTE,
  ZONA_LINEAS_CANTANTE,
  ZONA_LINEAS_CORO,
  ZONA_OPACIDAD_INACTIVA,
  zonasEfectivas,
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

describe('zonas por parte (ADR 0029 §4 bis)', () => {
  it('ausente vale por_parte y las constantes son las de la spec', () => {
    expect(zonasEfectivas(PANTALLA_PREDETERMINADA)).toBe('por_parte')
    expect(zonasEfectivas({ zonas: 'una' })).toBe('una')
    expect([ZONAS_AREA_INICIO, ZONAS_AREA_FIN, ZONAS_SEPARACION_S]).toEqual([0.12, 0.86, 0.3])
    expect([ZONA_CORO_FRACCION_ALTO, ZONA_LINEAS_CANTANTE, ZONA_LINEAS_CORO]).toEqual([0.5, 2, 1])
    expect([ZONA_ESCALA_SIGUIENTE, ZONA_ESCALA_MIN, ZONA_CORO_ESCALA_MIN]).toEqual([0.7, 0.75, 0.5])
    expect(ZONA_OPACIDAD_INACTIVA).toBe(0.55)
  })
})
