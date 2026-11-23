import { act, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { SOLTAR_VARIOS, VeloArrastre } from './VeloArrastre'

function arrastrar(
  tipo: 'dragenter' | 'dragleave' | 'drop',
  items: { directory?: boolean }[] = []
) {
  const e = createEvent(tipo, window)
  Object.defineProperty(e, 'dataTransfer', {
    value: {
      types: ['Files'],
      items: items.map((i) => ({
        kind: 'file',
        webkitGetAsEntry: () => ({ isDirectory: i.directory === true })
      }))
    }
  })
  act(() => void fireEvent(window, e))
}

describe('velo al arrastrar varios archivos (bib.arrastrar.soltarVarios)', () => {
  it('varios archivos: «Suelta para añadir {n} canciones»', () => {
    render(<VeloArrastre />)
    arrastrar('dragenter', [{}, {}, {}])
    expect(screen.getByRole('status')).toHaveTextContent(SOLTAR_VARIOS.n(3))
  })

  it('una carpeta: la variante de carpeta', () => {
    render(<VeloArrastre />)
    arrastrar('dragenter', [{ directory: true }])
    expect(screen.getByRole('status')).toHaveTextContent(SOLTAR_VARIOS.carpeta)
  })

  it('un solo archivo no lleva velo, y al salir o soltar se quita', () => {
    render(<VeloArrastre />)
    arrastrar('dragenter', [{}])
    expect(screen.queryByRole('status')).toBeNull()
    arrastrar('dragenter', [{}, {}])
    expect(screen.getByRole('status')).toBeInTheDocument()
    arrastrar('drop')
    expect(screen.queryByRole('status')).toBeNull()
  })
})
