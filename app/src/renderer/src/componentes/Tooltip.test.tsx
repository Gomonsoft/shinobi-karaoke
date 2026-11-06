import { act, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { posicionTooltip, Tooltip } from './Tooltip'

it('voltea arriba o abajo y respeta los márgenes horizontales', () => {
  const caja = { width: 100, height: 40 }
  const vista = { width: 300, height: 200 }
  expect(posicionTooltip({ top: 10, bottom: 30, left: 0, width: 20 }, caja, vista)).toEqual({
    top: 38,
    left: 8
  })
  expect(posicionTooltip({ top: 150, bottom: 170, left: 275, width: 25 }, caja, vista)).toEqual({
    top: 102,
    left: 192
  })
})

it('muestra cada aviso forzado dos segundos y renueva el plazo al cambiar la clave', () => {
  vi.useFakeTimers()
  try {
    const dibujar = (clave: number) => (
      <Tooltip contenido="Límite" forzar={{ clave, ms: 2000 }}>
        <button>Ajustar</button>
      </Tooltip>
    )
    const { rerender } = render(dibujar(1))
    expect(screen.getByRole('tooltip')).toBeVisible()
    act(() => vi.advanceTimersByTime(1000))
    rerender(dibujar(2))
    act(() => vi.advanceTimersByTime(1999))
    expect(screen.getByRole('tooltip')).toBeVisible()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByRole('tooltip')).toBeNull()
    rerender(dibujar(3))
    expect(screen.getByRole('tooltip')).toBeVisible()
  } finally {
    vi.useRealTimers()
  }
})
