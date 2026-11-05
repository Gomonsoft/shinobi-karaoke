import { describe, expect, it } from 'vitest'
import { CANALES, CONTRATO } from './ipc'
import { CODIGOS_ERROR, CODIGOS_SOLO_MAIN } from './errores'
import { estadoPasoLetra } from './derivados'
import {
  compararDuracion,
  sincroniaDe,
  urlBaseLrclib,
  URL_BASE_LRCLIB,
  ENTORNO_LRCLIB_URL
} from './letrasBusqueda'
import { linea, pausa, letraConPalabras, letraSincronizada } from './__fixtures__'
import { leerFixtureLetraJson } from './__fixtures__/letras'

const ok = (canal: keyof typeof CONTRATO, args: unknown[]): boolean =>
  CONTRATO[canal].args.safeParse(args).success

describe('sincroniaDe', () => {
  it('palabra, línea y texto', () => {
    expect(sincroniaDe(letraConPalabras().lineas)).toBe('palabra')
    expect(sincroniaDe(letraSincronizada().lineas)).toBe('linea')
    expect(sincroniaDe([linea('a', 'x', null), pausa('p')])).toBe('texto')
    expect(sincroniaDe([])).toBe('texto')
  })
})

describe('compararDuracion', () => {
  it('bordes', () => {
    expect(compararDuracion(0)).toEqual({ tipo: 'igual' })
    expect(compararDuracion(2400)).toEqual({ tipo: 'igual' })
    expect(compararDuracion(-2400)).toEqual({ tipo: 'igual' })
    expect(compararDuracion(2500)).toEqual({ tipo: 'diferente', segundos: 3, sentido: 'mas_larga' })
    expect(compararDuracion(-4000)).toEqual({
      tipo: 'diferente',
      segundos: 4,
      sentido: 'mas_corta'
    })
    expect(compararDuracion(10400)).toEqual({
      tipo: 'diferente',
      segundos: 10,
      sentido: 'mas_larga'
    })
    expect(compararDuracion(10500)).toEqual({ tipo: 'muy_distinta' })
    expect(compararDuracion(-30000)).toEqual({ tipo: 'muy_distinta' })
  })
})

describe('estadoPasoLetra', () => {
  it('completado solo con al menos una línea', () => {
    expect(estadoPasoLetra(null)).toBe('pendiente')
    expect(estadoPasoLetra({ lineas: [] })).toBe('pendiente')
    expect(estadoPasoLetra({ lineas: [pausa('p')] })).toBe('pendiente')
    expect(estadoPasoLetra(letraSincronizada())).toBe('completado')
  })
})

describe('errores', () => {
  it('ARCHIVO_SIN_LETRA existe y es solo del main', () => {
    expect(CODIGOS_ERROR).toContain('ARCHIVO_SIN_LETRA')
    expect(CODIGOS_SOLO_MAIN).toContain('ARCHIVO_SIN_LETRA')
  })
})

describe('urlBaseLrclib', () => {
  it('sustituye solo sin empaquetar y con valores admitidos', () => {
    expect(ENTORNO_LRCLIB_URL).toBe('SHINOBI_LRCLIB_URL')
    expect(urlBaseLrclib(undefined, false)).toBe(URL_BASE_LRCLIB)
    expect(urlBaseLrclib('http://127.0.0.1:4455/', false)).toBe('http://127.0.0.1:4455')
    expect(urlBaseLrclib('http://lrclib.invalid', false)).toBe('http://lrclib.invalid')
    expect(urlBaseLrclib('http://127.0.0.1:4455', true)).toBe(URL_BASE_LRCLIB)
    expect(urlBaseLrclib('https://otro.example', false)).toBe(URL_BASE_LRCLIB)
  })
})

describe('contrato Zod de letras.*', () => {
  const lineas = letraSincronizada().lineas
  it('buscar', () => {
    const c = CANALES.letras.buscar
    expect(ok(c, [{ cancionId: 'x', titulo: 'T', artista: '' }])).toBe(true)
    expect(ok(c, [{ cancionId: 'x', titulo: 'T', artista: 'A', usarCache: true }])).toBe(true)
    expect(ok(c, [{ cancionId: 'x', titulo: '', artista: 'A' }])).toBe(false)
    expect(ok(c, [{ cancionId: 'x', titulo: '  ', artista: 'A' }])).toBe(false)
    expect(ok(c, [{ cancionId: 'x', titulo: 'T' }])).toBe(false)
    expect(ok(c, [{ cancionId: 'x', titulo: 'T', artista: 'A', extra: 1 }])).toBe(false)
    expect(ok(c, [])).toBe(false)
  })
  it('guardar', () => {
    const c = CANALES.letras.guardar
    const base = { cancionId: 'x', origen: 'manual', lrclib_id: null, lineas }
    expect(ok(c, [base])).toBe(true)
    expect(ok(c, [{ ...base, origen: 'lrclib', lrclib_id: 9001 }])).toBe(true)
    expect(ok(c, [{ ...base, origen: 'archivo', lrclib_id: 9001 }])).toBe(false)
    expect(ok(c, [{ ...base, origen: 'otro' }])).toBe(false)
    expect(ok(c, [{ ...base, lineas: [] }])).toBe(false)
    expect(ok(c, [{ ...base, lineas: [pausa('p')] }])).toBe(false)
    const muchas = Array.from({ length: 5001 }, (_, i) => linea(`l${i}`, 'x', null))
    expect(ok(c, [{ ...base, lineas: muchas }])).toBe(false)
    expect(ok(c, [{ ...base, lineas: muchas.slice(0, 5000) }])).toBe(true)
  })
  it('editarTexto', () => {
    const c = CANALES.letras.editarTexto
    expect(ok(c, [{ cancionId: 'x', texto: 'hola' }])).toBe(true)
    expect(ok(c, [{ cancionId: 'x', texto: '' }])).toBe(true)
    expect(ok(c, [{ cancionId: 'x', texto: 'a'.repeat(512 * 1024) }])).toBe(true)
    expect(ok(c, [{ cancionId: 'x', texto: 'a'.repeat(512 * 1024 + 1) }])).toBe(false)
    expect(ok(c, [{ cancionId: 'x' }])).toBe(false)
  })
  it('leerArchivo', () => {
    const c = CANALES.letras.leerArchivo
    expect(ok(c, [])).toBe(true)
    expect(ok(c, ['x'])).toBe(false)
    const res = CONTRATO[c].res
    expect(res.safeParse({ cancelado: true }).success).toBe(true)
    expect(
      res.safeParse({
        cancelado: false,
        nombre: 'a.lrc',
        lineas,
        sincronia: 'linea',
        ignoradas: 2
      }).success
    ).toBe(true)
    expect(
      res.safeParse({ cancelado: false, nombre: 'a.lrc', lineas, sincronia: 'linea' }).success
    ).toBe(false)
    expect(
      res.safeParse({ cancelado: false, nombre: 'a.lrc', lineas, sincronia: 'x', ignoradas: 0 })
        .success
    ).toBe(false)
  })
})

describe('fixtures de letras', () => {
  it('los JSON de LRCLIB se leen', () => {
    const search =
      leerFixtureLetraJson<{ id: number; instrumental: boolean }[]>('lrclib-search.json')
    expect(search.map((r) => r.id)).toEqual([9001, 9002, 9003, 9004])
    expect(
      leerFixtureLetraJson<{ instrumental: boolean }>('lrclib-instrumental.json').instrumental
    ).toBe(true)
  })
})
