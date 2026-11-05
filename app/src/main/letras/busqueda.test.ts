import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it, vi } from 'vitest'
import { leerFixtureLetraJson } from '../../shared/__fixtures__/letras'
import type { Cancion } from '../../shared'
import { BusquedaLetras, convertirRegistro, type OpcionesBusquedaLetras } from './busqueda'
import {
  crearClienteLrclib,
  ErrorLrclib,
  registroLrclibSchema,
  type RegistroLrclib
} from './lrclib'

const reg = (o: Record<string, unknown>): RegistroLrclib => registroLrclibSchema.parse(o)
const get = reg(leerFixtureLetraJson('lrclib-get.json'))
const lista = leerFixtureLetraJson<unknown[]>('lrclib-search.json').map((x) =>
  reg(x as Record<string, unknown>)
)
const instr = reg(leerFixtureLetraJson('lrclib-instrumental.json'))
const base = (id: number, extra: Record<string, unknown> = {}): RegistroLrclib =>
  reg({
    id,
    trackName: 't',
    artistName: 'a',
    duration: 215,
    plainLyrics: 'uno\ndos',
    syncedLyrics: null,
    ...extra
  })

type Cliente = OpcionesBusquedaLetras['cliente']

function montar(cliente: Partial<Cliente>, extra: Partial<OpcionesBusquedaLetras> = {}) {
  let c = {
    metadatos: {
      titulo: 'Canción inventada',
      artista: 'Artista inventado',
      album: 'Álbum',
      duracion_ms: 215_000
    }
  } as Cancion
  const actualizar = vi.fn(async (_id: string, cambio: { metadatos?: object }) => {
    c = { ...c, metadatos: { ...c.metadatos, ...cambio.metadatos } } as Cancion
    return {} as never
  })
  const logs: string[] = []
  const cl: Cliente = {
    get: async () => null,
    buscar: async () => [],
    ...cliente
  }
  const b = new BusquedaLetras({
    biblioteca: { obtener: (id) => (id === 'c1' ? c : null), actualizar: actualizar as never },
    cliente: cl,
    registro: { escribir: (_n, _m, msg) => logs.push(msg) },
    ...extra
  })
  return { b, actualizar, logs }
}
const pet = (extra: object = {}) => ({
  cancionId: 'c1',
  titulo: 'Canción inventada',
  artista: 'Artista inventado',
  ...extra
})
const codigo = async (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: ErrorLrclib) => e.codigo
  )

describe('convertirRegistro', () => {
  it('Lyricsfile roto cae a LRC; sin nada o instrumental, null', () => {
    const roto = base(1, { hasWordSync: true, lyricsfile: ': : [', syncedLyrics: '[00:01.00]hola' })
    expect(convertirRegistro(roto)?.[0]?.inicio_ms).toBe(1000)
    expect(convertirRegistro(base(2, { plainLyrics: null }))).toBeNull()
    expect(convertirRegistro(instr)).toBeNull()
  })
})

describe('BusquedaLetras', () => {
  it('get acierta y search aporta más, sin duplicados, ordenados', async () => {
    const buscar = vi.fn(async () => lista)
    const { b } = montar({ get: async () => get, buscar })
    const r = await b.buscar(pet())
    const ids = r.candidatos.map((c) => c.lrclib_id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(9001)
    expect(r.candidatos[0]?.sincronia).toBe('palabra')
    const rango = { palabra: 0, linea: 1, texto: 2 }
    const s = r.candidatos.map((c) => rango[c.sincronia])
    expect(s).toEqual([...s].sort())
    expect(r.candidatos.find((c) => c.lrclib_id === 9001)).toMatchObject({
      duracion_ms: 215_400,
      diferencia_ms: 400
    })
    expect(r.instrumental).toBe(false)
    expect(buscar).toHaveBeenCalledTimes(1)
  })

  it('orden por |diferencia| y get primero a igualdad', async () => {
    const a = base(1, { duration: 230 })
    const bb = base(2, { duration: 214 })
    const g = base(3, { duration: 216 })
    const { b } = montar({ get: async () => g, buscar: async () => [a, bb] })
    const r = await b.buscar(pet())
    expect(r.candidatos.map((c) => c.lrclib_id)).toEqual([3, 2, 1])
    const { b: b2 } = montar({
      get: async () => base(5, { duration: 214 }),
      buscar: async () => [base(6, { duration: 216 })]
    })
    expect((await b2.buscar(pet())).candidatos.map((c) => c.lrclib_id)).toEqual([5, 6])
  })

  it('get 404 y search con resultados; search vacío repite con q', async () => {
    const buscar = vi.fn(async (c: object) => ('q' in c ? [base(7)] : []))
    const { b } = montar({ buscar })
    const r = await b.buscar(pet())
    expect(r.candidatos).toHaveLength(1)
    expect(buscar.mock.calls.map((x) => x[0])).toEqual([
      { titulo: 'Canción inventada', artista: 'Artista inventado' },
      { q: 'Canción inventada Artista inventado' }
    ])
  })

  it('sin artista: no hay get y se busca solo con el título', async () => {
    const g = vi.fn(async () => null)
    const buscar = vi.fn(async (c: object) => (c ? [base(1)] : []))
    const { b } = montar({ get: g, buscar })
    await b.buscar(pet({ artista: '  ' }))
    expect(g).not.toHaveBeenCalled()
    expect(buscar.mock.calls[0]?.[0]).toEqual({ q: 'Canción inventada' })
  })

  it('todo vacío: LETRA_NO_ENCONTRADA; sin conexión y servicio caído según el primer error', async () => {
    expect(await codigo(montar({}).b.buscar(pet()))).toBe('LETRA_NO_ENCONTRADA')
    const falla = (c: 'SIN_CONEXION' | 'SERVICIO_NO_DISPONIBLE') => ({
      get: async () => Promise.reject(new ErrorLrclib(c, 'x')),
      buscar: async () => Promise.reject(new ErrorLrclib('SERVICIO_NO_DISPONIBLE', 'y'))
    })
    expect(await codigo(montar(falla('SIN_CONEXION')).b.buscar(pet()))).toBe('SIN_CONEXION')
    expect(await codigo(montar(falla('SERVICIO_NO_DISPONIBLE')).b.buscar(pet()))).toBe(
      'SERVICIO_NO_DISPONIBLE'
    )
  })

  it('instrumental sin y con otros candidatos', async () => {
    expect(await codigo(montar({ get: async () => instr }).b.buscar(pet()))).toBe('INSTRUMENTAL')
    expect(await codigo(montar({ buscar: async () => [instr] }).b.buscar(pet()))).toBe(
      'INSTRUMENTAL'
    )
    const r = await montar({ get: async () => instr, buscar: async () => [base(1)] }).b.buscar(
      pet()
    )
    expect(r).toMatchObject({ instrumental: true })
    expect(r.candidatos).toHaveLength(1)
  })

  it('máximo 20 candidatos', async () => {
    const muchos = Array.from({ length: 30 }, (_, i) => base(100 + i))
    const r = await montar({ buscar: async () => muchos }).b.buscar(pet())
    expect(r.candidatos).toHaveLength(20)
  })

  it('presupuesto agotado: con candidatos los devuelve; sin ellos, SERVICIO_NO_DISPONIBLE', async () => {
    const cuelga = (s: AbortSignal) =>
      new Promise<never>((_, rj) =>
        s.addEventListener('abort', () => rj(new ErrorLrclib('CANCELADO', 'c')))
      )
    const con = montar(
      { get: async () => base(1), buscar: (_c, s) => cuelga(s) },
      { presupuestoMs: 30 }
    )
    expect((await con.b.buscar(pet())).candidatos).toHaveLength(1)
    const sin = montar({ get: (_d, s) => cuelga(s) }, { presupuestoMs: 30 })
    expect(await codigo(sin.b.buscar(pet()))).toBe('SERVICIO_NO_DISPONIBLE')
  })

  it('una búsqueda nueva cancela la anterior; cerrar cancela', async () => {
    let n = 0
    const cuelga = (s: AbortSignal) =>
      new Promise<never>((_, rj) =>
        s.addEventListener('abort', () => rj(new ErrorLrclib('CANCELADO', 'c')))
      )
    const { b } = montar({
      get: async (_d, s) => (n++ === 0 ? cuelga(s) : null),
      buscar: async () => [base(1)]
    })
    const primera = codigo(b.buscar(pet()))
    const segunda = await b.buscar(pet())
    expect(await primera).toBe('CANCELADO')
    expect(segunda.candidatos).toHaveLength(1)
    const { b: b2 } = montar({ get: (_d, s) => cuelga(s) })
    const p = codigo(b2.buscar(pet()))
    b2.cerrar()
    expect(await p).toBe('CANCELADO')
  })

  it('guarda los metadatos si cambian y no si coinciden; canción inexistente', async () => {
    const { b, actualizar } = montar({ buscar: async () => [base(1)] })
    await b.buscar(pet())
    expect(actualizar).not.toHaveBeenCalled()
    await b.buscar(pet({ titulo: ' Otro ' }))
    expect(actualizar).toHaveBeenCalledWith('c1', {
      metadatos: { titulo: 'Otro', artista: 'Artista inventado', album: 'Álbum' }
    })
    expect(await codigo(b.buscar(pet({ cancionId: 'nada' })))).toBe('ARGUMENTOS_NO_VALIDOS')
  })

  it('caché: solo con usarCache y mismos título y artista, y caduca', async () => {
    let t = 0
    const buscar = vi.fn(async () => [base(1)])
    const { b } = montar({ buscar }, { ahora: () => t, cacheMs: 1000 })
    await b.buscar(pet())
    await b.buscar(pet({ usarCache: true }))
    expect(buscar).toHaveBeenCalledTimes(1)
    await b.buscar(pet())
    expect(buscar).toHaveBeenCalledTimes(2)
    await b.buscar(pet({ usarCache: true, titulo: 'Otro' }))
    expect(buscar).toHaveBeenCalledTimes(3)
    t = 2000
    await b.buscar(pet({ usarCache: true, titulo: 'Otro' }))
    expect(buscar).toHaveBeenCalledTimes(4)
  })

  it('registra una línea por búsqueda sin el título', async () => {
    const { b, logs } = montar({ buscar: async () => [base(1)] })
    await b.buscar(pet())
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatch(/cancion=c1 candidatos=1 duracion_ms=\d+ error=-/)
    expect(logs[0]).not.toContain('inventada')
  })
})

describe('BusquedaLetras con servidor HTTP local', () => {
  it('cliente real contra un doble de LRCLIB', async () => {
    const srv = createServer((req, res) => {
      const u = new URL(req.url ?? '', 'http://x')
      res.setHeader('content-type', 'application/json')
      if (u.pathname === '/api/get') return void res.writeHead(404).end()
      res.end(JSON.stringify(lista))
    })
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r))
    try {
      const puerto = (srv.address() as AddressInfo).port
      const registro = { escribir: () => undefined }
      const cliente = crearClienteLrclib({
        fetch: (url, init) => fetch(url, init),
        version: '0.0.0',
        registro,
        env: { SHINOBI_LRCLIB_URL: `http://127.0.0.1:${puerto}` },
        empaquetada: false,
        separacionMs: 0
      })
      const { b } = montar({ get: cliente.get, buscar: cliente.buscar })
      const r = await b.buscar(pet())
      expect(r.candidatos.length).toBeGreaterThan(0)
      expect(r.candidatos[0]?.sincronia).toBe('palabra')
    } finally {
      srv.close()
    }
  })
})
