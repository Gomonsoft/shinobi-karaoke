import { act, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { NavegacionContexto } from '../../navegacion/estado'
import { apiEditorFalsa, cancionSincronizadaLrclib } from './fixturesApi'
import { Editor } from './Editor'

/** Motor falso con estado y suscriptores reales: el editor ve cuándo suena y cuándo se pausa. */
const m = vi.hoisted(() => {
  const estado = {
    sonando: false,
    duracionMs: 30_000,
    pista: 'original',
    velocidad: 1,
    cargando: false,
    cargandoPista: null,
    error: null,
    volumen: 1,
    tonoConservado: true
  }
  const oyentes = new Set<(e: typeof estado) => void>()
  const motor = {
    pos: 0,
    usarPista: vi.fn(async () => undefined),
    posicionMs: () => motor.pos,
    tiempoDeEvento: () => motor.pos,
    buscar: vi.fn((ms: number) => {
      motor.pos = ms
    }),
    pausar: vi.fn(),
    liberarAudio: vi.fn(),
    reproducir: vi.fn(async () => undefined),
    fijarVelocidad: vi.fn(),
    fijarBucle: vi.fn(() => true),
    fijarTramoConTono: vi.fn(),
    suscribir: (cb: (e: typeof estado) => void) => {
      oyentes.add(cb)
      return () => oyentes.delete(cb)
    },
    estado: () => estado,
    /** Cambia `sonando` y avisa, como el motor real. */
    sonar(sonando: boolean) {
      estado.sonando = sonando
      oyentes.forEach((cb) => cb({ ...estado }))
    }
  }
  return motor
})

vi.mock('../../karaoke/useMotorAudio', () => ({
  useMotorAudio: () => {
    const [estado, fijar] = useState(m.estado())
    useEffect(() => {
      const baja = m.suscribir((e) => fijar({ ...e }))
      return () => void baja()
    }, [])
    return { motor: m, estado }
  }
}))

// La vista previa se sustituye por una sonda con lo que el editor le pide.
vi.mock('../../karaoke/PantallaLetra', () => ({
  PantallaLetra: (p: { tiempoFijoMs?: number; etiqueta?: string; reproduciendo: boolean }) => (
    <div
      data-testid="previa"
      data-fijo={p.tiempoFijoMs ?? ''}
      data-etiqueta={p.etiqueta ?? ''}
      data-reproduciendo={String(p.reproduciendo)}
    />
  )
}))

async function montar() {
  const cancion = cancionSincronizadaLrclib()
  window.shinobi = apiEditorFalsa({ cancion }).api as unknown as typeof window.shinobi
  render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: cancion.id, paso: 'editor' }, ir: vi.fn() }}
    >
      <Editor id={cancion.id} />
    </NavegacionContexto.Provider>
  )
  await screen.findByRole('option', { name: /^Línea 1,/ })
  await act(async () => {})
}

const previa = () => screen.getByTestId('previa')
const fila = (n: number) => screen.getByRole('option', { name: new RegExp(`^Línea ${n},`) })
function sonar(sonando: boolean) {
  act(() => m.sonar(sonando))
}

afterEach(() => {
  m.pos = 0
  m.sonar(false)
  vi.clearAllMocks()
})

it('al entrar muestra la línea seleccionada con su píldora (I2-10)', async () => {
  await montar()
  expect(previa()).toHaveAttribute('data-fijo', '')
  expect(previa()).toHaveAttribute('data-etiqueta', 'Línea 1 (en pausa)')
})

it('pausar lejos de la línea seleccionada muestra el cabezal; la selección no se mueve (I2-1, I2-6)', async () => {
  await montar()
  fireEvent.click(fila(1))
  sonar(true)
  m.pos = 8500
  sonar(false)
  expect(previa()).toHaveAttribute('data-fijo', '8500')
  expect(previa()).toHaveAttribute('data-etiqueta', '')
  expect(fila(1)).toHaveAttribute('aria-selected', 'true')
  // La línea 3 (8000 a 13000) suena en el cabezal: lleva el ▶ y solo ella.
  expect(fila(3)).toHaveAttribute('aria-current', 'true')
  expect(fila(1)).not.toHaveAttribute('aria-current')
})

it('con el cabezal en un hueco ninguna fila lleva ▶ (I2-2)', async () => {
  await montar()
  sonar(true)
  m.pos = 14_000
  sonar(false)
  expect(previa()).toHaveAttribute('data-fijo', '14000')
  expect(
    screen.queryAllByRole('option').filter((o) => o.hasAttribute('aria-current'))
  ).toHaveLength(0)
})

it('seleccionar en pausa vuelve a la línea; buscar vuelve al cabezal; clic en la seleccionada, a la línea (I2-3, I2-4)', async () => {
  await montar()
  sonar(true)
  m.pos = 14_000
  sonar(false)
  fireEvent.click(fila(5))
  expect(previa()).toHaveAttribute('data-etiqueta', 'Línea 5 (en pausa)')
  expect(m.pos).toBe(14_000)
  // Buscar con la barra del transporte: modo Cabezal en la posición nueva.
  const barra = screen.getByRole('slider', { name: 'Tiempo de reproducción' })
  fireEvent.change(barra, { target: { value: '9000' } })
  expect(previa()).toHaveAttribute('data-fijo', '9000')
  expect(previa()).toHaveAttribute('data-etiqueta', '')
  // Clic en la línea ya seleccionada: modo Línea sin tocar el cabezal.
  fireEvent.click(fila(5))
  expect(previa()).toHaveAttribute('data-etiqueta', 'Línea 5 (en pausa)')
  expect(m.pos).toBe(9000)
})

it('seleccionar una línea mientras suena no cambia la vista previa; al pausar manda el cabezal', async () => {
  await montar()
  sonar(true)
  fireEvent.click(fila(4))
  expect(previa()).toHaveAttribute('data-reproduciendo', 'true')
  expect(previa()).toHaveAttribute('data-etiqueta', '')
  m.pos = 6000
  sonar(false)
  expect(previa()).toHaveAttribute('data-fijo', '6000')
  expect(fila(4)).toHaveAttribute('aria-selected', 'true')
})
