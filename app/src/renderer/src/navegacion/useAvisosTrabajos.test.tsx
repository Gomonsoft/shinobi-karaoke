import { act, render, screen } from '@testing-library/react'
import type { AbrirCancionIpc, AvisoTrabajoIpc } from '@shared/avisos'
import { ContenedorToasts } from '../componentes/Toasts'
import { cerrarTodosLosToasts } from '../componentes/gestorToasts'
import { textoDeError, textoDeErrorSeparacion } from '../vistas/progreso/textos'
import { tituloErrorAviso } from '@shared/avisos'
import type { Vista } from './estado'
import { useAvisosTrabajos } from './useAvisosTrabajos'

let aviso: ((a: AvisoTrabajoIpc) => void) | null = null
let abrir: ((e: AbrirCancionIpc) => void) | null = null
let tieneFoco = true

function Sonda({ vista, ir }: { vista: Vista; ir: (v: Vista) => void }) {
  useAvisosTrabajos(vista, ir)
  return <ContenedorToasts />
}

const ok: AvisoTrabajoIpc = {
  cancionId: 'c1',
  tipo: 'ok',
  texto: '«Canción»: voz e instrumental separadas.',
  etiqueta: 'Abrir',
  destino: 'progreso'
}
const error: AvisoTrabajoIpc = {
  cancionId: 'c1',
  tipo: 'error',
  texto: '«Canción»: Algo salió mal al separar.',
  etiqueta: 'Ver',
  destino: 'progreso'
}

beforeEach(() => {
  tieneFoco = true
  vi.spyOn(document, 'hasFocus').mockImplementation(() => tieneFoco)
  ;(window as unknown as { shinobi: unknown }).shinobi = {
    avisos: {
      alAviso: (cb: (a: AvisoTrabajoIpc) => void) => {
        aviso = cb
        return () => undefined
      },
      alAbrirCancion: (cb: (e: AbrirCancionIpc) => void) => {
        abrir = cb
        return () => undefined
      }
    }
  }
})
afterEach(() => {
  act(() => cerrarTodosLosToasts())
  vi.restoreAllMocks()
})

const biblioteca: Vista = { tipo: 'biblioteca' }

describe('useAvisosTrabajos', () => {
  it('en otra vista y con foco: toast con acción que abre la canción', () => {
    const ir = vi.fn()
    render(<Sonda vista={biblioteca} ir={ir} />)
    act(() => aviso!(ok))
    expect(screen.getByText(ok.texto)).toBeInTheDocument()
    act(() => screen.getByRole('button', { name: 'Abrir' }).click())
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c1', paso: 'progreso' })
  })

  it('"lista" abre el editor', () => {
    const ir = vi.fn()
    render(<Sonda vista={biblioteca} ir={ir} />)
    act(() =>
      aviso!({ ...ok, tipo: 'lista', etiqueta: 'Abrir editor', destino: 'editor', texto: 'lista' })
    )
    act(() => screen.getByRole('button', { name: 'Abrir editor' }).click())
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c1', paso: 'editor' })
  })

  it('en la vista de progreso de esa canción no hay toast; en la de otra, sí', () => {
    const { rerender } = render(
      <Sonda vista={{ tipo: 'cancion', id: 'c1', paso: 'progreso' }} ir={vi.fn()} />
    )
    act(() => aviso!(ok))
    expect(screen.queryByTestId('toast')).toBeNull()
    rerender(<Sonda vista={{ tipo: 'cancion', id: 'c2', paso: 'progreso' }} ir={vi.fn()} />)
    act(() => aviso!(ok))
    expect(screen.getAllByTestId('toast')).toHaveLength(1)
  })

  it('el error no caduca solo', () => {
    vi.useFakeTimers()
    render(<Sonda vista={biblioteca} ir={vi.fn()} />)
    act(() => aviso!(error))
    act(() => void vi.advanceTimersByTime(60_000))
    expect(screen.getByText(error.texto)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver' })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('sin foco los avisos esperan y se muestran al recuperarlo', () => {
    render(<Sonda vista={biblioteca} ir={vi.fn()} />)
    tieneFoco = false
    act(() => aviso!(ok))
    expect(screen.queryByTestId('toast')).toBeNull()
    tieneFoco = true
    act(() => void window.dispatchEvent(new Event('focus')))
    expect(screen.getByText(ok.texto)).toBeInTheDocument()
    // Y se borran: otro foco no los repite.
    act(() => cerrarTodosLosToasts())
    act(() => void window.dispatchEvent(new Event('focus')))
    expect(screen.queryByTestId('toast')).toBeNull()
  })

  it('el clic en la notificación del sistema abre la canción', () => {
    const ir = vi.fn()
    render(<Sonda vista={biblioteca} ir={ir} />)
    act(() => abrir!({ cancionId: 'c9', destino: 'editor' }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c9', paso: 'editor' })
  })
})

describe('textos de aviso en sintonía con la vista de progreso', () => {
  it('los títulos de error coinciden con los del banner', () => {
    for (const c of [
      'SIN_CONEXION',
      'SIN_ESPACIO',
      'FORMATO_NO_SOPORTADO',
      'YOUTUBE_BLOQUEADO',
      'X'
    ]) {
      expect(tituloErrorAviso('fuente', c)).toBe(textoDeError(c).titulo)
    }
    for (const c of ['SIN_CONEXION', 'SIN_ESPACIO', 'MODELO_NO_DISPONIBLE', 'X']) {
      expect(tituloErrorAviso('separacion', c)).toBe(textoDeErrorSeparacion(c, 'calidad').titulo)
    }
    for (const m of ['calidad', 'rapido'] as const) {
      expect(tituloErrorAviso('separacion', 'MEMORIA_INSUFICIENTE', m)).toBe(
        textoDeErrorSeparacion('MEMORIA_INSUFICIENTE', m).titulo
      )
    }
  })
})
