import { act, fireEvent, render, screen } from '@testing-library/react'
import type { EventoCancionIpc, TandaPreparacionIpc } from '@shared/ipc'
import { cerrarTodosLosToasts } from '../componentes/gestorToasts'
import { ContenedorToasts } from '../componentes/Toasts'
import { resumenPrueba } from '../vistas/biblioteca/resumenPrueba'
import type { Vista } from './estado'
import { useAvisosPreparacion } from './useAvisosPreparacion'

let emitir: (e: EventoCancionIpc) => void = () => undefined
let tanda: TandaPreparacionIpc | null = null

function Sonda({ vista, ir }: { vista: Vista; ir: (v: Vista) => void }) {
  useAvisosPreparacion(vista, ir)
  return <ContenedorToasts />
}
const evento = (
  estadoPreparacion: 'preparando' | 'lista_para_revisar' | 'elige_letra' | 'letra_pendiente'
): EventoCancionIpc => ({
  id: 'c1',
  resumen: resumenPrueba({ titulo: 'Eco de Plata', estadoPreparacion })
})
const pasar = async (...e: EventoCancionIpc[]) => {
  for (const x of e) await act(async () => emitir(x))
}

beforeEach(() => {
  tanda = null
  ;(window as unknown as { shinobi: unknown }).shinobi = {
    alCambiarCancion: (cb: (e: EventoCancionIpc) => void) => {
      emitir = cb
      return () => undefined
    },
    preparacion: { tanda: () => Promise.resolve(tanda) }
  }
})
afterEach(() => act(() => cerrarTodosLosToasts()))

describe('toasts del resultado de una canción', () => {
  it('F5-P8: al pasar de preparando a lista para revisar, toast con [Revisar]', async () => {
    const ir = vi.fn()
    render(<Sonda vista={{ tipo: 'biblioteca' }} ir={ir} />)
    await pasar(evento('preparando'), evento('lista_para_revisar'))
    expect(screen.getByText('«Eco de Plata» está lista para revisar.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c1', paso: 'editor', revisar: true })
  })

  it('«Elige la letra» da su toast; «Letra pendiente» no da ninguno', async () => {
    const ir = vi.fn()
    render(<Sonda vista={{ tipo: 'biblioteca' }} ir={ir} />)
    await pasar(evento('preparando'), evento('letra_pendiente'))
    expect(screen.queryByTestId('toast')).toBeNull()
    await pasar(evento('preparando'), evento('elige_letra'))
    expect(screen.getByText('«Eco de Plata»: elige la letra.')).toBeVisible()
  })

  it('en una tanda de varias canciones o en su vista de progreso no hay toast', async () => {
    tanda = {
      total: 2,
      terminadas: 0,
      pausada: false,
      motivoPausa: null,
      estimacionMin: null,
      descargasParadas: null,
      canciones: [
        { id: 'c1', resultado: null },
        { id: 'c2', resultado: null }
      ]
    }
    const { unmount } = render(<Sonda vista={{ tipo: 'biblioteca' }} ir={vi.fn()} />)
    await pasar(evento('preparando'), evento('lista_para_revisar'))
    expect(screen.queryByTestId('toast')).toBeNull()
    unmount()
    tanda = null
    render(<Sonda vista={{ tipo: 'cancion', id: 'c1', paso: 'progreso' }} ir={vi.fn()} />)
    await pasar(evento('preparando'), evento('lista_para_revisar'))
    expect(screen.queryByTestId('toast')).toBeNull()
  })
})
