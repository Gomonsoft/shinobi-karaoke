import { act, render, screen } from '@testing-library/react'
import type { AbrirCancionIpc, AvisoTrabajoIpc } from '@shared/avisos'
import { ContenedorToasts } from '../componentes/Toasts'
import { cerrarTodosLosToasts } from '../componentes/gestorToasts'
import { textoDeError, textoDeErrorSeparacion } from '../vistas/progreso/textos'
import { tituloErrorAviso } from '@shared/avisos'
import { estadoP1 } from '@shared/__fixtures__/sesion'
import { instalarApiSesion } from '../sesion/pruebas'
import { ProveedorSesion } from '../sesion/ProveedorSesion'
import { EDI_BLOQUEO } from '../sesion/textos'
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

  it('el aviso de una tanda abre el «Resultado de la preparación», no una canción', () => {
    const ir = vi.fn()
    render(<Sonda vista={biblioteca} ir={ir} />)
    act(() =>
      aviso!({
        cancionId: '',
        tipo: 'tanda',
        texto: '12 canciones listas para revisar.',
        etiqueta: 'Ver resultado',
        destino: 'biblioteca'
      })
    )
    act(() => screen.getByRole('button', { name: 'Ver resultado' }).click())
    expect(ir).toHaveBeenCalledWith({ tipo: 'biblioteca', abrirResultado: true })
  })

  it('el clic en la notificación de una tanda (preparacion:abrirResultado) va a la Biblioteca con el resultado', () => {
    const ir = vi.fn()
    let abrirResultado: (() => void) | null = null
    Object.assign((window as unknown as { shinobi: object }).shinobi, {
      preparacion: {
        alAbrirResultado: (cb: () => void) => {
          abrirResultado = cb
          return () => undefined
        }
      }
    })
    render(<Sonda vista={{ tipo: 'cancion', id: 'c1', paso: 'letra' }} ir={ir} />)
    act(() => abrirResultado!())
    expect(ir).toHaveBeenCalledWith({ tipo: 'biblioteca', abrirResultado: true })
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

  it('un toast anterior o una notificación no permiten salir de Primer arranque', () => {
    const ir = vi.fn()
    const { rerender } = render(<Sonda vista={biblioteca} ir={ir} />)
    act(() => aviso!(ok))
    rerender(<Sonda vista={{ tipo: 'primer-arranque' }} ir={ir} />)
    act(() => screen.getByRole('button', { name: 'Abrir' }).click())
    act(() => abrir!({ cancionId: 'c9', destino: 'editor' }))
    expect(ir).not.toHaveBeenCalled()
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
    for (const c of [
      'SIN_CONEXION',
      'SIN_ESPACIO',
      'MODELO_NO_DISPONIBLE',
      'RUNTIME_NO_DISPONIBLE',
      'X'
    ]) {
      expect(tituloErrorAviso('separacion', c)).toBe(textoDeErrorSeparacion(c, 'calidad').titulo)
    }
    for (const m of ['calidad', 'rapido'] as const) {
      expect(tituloErrorAviso('separacion', 'MEMORIA_INSUFICIENTE', m)).toBe(
        textoDeErrorSeparacion('MEMORIA_INSUFICIENTE', m).titulo
      )
    }
  })

  it('con sesión, «Abrir editor» muestra el bloqueo y no navega (E1)', async () => {
    instalarApiSesion(estadoP1())
    const ir = vi.fn()
    render(
      <ProveedorSesion>
        <Sonda vista={biblioteca} ir={ir} />
      </ProveedorSesion>
    )
    await act(async () => {})
    act(() =>
      aviso!({ ...ok, tipo: 'lista', etiqueta: 'Abrir editor', destino: 'editor', texto: 'lista' })
    )
    act(() => screen.getByRole('button', { name: 'Abrir editor' }).click())
    expect(ir).not.toHaveBeenCalled()
    expect(await screen.findByRole('dialog', { name: EDI_BLOQUEO.titulo })).toBeInTheDocument()
  })

  it('corrección diferida del desfase: toast con [Deshacer] que quita la corrección, también en su progreso', async () => {
    const escrituras: unknown[] = []
    const letra = {
      origen: 'lrclib',
      lrclib_id: null,
      offset_ms: 800,
      desfase_corregido_ms: 800,
      lineas: [
        { id: 'a', tipo: 'linea', texto: 'Uno', inicio_ms: 1000, fin_ms: null, palabras: null }
      ]
    }
    Object.assign((window as unknown as { shinobi: object }).shinobi, {
      letras: {
        abrirEdicion: () => Promise.resolve({ cancion: { letra }, sesionId: 's1' }),
        guardarTiempos: (p: unknown) => {
          escrituras.push(p)
          return Promise.resolve({})
        },
        cerrarEdicion: () => Promise.resolve()
      }
    })
    render(<Sonda vista={{ tipo: 'cancion', id: 'c1', paso: 'progreso' }} ir={vi.fn()} />)
    act(() =>
      aviso!({
        cancionId: 'c1',
        tipo: 'desfase',
        texto: 'Movimos la letra de «Canción» 0,8 s más tarde para que coincida con la voz.',
        etiqueta: 'Deshacer',
        destino: 'editor'
      })
    )
    expect(screen.getByText(/Movimos la letra de «Canción» 0,8 s más tarde/)).toBeInTheDocument()
    await act(async () => screen.getByRole('button', { name: 'Deshacer' }).click())
    expect(escrituras[0]).toMatchObject({ offset_ms: 0, desfase_corregido_ms: null })
  })
})
