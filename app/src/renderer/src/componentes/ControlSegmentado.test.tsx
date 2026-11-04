import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { ControlSegmentado } from './ControlSegmentado'

function Prueba({ conNoDisponible = false }: { conNoDisponible?: boolean }) {
  const [v, setV] = useState('a')
  return (
    <ControlSegmentado
      etiqueta="Modo"
      valor={v}
      onCambio={setV}
      opciones={[
        { valor: 'a', etiqueta: 'Original' },
        {
          valor: 'b',
          etiqueta: 'Voz',
          noDisponible: conNoDisponible ? 'Aún no separada' : undefined
        },
        { valor: 'c', etiqueta: 'Instrumental' }
      ]}
    />
  )
}

describe('ControlSegmentado', () => {
  it('es un radiogroup con una sola parada de tabulación', () => {
    render(<Prueba />)
    expect(screen.getByRole('radiogroup', { name: 'Modo' })).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1])
    expect(radios[0]).toBeChecked()
  })

  it('las flechas mueven foco y selección, con vuelta al principio', () => {
    render(<Prueba />)
    const [a, b, c] = screen.getAllByRole('radio') as [HTMLElement, HTMLElement, HTMLElement]
    a.focus()
    fireEvent.keyDown(a, { key: 'ArrowRight' })
    expect(b).toHaveFocus()
    expect(b).toBeChecked()
    fireEvent.keyDown(b, { key: 'ArrowDown' })
    expect(c).toBeChecked()
    fireEvent.keyDown(c, { key: 'ArrowRight' })
    expect(a).toHaveFocus()
    expect(a).toBeChecked()
    fireEvent.keyDown(a, { key: 'ArrowLeft' })
    expect(c).toBeChecked()
    fireEvent.keyDown(c, { key: 'Home' })
    expect(a).toBeChecked()
    fireEvent.keyDown(a, { key: 'End' })
    expect(c).toBeChecked()
  })

  it('una opción no disponible recibe foco, muestra el motivo y no se elige', () => {
    render(<Prueba conNoDisponible />)
    const [a, b] = screen.getAllByRole('radio') as [HTMLElement, HTMLElement]
    a.focus()
    fireEvent.keyDown(a, { key: 'ArrowRight' })
    expect(b).toHaveFocus()
    expect(b).not.toBeChecked()
    expect(b).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('tooltip')).toHaveTextContent('Aún no separada')
    fireEvent.click(b)
    expect(a).toBeChecked()
  })

  it('el clic elige la opción', () => {
    render(<Prueba />)
    fireEvent.click(screen.getByRole('radio', { name: 'Instrumental' }))
    expect(screen.getByRole('radio', { name: 'Instrumental' })).toBeChecked()
  })
})
