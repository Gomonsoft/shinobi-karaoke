import { expect, it, vi } from 'vitest'
import {
  confirmarBorradorAlCerrar,
  crearNavegacionGuardada,
  registrarBorradorAlCerrar,
  registrarVaciadoAlCerrar,
  vaciarAlCerrar
} from './salida'

it('la navegación espera la guarda y conserva la vista si rechaza', async () => {
  const cambiarVista = vi.fn()
  const navegacion = crearNavegacionGuardada(cambiarVista)
  const guarda = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
  navegacion.registrarGuardaSalida(guarda)
  const destino = { tipo: 'biblioteca' } as const
  const alNavegar = vi.fn()
  navegacion.ir(destino, alNavegar)
  await vi.waitFor(() => expect(guarda).toHaveBeenCalledOnce())
  expect(cambiarVista).not.toHaveBeenCalled()
  expect(alNavegar).not.toHaveBeenCalled()
  navegacion.ir(destino, alNavegar)
  await vi.waitFor(() => expect(cambiarVista).toHaveBeenCalledExactlyOnceWith(destino))
  expect(alNavegar).toHaveBeenCalledOnce()
})

it('el cierre no espera más allá del tope de vaciado', async () => {
  vi.useFakeTimers()
  const limpiar = registrarVaciadoAlCerrar(() => new Promise<boolean>(() => undefined))
  try {
    const cierre = vaciarAlCerrar()
    await vi.advanceTimersByTimeAsync(2000)
    await cierre
  } finally {
    limpiar()
    vi.useRealTimers()
  }
})

it('el borrador de tema decide el cierre y se puede dar de baja', async () => {
  await expect(confirmarBorradorAlCerrar()).resolves.toBe(true)
  const baja = registrarBorradorAlCerrar(async () => false)
  await expect(confirmarBorradorAlCerrar()).resolves.toBe(false)
  baja()
  await expect(confirmarBorradorAlCerrar()).resolves.toBe(true)
  const falla = registrarBorradorAlCerrar(() => Promise.reject(new Error('x')))
  await expect(confirmarBorradorAlCerrar()).resolves.toBe(false)
  falla()
})
