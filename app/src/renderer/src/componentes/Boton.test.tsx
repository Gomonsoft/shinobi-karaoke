import { act, fireEvent, render, screen } from '@testing-library/react'
import { Boton } from './Boton'
import { BotonIcono } from './BotonIcono'
import { Play } from 'lucide-react'

describe('Boton', () => {
  it('llama a onClick cuando está disponible', () => {
    const fn = vi.fn()
    render(<Boton onClick={fn}>Guardar</Boton>)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(fn).toHaveBeenCalledOnce()
  })

  it('aria-disabled sigue enfocable, no actúa y muestra el motivo al enfocar', () => {
    const fn = vi.fn()
    render(
      <Boton variante="primario" noDisponible="Falta la letra" onClick={fn}>
        Marcar como lista
      </Boton>
    )
    const b = screen.getByRole('button', { name: 'Marcar como lista' })
    expect(b).toHaveAttribute('aria-disabled', 'true')
    expect(b).not.toBeDisabled()
    expect(b).toHaveAccessibleDescription('Falta la letra')
    act(() => b.focus())
    expect(b).toHaveFocus()
    expect(screen.getByRole('tooltip')).toHaveTextContent('Falta la letra')
    fireEvent.click(b)
    expect(fn).not.toHaveBeenCalled()
  })

  it('muestra el motivo al pulsar aunque no tenga foco de teclado', () => {
    render(<Boton noDisponible="Sin audio">Reproducir</Boton>)
    expect(screen.queryByRole('tooltip')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('Sin audio')
  })

  it('cargando: aria-busy, texto de carga y sin clics', () => {
    const fn = vi.fn()
    render(
      <Boton cargando textoCargando="Guardando…" onClick={fn}>
        Guardar
      </Boton>
    )
    const b = screen.getByRole('button')
    expect(b).toHaveAttribute('aria-busy', 'true')
    expect(b).toHaveTextContent('Guardando…')
    fireEvent.click(b)
    expect(fn).not.toHaveBeenCalled()
  })

  it('aplica la variante y el tamaño', () => {
    render(
      <Boton variante="destructivo" tamano="grande">
        Eliminar
      </Boton>
    )
    expect(screen.getByRole('button').className).toMatch(/destructivo/)
    expect(screen.getByRole('button').className).toMatch(/grande/)
  })
})

describe('BotonIcono', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('tiene nombre accesible y tooltip inmediato con foco', () => {
    render(<BotonIcono icono={Play} etiqueta="Reproducir" />)
    const b = screen.getByRole('button', { name: 'Reproducir' })
    act(() => b.focus())
    expect(screen.getByRole('tooltip')).toHaveTextContent('Reproducir')
  })

  it('el tooltip del ratón aparece a los 500 ms', () => {
    render(<BotonIcono icono={Play} etiqueta="Reproducir" />)
    const b = screen.getByRole('button')
    fireEvent.mouseEnter(b.parentElement!)
    act(() => void vi.advanceTimersByTime(499))
    expect(screen.queryByRole('tooltip')).toBeNull()
    act(() => void vi.advanceTimersByTime(1))
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('Esc descarta el tooltip', () => {
    render(<BotonIcono icono={Play} etiqueta="Reproducir" />)
    act(() => screen.getByRole('button').focus())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('activo se expone con aria-pressed', () => {
    render(<BotonIcono icono={Play} etiqueta="Bucle" activo />)
    expect(screen.getByRole('button', { name: 'Bucle' })).toHaveAttribute('aria-pressed', 'true')
  })
})
