import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NavegacionContexto } from '../../navegacion/estado'
import { ExportacionContexto, type ContextoExportacion } from '../../exportacion/contexto'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { apiEditorFalsa, cancionSeparando, cancionSincronizadaLrclib } from './fixturesApi'
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

function montar(cancion = cancionSincronizadaLrclib()) {
  const falso = apiEditorFalsa({ cancion })
  window.shinobi = falso.api as unknown as typeof window.shinobi
  const abrir = vi.fn()
  const valor: ContextoExportacion = {
    exportaciones: [],
    activaDe: () => undefined,
    abrir,
    cerrar: vi.fn(),
    iniciada: vi.fn(),
    pedirCancelar: vi.fn()
  }
  render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: cancion.id, paso: 'editor' }, ir: vi.fn() }}
    >
      <ExportacionContexto.Provider value={valor}>
        <Editor id={cancion.id} />
      </ExportacionContexto.Provider>
    </NavegacionContexto.Provider>
  )
  return { abrir, cancion }
}

const abrirMenu = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Más acciones del editor' }))

afterEach(() => {
  vi.clearAllMocks()
  act(() => cerrarTodosLosToasts())
})

it('Ctrl/Cmd + E pausa el audio, vacía el guardado y abre el diálogo de exportación (EX1)', async () => {
  const { abrir, cancion } = montar()
  await screen.findByRole('button', { name: 'Sincronizar al ritmo (S)' })
  fireEvent.keyDown(window, { key: 'e', ctrlKey: true })
  await waitFor(() =>
    expect(abrir).toHaveBeenCalledWith({ cancionId: cancion.id, temaBorrador: false })
  )
  expect(motor.pausar).toHaveBeenCalled()
})

it('el ⋯ ofrece «Exportar video… (Ctrl/Cmd + E)» entre los atajos y volver a borrador', async () => {
  const { abrir, cancion } = montar()
  await screen.findByRole('button', { name: 'Sincronizar al ritmo (S)' })
  abrirMenu()
  const items = screen.getAllByRole('menuitem').map((i) => i.textContent)
  expect(items.indexOf('Exportar video… (Ctrl/Cmd + E)')).toBe(
    items.indexOf('Atajos de teclado (F1)') + 1
  )
  fireEvent.click(screen.getByRole('menuitem', { name: 'Exportar video… (Ctrl/Cmd + E)' }))
  await waitFor(() =>
    expect(abrir).toHaveBeenCalledWith({ cancionId: cancion.id, temaBorrador: false })
  )
})

it('con la separación sin completar el ítem está aria-disabled y Ctrl/Cmd + E no hace nada (EX2)', async () => {
  const { abrir } = montar(cancionSeparando())
  await screen.findByRole('button', { name: 'Sincronizar al ritmo (S)' })
  abrirMenu()
  const item = screen.getByRole('menuitem', { name: /Exportar video…/ })
  expect(item).toHaveAttribute('aria-disabled', 'true')
  fireEvent.keyDown(item, { key: 'Escape' })
  fireEvent.keyDown(window, { key: 'e', ctrlKey: true })
  await act(async () => undefined)
  expect(abrir).not.toHaveBeenCalled()
})

it('el diálogo de atajos incluye Ctrl/Cmd + E (EX7)', async () => {
  montar()
  await screen.findByRole('button', { name: 'Sincronizar al ritmo (S)' })
  fireEvent.keyDown(window, { key: 'F1' })
  expect(await screen.findByRole('rowheader', { name: 'Ctrl/Cmd + E' })).toBeInTheDocument()
})
