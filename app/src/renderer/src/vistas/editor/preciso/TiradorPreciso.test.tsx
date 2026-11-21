import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { TiradorPreciso } from './TiradorPreciso'

const vista = { inicioMs: 0, finMs: 1000 }

function montar() {
  const alMover = vi.fn()
  const alConfirmar = vi.fn()
  const alCancelar = vi.fn()
  const alAjustar = vi.fn()
  // Eje de 1000 px: 1 px = 1 ms.
  render(
    <div data-testid="eje">
      <TiradorPreciso
        tipo="palabra"
        borde="inicio"
        ms={400}
        vista={vista}
        etiqueta="Inicio de la palabra"
        min={0}
        max={1000}
        limitar={(ms) =>
          ms > 600 ? { valor: 600, limite: 'siguiente' } : { valor: ms, limite: null }
        }
        textoLimite={(l) => `límite ${l}`}
        alMover={alMover}
        alConfirmar={alConfirmar}
        alCancelar={alCancelar}
        alAjustar={alAjustar}
      />
    </div>
  )
  const eje = screen.getByTestId('eje')
  vi.spyOn(eje, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1000, 40))
  return { tirador: screen.getByRole('slider'), alMover, alConfirmar, alCancelar, alAjustar }
}

it('es un slider con valuetext y arrastra con límite y tiempo provisional', () => {
  const { tirador, alMover, alConfirmar } = montar()
  expect(tirador).toHaveAttribute('aria-valuetext', '00:00.40')
  fireEvent.pointerDown(tirador, { pointerId: 1, button: 0, clientX: 400 })
  fireEvent.pointerMove(tirador, { pointerId: 1, clientX: 450 })
  expect(alMover).toHaveBeenLastCalledWith(450, null)
  expect(screen.getByRole('tooltip')).toHaveTextContent('00:00.45')
  fireEvent.pointerMove(tirador, { pointerId: 1, clientX: 900 })
  expect(alMover).toHaveBeenLastCalledWith(600, 'siguiente')
  expect(screen.getByRole('tooltip')).toHaveTextContent('límite siguiente')
  fireEvent.pointerUp(tirador, { pointerId: 1, clientX: 900 })
  expect(alConfirmar).toHaveBeenCalledWith(600)
  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('Esc cancela el arrastre sin confirmar', () => {
  const { tirador, alConfirmar, alCancelar } = montar()
  fireEvent.pointerDown(tirador, { pointerId: 1, button: 0, clientX: 400 })
  fireEvent.pointerMove(tirador, { pointerId: 1, clientX: 450 })
  fireEvent.keyDown(window, { key: 'Escape' })
  fireEvent.pointerUp(tirador, { pointerId: 1, clientX: 450 })
  expect(alCancelar).toHaveBeenCalledTimes(1)
  expect(alConfirmar).not.toHaveBeenCalled()
})

it('las flechas ajustan 10 ms (Mayús 100)', () => {
  const { tirador, alAjustar } = montar()
  fireEvent.keyDown(tirador, { key: 'ArrowLeft' })
  fireEvent.keyDown(tirador, { key: 'ArrowRight', shiftKey: true })
  expect(alAjustar.mock.calls).toEqual([[-10], [100]])
})
