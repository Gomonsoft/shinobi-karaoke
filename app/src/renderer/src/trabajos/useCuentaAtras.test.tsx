import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { esperaDeReintentoRed, useCuentaAtras } from './useCuentaAtras'

const evento = (espera_s: number, intento = 2) =>
  ({
    id: 't',
    fase: 'reintentando',
    valor: null,
    etaSegundos: null,
    detalle: { motivo: 'red', espera_s },
    intento
  }) as never

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useCuentaAtras', () => {
  it('esperaDeReintentoRed solo reconoce la espera de red', () => {
    expect(esperaDeReintentoRed(evento(5))).toBe(5)
    expect(
      esperaDeReintentoRed({ fase: 'reintentando', detalle: { motivo: 'memoria' } })
    ).toBeNull()
    expect(esperaDeReintentoRed(null)).toBeNull()
  })

  it('cuenta atrás cada segundo y nunca baja de 1', () => {
    const { result } = renderHook(() => useCuentaAtras(evento(3), 't'))
    expect(result.current).toBe(3)
    act(() => void vi.advanceTimersByTime(1000))
    expect(result.current).toBe(2)
    act(() => void vi.advanceTimersByTime(1000))
    expect(result.current).toBe(1)
    act(() => void vi.advanceTimersByTime(5000))
    expect(result.current).toBe(1)
  })

  it('sin espera de red devuelve null; un intento nuevo reinicia la cuenta', () => {
    const { result, rerender } = renderHook(({ p }) => useCuentaAtras(p, 't'), {
      initialProps: { p: evento(5, 2) }
    })
    act(() => void vi.advanceTimersByTime(3000))
    expect(result.current).toBe(2)
    rerender({ p: evento(15, 3) })
    expect(result.current).toBe(15)
    rerender({ p: { fase: 'descargando', valor: 0.1, etaSegundos: null } as never })
    expect(result.current).toBeNull()
  })
})
