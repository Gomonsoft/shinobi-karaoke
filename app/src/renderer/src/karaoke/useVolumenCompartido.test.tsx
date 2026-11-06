import { act, renderHook } from '@testing-library/react'
import { configSchema } from '@shared/config'
import type { ApiShinobi } from '@shared/ipc'
import { useVolumenCompartido } from './useVolumenCompartido'

const config = configSchema.parse({})

describe('useVolumenCompartido', () => {
  const actualizar = vi.fn<ApiShinobi['config']['actualizar']>()

  beforeEach(() => {
    vi.useFakeTimers()
    actualizar.mockReset().mockResolvedValue(config)
    vi.stubGlobal('shinobi', { config: { actualizar } })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('lee los cuatro campos y reúne cambios parciales en una escritura cada 500 ms', () => {
    const { result } = renderHook(() => useVolumenCompartido(config.reproductor))
    expect(result.current).toMatchObject({
      volumen: 0.8,
      silenciado: false,
      volumenVoz: 0.3,
      vozSilenciada: true
    })
    act(() => {
      result.current.cambiar({ volumen: 0.6 })
      result.current.cambiar({ voz_guia: 0.5 })
      result.current.cambiar({ voz_guia_silenciada: false })
    })
    expect(result.current).toMatchObject({
      volumen: 0.6,
      silenciado: false,
      volumenVoz: 0.5,
      vozSilenciada: false
    })
    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(actualizar).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(actualizar).toHaveBeenCalledExactlyOnceWith({
      reproductor: { volumen: 0.6, silenciado: false, voz_guia: 0.5, voz_guia_silenciada: false }
    })

    act(() => result.current.cambiar({ silenciado: true }))
    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(actualizar).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(actualizar).toHaveBeenCalledTimes(2)
    expect(actualizar).toHaveBeenLastCalledWith({
      reproductor: { volumen: 0.6, silenciado: true, voz_guia: 0.5, voz_guia_silenciada: false }
    })
  })

  it('vacía la escritura pendiente al desmontar y conserva los niveles guardados', () => {
    const inicial = { volumen: 0.9, silenciado: true, voz_guia: 0.8, voz_guia_silenciada: false }
    const { result, unmount } = renderHook(() => useVolumenCompartido(inicial))
    expect(result.current).toMatchObject({
      volumen: 0.9,
      silenciado: true,
      volumenVoz: 0.8,
      vozSilenciada: false
    })
    act(() => result.current.cambiar({ voz_guia_silenciada: true }))
    unmount()
    expect(actualizar).toHaveBeenCalledExactlyOnceWith({
      reproductor: { ...inicial, voz_guia_silenciada: true }
    })
    vi.advanceTimersByTime(500)
    expect(actualizar).toHaveBeenCalledTimes(1)
  })
})
