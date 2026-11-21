import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_BLOQUES_PICOS } from '../../../../shared/ipc'
import { leerPicosBase, olvidarPicosBase } from './picosBase'

type Api = Parameters<typeof leerPicosBase>[0]

const ID = '11111111-1111-4111-8111-111111111111'
const G1 = 'a'.repeat(64)
const G2 = 'b'.repeat(64)
const TOTAL = 10000

const fuente = new Int16Array(TOTAL * 2).map((_, i) => (i % 2 ? i : -i))

function lectura(k: number, generacion = G1, pasoMs = 10) {
  const par = fuente.slice(k * MAX_BLOQUES_PICOS * 2, (k + 1) * MAX_BLOQUES_PICOS * 2)
  if (par.length === 0) return null
  return {
    generacion,
    primerBloque: k * MAX_BLOQUES_PICOS,
    pasoMs,
    bytes: new Uint8Array(par.buffer)
  }
}

function crearApi(opts: { estado?: unknown; leer?: (k: number) => unknown } = {}) {
  const leer = vi.fn(async (p: { inicioMs: number }) =>
    (opts.leer ?? lectura)(Math.round(p.inicioMs / 40960))
  )
  const solicitar = vi.fn(async () => opts.estado ?? { estado: 'lista', generacion: G1 })
  return { picos: { solicitar, leer } } as unknown as Api & {
    picos: { solicitar: typeof solicitar; leer: typeof leer }
  }
}

beforeEach(() => olvidarPicosBase())

describe('leerPicosBase', () => {
  it('lee 3 ventanas y reconstruye el array', async () => {
    const a = crearApi()
    const r = await leerPicosBase(a, ID, TOTAL * 10)
    expect(a.picos.leer).toHaveBeenCalledTimes(3)
    expect(r.estado).toBe('lista')
    if (r.estado === 'lista') expect(Array.from(r.pares)).toEqual(Array.from(fuente))
  })

  it('reutiliza el memo en la misma visita', async () => {
    const a = crearApi()
    await leerPicosBase(a, ID, TOTAL * 10)
    await leerPicosBase(a, ID, TOTAL * 10)
    expect(a.picos.leer).toHaveBeenCalledTimes(3)
  })

  it('reintenta una vez si cambia la generación y luego devuelve generando', async () => {
    let n = 0
    const a = crearApi({ leer: (k) => lectura(k, n++ === 1 ? G2 : G1) })
    expect((await leerPicosBase(a, ID, TOTAL * 10)).estado).toBe('lista')

    olvidarPicosBase()
    const b = crearApi({ leer: (k) => lectura(k, G2) })
    expect((await leerPicosBase(b, ID, TOTAL * 10)).estado).toBe('generando')
  })

  it.each(['generando', 'no_disponible', 'error'])('no lee con solicitar=%s', async (estado) => {
    const a = crearApi({ estado: { estado } })
    expect((await leerPicosBase(a, ID, 1000)).estado).toBe(estado)
    expect(a.picos.leer).not.toHaveBeenCalled()
  })

  it('pasoMs distinto de 10 da error', async () => {
    const a = crearApi({ leer: (k) => lectura(k, G1, 20) })
    expect((await leerPicosBase(a, ID, 1000)).estado).toBe('error')
  })

  it('abortar detiene la lectura', async () => {
    const ctl = new AbortController()
    const a = crearApi({
      leer: (k) => {
        ctl.abort()
        return lectura(k)
      }
    })
    await leerPicosBase(a, ID, TOTAL * 10, { signal: ctl.signal })
    expect(a.picos.leer).toHaveBeenCalledTimes(1)
  })
})
