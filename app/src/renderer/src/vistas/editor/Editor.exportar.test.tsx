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
    lotes: [],
    abrirLote: vi.fn(),
    verLote: vi.fn(),
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
  await screen.findByRole('button', { name: 'Sincronizar al ritmo' })
  // Los atajos se registran en un efecto pasivo (useAtajosEditor): bajo carga caen después de que
  // aparezca el botón y la tecla se perdía (falló en el CI de Windows y de macOS).
  await act(async () => {})
  await waitFor(() => {
    fireEvent.keyDown(window, { key: 'e', ctrlKey: true })
    expect(abrir).toHaveBeenCalledWith({ cancionId: cancion.id, temaBorrador: false })
  })
  expect(motor.pausar).toHaveBeenCalled()
})

const abrirFunciones = () => fireEvent.click(screen.getByRole('radio', { name: 'Funciones' }))

it('la pestaña Funciones ofrece «Exportar video…» y el ⋯ ya no (EX1, E8-14, E8-16)', async () => {
  const { abrir, cancion } = montar()
  await screen.findByRole('button', { name: 'Sincronizar al ritmo' })
  abrirMenu()
  expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
    'Atajos de teclado (F1)',
    'Restablecer distribución de paneles'
  ])
  fireEvent.keyDown(screen.getByRole('menuitem', { name: /Atajos/ }), { key: 'Escape' })
  abrirFunciones()
  fireEvent.click(screen.getByRole('button', { name: 'Exportar video…' }))
  await waitFor(() =>
    expect(abrir).toHaveBeenCalledWith({ cancionId: cancion.id, temaBorrador: false })
  )
})

it('con la separación sin completar el botón está aria-disabled, con su motivo visible, y Ctrl/Cmd + E no hace nada (EX2, E8-15)', async () => {
  const { abrir } = montar(cancionSeparando())
  await screen.findByRole('button', { name: 'Sincronizar al ritmo' })
  abrirFunciones()
  const boton = screen.getByRole('button', { name: 'Exportar video…' })
  expect(boton).toHaveAttribute('aria-disabled', 'true')
  expect(boton).toHaveAccessibleDescription('Podrás exportar cuando termine la separación.')
  fireEvent.click(boton)
  fireEvent.keyDown(window, { key: 'e', ctrlKey: true })
  await act(async () => undefined)
  expect(abrir).not.toHaveBeenCalled()
})

it('el diálogo de atajos incluye Ctrl/Cmd + E (EX7)', async () => {
  montar()
  await screen.findByRole('button', { name: 'Sincronizar al ritmo' })
  fireEvent.keyDown(window, { key: 'F1' })
  expect(await screen.findByRole('rowheader', { name: 'Ctrl/Cmd + E' })).toBeInTheDocument()
})

it('«Exportar la letra» vacía el guardado y exporta con la misma función que la Biblioteca (F9-E1)', async () => {
  const { cancion } = montar()
  const exportarLrc = vi.fn(() => Promise.resolve(null))
  Object.assign((window as unknown as { shinobi: { letras: object } }).shinobi.letras, {
    exportarLrc
  })
  await screen.findByRole('button', { name: 'Sincronizar al ritmo' })
  abrirFunciones()
  fireEvent.click(screen.getByRole('button', { name: 'Exportar la letra (.lrc)…' }))
  await waitFor(() => expect(exportarLrc).toHaveBeenCalledWith(cancion.id))
})

it('sin líneas con inicio «Exportar la letra» está aria-disabled con su motivo visible (F9-E2)', async () => {
  const c = cancionSincronizadaLrclib()
  montar({
    ...c,
    letra: {
      ...c.letra!,
      lineas: c.letra!.lineas.map((l) => ({ ...l, inicio_ms: null, fin_ms: null }))
    }
  } as never)
  await screen.findByRole('button', { name: 'Sincronizar al ritmo' })
  abrirFunciones()
  const boton = screen.getByRole('button', { name: 'Exportar la letra (.lrc)…' })
  expect(boton).toHaveAttribute('aria-disabled', 'true')
  expect(boton).toHaveAccessibleDescription('Esta canción aún no tiene ninguna línea sincronizada.')
})
