import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { EstadoMotor } from '../../karaoke/motorAudio'
import { EscuchaComprobacion } from './escuchaComprobacion'

function montar() {
  const estado: EstadoMotor = {
    pista: 'original',
    cargandoPista: null,
    cargando: false,
    error: null,
    sonando: false,
    velocidad: 1,
    duracionMs: 30_000,
    volumen: 1
  }
  const oyentes = new Set<(e: EstadoMotor) => void>()
  const publicar = (sonando: boolean) => {
    estado.sonando = sonando
    oyentes.forEach((cb) => cb(estado))
  }
  const motor = {
    estado: () => estado,
    posicionMs: () => 8000,
    reproducir: vi.fn(async () => publicar(true)),
    pausar: vi.fn(() => publicar(false)),
    buscar: vi.fn(),
    suscribir: (cb: (e: EstadoMotor) => void) => {
      oyentes.add(cb)
      return () => {
        oyentes.delete(cb)
      }
    }
  }
  return { motor, publicar, escucha: new EscuchaComprobacion(motor) }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('agrupa los ajustes, reproduce el fragmento del último fin y recupera la posición', async () => {
  const { motor, escucha, publicar } = montar()
  escucha.escuchar(4000, 'inicio')
  await vi.advanceTimersByTimeAsync(399)
  escucha.escuchar(5000, 'fin')
  await vi.advanceTimersByTimeAsync(399)
  expect(motor.reproducir).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(motor.reproducir).toHaveBeenCalledExactlyOnceWith({ desdeMs: 3000, hastaMs: 6000 })
  publicar(false)
  expect(motor.buscar).toHaveBeenCalledExactlyOnceWith(8000)
})

it('limita el fragmento y no interrumpe una reproducción ajena', async () => {
  const { motor, escucha, publicar } = montar()
  publicar(true)
  escucha.escuchar(500, 'inicio')
  await vi.advanceTimersByTimeAsync(400)
  expect(motor.reproducir).not.toHaveBeenCalled()
  publicar(false)
  escucha.escuchar(500, 'inicio')
  await vi.advanceTimersByTimeAsync(400)
  expect(motor.reproducir).toHaveBeenCalledExactlyOnceWith({ desdeMs: 0, hastaMs: 2500 })
  escucha.cancelar()
})

it('con el reloj real cancela sin lanzar "Illegal invocation" con los temporizadores por defecto', () => {
  const motor = {
    estado: () => ({ sonando: false, duracionMs: 1000 }),
    posicionMs: () => 0,
    reproducir: async () => undefined,
    pausar: () => undefined,
    buscar: () => undefined,
    suscribir: () => () => undefined
  } as unknown as ConstructorParameters<typeof EscuchaComprobacion>[0]
  const escucha = new EscuchaComprobacion(motor)
  escucha.escuchar(500, 'inicio')
  expect(() => escucha.cancelar()).not.toThrow()
})
