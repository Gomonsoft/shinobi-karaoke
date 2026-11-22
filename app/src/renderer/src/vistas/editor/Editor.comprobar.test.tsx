import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NavegacionContexto } from '../../navegacion/estado'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import type { Cancion } from '@shared/cancion'
import { apiPicosFalsa } from '../letra/fixturesPicos'
import { apiEditorFalsa, cancionLista, cancionSincronizadaLrclib } from './fixturesApi'
import { olvidarPicosBase } from './picosBase'
import { Editor } from './Editor'

const motor = vi.hoisted(() => ({
  usarPista: vi.fn(async () => undefined),
  posicionMs: vi.fn(() => 4200),
  buscar: vi.fn(),
  pausar: vi.fn(),
  liberarAudio: vi.fn(),
  reproducir: vi.fn(async () => undefined),
  fijarVelocidad: vi.fn(),
  fijarBucle: vi.fn(() => true),
  suscribir: vi.fn(() => () => undefined),
  estado: vi.fn(() => ({ sonando: false, duracionMs: 30_000, pista: 'original', velocidad: 1 }))
}))

vi.mock('../../karaoke/useMotorAudio', () => ({
  useMotorAudio: () => ({
    motor,
    estado: { sonando: false, pista: 'original', velocidad: 1, duracionMs: 30_000 }
  })
}))

/** Inicios de la letra de `cancionSincronizadaLrclib` (sin la pausa). */
const INICIOS = [2000, 5000, 8000, 15_000, 19_000, 23_000]
/** La voz canta 2 s desde cada inicio, desplazada `desfaseMs` respecto a la letra. */
const cantosConDesfase = (desfaseMs: number): [number, number][] =>
  INICIOS.map((t) => [t + desfaseMs, t + desfaseMs + 2000])

/** Cada línea acaba 2 s después de su inicio, lo que dura el canto de la voz. */
function conFines(cancion: Cancion): Cancion {
  for (const l of cancion.letra!.lineas)
    if (l.tipo === 'linea' && l.inicio_ms !== null) l.fin_ms = l.inicio_ms + 2000
  return cancion
}

function montar(
  cancion: Cancion,
  cantos: [number, number][],
  estadoPicos: 'lista' | 'generando' | 'no_disponible' = 'lista'
) {
  const falso = apiEditorFalsa({ cancion: conFines(cancion) })
  window.shinobi = {
    ...falso.api,
    picos: apiPicosFalsa(cantos, estadoPicos)
  } as unknown as typeof window.shinobi
  const ir = vi.fn()
  render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: cancion.id, paso: 'editor' }, ir }}
    >
      <Editor id={cancion.id} />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  return { ...falso, ir }
}

beforeEach(() => olvidarPicosBase())
afterEach(() => {
  vi.clearAllMocks()
  act(() => cerrarTodosLosToasts())
})

const abrirFunciones = async () => {
  fireEvent.click(await screen.findByRole('radio', { name: 'Funciones' }))
  return screen.findByRole('button', { name: 'Comprobar la letra con la voz…' })
}

it('F4-E3/E5: corregir el desfase es un paso: guarda offset y desfase sin tocar los tiempos y se deshace', async () => {
  const cancion = cancionSincronizadaLrclib()
  const antes = structuredClone(conFines(cancion).letra!.lineas)
  const { llamadas } = montar(cancion, cantosConDesfase(800))
  fireEvent.click(await abrirFunciones())
  const dialogo = await screen.findByRole('dialog', { name: '¿Corregir el desfase de la letra?' })
  expect(dialogo).toHaveTextContent('Toda la letra va 0,8 s adelantada respecto a la voz.')
  expect(dialogo).toHaveTextContent('Moveremos sus 6 líneas 0,8 s más tarde.')
  fireEvent.click(within(dialogo).getByRole('button', { name: 'Corregir el desfase' }))
  expect(
    await screen.findByText(/Desfase corregido: toda la letra 0,8 s más tarde\./)
  ).toBeVisible()
  expect(screen.getAllByText('Letra movida 0,8 s más tarde.').length).toBeGreaterThan(0)
  await waitFor(
    () => {
      const l = llamadas.find((x) => x.metodo === 'letras.guardarTiempos')
      expect(l?.args[0]).toMatchObject({ offset_ms: 800, desfase_corregido_ms: 800 })
      const tiempos = (l!.args[0] as { tiempos: { id: string; inicio_ms: number | null }[] })
        .tiempos
      expect(tiempos.map((t) => t.inicio_ms)).toEqual(antes.map((e) => e.inicio_ms))
    },
    { timeout: 2500 }
  )
  // Un solo paso de deshacer: quita la corrección y la línea «Desfase corregido».
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
  await waitFor(() => expect(screen.queryByText(/Desfase corregido/)).toBeNull())
})

it('F4-E5: Quitar la corrección resta el desfase en un paso y avisa con su toast', async () => {
  const cancion = cancionSincronizadaLrclib()
  cancion.letra!.offset_ms = 800
  cancion.letra!.desfase_corregido_ms = 800
  const { llamadas } = montar(cancion, cantosConDesfase(0))
  await abrirFunciones()
  expect(
    await screen.findByText(/Desfase corregido: toda la letra 0,8 s más tarde\./)
  ).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Quitar la corrección' }))
  expect(
    await screen.findAllByText('Corrección quitada: la letra vuelve a sus tiempos anteriores.')
  ).not.toHaveLength(0)
  expect(screen.queryByText(/Desfase corregido:/)).toBeNull()
  await waitFor(
    () => {
      const l = llamadas.find((x) => x.metodo === 'letras.guardarTiempos')
      expect(l?.args[0]).toMatchObject({ offset_ms: 0, desfase_corregido_ms: null })
    },
    { timeout: 2500 }
  )
})

it('F4-E2: una letra que coincide solo muestra el toast y no escribe nada', async () => {
  const { llamadas } = montar(cancionSincronizadaLrclib(), cantosConDesfase(0))
  fireEvent.click(await abrirFunciones())
  expect(await screen.findAllByText('La letra coincide con la voz.')).not.toHaveLength(0)
  expect(screen.queryByRole('dialog')).toBeNull()
  await act(async () => new Promise((r) => setTimeout(r, 1300)))
  expect(llamadas.filter((l) => l.metodo === 'letras.guardarTiempos')).toHaveLength(0)
})

it('F4-E6: una letra que no encaja lista los tramos; [Ir] lleva el cabezal y cerrar no cambia nada', async () => {
  // La voz canta donde la letra no tiene nada.
  const lejos: [number, number][] = [0, 1, 2, 3, 4].map((i) => [26_000 + i * 600, 26_400 + i * 600])
  const { llamadas, ir } = montar(cancionSincronizadaLrclib(), lejos)
  fireEvent.click(await abrirFunciones())
  const dialogo = await screen.findByRole('dialog', { name: 'La letra no encaja con la voz' })
  expect(dialogo).toHaveTextContent('No se puede arreglar moviendo toda la letra.')
  const irA = within(dialogo).getAllByRole('button', { name: /^Ir a / })[0]!
  fireEvent.click(irA)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(motor.buscar).toHaveBeenCalledWith(expect.any(Number))
  expect(llamadas.filter((l) => l.metodo === 'letras.guardarTiempos')).toHaveLength(0)
  // [Buscar otra letra] abre la vista Letra.
  fireEvent.click(await abrirFunciones())
  const otra = await screen.findByRole('dialog', { name: 'La letra no encaja con la voz' })
  fireEvent.click(within(otra).getByRole('button', { name: 'Buscar otra letra' }))
  expect(ir).toHaveBeenCalledWith({
    tipo: 'cancion',
    id: expect.any(String),
    paso: 'letra',
    buscarOtra: true
  })
})

it('F4-E7: al abrir un borrador desfasado el banner ofrece corregir; [Ahora no] lo oculta', async () => {
  montar(cancionSincronizadaLrclib(), cantosConDesfase(800))
  expect(await screen.findByText('Esta letra va 0,8 s adelantada respecto a la voz.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }))
  expect(screen.queryByText(/Esta letra va 0,8 s adelantada/)).toBeNull()
})

it('F4-E7: en una canción Lista no sale el banner', async () => {
  montar(cancionLista(), cantosConDesfase(800))
  await screen.findByRole('radio', { name: 'Funciones' })
  await act(async () => new Promise((r) => setTimeout(r, 300)))
  expect(screen.queryByText(/Esta letra va/)).toBeNull()
})

it('F4-E7: una letra que no encaja saca su banner con [Ver por qué]', async () => {
  const lejos: [number, number][] = [0, 1, 2, 3, 4].map((i) => [26_000 + i * 600, 26_400 + i * 600])
  montar(cancionSincronizadaLrclib(), lejos)
  expect(await screen.findByText(/Esta letra no encaja con la voz/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Ver por qué' }))
  expect(await screen.findByRole('dialog', { name: 'La letra no encaja con la voz' })).toBeVisible()
})

it('F4-E1: con la voz sin separar o los picos sin preparar el botón es aria-disabled con su motivo', async () => {
  montar(cancionSincronizadaLrclib(), cantosConDesfase(0), 'generando')
  const boton = await abrirFunciones()
  await waitFor(() => expect(boton).toHaveAttribute('aria-disabled', 'true'))
  expect(
    screen.getAllByText('La forma de onda de la voz (se está preparando…)').length
  ).toBeGreaterThan(0)
})
