import { describe, expect, it, vi } from 'vitest'
import { leerFixtureLetraJson } from '../../shared/__fixtures__/letras'
import type { RegistroApp } from '../registro'
import {
  crearClienteLrclib,
  type FetchLrclib,
  type OpcionesCliente,
  type RespuestaMinima
} from './lrclib'

/** Cola automática de LRCLIB (ADR 0025 §4): reloj falso y doble HTTP, sin red. */

const registroGet = leerFixtureLetraJson<Record<string, unknown>>('lrclib-get.json')
const libre = (): AbortSignal => new AbortController().signal

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
  const registro: RegistroApp = { escribir: () => undefined }
  let t = 1_000_000
  const esperas: number[] = []
  const base: Omit<OpcionesCliente, 'fetch'> = {
    version: '1.2.3',
    registro,
    empaquetada: false,
    ahora: () => t,
    // Avanza el reloj virtual; una espera abortada (llega una interactiva) rechaza.
    dormir: (ms, señal) =>
      new Promise<void>((resolver, rechazar) => {
        if (señal.aborted) return rechazar(señal.reason)
        esperas.push(ms)
        setTimeout(() => {
          if (señal.aborted) return rechazar(señal.reason)
          t += ms
          resolver()
        }, 0)
        señal.addEventListener('abort', () => rechazar(señal.reason), { once: true })
      }),
    aleatorio: () => 0
  }
  return { esperas, base, reloj: () => t }
}

const auto = { prioridad: 'automatica' as const }
const datos = (n: number) => ({ titulo: `Tema ${n}`, artista: 'Grupo' })

describe('cola automática de LRCLIB', () => {
  it('separa las peticiones automáticas al menos 1,5 s', async () => {
    const e = entorno()
    const momentos: number[] = []
    const f = vi.fn<FetchLrclib>(async () => {
      momentos.push(e.reloj())
      return resp(200, registroGet)
    })
    const c = crearClienteLrclib({ ...e.base, fetch: f })
    await Promise.all([1, 2, 3].map((n) => c.get(datos(n), libre(), auto)))
    expect(f).toHaveBeenCalledTimes(3)
    expect(momentos[1]! - momentos[0]!).toBeGreaterThanOrEqual(1500)
    expect(momentos[2]! - momentos[1]!).toBeGreaterThanOrEqual(1500)
  })

  it('una interactiva adelanta a las automáticas que esperan y conserva su separación de 250 ms', async () => {
    const e = entorno()
    const orden: string[] = []
    let soltar: () => void = () => undefined
    const f = vi.fn<FetchLrclib>(async (url) => {
      const t = new URL(url).searchParams.get('track_name') ?? ''
      orden.push(t)
      if (t === 'Tema 1') await new Promise<void>((r) => (soltar = r))
      return resp(200, registroGet)
    })
    const c = crearClienteLrclib({ ...e.base, fetch: f })
    const a1 = c.get(datos(1), libre(), auto)
    const a2 = c.get(datos(2), libre(), auto)
    const a3 = c.get(datos(3), libre(), auto)
    await vi.waitFor(() => expect(orden).toEqual(['Tema 1']))
    const interactiva = c.get({ titulo: 'Interactiva', artista: 'Grupo' }, libre())
    soltar()
    await Promise.all([a1, a2, a3, interactiva])
    expect(orden).toEqual(['Tema 1', 'Interactiva', 'Tema 2', 'Tema 3'])
  })

  it('respeta Retry-After (con su margen) sin límite de presupuesto', async () => {
    const e = entorno()
    const f = vi
      .fn<FetchLrclib>()
      .mockResolvedValueOnce(resp(429, '', { 'retry-after': '30' }))
      .mockResolvedValueOnce(resp(200, registroGet))
    const c = crearClienteLrclib({ ...e.base, aleatorio: () => 0.5, fetch: f })
    const r = await c.get(datos(1), libre(), auto)
    expect(r?.id).toBe(9001)
    // 30 s + 15 % de margen: mucho más que el presupuesto de 10 s de una búsqueda interactiva.
    expect(e.esperas).toContain(34_500)
  })

  it('tres 429 seguidos terminan en SERVICIO_NO_DISPONIBLE y la cola sigue', async () => {
    const e = entorno()
    const f = vi
      .fn<FetchLrclib>()
      .mockResolvedValue(resp(429, '', { 'retry-after': '1' }))
      .mockResolvedValueOnce(resp(429, '', { 'retry-after': '1' }))
    const c = crearClienteLrclib({ ...e.base, fetch: f })
    await expect(c.get(datos(1), libre(), auto)).rejects.toMatchObject({
      codigo: 'SERVICIO_NO_DISPONIBLE'
    })
    expect(f).toHaveBeenCalledTimes(4)
  })

  it('con el interruptor apagado no sale ninguna petición, ni las que esperaban en la cola', async () => {
    const e = entorno()
    let activo = true
    let soltar: () => void = () => undefined
    const f = vi.fn<FetchLrclib>(async () => {
      await new Promise<void>((r) => (soltar = r))
      return resp(200, registroGet)
    })
    const c = crearClienteLrclib({ ...e.base, fetch: f })
    const op = { ...auto, permitida: () => activo }
    const primera = c.get(datos(1), libre(), op)
    const segunda = c.get(datos(2), libre(), op)
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(1))
    activo = false
    soltar()
    await primera
    await expect(segunda).rejects.toMatchObject({ codigo: 'CANCELADO' })
    await expect(c.get(datos(3), libre(), op)).rejects.toMatchObject({ codigo: 'CANCELADO' })
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('cancelar la señal de una automática en cola la saca sin enviar nada', async () => {
    const e = entorno()
    let soltar: () => void = () => undefined
    const f = vi.fn<FetchLrclib>(async () => {
      await new Promise<void>((r) => (soltar = r))
      return resp(200, registroGet)
    })
    const c = crearClienteLrclib({ ...e.base, fetch: f })
    const ctl = new AbortController()
    const primera = c.get(datos(1), libre(), auto)
    const segunda = c.get(datos(2), ctl.signal, auto)
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(1))
    ctl.abort()
    soltar()
    await primera
    await expect(segunda).rejects.toMatchObject({ codigo: 'CANCELADO' })
    expect(f).toHaveBeenCalledTimes(1)
  })
})
