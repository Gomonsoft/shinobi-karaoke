import { describe, expect, it } from 'vitest'
import { letraSchema } from '../../shared/letra'
import { convertirRegistro } from './busqueda'
import { crearClienteLrclib, type FetchLrclib, type RegistroLrclib } from './lrclib'
import { convertirLyricsfile } from './lyricsfile'

/**
 * Prueba de contrato OPCIONAL con LRCLIB real (0089; ADR 0005, Revisión 2026-11-05).
 * Solo con `SHINOBI_TESTS_RED=1`; nunca en push/PR. Máx. 5 peticiones, en serie, con el
 * `User-Agent` del proyecto y 250 ms entre ellas (lo garantiza el cliente real). Solo se comprueba
 * la estructura: las letras recibidas no se imprimen ni se guardan.
 * Ejemplo de la documentación de LRCLIB: «I Want to Live», Borislav Slavov, 233 s.
 */
const TITULO = 'I Want to Live'
const ARTISTA = 'Borislav Slavov'
const DURACION_S = 233

const conRed = process.env.SHINOBI_TESTS_RED === '1'

const fetchReal: FetchLrclib = (url, init) => fetch(url, init)

function crear(): ReturnType<typeof crearClienteLrclib> {
  return crearClienteLrclib({
    fetch: fetchReal,
    version: '0.0.0-pruebas',
    registro: { escribir: () => undefined },
    // Sin SHINOBI_LRCLIB_URL: siempre la URL real.
    env: {},
    empaquetada: true
  })
}

function comprobarRegistro(r: RegistroLrclib): void {
  expect(Number.isInteger(r.id)).toBe(true)
  expect(typeof r.trackName).toBe('string')
  expect(typeof r.artistName).toBe('string')
  expect(typeof r.duration).toBe('number')
}

describe.runIf(conRed)('contrato con LRCLIB real (SHINOBI_TESTS_RED=1)', () => {
  const señal = new AbortController().signal
  const cliente = crear()

  it('usa la URL real', () => {
    expect(cliente.urlBase).toBe('https://lrclib.net')
  })

  it('get del ejemplo de la documentación: registro válido y letra convertible', async () => {
    const r = await cliente.get({ titulo: TITULO, artista: ARTISTA, duracionS: DURACION_S }, señal)
    expect(r).not.toBeNull()
    comprobarRegistro(r!)
    expect(Math.abs(r!.duration! - DURACION_S)).toBeLessThanOrEqual(2)

    // Si trae Lyricsfile, el conversor (0080) debe entenderlo.
    if (r!.hasWordSync && r!.lyricsfile) {
      const lf = convertirLyricsfile(r!.lyricsfile)
      expect(lf).not.toBeNull()
      expect(lf!.length).toBeGreaterThan(0)
    }

    const lineas = convertirRegistro(r!)
    expect(lineas).not.toBeNull()
    expect(lineas!.some((l) => l.tipo === 'linea')).toBe(true)
    const letra = letraSchema.safeParse({
      origen: 'lrclib',
      lrclib_id: r!.id,
      offset_ms: 0,
      lineas
    })
    expect(letra.success).toBe(true)
  })

  it('search con el título: al menos un resultado válido', async () => {
    const lista = await cliente.buscar({ q: TITULO }, señal)
    expect(lista.length).toBeGreaterThanOrEqual(1)
    for (const r of lista) {
      expect(Number.isInteger(r.id)).toBe(true)
    }
    comprobarRegistro(lista[0]!)
  })

  it('get de una canción inventada: null (404)', async () => {
    const r = await cliente.get(
      { titulo: 'Zxqv inexistente 9f3a', artista: 'Nadie Tampoco 7c1e', duracionS: 123 },
      señal
    )
    expect(r).toBeNull()
  })
})
