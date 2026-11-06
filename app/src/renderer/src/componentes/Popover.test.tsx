import { fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { expect, it } from 'vitest'
import { Popover } from './Popover'

function Ejemplo() {
  const [abierto, setAbierto] = useState(false)
  const ancla = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={ancla} onClick={() => setAbierto(true)}>
        Abrir
      </button>
      <button>Fuera</button>
      <Popover
        abierto={abierto}
        ancla={ancla}
        alCerrar={() => setAbierto(false)}
        titulo="Para continuar falta"
        etiqueta="Aviso"
        anunciar
      >
        <button>Revisar</button>
      </Popover>
    </>
  )
}

it('deja acceder por Tab y Esc cierra sin propagar la navegación', () => {
  const { container } = render(<Ejemplo />)
  const ancla = screen.getByRole('button', { name: 'Abrir' })
  fireEvent.click(ancla)
  const dialogo = screen.getByRole('dialog', { name: 'Para continuar falta' })
  expect(container).not.toContainElement(dialogo)
  expect(dialogo).not.toHaveAttribute('aria-modal')
  expect(screen.getByRole('status')).toHaveTextContent('Para continuar falta')
  ancla.focus()
  fireEvent.keyDown(ancla, { key: 'Tab' })
  const revisar = screen.getByRole('button', { name: 'Revisar' })
  expect(revisar).toHaveFocus()
  expect(fireEvent.keyDown(revisar, { key: 'Escape' })).toBe(false)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(ancla).toHaveFocus()
})

it('un clic fuera lo cierra y devuelve el foco al ancla', () => {
  render(<Ejemplo />)
  const ancla = screen.getByRole('button', { name: 'Abrir' })
  fireEvent.click(ancla)
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Revisar' }))
  expect(screen.getByRole('dialog')).toBeVisible()
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Fuera' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(ancla).toHaveFocus()
})
