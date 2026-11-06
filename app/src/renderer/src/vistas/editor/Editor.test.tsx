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
  fijarVelocidad: vi.fn()
}))

vi.mock('../../karaoke/useMotorAudio', () => ({
  useMotorAudio: () => ({
    motor,
    estado: { sonando: false, pista: 'original', velocidad: 1, duracionMs: 30_000 }
  })
}))

function montar(cancion = cancionSinSincronizar()) {
  const falso = apiEditorFalsa({ cancion })
  window.shinobi = falso.api as typeof window.shinobi
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

it('mantiene menos de 100 opciones montadas para una letra de mil líneas', async () => {
  const cancion = cancionSincronizadaLrclib()
  cancion.letra = letra(
    Array.from({ length: 1000 }, (_, i) => linea(String(i), `Línea inventada ${i}`, i * 10))
  )
  montar(cancion)
  await screen.findByRole('listbox', { name: 'Líneas' })
  await waitFor(() => expect(screen.getAllByRole('option').length).toBeLessThan(100))
})
