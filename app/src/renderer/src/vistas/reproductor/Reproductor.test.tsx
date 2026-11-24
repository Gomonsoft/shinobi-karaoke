import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ESTILO_PREDETERMINADO } from '@shared/estilo'
import { letra, linea } from '@shared/__fixtures__'
import { configPredeterminada } from '@shared/config'
import type { ApiShinobi } from '@shared/ipc'
import type { EstadoMotorReproductor } from '../../karaoke/motorReproductor'
import { envolvente, tramosCoro } from '@shared/coros'
import { Reproductor, type CancionReproductor } from './Reproductor'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'

const cancion: CancionReproductor = {
  id: 'cancion-prueba',
  titulo: 'Canción inventada',
  artista: 'Artista de prueba',
  duracionMs: 30_000,
  gananciaDb: 0,
  letra: letra([linea('l1', 'Luz sobre el río', 2_000)]),
  estilo: ESTILO_PREDETERMINADO,
  lineasSinSincronizar: 0
}

function preparar() {
  const estado: EstadoMotorReproductor = {
    listo: false,
    cargando: false,
    sonando: false,
    finalizado: false,
    duracionMs: 30_000,
    vozDisponible: true,
    errorPrincipal: null,
    errorVoz: null
  }
  const oyentes = new Set<(e: EstadoMotorReproductor) => void>()
  const motor = {
    cargar: vi.fn(async () => {
      const listo = { ...estado, listo: true, sonando: true }
      Object.assign(estado, listo)
      for (const oyente of oyentes) oyente(estado)
    }),
    reproducir: vi.fn(async () => {
      estado.sonando = true
      for (const oyente of oyentes) oyente(estado)
    }),
    pausar: vi.fn(() => {
      estado.sonando = false
      for (const oyente of oyentes) oyente(estado)
    }),
    buscar: vi.fn(() => undefined),
    posicionMs: vi.fn(() => 0),
    fijarVolumen: vi.fn(),
    fijarVoz: vi.fn(),
    fijarCoros: vi.fn(),
    estado: vi.fn(() => estado),
    suscribir: vi.fn((cb: (e: EstadoMotorReproductor) => void) => {
      oyentes.add(cb)
      return () => oyentes.delete(cb)
    }),
    destruir: vi.fn()
  }
  const ventana = {
    modoReproductor: vi.fn(async () => undefined),
    fijarPantallaCompleta: vi.fn(async () => undefined),
    estaEnPantallaCompleta: vi.fn(async () => false),
    evitarReposo: vi.fn(async () => undefined),
    alCambiarPantallaCompleta: vi.fn(() => () => undefined)
  }
  window.shinobi = {
    ventana,
    config: { obtener: async () => configPredeterminada() }
  } as unknown as ApiShinobi
  const volumen = {
    volumen: 0.8,
    silenciado: false,
    volumenVoz: 0.3,
    vozSilenciada: true,
    cambiar: vi.fn()
  }
  const fabricar = vi.fn(() => motor as never)
  const salir = vi.fn()
  return { motor, ventana, volumen, fabricar, salir }
}

afterEach(() => {
  vi.useRealTimers()
  cerrarTodosLosToasts()
})

describe('Reproductor', () => {
  it('entra en pantalla completa, carga el motor y restaura la ventana al desmontar', async () => {
    const f = preparar()
    const vista = render(
      <Reproductor
        cancion={cancion}
        origen="biblioteca"
        modo="karaoke"
        desdeMs={0}
        volumen={f.volumen}
        alSalir={f.salir}
        crearMotor={f.fabricar}
      />
    )
    expect(
      await screen.findByRole('dialog', { name: 'Reproductor de «Canción inventada»' })
    ).toBeVisible()
    expect(f.ventana.modoReproductor).toHaveBeenCalledWith(true)
    await waitFor(() => expect(f.motor.reproducir).toHaveBeenCalledWith({ desdeMs: -4000 }))
    vista.unmount()
    expect(f.motor.destruir).toHaveBeenCalledOnce()
    expect(f.ventana.modoReproductor).toHaveBeenCalledWith(false)
  })

  it('Espacio pausa el audio y mantiene los controles visibles', async () => {
    const f = preparar()
    render(
      <Reproductor
        cancion={cancion}
        origen="biblioteca"
        modo="karaoke"
        desdeMs={0}
        volumen={f.volumen}
        alSalir={f.salir}
        crearMotor={f.fabricar}
      />
    )
    await screen.findByRole('dialog')
    await waitFor(() => expect(f.motor.reproducir).toHaveBeenCalled())
    fireEvent.keyDown(window, { key: ' ' })
    expect(f.motor.pausar).toHaveBeenCalledOnce()
    expect(screen.getAllByText('❚❚ En pausa')[0]!).toBeVisible()
  })

  it('Esc sale una vez y Ctrl+N no actúa', async () => {
    const f = preparar()
    render(
      <Reproductor
        cancion={cancion}
        origen="biblioteca"
        modo="karaoke"
        desdeMs={0}
        volumen={f.volumen}
        alSalir={f.salir}
        crearMotor={f.fabricar}
      />
    )
    await screen.findByRole('dialog')
    fireEvent.keyDown(window, { key: 'n', ctrlKey: true })
    expect(f.salir).not.toHaveBeenCalled()
    act(() => fireEvent.keyDown(window, { key: 'Escape' }))
    expect(f.salir).toHaveBeenCalledOnce()
    expect(f.salir).toHaveBeenCalledWith({ posicionMs: 0 })
  })
})

describe('Reproductor · voz en los coros (0.2.3)', () => {
  const conCoros = (nivel?: number): CancionReproductor => ({
    ...cancion,
    letra: {
      ...letra([linea('l1', 'Luz sobre el río', 2_000), linea('c1', 'Eco inventado', 8_000)]),
      lineas: [
        linea('l1', 'Luz sobre el río', 2_000),
        { ...linea('c1', 'Eco inventado', 8_000), fin_ms: 10_000, parte: 'coro' }
      ],
      ...(nivel === undefined
        ? {}
        : { partes: { cantantes: [{ id: 'c1' as const, nombre: null }], voz_en_coros: nivel } })
    }
  })
  const montar = (c: CancionReproductor, vozSilenciada = false) => {
    const f = preparar()
    render(
      <Reproductor
        cancion={c}
        origen="biblioteca"
        modo="karaoke"
        desdeMs={0}
        volumen={{ ...f.volumen, vozSilenciada }}
        alSalir={f.salir}
        crearMotor={f.fabricar}
      />
    )
    return f
  }

  it('C2-R6: cada canción pasa al motor los puntos de su propio nivel (20 % y 70 %)', async () => {
    for (const nivel of [0.2, 0.7]) {
      const c = conCoros(nivel)
      const f = montar(c)
      await waitFor(() => expect(f.motor.fijarCoros).toHaveBeenCalledOnce())
      expect(f.motor.fijarCoros).toHaveBeenCalledWith(
        envolvente(tramosCoro(c.letra, c.duracionMs), nivel)
      )
      expect(f.motor.fijarCoros.mock.calls[0]![0][1][1]).toBe(nivel)
      cleanup()
    }
  })

  it('sin coros no se toca la envolvente del motor (como en 0.2.2)', async () => {
    const f = montar(cancion)
    await waitFor(() => expect(f.motor.reproducir).toHaveBeenCalled())
    expect(f.motor.fijarCoros).not.toHaveBeenCalled()
  })

  it('con nivel 0 tampoco', async () => {
    const f = montar(conCoros(0))
    await waitFor(() => expect(f.motor.reproducir).toHaveBeenCalled())
    expect(f.motor.fijarCoros).not.toHaveBeenCalled()
  })

  it('C2-R5: V en una canción con coros dice «Voz silenciada · coros al 50 %»', async () => {
    const f = montar(conCoros())
    await waitFor(() => expect(f.motor.reproducir).toHaveBeenCalled())
    fireEvent.keyDown(window, { key: 'v' })
    expect(await screen.findAllByText('Voz silenciada · coros al 50 %')).not.toHaveLength(0)
    expect(f.volumen.cambiar).toHaveBeenCalledWith(
      expect.objectContaining({ voz_guia_silenciada: true })
    )
  })

  it('C2-R5: en una canción sin coros, el indicador de siempre', async () => {
    const f = montar(cancion)
    await waitFor(() => expect(f.motor.reproducir).toHaveBeenCalled())
    fireEvent.keyDown(window, { key: 'v' })
    expect(await screen.findAllByText('Voz silenciada')).not.toHaveLength(0)
    expect(screen.queryByText(/coros al/)).toBeNull()
  })
})
