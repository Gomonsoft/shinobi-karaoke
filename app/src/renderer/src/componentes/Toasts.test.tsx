import { act, fireEvent, render, screen } from '@testing-library/react'
import { ContenedorToasts } from './Toasts'
import { cerrarTodosLosToasts, mostrarToast } from './gestorToasts'

describe('Toasts', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    act(() => cerrarTodosLosToasts())
    vi.useRealTimers()
  })

  const avisar = (mensaje: string, extra = {}) =>
    act(() => void mostrarToast({ tipo: 'info', mensaje, ...extra }))

  it('la región es aria-live polite aunque esté vacía', () => {
    const { container } = render(<ContenedorToasts />)
    expect(container.querySelector('[aria-live="polite"]')).toBeInTheDocument()
  })

  it('apila como máximo 3, descartando el más antiguo', () => {
    render(<ContenedorToasts />)
    ;['uno', 'dos', 'tres', 'cuatro'].forEach((m) => avisar(m))
    const t = screen.getAllByTestId('toast')
    expect(t).toHaveLength(3)
    expect(screen.queryByText('uno')).toBeNull()
    expect(screen.getByText('cuatro')).toBeInTheDocument()
  })

  it('caduca a los 6 s', () => {
    render(<ContenedorToasts />)
    avisar('hola')
    act(() => void vi.advanceTimersByTime(5999))
    expect(screen.getByText('hola')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(1))
    expect(screen.queryByText('hola')).toBeNull()
  })

  it('no caduca con el ratón encima y reanuda al salir', () => {
    render(<ContenedorToasts />)
    avisar('hola')
    const t = screen.getByTestId('toast')
    fireEvent.mouseEnter(t)
    act(() => void vi.advanceTimersByTime(20000))
    expect(screen.getByText('hola')).toBeInTheDocument()
    fireEvent.mouseLeave(t)
    act(() => void vi.advanceTimersByTime(6000))
    expect(screen.queryByText('hola')).toBeNull()
  })

  it('no caduca si tiene acción; la acción se ejecuta y lo cierra', () => {
    const fn = vi.fn()
    render(<ContenedorToasts />)
    avisar('Borrada', { accion: { etiqueta: 'Deshacer', alAccionar: fn } })
    act(() => void vi.advanceTimersByTime(60000))
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(fn).toHaveBeenCalledOnce()
    expect(screen.queryByText('Borrada')).toBeNull()
  })

  it('el botón de cerrar lo descarta', () => {
    render(<ContenedorToasts />)
    avisar('hola')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }))
    expect(screen.queryByText('hola')).toBeNull()
  })
})

it('un aviso persistente sin acciones sigue visible después del plazo', () => {
  vi.useFakeTimers()
  try {
    render(<ContenedorToasts />)
    act(() => {
      mostrarToast({ tipo: 'aviso', mensaje: 'Letra recargada', persistente: true })
    })
    act(() => vi.advanceTimersByTime(12_000))
    expect(screen.getByText('Letra recargada')).toBeVisible()
  } finally {
    vi.useRealTimers()
  }
})
