import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NavegacionContexto } from '../../navegacion/estado'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import { apiEditorFalsa, cancionConReparto } from './fixturesApi'
import { Editor } from './Editor'

const motor = vi.hoisted(() => ({
  usarPista: vi.fn(async () => undefined),
  posicionMs: vi.fn(() => 0),
  buscar: vi.fn(),
  pausar: vi.fn(),
  liberarAudio: vi.fn(),
  reproducir: vi.fn(async () => undefined),
  fijarVelocidad: vi.fn(),
  fijarBucle: vi.fn(() => true),
  prepararCoros: vi.fn(async () => true),
  suscribir: vi.fn(() => () => undefined),
  estado: vi.fn(() => ({ sonando: false, duracionMs: 30_000, pista: 'original', velocidad: 1 }))
}))
vi.mock('../../karaoke/useMotorAudio', () => ({
  useMotorAudio: () => ({
    motor,
    estado: { sonando: false, pista: 'original', velocidad: 1, duracionMs: 30_000 }
  })
}))

/** Dúo con voces a la vez: Ana de 2 a 6 s y Luis de 5 a 8 s (la fila 2 empieza durante la 1). */
function conSolapes() {
  const c = cancionConReparto()
  const [d1, d2] = c.letra!.lineas
  d1!.fin_ms = 6000
  d2!.fin_ms = 8000
  return c
}
function montar(cancion = conSolapes()) {
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
const filas = () => screen.getAllByRole('option')

it('C1S-E2: la fila que empieza durante otra lleva el icono de solape con su aviso', async () => {
  montar()
  await screen.findByRole('listbox', { name: 'Líneas' })
  expect(filas()[1]!.getAttribute('aria-label')).toContain('suena a la vez que la línea 1')
  expect(filas()[0]!.getAttribute('aria-label')).not.toContain('a la vez')
  expect(filas()[2]!.getAttribute('aria-label')).not.toContain('a la vez')
  // Las dos regiones se ven completas, cada una en su carril.
  expect(screen.getByRole('button', { name: /^Cruza el faro/ })).toBeVisible()
  expect(screen.getByRole('button', { name: /^Responde el viento/ })).toBeVisible()
})

it('C1S-E3: pasar la línea de Luis a Ana se rechaza por menú, Alt + 1 y Alt + ↑, y se explica', async () => {
  montar()
  await screen.findByRole('listbox', { name: 'Líneas' })
  fireEvent.click(filas()[1]!)
  fireEvent.keyDown(filas()[1]!, { key: 'c', code: 'KeyC' })
  const menu = await screen.findByRole('menu', { name: '¿Quién canta?' })
  const ana = within(menu).getByRole('menuitemradio', { name: /Cantante 1/ })
  expect(ana).toHaveAttribute('aria-disabled', 'true')
  expect(within(menu).getByText('No puede ser de Ana: se solapa con su línea 1.')).toBeVisible()
  fireEvent.click(ana)
  expect(screen.getByRole('menu')).toBeInTheDocument() // no se eligió
  fireEvent.keyDown(menu, { key: 'Escape' })

  fireEvent.keyDown(filas()[1]!, { key: '1', code: 'Digit1', altKey: true })
  fireEvent.keyDown(filas()[1]!, { key: 'ArrowUp', altKey: true })
  expect(filas()[1]!.getAttribute('aria-label')).toContain('Canta: Luis')
  expect(
    screen.getAllByText('No puede ser de Ana: se solapa con su línea 1.').length
  ).toBeGreaterThan(0)
})

it('un tirador de fin solo respeta a la siguiente línea que choca (C1S-E1)', async () => {
  montar()
  await screen.findByRole('listbox', { name: 'Líneas' })
  fireEvent.click(filas()[0]!)
  const fin = await screen.findByRole('slider', { name: /Fin de la línea/ })
  // La siguiente que choca con Ana es «Todos» (8 s), no la de Luis (5 s).
  expect(Number(fin.getAttribute('aria-valuemax'))).toBe(8001)
})

it('C1S-E7: con solapes y «Todas en un bloque» sale la nota con «Ver en zonas», que pasa a zonas en un paso', async () => {
  const c = conSolapes()
  c.estilo.pantalla = { lineas: 3, pasadas: 1, transicion: 'desplazamiento', zonas: 'una' } as never
  montar(c)
  await screen.findByRole('listbox', { name: 'Líneas' })
  fireEvent.click(screen.getByRole('radio', { name: /^Estilo/ }))
  const nota = await screen.findByText(/Esta canción tiene voces a la vez/)
  expect(nota).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Ver en zonas' }))
  expect(screen.queryByText(/Esta canción tiene voces a la vez/)).toBeNull()
  expect(screen.getByRole('radio', { name: /Cada una en su zona/ })).toBeChecked()
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
  expect(await screen.findByText(/Esta canción tiene voces a la vez/)).toBeVisible()
})

it('C1S-E7: sin solapes, o con zonas, la nota no aparece', async () => {
  const c = cancionConReparto()
  c.estilo.pantalla = { lineas: 3, pasadas: 1, transicion: 'desplazamiento', zonas: 'una' } as never
  montar(c)
  await screen.findByRole('listbox', { name: 'Líneas' })
  fireEvent.click(screen.getByRole('radio', { name: /^Estilo/ }))
  await screen.findByRole('radio', { name: /Todas en un bloque/ })
  expect(screen.queryByText(/Esta canción tiene voces a la vez/)).toBeNull()
})
