import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { instalarErroresGlobales, reiniciarErroresGlobales } from './erroresGlobales'

beforeEach(() => reiniciarErroresGlobales())

const montar = (estricto: boolean) => {
  const proceso = new EventEmitter()
  const registrar = vi.fn()
  const relanzar = vi.fn()
  instalarErroresGlobales({
    registrar,
    estricto,
    proceso: proceso as unknown as NodeJS.Process,
    relanzar
  })
  return { proceso, registrar, relanzar }
}

describe('errores globales del proceso principal', () => {
  it('modo normal: registra con su pila una promesa rechazada y sigue', () => {
    const { proceso, registrar, relanzar } = montar(false)
    proceso.emit('unhandledRejection', new Error('rechazo inventado'))
    expect(registrar).toHaveBeenCalledWith(
      'error',
      'proceso',
      expect.stringContaining('promesa rechazada sin manejar: Error: rechazo inventado')
    )
    expect(registrar.mock.calls[0]![2]).toContain('erroresGlobales.test.ts')
    expect(relanzar).not.toHaveBeenCalled()
  })

  it('modo normal: un throw asíncrono se registra y no se relanza', () => {
    const { proceso, registrar, relanzar } = montar(false)
    proceso.emit('uncaughtException', new Error('throw inventado'))
    expect(registrar).toHaveBeenCalledWith(
      'error',
      'proceso',
      expect.stringContaining('error no capturado: Error: throw inventado')
    )
    expect(relanzar).not.toHaveBeenCalled()
  })

  it('modo de prueba: registra y vuelve a lanzar', () => {
    const { proceso, registrar, relanzar } = montar(true)
    const e = new Error('visible en CI')
    proceso.emit('uncaughtException', e)
    proceso.emit('unhandledRejection', e)
    expect(registrar).toHaveBeenCalledTimes(2)
    expect(relanzar).toHaveBeenCalledTimes(2)
    expect(relanzar).toHaveBeenCalledWith(e)
  })

  it('un valor que no es Error también se registra', () => {
    const { proceso, registrar } = montar(false)
    proceso.emit('unhandledRejection', 'texto suelto')
    expect(registrar.mock.calls[0]![2]).toContain('texto suelto')
  })

  it('se instala una sola vez', () => {
    const proceso = new EventEmitter()
    const o = { registrar: vi.fn(), estricto: false, proceso: proceso as unknown as NodeJS.Process }
    expect(instalarErroresGlobales(o)).toBe(true)
    expect(instalarErroresGlobales(o)).toBe(false)
    expect(proceso.listenerCount('uncaughtException')).toBe(1)
    expect(proceso.listenerCount('unhandledRejection')).toBe(1)
  })
})
