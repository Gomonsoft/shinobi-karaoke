import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Config, PreferenciasPaneles } from '@shared/config'
import { configPredeterminada } from '@shared/config'
import { preferenciasPanelesPredeterminadas } from '@shared/paneles'
import {
  ESPERA_TECLADO_MS,
  normalizarPreferencias,
  usePreferenciasPaneles
} from './usePreferenciasPaneles'

const actualizar = vi.fn<(parcial: unknown) => Promise<Config>>()
let oyente: ((config: Config) => void) | null = null

beforeEach(() => {
  vi.useFakeTimers()
  actualizar.mockReset()
  actualizar.mockResolvedValue(configPredeterminada())
  oyente = null
  window.shinobi = {
    config: { actualizar },
    alCambiarConfig: (cb: (config: Config) => void) => {
      oyente = cb
      return () => {
        oyente = null
      }
    }
  } as unknown as typeof window.shinobi
})
afterEach(() => vi.useRealTimers())

const base = (): PreferenciasPaneles => preferenciasPanelesPredeterminadas()
const conLista = (ancho: number, minimizado = false): PreferenciasPaneles => ({
  ...base(),
  lista: { ancho, minimizado }
})

it('arranca con las preferencias recibidas y no escribe nada', () => {
  const { result } = renderHook(() => usePreferenciasPaneles(conLista(400)))
  expect(result.current.preferencias.lista.ancho).toBe(400)
  act(() => vi.advanceTimersByTime(5000))
  expect(actualizar).not.toHaveBeenCalled()
})

it('una acción inmediata (confirmar un arrastre, minimizar o restablecer) escribe una vez al momento', () => {
  const { result } = renderHook(() => usePreferenciasPaneles(base()))
  act(() => result.current.actualizar(conLista(333.4), 'inmediato'))
  expect(actualizar).toHaveBeenCalledExactlyOnceWith({
    editor: { paneles: { ...base(), lista: { ancho: 333, minimizado: false } } }
  })
  expect(result.current.preferencias.lista.ancho).toBe(333.4)
  act(() => result.current.actualizar(conLista(333, true), 'inmediato'))
  expect(actualizar).toHaveBeenCalledTimes(2)
})

it('cinco flechas seguidas escriben una sola vez, 500 ms después de la última', () => {
  const { result } = renderHook(() => usePreferenciasPaneles(base()))
  for (let i = 1; i <= 5; i++) {
    act(() => result.current.actualizar(conLista(300 + 16 * i), 'teclado'))
    act(() => vi.advanceTimersByTime(ESPERA_TECLADO_MS - 1))
  }
  expect(actualizar).not.toHaveBeenCalled()
  expect(result.current.preferencias.lista.ancho).toBe(380)
  act(() => vi.advanceTimersByTime(1))
  expect(actualizar).toHaveBeenCalledOnce()
  expect(actualizar.mock.calls[0]![0]).toMatchObject({
    editor: { paneles: { lista: { ancho: 380, minimizado: false } } }
  })
})

it('una escritura inmediata sustituye a la ráfaga de teclado pendiente', () => {
  const { result } = renderHook(() => usePreferenciasPaneles(base()))
  act(() => result.current.actualizar(conLista(316), 'teclado'))
  act(() => result.current.actualizar(conLista(316, true), 'inmediato'))
  act(() => vi.advanceTimersByTime(2000))
  expect(actualizar).toHaveBeenCalledOnce()
})

it('al desmontar con una ráfaga pendiente se envía sin esperar', () => {
  const { result, unmount } = renderHook(() => usePreferenciasPaneles(base()))
  act(() => result.current.actualizar(conLista(316), 'teclado'))
  unmount()
  expect(actualizar).toHaveBeenCalledOnce()
  act(() => vi.advanceTimersByTime(2000))
  expect(actualizar).toHaveBeenCalledOnce()
})

it('redondea y acota a los límites absolutos; la línea de tiempo sin tocar sigue en null', () => {
  const sucia: PreferenciasPaneles = {
    lista: { ancho: 9999, minimizado: false },
    panel: { ancho: 10, minimizado: true },
    linea_tiempo: { alto: null, minimizado: false }
  }
  expect(normalizarPreferencias(sucia)).toEqual({
    lista: { ancho: 480, minimizado: false },
    panel: { ancho: 300, minimizado: true },
    linea_tiempo: { alto: null, minimizado: false }
  })
  expect(
    normalizarPreferencias({ ...sucia, linea_tiempo: { alto: 5000.6, minimizado: true } })
      .linea_tiempo
  ).toEqual({ alto: 960, minimizado: true })
})

it('un rechazo del IPC no rompe nada y el estado en memoria se conserva', async () => {
  const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  actualizar.mockRejectedValue(new Error('rechazado'))
  const { result } = renderHook(() => usePreferenciasPaneles(base()))
  await act(async () => result.current.actualizar(conLista(400), 'inmediato'))
  expect(result.current.preferencias.lista.ancho).toBe(400)
  aviso.mockRestore()
})

it('adopta los cambios de la configuración solo si no hay nada propio sin enviar', async () => {
  let resolver: (config: Config) => void = () => undefined
  actualizar.mockReturnValue(new Promise<Config>((r) => (resolver = r)))
  const { result } = renderHook(() => usePreferenciasPaneles(base()))
  const externa = configPredeterminada()
  externa.editor.paneles.panel.ancho = 420
  act(() => oyente?.(externa))
  expect(result.current.preferencias.panel.ancho).toBe(420)

  act(() => result.current.actualizar(conLista(400), 'inmediato'))
  const eco = configPredeterminada()
  eco.editor.paneles.panel.ancho = 480
  // Con la petición en vuelo, un cambio de la configuración no pisa el estado local.
  act(() => oyente?.(eco))
  expect(result.current.preferencias.panel.ancho).toBe(360)
  await act(async () => resolver(eco))
  act(() => oyente?.(eco))
  expect(result.current.preferencias.panel.ancho).toBe(480)
})
