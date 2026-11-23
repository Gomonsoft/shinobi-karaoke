import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ApiShinobi, TandaPreparacionIpc, TrabajoIpc } from '@shared/ipc'
import { NavegacionContexto, type Vista } from './estado'
import { botonDeCola, textoEtaCola } from './cola'
import { IndicadorActividad } from './IndicadorActividad'
import { TrabajosContexto } from '../trabajos/useTrabajos'
import { BibliotecaContexto, type BibliotecaDatos } from '../vistas/biblioteca/useBiblioteca'
import { resumenPrueba } from '../vistas/biblioteca/resumenPrueba'

const ids = ['c1', 'c2', 'c3', 'c4', 'c5']

const tanda = (extra: Partial<TandaPreparacionIpc> = {}): TandaPreparacionIpc => ({
  total: 5,
  terminadas: 2,
  pausada: false,
  motivoPausa: null,
  estimacionMin: 6,
  descargasParadas: null,
  separacionesParadas: null,
  canciones: ids.map((id, i) => ({
    id,
    resultado: i < 2 ? ('lista_para_revisar' as const) : null
  })),
  ...extra
})

const trabajo = (cancionId: string, extra: Partial<TrabajoIpc> = {}): TrabajoIpc => ({
  id: `t-${cancionId}`,
  cancionId,
  paso: 'separacion',
  cola: 'pesada',
  comando: 'demo',
  estado: 'en_curso',
  posicion: null,
  resultado: null,
  error: null,
  progreso: null,
  ...extra
})

const biblioteca: BibliotecaDatos = {
  estado: 'listo',
  lenta: false,
  canciones: ids.map((id, i) => resumenPrueba({ id, titulo: `Tema ${i + 1}` })),
  reintentar: () => undefined
}

const ir = vi.fn<(v: Vista) => void>()
let emitir: (t: TandaPreparacionIpc | null) => void = () => undefined
const preparacion = {
  tanda: vi.fn(),
  alTanda: vi.fn((cb: (t: TandaPreparacionIpc | null) => void) => {
    emitir = cb
    return () => undefined
  }),
  pausar: vi.fn().mockResolvedValue(undefined),
  reanudar: vi.fn().mockResolvedValue(undefined),
  reintentarFallidas: vi.fn().mockResolvedValue(undefined),
  cancelar: vi.fn().mockResolvedValue(undefined)
}
const trabajos = { cancelar: vi.fn().mockResolvedValue(true) }

async function pintar(t: TandaPreparacionIpc, tr: TrabajoIpc[] = [trabajo('c3')]) {
  preparacion.tanda.mockResolvedValue(t)
  render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir }}>
      <BibliotecaContexto.Provider value={biblioteca}>
        <TrabajosContexto.Provider value={{ trabajos: tr, progreso: {}, terminado: false }}>
          <IndicadorActividad />
        </TrabajosContexto.Provider>
      </BibliotecaContexto.Provider>
    </NavegacionContexto.Provider>
  )
  return screen.findByRole('button', { name: /Preparando|En pausa|Cola parada/ })
}

beforeEach(() => {
  vi.clearAllMocks()
  window.shinobi = {
    preparacion,
    trabajos,
    config: { obtener: vi.fn().mockResolvedValue({ preparacion: { automatica: true } }) }
  } as unknown as ApiShinobi
})

describe('botonDeCola y textos', () => {
  it('con las separaciones paradas: «Preparando» con ⚠ si algo sigue; «Cola parada» si no queda nada en marcha', () => {
    const t = tanda({ separacionesParadas: 'RUNTIME_NO_DISPONIBLE' })
    expect(botonDeCola(t, true)).toEqual({ texto: 'Preparando 3 de 5', estado: 'aviso' })
    expect(botonDeCola(t, false)).toEqual({ texto: 'Cola parada · faltan 3', estado: 'parada' })
  })

  it('elige el texto y el estado del botón', () => {
    expect(botonDeCola(tanda())).toEqual({ texto: 'Preparando 3 de 5', estado: 'curso' })
    expect(botonDeCola(tanda({ pausada: true }))).toEqual({
      texto: 'En pausa · faltan 3',
      estado: 'pausa'
    })
    expect(botonDeCola(tanda({ pausada: true, motivoPausa: 'SIN_ESPACIO' })).estado).toBe('parada')
    expect(botonDeCola(tanda({ descargasParadas: 'YOUTUBE_BLOQUEADO' })).texto).toBe(
      'Cola parada · faltan 3'
    )
  })

  it('el tiempo restante', () => {
    expect(textoEtaCola(null)).toBe('Calculando tiempo…')
    expect(textoEtaCola(6)).toBe('quedan unos 6 min')
  })
})

describe('IndicadorActividad con cola de preparación', () => {
  it('muestra «Preparando 3 de 5» y la cabecera con barra, tiempo y grupos', async () => {
    const b = await pintar(tanda())
    expect(b).toHaveTextContent('Preparando 3 de 5')
    fireEvent.click(b)
    expect(
      screen.getByRole('heading', { name: 'Cola de preparación · 2 de 5 terminadas' })
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /Cola de preparación/ })).toBeInTheDocument()
    expect(screen.getByText('quedan unos 6 min')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'En cola (2)' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Terminadas (2)' }))
    expect(screen.getAllByText(/Lista para revisar/)).toHaveLength(2)
  })

  it('con una sola canción no cambia nada (sin cabecera de cola)', async () => {
    preparacion.tanda.mockResolvedValue(
      tanda({ total: 1, terminadas: 0, canciones: [{ id: 'c3', resultado: null }] })
    )
    render(
      <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir }}>
        <BibliotecaContexto.Provider value={biblioteca}>
          <TrabajosContexto.Provider
            value={{ trabajos: [trabajo('c3')], progreso: {}, terminado: false }}
          >
            <IndicadorActividad />
          </TrabajosContexto.Provider>
        </BibliotecaContexto.Provider>
      </NavegacionContexto.Provider>
    )
    expect(await screen.findByRole('button', { name: '1 en curso' })).toBeInTheDocument()
  })

  it('Pausar llama a la API; en pausa el botón dice ⏸ y el panel ofrece Reanudar', async () => {
    const b = await pintar(tanda())
    fireEvent.click(b)
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))
    expect(preparacion.pausar).toHaveBeenCalled()
    act(() => emitir(tanda({ pausada: true })))
    expect(screen.getByRole('button', { name: /En pausa · faltan 3/ })).toBeInTheDocument()
    expect(
      screen.getByText('La canción en curso termina su paso; las demás esperan.')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar' }))
    expect(preparacion.reanudar).toHaveBeenCalled()
  })

  it('«Cancelar lo que falta…» pide confirmación con el foco en «Seguir preparando»', async () => {
    const b = await pintar(tanda())
    fireEvent.click(b)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar lo que falta…' }))
    const d = await screen.findByRole('dialog', { name: '¿Cancelar las 3 canciones que faltan?' })
    expect(within(d).getByRole('button', { name: 'Seguir preparando' })).toHaveFocus()
    expect(trabajos.cancelar).not.toHaveBeenCalled()
    fireEvent.click(within(d).getByRole('button', { name: 'Cancelar lo que falta' }))
    expect(trabajos.cancelar).toHaveBeenCalledWith('t-c3')
    expect(preparacion.cancelar).toHaveBeenCalledWith('c4')
    expect(preparacion.cancelar).not.toHaveBeenCalledWith('c1')
  })

  it('los fallos abren el grupo «Con error» con [Reintentar las fallidas]', async () => {
    const t = tanda()
    t.canciones[2] = { id: 'c3', resultado: 'error', motivo: 'ERROR_INTERNO' }
    t.terminadas = 3
    const b = await pintar(t, [trabajo('c4')])
    fireEvent.click(b)
    expect(screen.getByRole('button', { name: 'Con error (1)' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar las fallidas' }))
    expect(preparacion.reintentarFallidas).toHaveBeenCalled()
  })

  it('las paradas automáticas muestran su aviso y su salida', async () => {
    const b = await pintar(tanda({ descargasParadas: 'YOUTUBE_BLOQUEADO' }))
    expect(b).toHaveTextContent('Cola parada · faltan 3')
    fireEvent.click(b)
    expect(screen.getByText(/YouTube no permite descargas ahora mismo/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar las descargas' }))
    expect(preparacion.reanudar).toHaveBeenCalled()
    act(() => emitir(tanda({ pausada: true, motivoPausa: 'RUNTIME_NO_DISPONIBLE' })))
    fireEvent.click(screen.getByRole('button', { name: 'Reparar el motor de audio' }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'primer-arranque' })
  })

  it('sin motor de separación (0390) la cola sigue, con su aviso y «Reparar el motor» (texto de la parada total)', async () => {
    const b = await pintar(tanda({ separacionesParadas: 'RUNTIME_NO_DISPONIBLE' }))
    // Algo sigue en marcha (hay un trabajo en curso): el botón sigue en «Preparando» y la línea es la nueva.
    expect(b).toHaveTextContent('Preparando 3 de 5')
    fireEvent.click(b)
    expect(
      screen.getByText(
        'Hay que reparar el motor de audio para separar las pistas. Hemos parado las 3 separaciones que faltan. Las descargas y la búsqueda de letras siguen.'
      )
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reparar el motor de audio' }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'primer-arranque' })
  })

  it('al terminar la tanda el botón de la cola desaparece', async () => {
    const b = await pintar(tanda(), [trabajo('c3')])
    fireEvent.click(b)
    const fin = tanda({
      terminadas: 5,
      canciones: ids.map((id) => ({ id, resultado: 'lista_para_revisar' as const }))
    })
    act(() => emitir(fin))
    expect(screen.queryByRole('button', { name: /Preparando/ })).toBeNull()
  })
})
