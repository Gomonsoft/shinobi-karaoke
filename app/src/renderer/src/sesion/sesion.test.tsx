import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  estadoP1,
  estadoP2,
  estadoP3,
  estadoP4,
  estadoP4FinDeCola,
  estadoP5,
  estadoSinCola
} from '@shared/__fixtures__/sesion'
import type { EstadoSesionIpc } from '@shared/sesion'
import { NavegacionContexto, esVistaDeEdicion, type Vista } from '../navegacion/estado'
import { ProveedorReproductor, useReproductor } from '../navegacion/reproductor'
import { DialogoBloqueo } from './DialogoBloqueo'
import { IndicadorSesion } from './IndicadorSesion'
import { instalarApiSesion } from './pruebas'
import { ProveedorSesion, useSesion } from './ProveedorSesion'
import { EDI_BLOQUEO } from './textos'
import { useAccionBloqueable } from './useAccionBloqueable'

const TITULO = EDI_BLOQUEO.titulo

function montarApi(estado: EstadoSesionIpc) {
  window.shinobi = {} as never
  return instalarApiSesion(estado)
}

function BotonEditar({ alEditar }: { alEditar: () => void }) {
  const b = useAccionBloqueable()
  return (
    <button type="button" {...b.atributos('Editar')} onClick={() => b.intentar(alEditar)}>
      {b.candado}
      Editar
    </button>
  )
}

function Estado() {
  const s = useSesion()
  return (
    <output data-testid="s">
      {s.estado?.revision ?? 'nada'}|{String(s.haySesion)}|{String(s.panelAbierto)}|
      {s.posicion?.posicionMs ?? '-'}
    </output>
  )
}

async function montar(estado: EstadoSesionIpc, alEditar = vi.fn()) {
  const api = montarApi(estado)
  render(
    <ProveedorSesion>
      <BotonEditar alEditar={alEditar} />
      <Estado />
    </ProveedorSesion>
  )
  await waitFor(() => expect(screen.getByTestId('s')).not.toHaveTextContent('nada'))
  return { api, alEditar }
}

const emitir = (api: ReturnType<typeof montarApi>, e: EstadoSesionIpc) =>
  act(() => api.emitirEstado(e))

describe('ProveedorSesion', () => {
  it('lee el estado al montar', async () => {
    await montar(estadoP1({ revision: 5 }))
    expect(screen.getByTestId('s')).toHaveTextContent('5|true|false|-')
  })

  it('una revisión vieja que llega después de una nueva no cambia el estado', async () => {
    const { api } = await montar(estadoP1({ revision: 5 }))
    await emitir(api, estadoSinCola({ revision: 9 }))
    expect(screen.getByTestId('s')).toHaveTextContent('9|false')
    await emitir(api, estadoP1({ revision: 8 }))
    expect(screen.getByTestId('s')).toHaveTextContent('9|false')
  })

  it('una lectura inicial tardía no pisa a un evento más nuevo', async () => {
    window.shinobi = {} as never
    const api = instalarApiSesion(estadoP1({ revision: 5 }))
    let resolver: (e: EstadoSesionIpc) => void = () => {}
    window.shinobi.sesion.estado = () => new Promise((r) => (resolver = r))
    render(
      <ProveedorSesion>
        <Estado />
      </ProveedorSesion>
    )
    await emitir(api, estadoSinCola({ revision: 9 }))
    await act(async () => resolver(estadoP1({ revision: 5 })))
    expect(screen.getByTestId('s')).toHaveTextContent('9|false')
  })

  it('sigue la posición solo mientras hay sesión', async () => {
    const { api } = await montar(estadoP1())
    const activa = estadoP1().activa!
    act(() =>
      api.emitirPosicion({
        sesionId: estadoP1().sesion!.sesionId,
        entradaId: activa.entradaId,
        posicionMs: 12_000,
        duracionMs: 180_000
      })
    )
    expect(screen.getByTestId('s')).toHaveTextContent('|12000')
    await emitir(api, estadoSinCola({ revision: 20 }))
    expect(screen.getByTestId('s')).toHaveTextContent('|-')
  })

  it('no falla sin la API de sesión (muestrario, pruebas antiguas)', async () => {
    window.shinobi = {} as never
    render(
      <ProveedorSesion>
        <Estado />
      </ProveedorSesion>
    )
    expect(screen.getByTestId('s')).toHaveTextContent('nada|false')
  })
})

describe('bloqueo de edición (E1, E2, E3, E4, E7)', () => {
  it('E1: con sesión muestra el diálogo con el título exacto, no ejecuta y devuelve el foco con Entendido', async () => {
    const { alEditar } = await montar(estadoP1())
    const boton = screen.getByRole('button', { name: /^Editar/ })
    boton.focus()
    fireEvent.click(boton)
    const dialogo = await screen.findByRole('dialog', { name: TITULO })
    expect(dialogo).toHaveTextContent(EDI_BLOQUEO.cuerpo)
    expect(alEditar).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Entendido' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(boton).toHaveFocus()
  })

  it('E1: Esc equivale a Entendido y devuelve el foco', async () => {
    await montar(estadoP1())
    const boton = screen.getByRole('button', { name: /^Editar/ })
    boton.focus()
    fireEvent.click(boton)
    await screen.findByRole('dialog', { name: TITULO })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(boton).toHaveFocus()
  })

  const pausada = estadoP1()
  pausada.sesion!.fase = 'pausada'
  const cierre = estadoP1()
  cierre.sesion!.cierrePendiente = { origen: 'principal' }
  it.each([
    ['reproduciendo', estadoP1],
    ['pausa', () => pausada],
    ['cuenta entre canciones', estadoP2],
    ['en espera', estadoP4],
    ['fin de la cola', estadoP4FinDeCola],
    ['fallo', estadoP3],
    ['diálogo de cierre abierto', () => cierre]
  ])('E2: el bloqueo se mantiene en %s', async (_nombre, estado) => {
    const { alEditar } = await montar(estado())
    fireEvent.click(screen.getByRole('button', { name: /^Editar/ }))
    expect(await screen.findByRole('dialog', { name: TITULO })).toBeInTheDocument()
    expect(alEditar).not.toHaveBeenCalled()
  })

  it('E7: el elemento bloqueado sigue enfocable, con candado y nombre accesible ampliado', async () => {
    await montar(estadoP1())
    const boton = screen.getByRole('button', {
      name: `Editar${EDI_BLOQUEO.aria}`
    })
    expect(boton).toHaveAttribute('aria-disabled', 'true')
    expect(boton).not.toBeDisabled()
    expect(boton.querySelector('svg.lucide-lock')).not.toBeNull()
    boton.focus()
    expect(boton).toHaveFocus()
  })

  it('E3: al terminar la sesión la misma acción se ejecuta sin recargar', async () => {
    const { api, alEditar } = await montar(estadoP1({ revision: 5 }))
    await emitir(api, estadoP5({ revision: 6 }))
    const boton = screen.getByRole('button', { name: 'Editar' })
    expect(boton).not.toHaveAttribute('aria-disabled')
    fireEvent.click(boton)
    expect(alEditar).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('E3: una cola conservada sin sesión no bloquea nada', async () => {
    const { alEditar } = await montar(estadoP5())
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(alEditar).toHaveBeenCalledTimes(1)
  })

  it('si la sesión termina con el diálogo abierto, sigue abierto y Entendido lo cierra', async () => {
    const { api, alEditar } = await montar(estadoP1({ revision: 5 }))
    fireEvent.click(screen.getByRole('button', { name: /^Editar/ }))
    await screen.findByRole('dialog', { name: TITULO })
    await emitir(api, estadoSinCola({ revision: 6 }))
    expect(screen.getByRole('dialog', { name: TITULO })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    expect(alEditar).toHaveBeenCalledTimes(1)
  })

  it('E4: «Cerrar el reproductor…» pide el cierre, cierra el diálogo y no ejecuta la acción', async () => {
    const { api, alEditar } = await montar(estadoP1())
    fireEvent.click(screen.getByRole('button', { name: /^Editar/ }))
    await screen.findByRole('dialog', { name: TITULO })
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar el reproductor…' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() =>
      expect(api.llamadas.some(([nombre]) => nombre === 'sesion.solicitarCierre')).toBe(true)
    )
    // La sesión termina al confirmar; aun así, la acción no se ejecuta sola.
    await emitir(api, estadoSinCola({ revision: 30 }))
    expect(alEditar).not.toHaveBeenCalled()
  })
})

describe('DialogoBloqueo', () => {
  it('tiene «Entendido» como foco inicial', () => {
    render(<DialogoBloqueo abierto alCerrar={() => {}} alCerrarReproductor={() => {}} />)
    expect(screen.getByRole('button', { name: 'Entendido' })).toHaveFocus()
  })
})

describe('esVistaDeEdicion', () => {
  it('solo Letra y Editor de una canción', () => {
    const v = (paso: 'fuente' | 'progreso' | 'letra' | 'editor'): Vista => ({
      tipo: 'cancion',
      id: 'c',
      paso
    })
    expect(esVistaDeEdicion(v('letra'))).toBe(true)
    expect(esVistaDeEdicion(v('editor'))).toBe(true)
    expect(esVistaDeEdicion(v('progreso'))).toBe(false)
    expect(esVistaDeEdicion(v('fuente'))).toBe(false)
    expect(esVistaDeEdicion({ tipo: 'biblioteca' })).toBe(false)
    expect(esVistaDeEdicion({ tipo: 'ajustes' })).toBe(false)
  })
})

describe('reproductor local con sesión', () => {
  function Abrir() {
    const { abrir, abierto } = useReproductor()
    return (
      <>
        <button onClick={() => abrir('c1')}>Abrir c1</button>
        <output data-testid="abierto">{abierto ?? 'ninguno'}</output>
      </>
    )
  }
  async function montarReproductor(estado: EstadoSesionIpc) {
    montarApi(estado)
    render(
      <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir: vi.fn() }}>
        <ProveedorSesion>
          <ProveedorReproductor>
            <Abrir />
          </ProveedorReproductor>
          <Estado />
        </ProveedorSesion>
      </NavegacionContexto.Provider>
    )
    await waitFor(() => expect(screen.getByTestId('s')).not.toHaveTextContent('nada'))
  }

  it('con sesión, abrir(id) no abre la capa', async () => {
    await montarReproductor(estadoP1())
    fireEvent.click(screen.getByRole('button', { name: 'Abrir c1' }))
    expect(screen.getByTestId('abierto')).toHaveTextContent('ninguno')
  })

  it('sin sesión (aunque haya cola conservada), abrir(id) abre', async () => {
    await montarReproductor(estadoP5())
    fireEvent.click(screen.getByRole('button', { name: 'Abrir c1' }))
    expect(screen.getByTestId('abierto')).toHaveTextContent('c1')
  })
})

describe('IndicadorSesion (S14)', () => {
  async function montarIndicador(estado: EstadoSesionIpc, vista: Vista = { tipo: 'ajustes' }) {
    const api = montarApi(estado)
    const ir = vi.fn((_v: Vista, alNavegar?: () => void) => alNavegar?.())
    render(
      <NavegacionContexto.Provider value={{ vista, ir }}>
        <ProveedorSesion>
          <IndicadorSesion />
          <Estado />
          <button data-boton-cola>Cola</button>
        </ProveedorSesion>
      </NavegacionContexto.Provider>
    )
    await waitFor(() => expect(screen.getByTestId('s')).not.toHaveTextContent('nada'))
    return { api, ir }
  }

  it('no aparece sin sesión ni cola', async () => {
    await montarIndicador(estadoSinCola())
    expect(document.querySelector('[data-indicador-sesion]')).toBeNull()
  })

  it.each([
    ['En otra pantalla', estadoP1],
    ['Siguiente en 3 s', estadoP2],
    ['En espera', estadoP4],
    ['Requiere atención', estadoP3],
    ['Cola 2', estadoP5]
  ])('muestra «%s»', async (texto, estado) => {
    await montarIndicador(estado())
    expect(screen.getByRole('button', { name: /Ir a la cola/ })).toHaveTextContent(texto)
  })

  it('con sesión, el nombre accesible incluye el estado', async () => {
    await montarIndicador(estadoP1())
    expect(
      screen.getByRole('button', {
        name: 'Reproductor en otra pantalla: En otra pantalla. Ir a la cola.'
      })
    ).toBeInTheDocument()
  })

  it('desde Ajustes lleva a la Biblioteca, abre el panel y enfoca «Cola» si el panel no existe', async () => {
    const { ir } = await montarIndicador(estadoP1(), { tipo: 'ajustes' })
    fireEvent.click(screen.getByRole('button', { name: /Ir a la cola/ }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'biblioteca' }, expect.any(Function))
    expect(screen.getByTestId('s')).toHaveTextContent('|true|')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cola' })).toHaveFocus())
  })

  it('desde Progreso (espacio de canción) hace lo mismo', async () => {
    const { ir } = await montarIndicador(estadoP4(), { tipo: 'cancion', id: 'c', paso: 'progreso' })
    fireEvent.click(screen.getByRole('button', { name: /Ir a la cola/ }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'biblioteca' }, expect.any(Function))
  })

  it('con el panel montado, el foco va a su primer control', async () => {
    await montarIndicador(estadoP1(), { tipo: 'biblioteca' })
    const panel = document.createElement('div')
    panel.setAttribute('data-panel-cola', '')
    panel.innerHTML = '<button>Pausa</button>'
    document.body.append(panel)
    fireEvent.click(screen.getByRole('button', { name: /Ir a la cola/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pausa' })).toHaveFocus())
    panel.remove()
  })

  it('la cuenta baja con el reloj local entre dos estados', async () => {
    vi.useFakeTimers()
    try {
      montarApi(estadoP2())
      render(
        <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir: vi.fn() }}>
          <ProveedorSesion>
            <IndicadorSesion />
          </ProveedorSesion>
        </NavegacionContexto.Provider>
      )
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByRole('button')).toHaveTextContent('Siguiente en 3 s')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1100)
      })
      expect(screen.getByRole('button')).toHaveTextContent('Siguiente en 2 s')
    } finally {
      vi.useRealTimers()
    }
  })
})
