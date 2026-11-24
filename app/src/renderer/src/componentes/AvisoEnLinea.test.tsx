import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AvisoEnLinea } from './AvisoEnLinea'

describe('AvisoEnLinea', () => {
  it('con accionesAbajo las acciones van juntas en su propia fila, tras el texto', () => {
    render(
      <AvisoEnLinea
        tipo="info"
        accionesAbajo
        accion={
          <>
            <button>Uno</button>
            <button>Dos</button>
          </>
        }
      >
        Texto del aviso
      </AvisoEnLinea>
    )
    const uno = screen.getByRole('button', { name: 'Uno' })
    expect(uno.parentElement).toBe(screen.getByRole('button', { name: 'Dos' }).parentElement)
    expect(uno.parentElement).not.toBe(screen.getByRole('status'))
    expect(screen.getByRole('status').lastElementChild).toBe(uno.parentElement)
  })

  it('sin accionesAbajo la acción sigue siendo hija directa (comportamiento de siempre)', () => {
    render(
      <AvisoEnLinea tipo="info" accion={<button>Uno</button>}>
        Texto
      </AvisoEnLinea>
    )
    expect(screen.getByRole('button', { name: 'Uno' }).parentElement).toBe(
      screen.getByRole('status')
    )
  })
})
