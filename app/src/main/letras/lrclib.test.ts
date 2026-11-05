import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { leerFixtureLetraJson } from '../../shared/__fixtures__/letras'
import type { RegistroApp } from '../registro'
import {
  crearClienteLrclib,
  ErrorLrclib,
  leerRetryAfter,
  type FetchLrclib,
  type InitMinimo,
  type OpcionesCliente,
  type RespuestaMinima
} from './lrclib'

const registroGet = leerFixtureLetraJson<Record<string, unknown>>('lrclib-get.json')
const señalLibre = (): AbortSignal => new AbortController().signal

function resp(status: number, cuerpo: unknown = '', headers: Record<string, string> = {}) {
  const texto = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo)
  const r: RespuestaMinima = {
    status,
    headers: { get: (n) => headers[n.toLowerCase()] ?? null },
    body: new Response(texto).body,
    text: async () => texto
  }
  return r
}

function entorno() {
  const logs: string[] = []
  const registro: RegistroApp = { escribir: (n, m, msg) => logs.push(`${n} ${m} ${msg}`) }
  let t = 1_000_000
  const esperas: number[] = []
  const base: Omit<OpcionesCliente, 'fetch'> = {
    version: '1.2.3',
    registro,
    empaquetada: false,
    ahora: () => t,
    dormir: async (ms) => {
      esperas.push(ms)
      t += ms
    },
    aleatorio: () => 0
  }
  return { logs, esperas, base, avanzar: (ms: number) => (t += ms), reloj: () => t }
}

describe('leerRetryAfter', () => {
  it('segundos, fecha HTTP y basura', () => {
    expect(leerRetryAfter('3', 0)).toBe(3000)
    expect(
      leerRetryAfter('Wed, 21 Oct 2015 07:28:05 GMT', Date.parse('2015-10-21T07:28:00Z'))
    ).toBe(5000)
    expect(leerRetryAfter('nada', 0)).toBeNull()
    expect(leerRetryAfter(null, 0)).toBeNull()
  })
})

describe('cliente LRCLIB con fetch falso', () => {
  it('200: envía exactamente las cabeceras y los parámetros esperados', async () => {
    const e = entorno()
    const f = vi.fn<FetchLrclib>(async () => resp(200, registroGet))
    const c = crearClienteLrclib({ ...e.base, fetch: f })
    const r = await c.get(
      { titulo: 'Canción & más', artista: 'A', album: 'B', duracionS: 215.4 },
      señalLibre()
    )
    expect(r?.id).toBe(9001)
    expect(r?.hasWordSync).toBe(false)
    const [url, init] = f.mock.calls[0] as [string, InitMinimo]
    const u = new URL(url)
    expect(u.origin + u.pathname).toBe('https://lrclib.net/api/get')
    expect(Object.fromEntries(u.searchParams)).toEqual({
      track_name: 'Canción & más',
      artist_name: 'A',
      album_name: 'B',
      duration: '215'
    })
    expect(init.method).toBe('GET')
    expect(init.credentials).toBe('omit')
    expect(init.headers).toEqual({
      'User-Agent': 'ShinobiKaraoke/1.2.3 (https://github.com/Gomonsoft/shinobi-karaoke)',
      Accept: 'application/json'
    })
    expect(Object.keys(init).sort()).toEqual(['credentials', 'headers', 'method', 'signal'])
  })

  it('duration fuera de rango se omite; sin álbum se omite', async () => {
    const e = entorno()
    const f = vi.fn<FetchLrclib>(async () => resp(404))
    const c = crearClienteLrclib({ ...e.base, fetch: f })
    expect(await c.get({ titulo: 't', artista: 'a', duracionS: 4000 }, señalLibre())).toBeNull()
    await c.get({ titulo: 't', artista: 'a', duracionS: 0.2 }, señalLibre())
    for (const [url] of f.mock.calls) {
      const p = new URL(url as string).searchParams
      expect(p.has('duration')).toBe(false)
      expect(p.has('album_name')).toBe(false)
    }
  })

  it('porId: 200 y 404', async () => {
    const e = entorno()
    const f = vi
      .fn<FetchLrclib>()
      .mockResolvedValueOnce(resp(200, registroGet))
      .mockResolvedValueOnce(resp(404))
    const c = crearClienteLrclib({ ...e.base, fetch: f })
    expect((await c.porId(9001, señalLibre()))?.trackName).toBe('Canción inventada')
    expect(await c.porId(5, señalLibre())).toBeNull()
    expect(f.mock.calls[0]?.[0]).toBe('https://lrclib.net/api/get/9001')
  })

  it('buscar: limita a 20 y descarta registros no válidos sin perder el resto', async () => {
    const e = entorno()
    const lista = [
      ...Array.from({ length: 30 }, (_, i) => ({ ...registroGet, id: i + 1 })),
      { id: 'x' }
    ]
    lista.splice(1, 0, { id: 'mal', trackName: 5 } as never)
    const f = vi.fn<FetchLrclib>(async () => resp(200, lista))
    const c = crearClienteLrclib({ ...e.base, fetch: f })
    const r = await c.buscar({ q: 'hola mundo' }, señalLibre())
    expect(r).toHaveLength(20)
    expect(r[0]?.id).toBe(1)
    expect(new URL(f.mock.calls[0]?.[0] as string).searchParams.get('q')).toBe('hola mundo')
    expect(e.logs.some((l) => l.includes('descartado'))).toBe(true)
    expect(e.logs.join('\n')).not.toContain('Canción inventada')
  })

  it('buscar por título y artista; tolera campos nuevos', async () => {
    const e = entorno()
    const f = vi.fn<FetchLrclib>(async () => resp(200, [{ ...registroGet, nuevo: 1 }]))
    const c = crearClienteLrclib({ ...e.base, fetch: f })
    expect(await c.buscar({ titulo: 'T', artista: 'A' }, señalLibre())).toHaveLength(1)
    const p = new URL(f.mock.calls[0]?.[0] as string).searchParams
    expect(p.get('track_name')).toBe('T')
    expect(p.get('artist_name')).toBe('A')
  })

  it('separa las peticiones al menos 250 ms y las hace en serie', async () => {
    const e = entorno()
    const inicios: number[] = []
    let activas = 0
    let maxActivas = 0
    const f: FetchLrclib = async () => {
      inicios.push(e.reloj())
      activas++
      maxActivas = Math.max(maxActivas, activas)
      await Promise.resolve()
      activas--
      return resp(404)
    }
    const c = crearClienteLrclib({ ...e.base, fetch: f })
    await Promise.all([1, 2, 3].map((i) => c.porId(i, señalLibre())))
    expect(maxActivas).toBe(1)
    expect(inicios[1]! - inicios[0]!).toBeGreaterThanOrEqual(250)
    expect(inicios[2]! - inicios[1]!).toBeGreaterThanOrEqual(250)
  })

  it('429 con espera que cabe: espera Retry-After más margen y reintenta una vez', async () => {
    const e = entorno()
    const f = vi
      .fn<FetchLrclib>()
      .mockResolvedValueOnce(resp(429, '', { 'retry-after': '2' }))
      .mockResolvedValueOnce(resp(200, registroGet))
    const c = crearClienteLrclib({ ...e.base, aleatorio: () => 0.5, fetch: f })
    expect((await c.porId(1, señalLibre()))?.id).toBe(9001)
    expect(f).toHaveBeenCalledTimes(2)
    expect(e.esperas).toContain(2300)
  })

  it('429 dos veces: no reintenta más y bloquea con "no antes de"', async () => {
    const e = entorno()
    const f = vi.fn<FetchLrclib>(async () => resp(429, '', { 'retry-after': '1' }))
    const c = crearClienteLrclib({ ...e.base, fetch: f })
    await expect(c.porId(1, señalLibre())).rejects.toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE'
    })
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('429 que no cabe en el presupuesto: falla y no toca la red hasta pasado el plazo', async () => {
    const e = entorno()
    const f = vi
      .fn<FetchLrclib>()
      .mockResolvedValueOnce(resp(429, '', { 'retry-after': '60' }))
      .mockResolvedValue(resp(404))
    const c = crearClienteLrclib({ ...e.base, fetch: f })
    await expect(c.porId(1, señalLibre())).rejects.toBeInstanceOf(ErrorLrclib)
    expect(f).toHaveBeenCalledTimes(1)
    await expect(c.porId(2, señalLibre())).rejects.toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE'
    })
    expect(f).toHaveBeenCalledTimes(1)
    e.avanzar(61_000)
    expect(await c.porId(3, señalLibre())).toBeNull()
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('429 con Retry-After como fecha HTTP', async () => {
    const e = entorno()
    const fecha = new Date(e.reloj() + 3000).toUTCString()
    const f = vi
      .fn<FetchLrclib>()
      .mockResolvedValueOnce(resp(429, '', { 'retry-after': fecha }))
      .mockResolvedValueOnce(resp(404))
    const c = crearClienteLrclib({ ...e.base, fetch: f })
    expect(await c.porId(1, señalLibre())).toBeNull()
    expect(e.esperas.some((x) => x >= 1500 && x <= 3000)).toBe(true)
  })

  it.each([500, 503, 400])('HTTP %i -> SERVICIO_NO_DISPONIBLE', async (st) => {
    const e = entorno()
    const c = crearClienteLrclib({ ...e.base, fetch: async () => resp(st) })
    await expect(c.porId(1, señalLibre())).rejects.toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE'
    })
  })

  it.each([
    ['net::ERR_NAME_NOT_RESOLVED', 'SIN_CONEXION'],
    ['net::ERR_INTERNET_DISCONNECTED', 'SIN_CONEXION'],
    ['net::ERR_NETWORK_CHANGED', 'SIN_CONEXION'],
    ['net::ERR_ADDRESS_UNREACHABLE', 'SIN_CONEXION'],
    ['net::ERR_CONNECTION_REFUSED', 'SERVICIO_NO_DISPONIBLE'],
    ['net::ERR_CONNECTION_RESET', 'SERVICIO_NO_DISPONIBLE'],
    ['net::ERR_CERT_AUTHORITY_INVALID', 'SERVICIO_NO_DISPONIBLE']
  ])('%s -> %s', async (msg, codigo) => {
    const e = entorno()
    const c = crearClienteLrclib({
      ...e.base,
      fetch: async () => {
        throw new TypeError(msg)
      }
    })
    await expect(c.porId(1, señalLibre())).rejects.toMatchObject({ codigo })
  })

  it('net.isOnline() false -> SIN_CONEXION sin tocar la red', async () => {
    const e = entorno()
    const f = vi.fn<FetchLrclib>()
    const c = crearClienteLrclib({ ...e.base, enLinea: () => false, fetch: f })
    await expect(c.porId(1, señalLibre())).rejects.toMatchObject({ codigo: 'SIN_CONEXION' })
    expect(f).not.toHaveBeenCalled()
  })

  it('JSON roto y respuesta de búsqueda que no es lista', async () => {
    const e = entorno()
    const c = crearClienteLrclib({ ...e.base, fetch: async () => resp(200, '{no json') })
    await expect(c.porId(1, señalLibre())).rejects.toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE'
    })
    const c2 = crearClienteLrclib({ ...e.base, fetch: async () => resp(200, { a: 1 }) })
    await expect(c2.buscar({ q: 'x' }, señalLibre())).rejects.toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE'
    })
  })

  it('cuerpo de más de 2 MB se corta', async () => {
    const e = entorno()
    let cancelado = false
    const trozo = new Uint8Array(512 * 1024).fill(65)
    let n = 0
    const body = new ReadableStream<Uint8Array>({
      pull(ctl) {
        if (n++ < 100) ctl.enqueue(trozo)
        else ctl.close()
      },
      cancel() {
        cancelado = true
      }
    })
    const c = crearClienteLrclib({
      ...e.base,
      fetch: async () => ({ ...resp(200), body })
    })
    await expect(c.porId(1, señalLibre())).rejects.toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE'
    })
    expect(cancelado).toBe(true)
    expect(n).toBeLessThan(10)
  })

  it('tiempo máximo de la petición -> SERVICIO_NO_DISPONIBLE', async () => {
    const e = entorno()
    const f: FetchLrclib = (_u, init) =>
      new Promise((_res, rej) => {
        init.signal.addEventListener('abort', () => rej(new DOMException('abort', 'AbortError')))
      })
    const c = crearClienteLrclib({ ...e.base, tiempoPeticionMs: 20, fetch: f })
    await expect(c.porId(1, señalLibre())).rejects.toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE'
    })
  })

  it('cancelación del usuario -> CANCELADO', async () => {
    const e = entorno()
    const ctl = new AbortController()
    const f: FetchLrclib = (_u, init) =>
      new Promise((_res, rej) => {
        init.signal.addEventListener('abort', () => rej(new DOMException('abort', 'AbortError')))
      })
    const c = crearClienteLrclib({ ...e.base, fetch: f })
    const p = c.porId(1, ctl.signal)
    setTimeout(() => ctl.abort(), 5)
    await expect(p).rejects.toMatchObject({ codigo: 'CANCELADO' })
  })

  describe('URL base', () => {
    it('por defecto es lrclib.net y se registra', () => {
      const e = entorno()
      const c = crearClienteLrclib({ ...e.base, fetch: async () => resp(404) })
      expect(c.urlBase).toBe('https://lrclib.net')
      expect(e.logs).toContain('info lrclib URL base: https://lrclib.net')
    })
    it('SHINOBI_LRCLIB_URL local sin empaquetar se usa', () => {
      const e = entorno()
      const c = crearClienteLrclib({
        ...e.base,
        env: { SHINOBI_LRCLIB_URL: 'http://127.0.0.1:5555' },
        fetch: async () => resp(404)
      })
      expect(c.urlBase).toBe('http://127.0.0.1:5555')
      expect(e.logs).toContain('info lrclib URL base: http://127.0.0.1:5555')
    })
    it('se ignora si está empaquetada o apunta a otro host', () => {
      const e = entorno()
      const a = crearClienteLrclib({
        ...e.base,
        empaquetada: true,
        env: { SHINOBI_LRCLIB_URL: 'http://127.0.0.1:5555' },
        fetch: async () => resp(404)
      })
      expect(a.urlBase).toBe('https://lrclib.net')
      const b = crearClienteLrclib({
        ...e.base,
        env: { SHINOBI_LRCLIB_URL: 'https://malo.example' },
        fetch: async () => resp(404)
      })
      expect(b.urlBase).toBe('https://lrclib.net')
      expect(e.logs.some((l) => l.includes('ignorada'))).toBe(true)
    })
  })
})

describe('integración con servidor HTTP local (fetch de Node)', () => {
  let servidor: Server | null = null
  afterEach(() => new Promise<void>((r) => (servidor ? servidor.close(() => r()) : r())))

  async function levantar(manejador: Parameters<typeof createServer>[1]): Promise<{ url: string }> {
    servidor = createServer(manejador)
    await new Promise<void>((r) => servidor!.listen(0, '127.0.0.1', r))
    return { url: `http://127.0.0.1:${(servidor.address() as AddressInfo).port}` }
  }

  it('get, 404 y cabeceras reales sin datos identificativos', async () => {
    const vistas: Record<string, string | string[] | undefined>[] = []
    const { url } = await levantar((req, res) => {
      vistas.push(req.headers)
      if (req.url?.startsWith('/api/get/404')) {
        res.statusCode = 404
        res.end('{}')
        return
      }
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(registroGet))
    })
    const e = entorno()
    const c = crearClienteLrclib({
      ...e.base,
      dormir: undefined,
      ahora: undefined,
      env: { SHINOBI_LRCLIB_URL: url },
      fetch: ((u, init) => fetch(u, init)) as FetchLrclib
    })
    expect((await c.get({ titulo: 'a', artista: 'b' }, señalLibre()))?.id).toBe(9001)
    expect(await c.porId(404, señalLibre())).toBeNull()
    const h = vistas[0]!
    expect(h['user-agent']).toBe(
      'ShinobiKaraoke/1.2.3 (https://github.com/Gomonsoft/shinobi-karaoke)'
    )
    expect(h['accept']).toBe('application/json')
    for (const k of ['cookie', 'referer', 'authorization', 'lrclib-app-id']) {
      expect(h[k]).toBeUndefined()
    }
  })

  it('429 real con Retry-After: espera y reintenta', async () => {
    let n = 0
    const { url } = await levantar((_req, res) => {
      if (n++ === 0) {
        res.statusCode = 429
        res.setHeader('retry-after', '0')
        res.end()
      } else res.end(JSON.stringify([registroGet]))
    })
    const e = entorno()
    const c = crearClienteLrclib({
      ...e.base,
      dormir: undefined,
      ahora: undefined,
      env: { SHINOBI_LRCLIB_URL: url },
      fetch: ((u, init) => fetch(u, init)) as FetchLrclib
    })
    expect(await c.buscar({ q: 'x' }, señalLibre())).toHaveLength(1)
    expect(n).toBe(2)
  })

  it('servidor caído -> SERVICIO_NO_DISPONIBLE', async () => {
    const { url } = await levantar((_q, res) => res.end())
    await new Promise<void>((r) => servidor!.close(() => r()))
    servidor = null
    const e = entorno()
    const c = crearClienteLrclib({
      ...e.base,
      env: { SHINOBI_LRCLIB_URL: url },
      fetch: ((u, init) => fetch(u, init)) as FetchLrclib
    })
    await expect(c.porId(1, señalLibre())).rejects.toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE'
    })
  })
})

describe.skipIf(!process.env.SHINOBI_TESTS_RED)('LRCLIB real (SHINOBI_TESTS_RED=1)', () => {
  it('busca una letra de dominio público', async () => {
    const e = entorno()
    const c = crearClienteLrclib({
      ...e.base,
      dormir: undefined,
      ahora: undefined,
      empaquetada: true,
      fetch: ((u, init) => fetch(u, init)) as FetchLrclib
    })
    const r = await c.buscar({ q: 'Twinkle Twinkle Little Star' }, señalLibre())
    expect(Array.isArray(r)).toBe(true)
  })
})
