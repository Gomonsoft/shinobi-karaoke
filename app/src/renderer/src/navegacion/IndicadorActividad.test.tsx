import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ApiShinobi, EventoProgresoIpc, TrabajoIpc } from '@shared/ipc'
import { NavegacionContexto, type Vista } from './estado'
import { IndicadorActividad } from './IndicadorActividad'
import { TrabajosContexto, type EstadoTrabajos } from '../trabajos/useTrabajos'
import { BibliotecaContexto, type BibliotecaDatos } from '../vistas/biblioteca/useBiblioteca'
import { resumenPrueba } from '../vistas/biblioteca/resumenPrueba'

const trabajo = (extra: Partial<TrabajoIpc> = {}): TrabajoIpc => ({
  id: 't1',
  cancionId: 'c1',
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

const evento = (extra: Partial<EventoProgresoIpc> & { id?: string } = {}): EventoProgresoIpc =>
  ({
    id: 't1',
    cancionId: 'c1',
    paso: 'separacion',
    fase: 'separando',
    valor: 0.42,
    etaSegundos: 180,
    ...extra
  }) as EventoProgresoIpc

const biblioteca: BibliotecaDatos = {
  estado: 'listo',
  lenta: false,
  canciones: [
    resumenPrueba({ id: 'c1', titulo: 'Bohemian Rhapsody' }),
    resumenPrueba({ id: 'c2', titulo: 'La flaca' })
  ],
  reintentar: () => undefined
}

const ir = vi.fn<(v: Vista) => void>()
const cancelar = vi.fn(() => Promise.resolve(true))

function pintar(estado: Partial<EstadoTrabajos>) {
  const completo: EstadoTrabajos = { trabajos: [], progreso: {}, terminado: false, ...estado }
  const arbol = (e: EstadoTrabajos) => (
    <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir }}>
      <BibliotecaContexto.Provider value={biblioteca}>
        <TrabajosContexto.Provider value={e}>
          <IndicadorActividad />
        </TrabajosContexto.Provider>
      </BibliotecaContexto.Provider>
    </NavegacionContexto.Provider>
  )
  const r = render(arbol(completo))
  return {
    ...r,
    actualizar: (e: Partial<EstadoTrabajos>) => r.rerender(arbol({ ...completo, ...e }))
  }
}

const abrirPanel = () => fireEvent.click(screen.getByRole('button', { name: /en curso|en cola/ }))

beforeEach(() => {
  ir.mockClear()
  cancelar.mockClear()
  ;(window as unknown as { shinobi: unknown }).shinobi = {
    trabajos: { cancelar }
  } as unknown as ApiShinobi
})

describe('IndicadorActividad: botón', () => {
  it('no se ve sin trabajos', () => {
    pintar({})
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('muestra "1 en curso · 2 en cola" con aria-expanded y aria-controls', () => {
    pintar({
      trabajos: [
        trabajo(),
        trabajo({ id: 't2', estado: 'en_cola', posicion: 1 }),
        trabajo({ id: 't3', estado: 'en_cola', posicion: 2 })
      ]
    })
    const b = screen.getByRole('button', { name: '1 en curso · 2 en cola' })
    expect(b).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(b)
    expect(b).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(b.getAttribute('aria-controls')!)).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Actividad' })).toBeInTheDocument()
  })
})

describe('IndicadorActividad: filas', () => {
  it('una fila por trabajo con el texto de su fase, barra y tiempo restante', () => {
    pintar({
      trabajos: [
        trabajo(),
        trabajo({ id: 't2', cancionId: 'c2', paso: 'fuente', cola: 'ligera' }),
        trabajo({ id: 't3', cancionId: 'c2', estado: 'en_cola', posicion: 1 })
      ],
      progreso: {
        t1: evento(),
        t2: evento({
          id: 't2',
          cancionId: 'c2',
          paso: 'fuente',
          fase: 'descargando',
          valor: 0.8,
          etaSegundos: 20
        })
      }
    })
    abrirPanel()
    const filas = screen.getAllByRole('listitem')
    expect(filas).toHaveLength(3)
    expect(within(filas[0]!).getByText('Bohemian Rhapsody — Separando 42 %')).toBeInTheDocument()
    expect(within(filas[0]!).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
    expect(within(filas[0]!).getByText('quedan unos 3 min')).toBeInTheDocument()
    expect(within(filas[1]!).getByText('La flaca — Descargando 80 %')).toBeInTheDocument()
    expect(within(filas[1]!).getByText('queda menos de 1 min')).toBeInTheDocument()
    expect(within(filas[2]!).getByText('La flaca — En cola para separar')).toBeInTheDocument()
    expect(within(filas[2]!).queryByRole('progressbar')).toBeNull()
  })

  it('descarga del modelo con barra determinada', () => {
    pintar({
      trabajos: [trabajo()],
      progreso: { t1: evento({ fase: 'descargando_modelo', valor: 0.34, etaSegundos: null }) }
    })
    abrirPanel()
    expect(screen.getByText('Bohemian Rhapsody — Descargando el modelo 34 %')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '34')
  })

  it('reintento por memoria: barra indeterminada', () => {
    pintar({
      trabajos: [trabajo()],
      progreso: {
        t1: evento({
          fase: 'reintentando',
          valor: null,
          detalle: { motivo: 'memoria' },
          intento: 2
        })
      }
    })
    abrirPanel()
    expect(screen.getByText('Bohemian Rhapsody — Reintentando la separación…')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
  })

  it('reintento de red: cuenta atrás sin barra', () => {
    vi.useFakeTimers()
    try {
      pintar({
        trabajos: [trabajo({ paso: 'fuente', cola: 'ligera' })],
        progreso: {
          t1: evento({
            paso: 'fuente',
            fase: 'reintentando',
            valor: null,
            etaSegundos: null,
            detalle: { motivo: 'red', espera_s: 5 },
            intento: 2
          })
        }
      })
      abrirPanel()
      expect(screen.getByText('Bohemian Rhapsody — Reintentando en 5 s…')).toBeInTheDocument()
      expect(screen.queryByRole('progressbar')).toBeNull()
      act(() => void vi.advanceTimersByTime(2000))
      expect(screen.getByText('Bohemian Rhapsody — Reintentando en 3 s…')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('actualizando el descargador: indeterminada', () => {
    pintar({
      trabajos: [trabajo({ paso: 'fuente', cola: 'ligera' })],
      progreso: {
        t1: evento({ paso: 'fuente', fase: 'actualizando', valor: null, etaSegundos: null })
      }
    })
    abrirPanel()
    expect(screen.getByText(/Actualizando el descargador…/)).toBeInTheDocument()
  })
})

describe('IndicadorActividad: acciones', () => {
  it('[Ir] abre la vista de progreso de esa canción y cierra el panel', () => {
    pintar({ trabajos: [trabajo()] })
    abrirPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Ir' }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c1', paso: 'progreso' })
    expect(screen.queryByRole('heading', { name: 'Actividad' })).toBeNull()
  })

  it('[✕] en cola cancela sin diálogo', () => {
    pintar({ trabajos: [trabajo({ id: 'q', estado: 'en_cola', posicion: 1 }), trabajo()] })
    abrirPanel()
    fireEvent.click(screen.getAllByRole('button', { name: /^Cancelar/ })[0]!)
    expect(cancelar).toHaveBeenCalledWith('q')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('[✕] de una separación en curso pide confirmar (Seguir no cancela)', () => {
    pintar({ trabajos: [trabajo()] })
    abrirPanel()
    fireEvent.click(screen.getByRole('button', { name: /^Cancelar/ }))
    expect(cancelar).not.toHaveBeenCalled()
    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByText('¿Cancelar la separación?')).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Seguir separando' }))
    expect(cancelar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^Cancelar/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar separación' }))
    expect(cancelar).toHaveBeenCalledWith('t1')
  })

  it('[✕] de una descarga en curso (también esperando un reintento) usa el diálogo de la descarga', () => {
    pintar({
      trabajos: [trabajo({ paso: 'fuente', cola: 'ligera' })],
      progreso: {
        t1: evento({
          paso: 'fuente',
          fase: 'reintentando',
          valor: null,
          etaSegundos: null,
          detalle: { motivo: 'red', espera_s: 5 }
        })
      }
    })
    abrirPanel()
    fireEvent.click(screen.getByRole('button', { name: /^Cancelar/ }))
    expect(screen.getByText('¿Cancelar la descarga?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar descarga' }))
    expect(cancelar).toHaveBeenCalledWith('t1')
  })
})

describe('IndicadorActividad: teclado y foco', () => {
  it('Esc cierra y devuelve el foco al botón', () => {
    pintar({ trabajos: [trabajo(), trabajo({ id: 't2', cancionId: 'c2' })] })
    abrirPanel()
    const botones = screen.getAllByRole('button', { name: 'Ir' })
    expect(botones[0]!).toHaveFocus()
    fireEvent.keyDown(botones[0]!, { key: 'Escape' })
    expect(screen.queryByRole('heading', { name: 'Actividad' })).toBeNull()
    expect(screen.getByRole('button', { name: /en curso/ })).toHaveFocus()
  })

  it('las flechas recorren los controles del panel', () => {
    pintar({ trabajos: [trabajo(), trabajo({ id: 't2', cancionId: 'c2' })] })
    abrirPanel()
    const ira = screen.getAllByRole('button', { name: 'Ir' })
    const x = screen.getAllByRole('button', { name: /^Cancelar/ })
    fireEvent.keyDown(ira[0]!, { key: 'ArrowDown' })
    expect(x[0]!).toHaveFocus()
    fireEvent.keyDown(x[0]!, { key: 'ArrowDown' })
    expect(ira[1]!).toHaveFocus()
    fireEvent.keyDown(ira[1]!, { key: 'ArrowUp' })
    expect(x[0]!).toHaveFocus()
  })

  it('un clic fuera cierra el panel', () => {
    pintar({ trabajos: [trabajo()] })
    abrirPanel()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('heading', { name: 'Actividad' })).toBeNull()
  })
})

describe('IndicadorActividad: fin de los trabajos', () => {
  it('al quedarse sin trabajos el panel se cierra y se muestra "Terminado"', () => {
    const { actualizar } = pintar({ trabajos: [trabajo()] })
    abrirPanel()
    actualizar({ trabajos: [], terminado: true })
    expect(screen.queryByRole('heading', { name: 'Actividad' })).toBeNull()
    expect(screen.getByText('Terminado')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
