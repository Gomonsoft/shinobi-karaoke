import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { CampoCombo } from './CampoCombo'

function Campo() {
  const [v, setV] = useState('')
  return (
    <div data-testid="tabla" style={{ overflow: 'auto' }}>
      <CampoCombo
        etiqueta="Artista"
        value={v}
        onChange={setV}
        opciones={[
          { valor: 'Queen', canciones: 3 },
          { valor: 'Quevedo', canciones: 1 }
        ]}
      />
    </div>
  )
}

describe('lista de sugerencias (spec 03 · tabla del modo lote)', () => {
  it('se pinta en un portal sobre <body>, fuera de la tabla que recorta', () => {
    render(<Campo />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Artista' }), {
      target: { value: 'Que' }
    })
    const lista = screen.getByRole('listbox', { name: 'Artista' })
    expect(lista.parentElement).toBe(document.body)
    expect(screen.getByTestId('tabla')).not.toContainElement(lista)
    expect(lista.style.position || getComputedStyle(lista).position).not.toBe('absolute')
  })

  it('se cierra al desplazar la tabla', () => {
    render(<Campo />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Artista' }), {
      target: { value: 'Que' }
    })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.scroll(screen.getByTestId('tabla'))
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('elegir una opción con el ratón sigue funcionando desde el portal', () => {
    render(<Campo />)
    const campo = screen.getByRole('combobox', { name: 'Artista' }) as HTMLInputElement
    fireEvent.change(campo, { target: { value: 'Que' } })
    fireEvent.click(screen.getByRole('option', { name: /Queen/ }))
    expect(campo.value).toBe('Queen')
  })
})
