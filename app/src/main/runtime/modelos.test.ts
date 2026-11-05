import { createHash, randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { manifiestoSchema, type ModeloManifiesto } from '../../shared'
import type { NivelRegistro, RegistroApp } from '../registro/registroApp'
import { descargarModelo, ErrorModelo, limpiarModelos, verificarModelo } from './modelos'

const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex')
const CONTENIDO = randomBytes(2 * 1024 * 1024)
const EXTRA = Buffer.from('extra: configuración del modelo\n')

type Manejador = (req: IncomingMessage, res: ServerResponse, contenido: Buffer) => void
let servidor: Server
let puerto: number
let manejadores: Record<string, Manejador>
let peticiones: { ruta: string; range?: string }[]

const completo: Manejador = (req, res, c) => {
  const m = /^bytes=(\d+)-$/.exec(req.headers.range ?? '')
  if (m) {
    const ini = Number(m[1])
    res.writeHead(206, {
      'Content-Range': `bytes ${ini}-${c.length - 1}/${c.length}`,
      'Content-Length': c.length - ini
    })
    res.end(c.subarray(ini))
    return
  }
  res.writeHead(200, { 'Content-Length': c.length })
  res.end(c)
}

beforeAll(async () => {
  servidor = createServer((req, res) => {
    const ruta = req.url ?? ''
    peticiones.push({ ruta, range: req.headers.range })
    const c = ruta.startsWith('/extra') ? EXTRA : CONTENIDO
    ;(manejadores[ruta] ?? completo)(req, res, c)
  })
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r))
  puerto = (servidor.address() as AddressInfo).port
})
afterAll(() => new Promise<void>((r) => servidor.close(() => r())))

let dir: string
beforeEach(async () => {
  manejadores = {}
  peticiones = []
  dir = await mkdtemp(join(tmpdir(), 'shinobi-modelos-'))
  return async () => rm(dir, { recursive: true, force: true })
})

const url = (r: string, p = puerto): string => `http://127.0.0.1:${p}${r}`

function modelo(parcial: Partial<ModeloManifiesto> = {}, conExtra = false): ModeloManifiesto {
  return {
    id: 'rapido',
    archivo: 'm.onnx',
    urls: [url('/m')],
    bytes: CONTENIDO.length,
    sha256: sha(CONTENIDO),
    extra: conExtra
      ? [{ archivo: 'm.yaml', urls: [url('/extra')], bytes: EXTRA.length, sha256: sha(EXTRA) }]
      : [],
    licencia: 'MIT',
    provisional: false,
    ...parcial
  }
}

const codigo = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p
  } catch (e) {
    return e instanceof ErrorModelo ? e.codigo : `otro: ${String(e)}`
  }
  return 'sin error'
}

/** Responde con la mitad del contenido y corta la conexión. */
const cortarAMitad: Manejador = (_req, res, c) => {
  res.writeHead(200, { 'Content-Length': c.length })
  res.write(c.subarray(0, c.length / 2))
  setTimeout(() => res.destroy(), 20)
}

describe('descargarModelo', () => {
  it('descarga completa con extras, progreso acotado y total del manifiesto', async () => {
    const eventos: { bytes: number; total: number }[] = []
    await descargarModelo(modelo({}, true), {
      dirModelos: dir,
      alProgreso: (p) => eventos.push(p)
    })
    expect(await readFile(join(dir, 'm.onnx'))).toEqual(CONTENIDO)
    expect((await readFile(join(dir, 'm.yaml'))).equals(EXTRA)).toBe(true)
    expect(existsSync(join(dir, 'm.onnx.descarga'))).toBe(false)
    const total = CONTENIDO.length + EXTRA.length
    expect(eventos.every((e) => e.total === total)).toBe(true)
    expect(eventos.at(-1)?.bytes).toBe(total)
    expect(eventos.length).toBeLessThanOrEqual(20)
    for (let i = 1; i < eventos.length; i++) {
      expect(eventos[i]!.bytes).toBeGreaterThanOrEqual(eventos[i - 1]!.bytes)
    }
  })

  it('tras un corte a mitad, reanuda con Range y 206', async () => {
    manejadores['/m'] = cortarAMitad
    const m = modelo()
    expect(await codigo(descargarModelo(m, { dirModelos: dir }))).toBe('SIN_CONEXION')
    const parte = (await stat(join(dir, 'm.onnx.descarga'))).size
    expect(parte).toBeGreaterThan(0)
    expect(parte).toBeLessThan(CONTENIDO.length)

    delete manejadores['/m']
    peticiones = []
    await descargarModelo(m, { dirModelos: dir })
    expect(peticiones[0]!.range).toBe(`bytes=${parte}-`)
    expect(await readFile(join(dir, 'm.onnx'))).toEqual(CONTENIDO)
  })

  it('si el servidor ignora Range (200) empieza de cero', async () => {
    manejadores['/m'] = cortarAMitad
    const m = modelo()
    await codigo(descargarModelo(m, { dirModelos: dir }))
    manejadores['/m'] = (_q, res, c) => {
      res.writeHead(200, { 'Content-Length': c.length })
      res.end(c)
    }
    peticiones = []
    await descargarModelo(m, { dirModelos: dir })
    expect(peticiones[0]!.range).toBeDefined()
    expect(await readFile(join(dir, 'm.onnx'))).toEqual(CONTENIDO)
  })

  it('un SHA incorrecto una vez se recupera reintentando desde cero', async () => {
    let n = 0
    manejadores['/m'] = (req, res, c) => {
      if (n++ === 0) {
        res.writeHead(200, { 'Content-Length': c.length })
        res.end(Buffer.alloc(c.length, 7))
      } else completo(req, res, c)
    }
    await descargarModelo(modelo(), { dirModelos: dir })
    expect(n).toBe(2)
    expect(await readFile(join(dir, 'm.onnx'))).toEqual(CONTENIDO)
  })

  it('un SHA siempre incorrecto da VERIFICACION_FALLIDA y no deja archivos', async () => {
    manejadores['/m'] = (_q, res, c) => {
      res.writeHead(200, { 'Content-Length': c.length })
      res.end(Buffer.alloc(c.length, 7))
    }
    expect(await codigo(descargarModelo(modelo(), { dirModelos: dir }))).toBe(
      'VERIFICACION_FALLIDA'
    )
    expect(peticiones).toHaveLength(2)
    expect(await readdir(dir)).toEqual([])
  })

  it('prueba la siguiente URL ante HTTP 500', async () => {
    manejadores['/malo'] = (_q, res) => {
      res.writeHead(500)
      res.end()
    }
    await descargarModelo(modelo({ urls: [url('/malo'), url('/m')] }), { dirModelos: dir })
    expect(peticiones.map((p) => p.ruta)).toEqual(['/malo', '/m'])
    expect(await readFile(join(dir, 'm.onnx'))).toEqual(CONTENIDO)
  })

  it('si todas las URLs fallan con HTTP: SERVICIO_NO_DISPONIBLE', async () => {
    manejadores['/a'] = manejadores['/b'] = (_q, res) => {
      res.writeHead(503)
      res.end()
    }
    expect(
      await codigo(descargarModelo(modelo({ urls: [url('/a'), url('/b')] }), { dirModelos: dir }))
    ).toBe('SERVICIO_NO_DISPONIBLE')
  })

  it('puerto cerrado: SIN_CONEXION', async () => {
    const tmp = createServer()
    await new Promise<void>((r) => tmp.listen(0, '127.0.0.1', r))
    const cerrado = (tmp.address() as AddressInfo).port
    await new Promise<void>((r) => tmp.close(() => r()))
    expect(
      await codigo(descargarModelo(modelo({ urls: [url('/m', cerrado)] }), { dirModelos: dir }))
    ).toBe('SIN_CONEXION')
  })

  it('cancelar deja el .descarga y lo reanuda después', async () => {
    const ctl = new AbortController()
    manejadores['/m'] = (_q, res, c) => {
      res.writeHead(200, { 'Content-Length': c.length })
      res.write(c.subarray(0, 512 * 1024))
      // se queda abierto hasta que el cliente cancele
    }
    await writeFile(join(dir, 'viejo.onnx.partial'), 'x')
    const m = modelo()
    const p = descargarModelo(m, {
      dirModelos: dir,
      señal: ctl.signal,
      intervaloProgresoMs: 0,
      alProgreso: (e) => {
        if (e.bytes > 0) ctl.abort()
      }
    })
    expect(await codigo(p)).toBe('CANCELADO')
    expect(existsSync(join(dir, 'm.onnx.descarga'))).toBe(true)
    expect(existsSync(join(dir, 'viejo.onnx.partial'))).toBe(false)
    delete manejadores['/m']
    await descargarModelo(m, { dirModelos: dir })
    expect(await readFile(join(dir, 'm.onnx'))).toEqual(CONTENIDO)
  })

  it('registra la licencia "no declarada" de los modelos provisionales', async () => {
    const lineas: string[] = []
    const registro: RegistroApp = {
      escribir: (_n: NivelRegistro, _m: string, msg: string) => void lineas.push(msg)
    }
    await descargarModelo(modelo({ licencia: 'no declarada', provisional: true }), {
      dirModelos: dir,
      registro
    })
    expect(lineas.some((l) => l.includes('licencia no declarada'))).toBe(true)
    expect(await verificarModelo(modelo(), dir)).toBe(true)
  })
})

describe('verificarModelo', () => {
  it('usa verificados.json para no recalcular y recalcula con completo', async () => {
    const m = modelo()
    await descargarModelo(m, { dirModelos: dir })
    const ruta = join(dir, 'm.onnx')
    const st = await stat(ruta)
    const idx = JSON.parse(await readFile(join(dir, 'verificados.json'), 'utf8'))
    expect(idx['m.onnx']).toMatchObject({ bytes: CONTENIDO.length, sha256: sha(CONTENIDO) })

    // Corrompe un byte conservando tamaño y mtime: el índice no lo ve, el completo sí.
    const corrupto = Buffer.from(CONTENIDO)
    corrupto.writeUInt8(corrupto.readUInt8(10) ^ 0xff, 10)
    await writeFile(ruta, corrupto)
    await utimes(ruta, st.atime, new Date(Math.trunc(st.mtimeMs)))
    expect(await verificarModelo(m, dir)).toBe(true)
    expect(await verificarModelo(m, dir, { completo: true })).toBe(false)
  })

  it('detecta archivo ausente, tamaño distinto y modificación', async () => {
    const m = modelo()
    expect(await verificarModelo(m, dir)).toBe(false)
    await descargarModelo(m, { dirModelos: dir })
    await writeFile(join(dir, 'm.onnx'), 'corto')
    expect(await verificarModelo(m, dir)).toBe(false)
  })
})

describe('limpiarModelos', () => {
  it('borra *.partial y respeta *.descarga y los modelos', async () => {
    await writeFile(join(dir, 'a.onnx.partial'), 'x')
    await writeFile(join(dir, 'b.ckpt.descarga'), 'x')
    await writeFile(join(dir, 'c.onnx'), 'x')
    expect(await limpiarModelos(dir)).toEqual(['a.onnx.partial'])
    expect((await readdir(dir)).sort()).toEqual(['b.ckpt.descarga', 'c.onnx'])
    expect(await limpiarModelos(join(dir, 'no-existe'))).toEqual([])
  })
})

describe.runIf(process.env.SHINOBI_TESTS_RED === '1')('URLs reales (SHINOBI_TESTS_RED=1)', () => {
  it('el manifiesto real responde a Range sin descargar el modelo', async () => {
    const { readFileSync } = await import('node:fs')
    const m = manifiestoSchema.parse(
      JSON.parse(readFileSync(join(__dirname, '../../../resources/runtime-manifest.json'), 'utf8'))
    )
    for (const mod of m.modelos) {
      const r = await fetch(mod.urls[0]!, { headers: { Range: 'bytes=0-15' } })
      expect([200, 206]).toContain(r.status)
      await r.body?.cancel()
      if (r.status === 206) expect(r.headers.get('content-range')).toMatch(/^bytes 0-15\//)
    }
  }, 60_000)
})
