import { describe, expect, it } from 'vitest'
import {
  ErrorDatosInvalidos,
  ErrorEsquemaNoSoportado,
  migrarCancion,
  migrarConfig
} from './migraciones'
import { lista, listaConPalabras } from './__fixtures__'

describe('migrarCancion', () => {
  it('acepta la versión 1 y devuelve la canción validada', () => {
    expect(migrarCancion(JSON.parse(JSON.stringify(listaConPalabras())))).toEqual(
      listaConPalabras()
    )
  })
  it('rechaza esquema > 1 con un mensaje claro', () => {
    const f = () => migrarCancion({ ...lista(), esquema: 2 })
    expect(f).toThrow(ErrorEsquemaNoSoportado)
    expect(f).toThrow(/más nuevo/)
  })
  it('rechaza esquema ausente, 0, negativo, no entero o no numérico', () => {
    const sin: Record<string, unknown> = { ...lista() }
    delete sin.esquema
    for (const malo of [
      sin,
      { ...lista(), esquema: 0 },
      { ...lista(), esquema: -1 },
      { ...lista(), esquema: 1.5 },
      { ...lista(), esquema: '1' }
    ]) {
      expect(() => migrarCancion(malo)).toThrow(ErrorEsquemaNoSoportado)
    }
    expect(() => migrarCancion({ ...lista(), esquema: 0 })).toThrow(/no válida/)
  })
  it('rechaza entradas que no son objetos', () => {
    for (const malo of [null, 5, 'x', [], undefined]) {
      expect(() => migrarCancion(malo)).toThrow(ErrorDatosInvalidos)
    }
  })
  it('rechaza datos inválidos con el detalle', () => {
    try {
      migrarCancion({ ...lista(), estado: 'otra' })
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(ErrorDatosInvalidos)
      expect((e as ErrorDatosInvalidos).detalle).toMatch(/estado/)
    }
  })
})

describe('migrarConfig', () => {
  it('{} → valores por defecto (sin esquema se asume 1)', () => {
    const c = migrarConfig({})
    expect(c.esquema).toBe(1)
    expect(c.reproductor.volumen).toBe(0.8)
  })
  it('rechaza esquema > 1', () => {
    expect(() => migrarConfig({ esquema: 2 })).toThrow(ErrorEsquemaNoSoportado)
  })
  it('rechaza esquema inválido y no objetos', () => {
    expect(() => migrarConfig({ esquema: 'a' })).toThrow(ErrorEsquemaNoSoportado)
    expect(() => migrarConfig(null)).toThrow(ErrorDatosInvalidos)
  })
  it('rechaza datos inválidos', () => {
    expect(() => migrarConfig({ reproductor: { volumen: 9 } })).toThrow(ErrorDatosInvalidos)
  })
})
