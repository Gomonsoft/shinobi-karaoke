import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NavegacionContexto } from '../../navegacion/estado'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { apiEditorFalsa, cancionConCoros, cancionConReparto, cancionLista } from './fixturesApi'
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

function montar(cancion = cancionConReparto()) {
  const falso = apiEditorFalsa({ cancion })
  window.shinobi = falso.api as unknown as typeof window.shinobi
  const ir = vi.fn()
  const utils = render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: cancion.id, paso: 'editor' }, ir }}
    >
      <Editor id={cancion.id} />
    </NavegacionContexto.Provider>
  )
  return { ...falso, ...utils, ir }
}

afterEach(() => {
  vi.clearAllMocks()
  act(() => cerrarTodosLosToasts())
})

const filas = () => screen.getAllByRole('option')
const guardados = (llamadas: { metodo: string; args: unknown[] }[]) =>
  llamadas.filter((l) => l.metodo === 'letras.guardarTiempos')

it('una canción de un solo cantante se ve como en 0.2.2: sin chips, sin menú y sin fila «Canta»', async () => {
  montar(cancionLista())
  await screen.findByRole('listbox', { name: 'Líneas' })
  expect(document.querySelector('[data-chip-parte]')).toBeNull()
  expect(screen.queryByText('Canta')).toBeNull()
  expect(filas()[0]!.getAttribute('aria-label')).not.toMatch(/Canta:/)
  // C abre el menú también aquí (un cantante: «Cantante 1», «Coro» y «Añadir cantante»).
  fireEvent.keyDown(filas()[0]!, { key: 'c', code: 'KeyC' })
  const menu = await screen.findByRole('menu', { name: '¿Quién canta?' })
  expect(
    within(menu)
      .getAllByRole('menuitemradio')
      .map((i) => i.textContent)
  ).toEqual([expect.stringContaining('Cantante 1'), expect.stringContaining('Coro')])
  expect(within(menu).getByRole('menuitem', { name: /Añadir cantante/ })).toBeVisible()
  expect(within(menu).queryByText(/Todos/)).toBeNull()
})

it('con reparto cada fila lleva su chip y su nombre accesible; el coro, entre paréntesis', async () => {
  montar()
  await screen.findByRole('listbox', { name: 'Líneas' })
  const lista = filas()
  expect(lista[0]!.getAttribute('aria-label')).toContain('Canta: Ana')
  expect(lista[1]!.getAttribute('aria-label')).toContain('Canta: Luis')
  expect(lista[2]!.getAttribute('aria-label')).toContain('Canta: Todos')
  expect(within(lista[0]!).getByText('A')).toBeVisible()
  expect(within(lista[2]!).getByText('A·L')).toBeVisible()
  // El texto del coro ya trae paréntesis: no se duplican. El otro coro los recibe dibujados.
  expect(within(lista[3]!).getByText('(Ah, ah, la marea)')).toBeVisible()
  expect(within(lista[5]!).getByText('(Ya duerme la bahía)')).toBeVisible()
})

it('C › 2 asigna tres líneas seleccionadas en un paso, se guarda y se deshace exacto (C1-E2, C1-E3)', async () => {
  const { llamadas } = montar()
  await screen.findByRole('listbox', { name: 'Líneas' })
  fireEvent.click(filas()[0]!)
  fireEvent.click(filas()[2]!, { shiftKey: true })
  expect(filas().filter((f) => f.getAttribute('aria-selected') === 'true')).toHaveLength(3)
  expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true')
  expect(filas()[2]).toHaveAttribute('aria-current', 'true')

  fireEvent.keyDown(filas()[2]!, { key: 'c', code: 'KeyC' })
  const menu = await screen.findByRole('menu', { name: '¿Quién canta?' })
  // Partes distintas: ninguna marca ✓.
  expect(within(menu).queryAllByRole('menuitemradio', { checked: true })).toHaveLength(0)
  fireEvent.keyDown(menu, { key: '2' })

  expect(screen.queryByRole('menu')).toBeNull()
  for (const f of filas().slice(0, 3)) expect(f.getAttribute('aria-label')).toContain('Canta: Luis')
  expect(screen.getByText('3 líneas para Luis.')).toBeInTheDocument()
  await waitFor(() => expect(guardados(llamadas)).toHaveLength(1), { timeout: 4000 })
  const [peticion] = guardados(llamadas)[0]!.args as [
    { partes: unknown; tiempos: { id: string; parte?: string }[] }
  ]
  expect(peticion.tiempos.slice(0, 3).map((t) => t.parte)).toEqual(['c2', 'c2', 'c2'])
  expect(peticion.partes).toMatchObject({ cantantes: [{ id: 'c1' }, { id: 'c2' }] })

  fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
  expect(filas()[0]!.getAttribute('aria-label')).toContain('Canta: Ana')
  expect(filas()[1]!.getAttribute('aria-label')).toContain('Canta: Luis')
  expect(filas()[2]!.getAttribute('aria-label')).toContain('Canta: Todos')
})

it('Esc con varias seleccionadas deja solo la principal sin salir del editor', async () => {
  const { ir } = montar()
  await screen.findByRole('listbox', { name: 'Líneas' })
  fireEvent.click(filas()[0]!)
  fireEvent.click(filas()[2]!, { ctrlKey: true })
  fireEvent.keyDown(filas()[2]!, { key: 'Escape' })
  expect(filas().filter((f) => f.getAttribute('aria-selected') === 'true')).toHaveLength(1)
  expect(ir).not.toHaveBeenCalled()
})

it('Alt + 3 sin cantante 3 no cambia nada y lo anuncia; Alt + 1…4 leen la tecla física (C1-E6)', async () => {
  const { llamadas } = montar()
  await screen.findByRole('listbox', { name: 'Líneas' })
  fireEvent.click(filas()[0]!)
  fireEvent.keyDown(filas()[0]!, { key: '3', code: 'Digit3', altKey: true })
  expect(screen.getByText('Esta canción no tiene cantante 3.')).toBeInTheDocument()
  expect(filas()[0]!.getAttribute('aria-label')).toContain('Canta: Ana')
  // Opción + 2 en macOS cambia `key` (a «™»), no `code`.
  fireEvent.keyDown(filas()[0]!, { key: '™', code: 'Digit2', altKey: true })
  expect(filas()[0]!.getAttribute('aria-label')).toContain('Canta: Luis')
  // AltGr (Ctrl + Alt) no cuenta.
  fireEvent.keyDown(filas()[0]!, { key: '|', code: 'Digit1', altKey: true, ctrlKey: true })
  expect(filas()[0]!.getAttribute('aria-label')).toContain('Canta: Luis')
  expect(guardados(llamadas)).toHaveLength(0)
})

it('Alt + ↑/↓ lleva la línea a la parte vecina y las pulsaciones seguidas son un solo paso', async () => {
  montar(cancionConCoros())
  await screen.findByRole('listbox', { name: 'Líneas' })
  fireEvent.click(filas()[0]!)
  // Un cantante y coros: el orden es Cantante 1 → Coro.
  fireEvent.keyDown(filas()[0]!, { key: 'ArrowDown', altKey: true })
  expect(filas()[0]!.getAttribute('aria-label')).toContain('Canta: Coro')
  fireEvent.keyDown(filas()[0]!, { key: 'ArrowDown', altKey: true })
  expect(filas()[0]!.getAttribute('aria-label')).toContain('Canta: Coro')
  fireEvent.keyDown(filas()[0]!, { key: 'ArrowUp', altKey: true })
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
  expect(filas()[0]!.getAttribute('aria-label')).toContain('Canta: Cantante 1')
})

it('«+ Añadir cantante» crea el Cantante 2 y le asigna la selección en un solo paso (C1-E5)', async () => {
  montar(cancionLista())
  await screen.findByRole('listbox', { name: 'Líneas' })
  fireEvent.click(filas()[1]!)
  fireEvent.keyDown(filas()[1]!, { key: 'c', code: 'KeyC' })
  fireEvent.click(await screen.findByRole('menuitem', { name: /Añadir cantante/ }))
  expect(screen.getByText('Cantante 2 añadido: 1 línea para Cantante 2.')).toBeInTheDocument()
  expect(filas()[1]!.getAttribute('aria-label')).toContain('Canta: Cantante 2')
  expect(filas()[0]!.getAttribute('aria-label')).toContain('Canta: Cantante 1')
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
  expect(document.querySelector('[data-chip-parte]')).toBeNull()
})

it('durante «Sincronizar al ritmo» C no abre el menú y la selección múltiple no actúa (C1-E21)', async () => {
  montar()
  fireEvent.click(await screen.findByRole('button', { name: 'Sincronizar al ritmo' }))
  await screen.findByRole('region', { name: 'Sincronizando al ritmo' })
  fireEvent.keyDown(window, { key: 'c', code: 'KeyC' })
  expect(screen.queryByRole('menu')).toBeNull()
  fireEvent.click(filas()[3]!, { ctrlKey: true })
  expect(filas().filter((f) => f.getAttribute('aria-selected') === 'true')).toHaveLength(1)
})

it('el menú contextual de una fila trae «¿Quién canta?… (C)» tras el editor preciso', async () => {
  montar()
  await screen.findByRole('listbox', { name: 'Líneas' })
  fireEvent.contextMenu(filas()[1]!, { clientX: 20, clientY: 20 })
  const items = screen.getAllByRole('menuitem').map((i) => i.textContent)
  expect(items.slice(0, 2)).toEqual(['Editor preciso de línea… (P)', '¿Quién canta?… (C)'])
  fireEvent.click(screen.getByRole('menuitem', { name: '¿Quién canta?… (C)' }))
  expect(await screen.findByRole('menu', { name: '¿Quién canta?' })).toBeVisible()
})

it('la fila «Canta» del panel muestra la parte, abre el menú y cambia la línea (0344)', async () => {
  montar()
  await screen.findByRole('listbox', { name: 'Líneas' })
  fireEvent.click(filas()[0]!)
  const canta = screen.getByRole('button', { name: 'Canta: Ana' })
  expect(canta).toHaveAttribute('aria-haspopup', 'menu')
  fireEvent.click(canta)
  const menu = await screen.findByRole('menu', { name: '¿Quién canta?' })
  expect(canta).toHaveAttribute('aria-expanded', 'true')
  expect(within(menu).getByRole('menuitemradio', { name: /Cantante 1 · Ana/ })).toBeChecked()
  fireEvent.click(within(menu).getByRole('menuitemradio', { name: /Coro/ }))
  expect(await screen.findByRole('button', { name: 'Canta: Coro' })).toHaveFocus()
  expect(filas()[0]!.getAttribute('aria-label')).toContain('Canta: Coro')
})

it('con varias seleccionadas el panel dice cuántas, «Varias» y de qué línea son los tiempos', async () => {
  montar()
  await screen.findByRole('listbox', { name: 'Líneas' })
  fireEvent.click(filas()[0]!)
  fireEvent.click(filas()[2]!, { shiftKey: true })
  expect(screen.getByRole('heading', { name: '3 líneas seleccionadas' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Canta: Varias' })).toBeVisible()
  expect(
    screen.getByText(
      'Los tiempos se editan de una en una: los controles de abajo son de la línea 3.'
    )
  ).toBeVisible()
  fireEvent.click(filas()[1]!, { ctrlKey: true })
  fireEvent.click(filas()[0]!)
  expect(screen.queryByRole('heading', { name: /líneas seleccionadas/ })).toBeNull()
})

it('sin reparto el panel no tiene fila «Canta»', async () => {
  montar(cancionLista())
  await screen.findByRole('listbox', { name: 'Líneas' })
  expect(document.querySelector('[data-boton-canta]')).toBeNull()
})
