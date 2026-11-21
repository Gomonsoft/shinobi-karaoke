import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { MarcaDeAgua } from './MarcaDeAgua'
import estilos from './exportacion.module.css'

it('muestra el texto literal con su clase y sin animación inline', () => {
  const { container } = render(<MarcaDeAgua />)
  const marca = container.firstElementChild as HTMLElement
  expect(marca).toHaveTextContent(/^Shinobi Karaoke$/)
  expect(marca).toHaveClass(estilos.marca!)
  expect(marca.style.animation).toBe('')
})
