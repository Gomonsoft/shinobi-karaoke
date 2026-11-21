import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ESTILO_PREDETERMINADO } from '@shared/estilo'
import { letra, linea } from '@shared/__fixtures__'
import { configPredeterminada } from '@shared/config'
import type { ApiShinobi } from '@shared/ipc'
import type { EstadoMotorReproductor } from '../../karaoke/motorReproductor'
import type { PantallaLetraProps } from '../../karaoke/PantallaLetra'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { Reproductor, type CancionReproductor } from './Reproductor'
import { R } from './textos'

const pantalla = vi.hoisted(() => ({ props: [] as PantallaLetraProps[] }))
vi.mock('../../karaoke/PantallaLetra', () => ({
  PantallaLetra: (props: PantallaLetraProps) => {
    pantalla.props.push(props)
    return <div data-testid="pantalla-letra" />
  }
}))

const base: CancionReproductor = {
  id: 'c1',
  titulo: 'Canción',
  artista: 'Artista',
  duracionMs: 30_000,
  gananciaDb: 0,
  letra: letra([linea('l1', 'Luz sobre el río', 2_000)]),
  estilo: ESTILO_PREDETERMINADO,
  lineasSinSincronizar: 0
}

function preparar() {
  const estado: EstadoMotorReproductor = {
    listo: true,
    cargando: false,
    sonando: true,
    finalizado: false,
    duracionMs: 30_000,
    vozDisponible: false,
    errorPrincipal: null,
    errorVoz: null
  }
  const motor = {
    cargar: vi.fn(async () => undefined),
    reproducir: vi.fn(async () => undefined),
    pausar: vi.fn(),
    buscar: vi.fn(),
    posicionMs: vi.fn(() => 0),
    fijarVolumen: vi.fn(),
    fijarVoz: vi.fn(),
    estado: vi.fn(() => estado),
    suscribir: vi.fn((cb: (e: EstadoMotorReproductor) => void) => {
      cb(estado)
      return () => undefined
    }),
    destruir: vi.fn()
  }
  window.shinobi = {
    ventana: {
      modoReproductor: vi.fn(async () => undefined),
      fijarPantallaCompleta: vi.fn(async () => undefined),
      estaEnPantallaCompleta: vi.fn(async () => false),
      evitarReposo: vi.fn(async () => undefined),
      alCambiarPantallaCompleta: vi.fn(() => () => undefined)
    },
    config: { obtener: async () => configPredeterminada() }
  } as unknown as ApiShinobi
  const volumen = {
    volumen: 0.8,
    silenciado: false,
    volumenVoz: 0.3,
    vozSilenciada: true,
    cambiar: vi.fn()
  }
  return { volumen, fabricar: vi.fn(() => motor as never) }
}

function montar(origen: 'biblioteca' | 'editor') {
  const f = preparar()
  const ui = (cancion: CancionReproductor) => (
    <Reproductor
      cancion={cancion}
      origen={origen}
      modo="karaoke"
      desdeMs={0}
      volumen={f.volumen}
      alSalir={vi.fn()}
      crearMotor={f.fabricar}
    />
  )
  return ui
}

afterEach(() => {
  pantalla.props = []
  cerrarTodosLosToasts()
})

const ultimas = () => pantalla.props.at(-1)!

describe('Reproductor: modalidad y espera (0216)', () => {
  it.each(['biblioteca', 'editor'] as const)(
    'Letra lista sin barrido y Lista con barrido (%s)',
    async (origen) => {
      const ui = montar(origen)
      const vista = render(ui({ ...base, modalidad: 'letra_lista' }))
      await screen.findByTestId('pantalla-letra')
      expect(ultimas().barrido).toBe(false)
      vista.unmount()
      render(ui({ ...base, modalidad: 'karaoke' }))
      await screen.findByTestId('pantalla-letra')
      expect(ultimas().barrido).toBe(true)
    }
  )

  it('R13: cambiar la modalidad a mitad no cambia la reproducción en curso', async () => {
    const ui = montar('biblioteca')
    const vista = render(ui({ ...base, modalidad: 'letra_lista' }))
    await screen.findByTestId('pantalla-letra')
    vista.rerender(ui({ ...base, modalidad: 'karaoke' }))
    expect(ultimas().barrido).toBe(false)
  })

  it('anuncia la espera con rep.espera.aria en la región aria-live', async () => {
    const ui = montar('biblioteca')
    render(ui(base))
    await screen.findByTestId('pantalla-letra')
    act(() => ultimas().alAnunciarEspera!(8))
    expect(await screen.findByText('La letra sigue en 8 segundos.')).toBeInTheDocument()
    expect(R.espera.aria(1)).toBe('La letra sigue en 1 segundo.')
  })
})
