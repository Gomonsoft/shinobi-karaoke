import { act, renderHook } from '@testing-library/react'
import { useReducer } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { letra, linea, pausa } from '@shared/__fixtures__'
import { estiloPredeterminado } from '@shared/estilo'
import type { EstadoMotor, Velocidad } from '../../karaoke/motorAudio'
import { estadoInicial, reducirEditor } from './estado'
import { useSincronizarAlRitmo } from './useSincronizarAlRitmo'

function montar(velocidad: Velocidad = 1, offset = 0) {
  const estado: EstadoMotor = {
    sonando: false,
    pista: 'voz',
    cargando: false,
    cargandoPista: null,
    error: null,
    duracionMs: 30_000,
    velocidad,
    volumen: 1
  }
  const oyentes = new Set<(estado: EstadoMotor) => void>()
  let pos = 0
  const publicar = () => {
    for (const cb of oyentes) cb(estado)
  }
  const motor = {
    estado: () => estado,
    posicionMs: () => pos,
    pausar: vi.fn(() => {
      estado.sonando = false
      publicar()
    }),
    reproducir: vi.fn(async (opciones?: { desdeMs?: number }) => {
      pos = opciones?.desdeMs ?? pos
      estado.sonando = true
      publicar()
    }),
    buscar: vi.fn((ms: number) => {
      pos = ms
    }),
    tiempoDeEvento: (ts: number) => (estado.sonando ? ts * velocidad : null),
    suscribir: (cb: (estado: EstadoMotor) => void) => {
      oyentes.add(cb)
      return () => {
        oyentes.delete(cb)
      }
    }
  }
  const l = letra([
    linea('a', 'Nube', null),
    pausa('p'),
    linea('b', 'Viento', null),
    linea('c', 'Sal', null)
  ])
  l.offset_ms = offset
  const alSalir = vi.fn()
  const hook = renderHook(() => {
    const [edicion, despachar] = useReducer(
      reducirEditor,
      estadoInicial({ letra: l, estilo: estiloPredeterminado() }, 'a')
    )
    const sync = useSincronizarAlRitmo({ edicion, despachar, motor, duracionMs: 30_000, alSalir })
    return { edicion, sync }
  })
  return {
    ...hook,
    motor,
    alSalir,
    terminar: () => {
      pos = 30_000
      estado.sonando = false
      publicar()
    }
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('cuenta tres segundos en silencio y permite cancelar sin marcas', () => {
  const { result, motor, alSalir } = montar()
  act(() => result.current.sync.entrar())
  expect(result.current.sync.cuentaAtras).toBe(3)
  act(() => vi.advanceTimersByTime(1000))
  expect(result.current.sync.cuentaAtras).toBe(2)
  act(() => result.current.sync.terminar())
  act(() => vi.advanceTimersByTime(2500))
  expect(result.current.edicion.sync.activo).toBe(false)
  expect(result.current.edicion.pasado).toHaveLength(0)
  expect(motor.reproducir).not.toHaveBeenCalled()
  expect(alSalir).toHaveBeenCalledOnce()
})

it.each([0.5, 1] as const)(
  'marca los mismos ms de audio a %s× y detecta el fin de letra',
  (velocidad) => {
    const { result, motor, terminar } = montar(velocidad, 250)
    act(() => result.current.sync.entrar())
    act(() => vi.advanceTimersByTime(3000))
    expect(motor.reproducir).toHaveBeenCalledExactlyOnceWith({ desdeMs: 0 })
    for (const t of [2000, 4000, 6000]) {
      act(() => result.current.sync.marcar(t / velocidad, 'teclado'))
      act(() => result.current.sync.soltar(t / velocidad + 100, 'teclado'))
    }
    expect(result.current.edicion.actual.letra.lineas.map((l) => l.inicio_ms)).toEqual([
      1750,
      null,
      3750,
      5750
    ])
    expect(result.current.edicion.actual.letra.lineas.every((l) => l.fin_ms === null)).toBe(true)
    expect(result.current.edicion.sync.siguiente).toBeNull()
    act(terminar)
    expect(result.current.edicion.sync.activo).toBe(false)
  }
)

it('mantiene para fijar fin, advierte si se pulsa pronto, rebobina y pausa al perder foco', () => {
  const { result, motor } = montar()
  act(() => result.current.sync.entrar())
  act(() => vi.advanceTimersByTime(3000))
  act(() => result.current.sync.marcar(2100, 'teclado'))
  act(() => result.current.sync.soltar(2700, 'teclado'))
  expect(result.current.edicion.actual.letra.lineas[0]?.fin_ms).toBe(2700)
  act(() => result.current.sync.marcar(2000, 'teclado'))
  expect(result.current.sync.pronto).toBe(true)
  act(() => vi.advanceTimersByTime(2000))
  expect(result.current.sync.pronto).toBe(false)
  act(() => result.current.sync.marcar(5200, 'teclado'))
  act(() => result.current.sync.deshacer())
  expect(motor.reproducir).toHaveBeenLastCalledWith({ desdeMs: 2200 })
  expect(result.current.edicion.sync.siguiente).toBe('b')
  act(() => window.dispatchEvent(new Event('blur')))
  expect(motor.estado().sonando).toBe(false)
  expect(result.current.edicion.sync.activo).toBe(true)
})

it('el reducer marca 1000 líneas sin superar 10 ms por marca en promedio', () => {
  const l = letra(Array.from({ length: 1000 }, (_, i) => linea(String(i), `Verso ${i}`, null)))
  let e = estadoInicial({ letra: l, estilo: estiloPredeterminado() }, '0')
  e = reducirEditor(e, { tipo: 'entrar_sync', desdeId: null })
  const desde = performance.now()
  for (let i = 0; i < 1000; i++) e = reducirEditor(e, { tipo: 'marcar', ms: i * 20, ahora: i * 20 })
  expect((performance.now() - desde) / 1000).toBeLessThan(10)
  expect(e.sync.siguiente).toBeNull()
})
