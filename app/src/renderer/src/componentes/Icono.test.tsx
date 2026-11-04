import { render } from '@testing-library/react'
import { Play } from 'lucide-react'
import { Icono } from './Icono'

describe('Icono', () => {
  it('es decorativo y de 20 px por defecto', () => {
    const { container } = render(<Icono icono={Play} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).toHaveAttribute('width', '20')
  })

  it('con etiqueta es una imagen accesible', () => {
    const { getByRole } = render(<Icono icono={Play} etiqueta="Reproducir" />)
    expect(getByRole('img', { name: 'Reproducir' })).toBeInTheDocument()
  })
})
