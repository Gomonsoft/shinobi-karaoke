import { expect, it, vi } from 'vitest'
import { crearNavegacionGuardada, registrarVaciadoAlCerrar, vaciarAlCerrar } from './salida'

it('la navegación espera la guarda y conserva la vista si rechaza', async () => {
  const cambiarVista = vi.fn()
  const navegacion = crearNavegacionGuardada(cambiarVista)
  const guarda = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
  navegacion.registrarGuardaSalida(guarda)
  const destino = { tipo: 'biblioteca' } as const
  navegacion.ir(destino)
  await vi.waitFor(() => expect(guarda).toHaveBeenCalledOnce())
  expect(cambiarVista).not.toHaveBeenCalled()
  navegacion.ir(destino)
  await vi.waitFor(() => expect(cambiarVista).toHaveBeenCalledExactlyOnceWith(destino))
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
