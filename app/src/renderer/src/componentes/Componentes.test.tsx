import { render, screen } from '@testing-library/react'
import { AvisoEnLinea } from './AvisoEnLinea'
import { BarraProgreso } from './BarraProgreso'
import { AreaTexto, CampoTexto } from './Campos'
import { InsigniaEstado } from './InsigniaEstado'

describe('AvisoEnLinea', () => {
  it.each([
    ['error', 'alert'],
    ['info', 'status'],
    ['exito', 'status'],
    ['aviso', 'status']
  ] as const)('%s usa role=%s', (tipo, rol) => {
    render(<AvisoEnLinea tipo={tipo}>Texto</AvisoEnLinea>)
    expect(screen.getByRole(rol)).toHaveTextContent('Texto')
  })
})

describe('BarraProgreso', () => {
  it('determinada: valuenow y valuetext', () => {
    render(
      <BarraProgreso etiqueta="Separación" valor={42} textoValor="42 %, quedan unos 3 minutos" />
    )
    const b = screen.getByRole('progressbar', { name: 'Separación' })
    expect(b).toHaveAttribute('aria-valuenow', '42')
    expect(b).toHaveAttribute('aria-valuetext', '42 %, quedan unos 3 minutos')
  })
  it('valuetext por defecto y limitado a 0–100', () => {
    render(<BarraProgreso etiqueta="x" valor={150} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '100 %')
  })
  it('indeterminada omite aria-valuenow', () => {
    render(<BarraProgreso etiqueta="x" indeterminada />)
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
  })
})

describe('Campos', () => {
  it('etiqueta visible y ayuda asociada', () => {
    render(<CampoTexto etiqueta="Título" ayuda="Ayuda" />)
    expect(screen.getByLabelText('Título')).toHaveAccessibleDescription('Ayuda')
  })
  it('error: aria-invalid y descrito por el mensaje', () => {
    render(<CampoTexto etiqueta="Artista" ayuda="Ayuda" error="Obligatorio" />)
    const c = screen.getByLabelText('Artista')
    expect(c).toBeInvalid()
    expect(c).toHaveAccessibleDescription('Ayuda Obligatorio')
  })
  it('el área de texto funciona igual', () => {
    render(<AreaTexto etiqueta="Letra" error="Vacía" />)
    const c = screen.getByRole('textbox', { name: 'Letra' })
    expect(c.tagName).toBe('TEXTAREA')
    expect(c).toHaveAccessibleDescription('Vacía')
  })
})

describe('InsigniaEstado', () => {
  it.each([
    ['lista', 'Lista'],
    ['borrador', 'Borrador'],
    ['en-curso', 'En curso'],
    ['en-cola', 'En cola'],
    ['interrumpido', 'Interrumpido'],
    ['error', 'Error'],
    ['danada', 'Dañada']
  ] as const)('%s muestra icono y texto "%s"', (estado, texto) => {
    const { container } = render(<InsigniaEstado estado={estado} />)
    expect(screen.getByText(texto)).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
  it('admite texto personalizado', () => {
    render(<InsigniaEstado estado="en-curso" texto="Separando 42 %" />)
    expect(screen.getByText('Separando 42 %')).toBeInTheDocument()
  })
})
