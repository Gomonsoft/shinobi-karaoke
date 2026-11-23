import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NavegacionContexto } from '../../navegacion/estado'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import type { Cancion } from '@shared/cancion'
import { apiPicosFalsa } from '../letra/fixturesPicos'
import { apiEditorFalsa, cancionSincronizadaLrclib } from './fixturesApi'
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

const ahora = '2026-11-21T10:00:00Z'

/** Borrador preparado por la app: letra de LRCLIB elegida sola, desfase corregido y fines de la preparación. */
function preparada(conRegistro = true): Cancion {
  const c = cancionSincronizadaLrclib()
  const letra = c.letra!
  letra.desfase_corregido_ms = 800
  letra.offset_ms = 800
  for (const l of letra.lineas) {
    if (l.tipo !== 'linea' || l.inicio_ms === null) continue
    l.fin_ms = l.inicio_ms + 2000
    if (l.id !== 'l3') l.origen_fin = 'preparacion'
  }
  if (conRegistro) {
    c.preparacion = {
      estado: 'lista_para_revisar',
      paso: null,
      origen: 'automatica',
      actualizado: ahora,
      busqueda: { resultado: 'elegida', candidatas: 2, motivo: null, ids: [] },
      eleccion: { por: 'app', fecha: ahora, lrclib_id: letra.lrclib_id },
      desfase_ms: 800,
      fines: { metodo: 'silencios', lineas: 5 },
      dudosas: 0,
      revisada: false
    }
  }
  return c
}

function montar(cancion: Cancion) {
  const falso = apiEditorFalsa({ cancion })
  window.shinobi = {
    ...falso.api,
    picos: apiPicosFalsa([])
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

it('F5-E1: un borrador preparado y sin revisar muestra el banner; [×] lo cierra y lo da por visto', async () => {
  const { llamadas } = montar(preparada())
  expect(await screen.findByText(/Shinobi Karaoke preparó esta canción/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))
  expect(screen.queryByText(/Shinobi Karaoke preparó esta canción/)).toBeNull()
  expect(llamadas.some((l) => l.metodo === 'biblioteca.marcarPreparacionRevisada')).toBe(true)
})

it('F5-E1: [Ver qué hicimos] abre «Funciones» con el foco en «Preparación automática»', async () => {
  montar(preparada())
  await screen.findByText(/Shinobi Karaoke preparó esta canción/)
  fireEvent.click(screen.getByRole('button', { name: 'Ver qué hicimos' }))
  const titulo = await screen.findByRole('heading', { name: 'Preparación automática' })
  await waitFor(() => expect(titulo).toHaveFocus())
})

it('F5-E1: ya revisada, no sale el banner', async () => {
  const c = preparada()
  c.preparacion!.revisada = true
  montar(c)
  await screen.findByRole('radio', { name: 'Funciones' })
  expect(screen.queryByText(/Shinobi Karaoke preparó esta canción/)).toBeNull()
})

it('F5-E4: sin registro de preparación no hay banner ni bloque', async () => {
  montar(preparada(false))
  fireEvent.click(await screen.findByRole('radio', { name: 'Funciones' }))
  expect(screen.queryByRole('heading', { name: 'Preparación automática' })).toBeNull()
  expect(screen.queryByText(/Shinobi Karaoke preparó esta canción/)).toBeNull()
})

it('F5-E2/E3: el bloque lista lo que sigue en pie y [Quitar esos fines] conserva el fin de una línea tocada', async () => {
  montar(preparada())
  fireEvent.click(await screen.findByRole('radio', { name: 'Funciones' }))
  const bloque = (await screen.findByRole('heading', { name: 'Preparación automática' })).closest(
    'section'
  ) as HTMLElement
  expect(within(bloque).getByText('· Letra de LRCLIB, coincidencia exacta.')).toBeVisible()
  expect(
    within(bloque).getByText('· Desfase corregido: toda la letra 0,8 s más tarde.')
  ).toBeVisible()
  expect(within(bloque).getByText('· Fin de 5 líneas ajustado con la voz.')).toBeVisible()
  fireEvent.click(within(bloque).getByRole('button', { name: 'Quitar esos fines' }))
  expect(await screen.findByText('5 líneas vuelven al fin automático.')).toBeVisible()
  // El renglón de fines desaparece (ya no queda ninguno en pie); el de desfase sigue.
  expect(screen.queryByRole('button', { name: 'Quitar esos fines' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Quitar la corrección' })).toBeVisible()
  // [Deshacer] devuelve los fines.
  fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
  expect(await screen.findByRole('button', { name: 'Quitar esos fines' })).toBeVisible()
})

it('[Ver otras candidatas] abre Letra en A', async () => {
  const { ir } = montar(preparada())
  fireEvent.click(await screen.findByRole('radio', { name: 'Funciones' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Ver otras candidatas' }))
  expect(ir).toHaveBeenCalledWith(expect.objectContaining({ paso: 'letra', buscarOtra: true }))
})
