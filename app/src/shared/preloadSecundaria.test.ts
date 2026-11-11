import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { CANALES } from './canales'
import type { ApiReproductor } from './ipc'

const expuestos = vi.hoisted(() => new Map<string, Record<string, unknown>>())
const ipc = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn()
}))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (nombre: string, api: Record<string, unknown>) => expuestos.set(nombre, api)
  },
  ipcRenderer: ipc,
  webUtils: { getPathForFile: () => '' }
}))

describe('preload de la ventana secundaria', () => {
  beforeEach(() => {
    vi.resetModules()
    expuestos.clear()
    ipc.invoke.mockReset()
  })

  it('expone solo window.shinobiReproductor, sin biblioteca, temas, config ni cola', async () => {
    await import('../preload/secundaria')
    expect([...expuestos.keys()]).toEqual(['shinobiReproductor'])
    const api = expuestos.get('shinobiReproductor')!
    expect(Object.keys(api).sort()).toEqual([
      'alComando',
      'alEstado',
      'alPreferencias',
      'sesion',
      'ventana'
    ])
    for (const prohibido of ['biblioteca', 'temas', 'config', 'cola', 'letras', 'app']) {
      expect(api).not.toHaveProperty(prohibido)
    }
  })

  it('el tipo ApiReproductor no tiene biblioteca, temas, config ni cola', () => {
    expectTypeOf<ApiReproductor>().not.toHaveProperty('biblioteca')
    expectTypeOf<ApiReproductor>().not.toHaveProperty('temas')
    expectTypeOf<ApiReproductor>().not.toHaveProperty('config')
    expectTypeOf<ApiReproductor>().not.toHaveProperty('cola')
  })

  it('invoca los canales con los argumentos del contrato y desempaqueta el error', async () => {
    await import('../preload/secundaria')
    const api = expuestos.get('shinobiReproductor') as {
      sesion: {
        siguiente(id: string): Promise<unknown>
        cierre: { confirmar(c: string, r: number): Promise<unknown> }
      }
    }
    ipc.invoke.mockResolvedValueOnce({ ok: true, valor: 'estado' })
    await expect(api.sesion.siguiente('e1')).resolves.toBe('estado')
    expect(ipc.invoke).toHaveBeenCalledWith(CANALES.sesion.siguiente, { desdeEntradaId: 'e1' })
    ipc.invoke.mockResolvedValueOnce({
      ok: false,
      error: { codigo: 'SESION_NO_ACTIVA', mensaje: 'x' }
    })
    await expect(api.sesion.cierre.confirmar('conservar', 3)).rejects.toEqual({
      codigo: 'SESION_NO_ACTIVA',
      mensaje: 'x'
    })
    expect(ipc.invoke).toHaveBeenLastCalledWith(CANALES.sesion.confirmarCierre, {
      cola: 'conservar',
      revision: 3
    })
  })

  it('las suscripciones no filtran el evento de Electron y se dan de baja', async () => {
    await import('../preload/secundaria')
    const api = expuestos.get('shinobiReproductor') as {
      alComando(cb: (c: unknown) => void): () => void
    }
    const cb = vi.fn()
    const baja = api.alComando(cb)
    expect(ipc.on).toHaveBeenCalledWith(CANALES.eventos.sesionComando, expect.any(Function))
    ipc.on.mock.calls[0]![1]({ sender: 'secreto' }, { tipo: 'fin_de_cola' })
    expect(cb).toHaveBeenCalledWith({ tipo: 'fin_de_cola' })
    baja()
    expect(ipc.removeListener).toHaveBeenCalled()
  })
})

describe('preload principal', () => {
  it('añade pantallas, sesion y cola a window.shinobi', async () => {
    vi.resetModules()
    expuestos.clear()
    await import('../preload/index')
    const api = expuestos.get('shinobi')!
    expect(Object.keys(api)).toEqual(
      expect.arrayContaining([
        'pantallas',
        'sesion',
        'cola',
        'alCambiarSesion',
        'alPosicionSesion',
        'alCambiarPantallas'
      ])
    )
    expect(Object.keys(api)).not.toContain('sesionInicial')
  })
})
