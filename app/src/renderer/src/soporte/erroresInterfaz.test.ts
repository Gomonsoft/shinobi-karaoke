// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fijarContextoError,
  informarError,
  instalarCapturaErrores,
  reiniciarErroresInterfaz
} from './erroresInterfaz'

describe('errores de la interfaz', () => {
  const registrarError = vi.fn(() => Promise.resolve())
  beforeEach(() => {
    reiniciarErroresInterfaz()
    registrarError.mockClear()
    ;(window as unknown as { shinobi: unknown }).shinobi = { app: { registrarError } }
  })
  afterEach(() => {
    delete (window as unknown as { shinobi?: unknown }).shinobi
  })

  it('envía mensaje, pila y contexto, recortados', () => {
    fijarContextoError({ vista: 'cancion/editor', cancionId: 'c1' })
    informarError('react', new Error('x'.repeat(2000)), '\n  at A')
    expect(registrarError).toHaveBeenCalledOnce()
    const [carga] = registrarError.mock.calls[0] as unknown as [Record<string, string>]
    expect(carga).toMatchObject({
      origen: 'react',
      vista: 'cancion/editor',
      cancionId: 'c1',
      componentes: 'at A'
    })
    expect(carga.mensaje!.length).toBeLessThanOrEqual(500)
    expect(carga.pila!.length).toBeLessThanOrEqual(3000)
  })

  it('el mismo error en bucle se manda una vez; sin puente no lanza', () => {
    for (let i = 0; i < 5; i++) informarError('onerror', 'igual')
    expect(registrarError).toHaveBeenCalledOnce()
    delete (window as unknown as { shinobi?: unknown }).shinobi
    expect(() => informarError('onerror', 'otro')).not.toThrow()
  })

  it('captura window.onerror y las promesas rechazadas', () => {
    const quitar = instalarCapturaErrores()
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('uno'), message: 'uno' }))
    const rechazo = new Event('unhandledrejection') as Event & { reason?: unknown }
    rechazo.reason = new Error('dos')
    window.dispatchEvent(rechazo)
    quitar()
    const origenes = registrarError.mock.calls.map(
      (c) => (c as unknown as [{ origen: string }])[0].origen
    )
    expect(origenes).toEqual(['onerror', 'promesa'])
  })
})
