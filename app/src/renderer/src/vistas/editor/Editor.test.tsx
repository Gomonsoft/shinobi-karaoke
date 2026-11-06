import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { linea, letra } from '@shared/__fixtures__'
import { NavegacionContexto } from '../../navegacion/estado'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import {
  apiEditorFalsa,
  cancionSeparando,
  cancionSincronizadaLrclib,
  cancionSinSincronizar
} from './fixturesApi'
import { Editor } from './Editor'

const motor = vi.hoisted(() => ({
  usarPista: vi.fn(async () => undefined),
  posicionMs: vi.fn(() => 4200),
  buscar: vi.fn(),
  pausar: vi.fn(),
  reproducir: vi.fn(async () => undefined),
  fijarVelocidad: vi.fn(),
  suscribir: vi.fn(() => () => undefined),
  estado: () => ({ sonando: false, duracionMs: 30_000 })
}))

vi.mock('../../karaoke/useMotorAudio', () => ({
  useMotorAudio: () => ({
    motor,
    estado: { sonando: false, pista: 'original', velocidad: 1, duracionMs: 30_000 }
  })
}))

function montar(cancion = cancionSinSincronizar()) {
  const falso = apiEditorFalsa({ cancion })
  window.shinobi = falso.api as unknown as typeof window.shinobi
  const ir = vi.fn()
  const utils = render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: cancion.id, paso: 'editor' }, ir }}
    >
      <Editor id={cancion.id} />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  return { ...falso, ...utils, ir }
}

afterEach(() => {
  vi.clearAllMocks()
  act(() => cerrarTodosLosToasts())
})

it('abre un borrador sin tiempos en Voz, selecciona la primera línea y enfoca Sincronizar', async () => {
  montar()
  const boton = await screen.findByRole('button', { name: 'Sincronizar al ritmo (S)' })
  expect(boton).toHaveFocus()
  expect(screen.getByRole('option', { name: /^Línea 1, sin sincronizar/ })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(screen.getByRole('separator', { name: 'pausa' })).toBeVisible()
  expect(motor.usarPista).toHaveBeenCalledExactlyOnceWith('voz')
})

it('activa Voz al terminar la separación sin cambiar lo que suena', async () => {
  const { api, emitirCambio } = montar(cancionSeparando())
  const voz = await screen.findByRole('radio', { name: 'Voz' })
  expect(voz).toHaveAttribute('aria-disabled', 'true')
  fireEvent.focus(voz)
  expect(screen.getByRole('tooltip')).toHaveTextContent(
    'Disponible cuando termine la separación (42 %)'
  )
  const resumen = (await api.biblioteca.listar!())[0]!
  act(() =>
    emitirCambio({
      ...resumen,
      pasos: {
        ...resumen.pasos!,
        separacion: { estado: 'completado', progreso: null, error: null }
      }
    })
  )
  expect(screen.getByRole('radio', { name: 'Voz' })).not.toHaveAttribute('aria-disabled')
  expect(motor.usarPista).toHaveBeenCalledExactlyOnceWith('original')
})

it('selecciona la primera línea pendiente desde el contador y guarda los tiempos mostrados con offset', async () => {
  const c = cancionSincronizadaLrclib()
  c.letra!.offset_ms = 250
  c.letra!.lineas[1]!.inicio_ms = null
  montar(c)
  const segunda = await screen.findByRole('option', { name: /^Línea 2, sin sincronizar/ })
  expect(segunda).toHaveFocus()
  expect(screen.getByRole('option', { name: /^Línea 1, 00:02.25/ })).toBeVisible()
  fireEvent.keyDown(segunda, { key: 'ArrowUp' })
  fireEvent.click(screen.getByRole('button', { name: '5/6 sincronizadas' }))
  expect(segunda).toHaveFocus()
})

it('Esc cierra el diálogo de atajos antes de volver a la Biblioteca', async () => {
  const { ir } = montar()
  const boton = await screen.findByRole('button', { name: /Sincronizar al ritmo/ })
  fireEvent.keyDown(boton, { key: 'F1' })
  expect(screen.getByRole('dialog', { name: 'Atajos de teclado' })).toBeVisible()
  fireEvent.keyDown(screen.getByRole('button', { name: 'Cerrar' }), { key: 'Escape' })
  expect(ir).not.toHaveBeenCalled()
  fireEvent.keyDown(boton, { key: 'Escape' })
  expect(ir).toHaveBeenCalledWith({ tipo: 'biblioteca' })
})

it('S entra en Sincronizar al ritmo con cuenta atrás y Esc la cancela sin marcar', async () => {
  const { ir } = montar()
  const boton = await screen.findByRole('button', { name: /Sincronizar al ritmo/ })
  await waitFor(() => expect(boton).toBeEnabled())
  fireEvent.keyDown(boton, { key: 's' })
  expect(await screen.findByRole('region', { name: 'Sincronizando al ritmo' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Deshacer (Retroceso)' })).toBeDisabled()
  expect(screen.getByRole('radio', { name: 'Estilo' })).toHaveAttribute('aria-disabled', 'true')
  fireEvent.keyDown(window, { key: 'Escape' })
  await waitFor(() =>
    expect(screen.queryByRole('region', { name: 'Sincronizando al ritmo' })).toBeNull()
  )
  expect(ir).not.toHaveBeenCalled()
  expect(motor.reproducir).not.toHaveBeenCalled()
})

it('mantiene menos de 100 opciones montadas para una letra de mil líneas', async () => {
  const cancion = cancionSincronizadaLrclib()
  cancion.letra = letra(
    Array.from({ length: 1000 }, (_, i) => linea(String(i), `Línea inventada ${i}`, i * 10))
  )
  montar(cancion)
  await screen.findByRole('listbox', { name: 'Líneas' })
  await waitFor(() => expect(screen.getAllByRole('option').length).toBeLessThan(100))
})

it('I aplica el desplazamiento, y deshacer restaura palabras descartadas por un ajuste', async () => {
  const c = cancionSincronizadaLrclib()
  const l = c.letra!
  l.offset_ms = 250
  l.lineas[0]!.palabras = [{ texto: 'Baila', inicio_ms: 2000, fin_ms: 4200 }]
  const { llamadas } = montar(c)
  const segunda = await screen.findByRole('option', { name: /^Línea 2,/ })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Escuchar al ajustar' }))
  fireEvent.click(segunda)
  fireEvent.keyDown(segunda, { key: 'i' })
  expect(screen.getByRole('option', { name: /^Línea 2, 00:04.20/ })).toBeVisible()
  await waitFor(
    () => {
      const llamada = llamadas.find((l) => l.metodo === 'letras.guardarTiempos')
      expect(llamada?.args[0]).toMatchObject({
        tiempos: expect.arrayContaining([expect.objectContaining({ id: 'l2', inicio_ms: 3950 })])
      })
    },
    { timeout: 2500 }
  )
  expect(screen.getByText(/La línea 1 ya no se resaltará palabra a palabra/)).toBeVisible()
  const aviso = screen
    .getByText(/La línea 1 ya no se resaltará palabra a palabra/)
    .closest('[data-testid=toast]')!
  fireEvent.click(aviso.querySelector('button')!)
  expect(screen.getByRole('option', { name: /^Línea 2, 00:05.25/ })).toBeVisible()
})

it('recarga una visita desactualizada en pausa, vacía historial y no reintenta', async () => {
  const { fallar, llamadas } = montar(cancionSincronizadaLrclib())
  const primero = await screen.findByRole('option', { name: /^Línea 1,/ })
  fallar('letras.guardarTiempos', 'LETRA_DESACTUALIZADA')
  fireEvent.keyDown(primero, { key: '.' })
  // Esperar a que React aplique el cambio: en la CI de Linux la aserción
  // síncrona se adelantaba al render.
  await waitFor(() => expect(screen.getByRole('button', { name: /^Deshacer/ })).toBeEnabled())
  await screen.findByText(/La letra ha cambiado fuera del editor/, {}, { timeout: 2500 })
  expect(screen.getByRole('button', { name: /^Deshacer/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: /^Rehacer/ })).toBeDisabled()
  expect(screen.getByRole('option', { name: /^Línea 1, 00:02.00/ })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(motor.pausar).toHaveBeenCalledOnce()
  expect(motor.buscar).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.getByText('Guardado', { exact: true })).toBeVisible())
  expect(llamadas.filter((l) => l.metodo === 'letras.guardarTiempos')).toHaveLength(1)
  expect(llamadas.filter((l) => l.metodo === 'letras.abrirEdicion')).toHaveLength(2)
})
