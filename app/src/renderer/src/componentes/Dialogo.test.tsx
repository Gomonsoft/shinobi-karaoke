import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Dialogo } from './Dialogo'

function Prueba({ alCancelar = vi.fn() }: { alCancelar?: () => void }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button onClick={() => setAbierto(true)}>Abrir</button>
      <Dialogo
        abierto={abierto}
        titulo="¿Eliminar?"
        onCancelar={() => {
          alCancelar()
          setAbierto(false)
        }}
        acciones={
          <>
            <button onClick={() => setAbierto(false)}>Cancelar</button>
            <button>Eliminar</button>
          </>
        }
      >
        <p>Texto</p>
      </Dialogo>
    </>
  )
}

describe('Dialogo', () => {
  it('es un diálogo modal con nombre y enfoca el primer control', () => {
    render(<Prueba />)
    const disparador = screen.getByRole('button', { name: 'Abrir' })
    disparador.focus()
    fireEvent.click(disparador)
    const d = screen.getByRole('dialog', { name: '¿Eliminar?' })
    expect(d).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  it('atrapa el foco con Tab y Shift+Tab', () => {
    render(<Prueba />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    const cancelar = screen.getByRole('button', { name: 'Cancelar' })
    const eliminar = screen.getByRole('button', { name: 'Eliminar' })
    eliminar.focus()
    fireEvent.keyDown(eliminar, { key: 'Tab' })
    expect(cancelar).toHaveFocus()
    fireEvent.keyDown(cancelar, { key: 'Tab', shiftKey: true })
    expect(eliminar).toHaveFocus()
  })

  it('Esc cancela y devuelve el foco al disparador', () => {
    const fn = vi.fn()
    render(<Prueba alCancelar={fn} />)
    const disparador = screen.getByRole('button', { name: 'Abrir' })
    disparador.focus()
    fireEvent.click(disparador)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(fn).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(disparador).toHaveFocus()
  })

  it('devuelve el foco también al cerrar con un botón', () => {
    render(<Prueba />)
    const disparador = screen.getByRole('button', { name: 'Abrir' })
    disparador.focus()
    fireEvent.click(disparador)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(disparador).toHaveFocus()
  })
})
