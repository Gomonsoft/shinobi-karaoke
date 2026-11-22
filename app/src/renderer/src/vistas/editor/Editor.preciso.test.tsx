import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NavegacionContexto } from '../../navegacion/estado'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import { apiEditorFalsa, cancionSincronizadaLrclib } from './fixturesApi'
import { Editor } from './Editor'

const motor = vi.hoisted(() => {
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
  return {
    usarPista: vi.fn(async () => undefined),
    posicionMs: vi.fn(() => 4200),
    tiempoDeEvento: vi.fn(() => 4200),
    buscar: vi.fn(),
    pausar: vi.fn(),
    liberarAudio: vi.fn(),
    reproducir: vi.fn(async () => undefined),
    fijarVelocidad: vi.fn(),
    fijarBucle: vi.fn(() => true),
    fijarTramoConTono: vi.fn(),
    suscribir: vi.fn(() => () => undefined),
    estado: vi.fn(() => estado)
  }
})

vi.mock('../../karaoke/useMotorAudio', () => ({
  useMotorAudio: () => ({
    motor,
    estado: { sonando: false, pista: 'original', velocidad: 1, duracionMs: 30_000 }
  })
}))

function montar() {
  const cancion = cancionSincronizadaLrclib()
  const falso = apiEditorFalsa({ cancion })
  window.shinobi = falso.api as unknown as typeof window.shinobi
  render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: cancion.id, paso: 'editor' }, ir: vi.fn() }}
    >
      <Editor id={cancion.id} />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  return falso
}

afterEach(() => {
  vi.clearAllMocks()
  act(() => cerrarTodosLosToasts())
})

it('P abre el editor preciso de la línea seleccionada, bloquea sus controles y Esc lo cierra', async () => {
  montar()
  const primera = await screen.findByRole('option', { name: /^Línea 1,/ })
  await act(async () => {})
  fireEvent.click(primera)
  fireEvent.keyDown(primera, { key: 'p' })
  const ventana = await screen.findByRole('dialog', { name: /Editor preciso · Línea 1 de/ })
  expect(ventana).toBeVisible()
  // La línea abierta no deja editar sus tiempos desde el panel (P16).
  const panel = screen.getByRole('region', { name: 'Ajuste de sincronía' })
  expect(within(panel).getByRole('textbox', { name: 'Inicio' })).toBeDisabled()
  fireEvent.keyDown(primera, { key: 'i' })
  expect(
    screen.getAllByText('Esta línea está abierta en el editor preciso.').length
  ).toBeGreaterThan(0)
  fireEvent.keyDown(document.activeElement ?? ventana, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog', { name: /Editor preciso/ })).toBeNull())
})

it('P en una línea sin inicio muestra el motivo en lugar de abrir la ventana (P1)', async () => {
  const cancion = cancionSincronizadaLrclib()
  cancion.letra!.lineas[1]!.inicio_ms = null
  const falso = apiEditorFalsa({ cancion })
  window.shinobi = falso.api as unknown as typeof window.shinobi
  render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: cancion.id, paso: 'editor' }, ir: vi.fn() }}
    >
      <Editor id={cancion.id} />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  const segunda = await screen.findByRole('option', { name: /^Línea 2,/ })
  await act(async () => {})
  fireEvent.click(segunda)
  fireEvent.keyDown(segunda, { key: 'p' })
  expect(await screen.findAllByText('Fija primero el inicio de esta línea.')).not.toHaveLength(0)
  expect(screen.queryByRole('dialog', { name: /Editor preciso/ })).toBeNull()
})
