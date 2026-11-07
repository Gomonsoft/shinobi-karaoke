import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ESTILO_PREDETERMINADO } from '@shared/estilo'
import { letra, linea } from '@shared/__fixtures__'
import type { ApiShinobi } from '@shared/ipc'
import type { EstadoMotorReproductor } from '../../karaoke/motorReproductor'
import { Reproductor, type PropsReproductor } from './Reproductor'
import { E } from '../editor/textos'
import { R } from './textos'

const cancion = {
  id: 'cancion-prueba',
  titulo: 'Canción inventada',
  artista: 'Artista de prueba',
  duracionMs: 30_000,
  gananciaDb: 0,
  letra: letra([linea('l1', 'Luz sobre el río', 2000)]),
  estilo: ESTILO_PREDETERMINADO,
  lineasSinSincronizar: 0
}

function montar(cambios: Partial<PropsReproductor> = {}, antesDeCargar = Promise.resolve()) {
  let estado: EstadoMotorReproductor = {
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
  const emitir = (cambio: Partial<EstadoMotorReproductor>) => {
    estado = { ...estado, ...cambio }
    for (const oyente of oyentes) oyente(estado)
  }
  const motor = {
    cargar: vi.fn(async () => {
      await antesDeCargar
      emitir({ listo: true })
    }),
    reproducir: vi.fn(async () => emitir({ sonando: true })),
    pausar: vi.fn(() => emitir({ sonando: false })),
    buscar: vi.fn(() => emitir({ finalizado: false })),
    posicionMs: vi.fn(() => -4000),
    fijarVolumen: vi.fn(),
    fijarVoz: vi.fn(),
    estado: () => estado,
    suscribir: (cb: (e: EstadoMotorReproductor) => void) => {
      oyentes.add(cb)
      return () => oyentes.delete(cb)
    },
    destruir: vi.fn()
  }
  const ventana = {
    modoReproductor: vi.fn(async () => undefined),
    estaEnPantallaCompleta: vi.fn(async () => false),
    evitarReposo: vi.fn(async () => undefined),
    alCambiarPantallaCompleta: vi.fn(() => () => undefined)
  }
  window.shinobi = {
    ventana,
    sistema: { info: async () => ({ version: '0.1.0', so: 'Sistema de prueba' }) }
  } as unknown as ApiShinobi
  const alSalir = vi.fn()
  const props: PropsReproductor = {
    cancion,
    origen: 'biblioteca',
    modo: 'karaoke',
    desdeMs: 0,
    volumen: {
      volumen: 0.8,
      silenciado: false,
      volumenVoz: 0.3,
      vozSilenciada: true,
      cambiar: vi.fn()
    },
    alSalir,
    crearMotor: () => motor as never,
    ...cambios
  }
  return { motor, ventana, emitir, alSalir, props, ...render(<Reproductor {...props} />) }
}

async function terminar(f: ReturnType<typeof montar>): Promise<void> {
  await act(async () => undefined)
  f.motor.posicionMs.mockReturnValue(30_000)
  act(() => f.emitir({ finalizado: true, sonando: false }))
}

const anuncio = () => document.querySelector('[aria-live="polite"]')

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('estados del reproductor', () => {
  it('enfoca Volver y sale después de los 10 s si nadie interviene', async () => {
    vi.useFakeTimers()
    const f = montar()
    await terminar(f)
    expect(screen.getByRole('button', { name: R.volver.biblioteca })).toHaveFocus()
    expect(screen.getByText(R.cierre(10), { selector: 'span' })).toBeVisible()
    expect(screen.queryByRole('slider', { name: 'Barra de tiempo' })).not.toBeInTheDocument()
    expect(f.ventana.evitarReposo).toHaveBeenLastCalledWith(false)
    act(() => vi.advanceTimersByTime(9000))
    expect(screen.getByText(R.cierre(1))).toBeVisible()
    expect(anuncio()).toHaveTextContent(`${R.aria.fin} ${R.cierre(10)}`)
    act(() => vi.advanceTimersByTime(1000))
    expect(f.alSalir).toHaveBeenCalledExactlyOnceWith({ posicionMs: 30_000 })
  })

  it('detiene la cuenta con actividad y Otra vez repite el silencio previo', async () => {
    vi.useFakeTimers()
    const f = montar()
    await terminar(f)
    fireEvent.pointerMove(screen.getByRole('dialog'))
    expect(screen.queryByText(R.cierre(10), { selector: 'span' })).not.toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Barra de tiempo' })).toBeVisible()
    act(() => vi.advanceTimersByTime(10_000))
    expect(f.alSalir).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: R.otravez }))
    expect(f.motor.buscar).toHaveBeenLastCalledWith(0)
    expect(f.motor.reproducir).toHaveBeenLastCalledWith({ desdeMs: -4000 })
    expect(screen.queryByRole('button', { name: R.otravez })).not.toBeInTheDocument()
  })

  it('retroceder desde el final reanuda el audio en la posición elegida', async () => {
    const f = montar()
    await terminar(f)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'j' })
    expect(f.motor.buscar).toHaveBeenLastCalledWith(20_000)
    expect(f.motor.reproducir).toHaveBeenLastCalledWith()
    expect(screen.queryByRole('button', { name: R.otravez })).not.toBeInTheDocument()
  })

  it('avisa una vez si falta el instrumental, permite copiar los detalles y salir con Esc', async () => {
    const alFallarPista = vi.fn()
    const writeText = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const f = montar({ alFallarPista })
    await act(async () => undefined)
    const errorPrincipal = {
      tipo: 'no_encontrada',
      ruta: 'pistas/instrumental.flac',
      detalle: 'HTTP 404'
    } as const
    act(() => f.emitir({ errorPrincipal, sonando: false }))
    act(() => f.emitir({ errorPrincipal }))
    expect(screen.getByRole('alert')).toHaveTextContent(R.error.pistas)
    expect(screen.getByRole('button', { name: R.volver.biblioteca })).toHaveFocus()
    expect(alFallarPista).toHaveBeenCalledExactlyOnceWith({
      pista: 'principal',
      tipo: 'no_encontrada'
    })
    expect(f.ventana.evitarReposo).toHaveBeenLastCalledWith(false)
    fireEvent.click(screen.getByRole('button', { name: R.copiar }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'Shinobi Karaoke 0.1.0 · Sistema de prueba\nReproductor: instrumental (pistas/instrumental.flac) · no_encontrada · HTTP 404'
      )
    )
    fireEvent.keyDown(screen.getByRole('alert'), { key: 'Escape' })
    expect(f.alSalir).toHaveBeenCalledOnce()
  })

  it('distingue decodificación de pista ausente y deja cantar si solo falla la voz', async () => {
    const alFallarPista = vi.fn()
    const f = montar({ alFallarPista })
    await act(async () => undefined)
    const error = { tipo: 'decodificacion', detalle: 'Datos no válidos' } as const
    act(() => f.emitir({ errorVoz: { ...error, ruta: 'pistas/voz.flac' }, vozDisponible: false }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('slider', { name: R.aria.vozguia })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(alFallarPista).toHaveBeenCalledWith({ pista: 'voz', tipo: 'decodificacion' })
    act(() =>
      f.emitir({ errorPrincipal: { ...error, ruta: 'pistas/instrumental.flac' }, sonando: false })
    )
    expect(screen.getByRole('alert')).toHaveTextContent(R.error.audio)
  })

  it.each([1, 3])('muestra el aviso de %i líneas pendientes y lo anuncia al empezar', async (n) => {
    const f = montar({ cancion: { ...cancion, lineasSinSincronizar: n } })
    const aviso = R.incompleta(n)
    await waitFor(() => expect(screen.getAllByText(aviso.slice(2))).toHaveLength(2))
    await waitFor(() => expect(anuncio()).toHaveTextContent(aviso))
    act(() => f.emitir({ sonando: false }))
    act(() => f.emitir({ sonando: true }))
    expect(anuncio()).toHaveTextContent(R.aria.reanudacion)
  })

  it('omite el aviso desde el editor y pausa al abrir los atajos', async () => {
    const f = montar({
      origen: 'editor',
      modo: 'original',
      cancion: { ...cancion, lineasSinSincronizar: 3 },
      alDesplazar: vi.fn()
    })
    await act(async () => undefined)
    expect(screen.queryByText(R.incompleta(3).slice(2))).not.toBeInTheDocument()
    const superficie = screen.getByRole('dialog')
    fireEvent.keyDown(superficie, { key: 'F1' })
    expect(screen.getByRole('dialog', { name: R.atajos.titulo })).toBeVisible()
    expect(f.motor.pausar).toHaveBeenCalledOnce()
    expect(screen.getByRole('rowheader', { name: ', / .' })).toBeVisible()
    expect(screen.queryByRole('rowheader', { name: 'V' })).not.toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cerrar' }), { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: R.atajos.titulo })).not.toBeInTheDocument()
    expect(f.alSalir).not.toHaveBeenCalled()
    expect(superficie).toHaveFocus()
    expect(f.motor.reproducir).toHaveBeenCalledOnce()
  })

  it('abrir los atajos durante la carga mantiene el audio en pausa al cerrar el diálogo', async () => {
    let cargar!: () => void
    const f = montar({}, new Promise((resolve) => (cargar = resolve)))
    const superficie = screen.getByRole('dialog')
    fireEvent.keyDown(superficie, { key: 'F1' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cerrar' }), { key: 'Escape' })
    await act(async () => cargar())
    expect(f.motor.reproducir).not.toHaveBeenCalled()
    fireEvent.keyDown(superficie, { key: ' ' })
    expect(f.motor.reproducir).toHaveBeenCalledExactlyOnceWith({ desdeMs: -4000 })
  })

  it('refleja el desplazamiento que recibe y avisa durante 1 s en el límite', async () => {
    vi.useFakeTimers()
    const alDesplazar = vi.fn()
    const conDesplazamiento = (offset_ms: number) => ({
      ...cancion,
      letra: { ...cancion.letra, offset_ms }
    })
    const f = montar({ origen: 'editor', alDesplazar, cancion: conDesplazamiento(-29_900) })
    await act(async () => undefined)
    const superficie = screen.getByRole('dialog')
    fireEvent.keyDown(superficie, { key: ',' })
    expect(alDesplazar).toHaveBeenCalledExactlyOnceWith(-100)
    f.rerender(<Reproductor {...f.props} cancion={conDesplazamiento(-30_000)} />)
    expect(screen.getByText(R.offset(-30_000))).toBeVisible()
    fireEvent.keyDown(superficie, { key: ',' })
    expect(alDesplazar).toHaveBeenCalledOnce()
    const aviso = `${R.offset(-30_000)} ${E.offsetRango}`
    act(() => vi.advanceTimersByTime(999))
    expect(screen.getByText(aviso)).toBeVisible()
    act(() => vi.advanceTimersByTime(1))
    expect(screen.queryByText(aviso)).not.toBeInTheDocument()
  })
})
