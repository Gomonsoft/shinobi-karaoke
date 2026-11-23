import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { NavegacionContexto } from '../../navegacion/estado'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { apiEditorFalsa, cancionConCoros, cancionConReparto, cancionLista } from './fixturesApi'
import { ContenedorToasts } from '../../componentes/Toasts'
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

function montar(cancion = cancionConReparto()) {
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
  // En el CI (ubuntu, 362 archivos a la vez) la primera pulsación llegó a veces antes de que el editor
  // tuviera línea principal y el menú no se abría: se repite la tecla hasta que el menú aparece.
  await waitFor(
    () => {
      fireEvent.keyDown(filas()[0]!, { key: 'c', code: 'KeyC' })
      expect(screen.getByRole('menu', { name: '¿Quién canta?' })).toBeInTheDocument()
    },
    { timeout: 5000 }
  )
  const menu = screen.getByRole('menu', { name: '¿Quién canta?' })
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
  expect(filas()[2]!.getAttribute('aria-label')).toMatch(/, principal$/)
  expect(filas()[2]).not.toHaveAttribute('aria-current')

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

it('sin reparto no hay carriles ni botón de juntar y Alt + ↑/↓ no se captura (0345)', async () => {
  montar(cancionLista())
  await screen.findByRole('listbox', { name: 'Líneas' })
  expect(document.querySelector('[data-carril]')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Juntar carriles' })).toBeNull()
  expect(fireEvent.keyDown(filas()[0]!, { key: 'ArrowDown', altKey: true })).toBe(true)
})

it('un cantante nuevo trae su carril vacío y Alt + ↓ le lleva una línea (C1-E8)', async () => {
  montar(cancionConCoros())
  await screen.findByRole('listbox', { name: 'Líneas' })
  expect(document.querySelectorAll('[data-carril]')).toHaveLength(2) // Cantante 1 y Coro
  fireEvent.click(filas()[1]!)
  fireEvent.keyDown(filas()[1]!, { key: 'c', code: 'KeyC' })
  fireEvent.click(await screen.findByRole('menuitem', { name: /Añadir cantante/ }))
  // La línea 2 pasó al Cantante 2; el Cantante 1 ya no tiene la 2.
  expect(document.querySelectorAll('[data-carril]')).toHaveLength(3)
  fireEvent.keyDown(filas()[1]!, { key: 'ArrowUp', altKey: true })
  expect(filas()[1]!.getAttribute('aria-label')).toContain('Canta: Cantante 1')
  expect(screen.getByText('Arrastra aquí las líneas de Cantante 2')).toBeVisible()
  fireEvent.keyDown(filas()[1]!, { key: 'ArrowDown', altKey: true })
  expect(filas()[1]!.getAttribute('aria-label')).toContain('Canta: Cantante 2')
})

it('«Juntar carriles» se alterna, se anuncia y se guarda en la configuración (C1-E16)', async () => {
  const { llamadas } = montar()
  await screen.findByRole('listbox', { name: 'Líneas' })
  const boton = screen.getByRole('button', { name: 'Juntar carriles' })
  expect(boton).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(boton)
  expect(screen.getByRole('button', { name: 'Separar carriles' })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  expect(screen.getByText('Carriles juntos en una pista.')).toBeInTheDocument()
  expect(document.querySelector('[data-carril]')).toBeNull()
  expect(llamadas.some((l) => l.metodo === 'config.actualizar')).toBe(true)
})

// --- Funciones › «Cantantes y coros» (0346) ---
async function irAFunciones() {
  fireEvent.click(await screen.findByRole('radio', { name: 'Funciones' }))
  return screen.findByRole('heading', { name: 'Cantantes y coros' })
}

it('con un solo cantante: «Repartir entre varios» crea el Cantante 2 sin líneas y enfoca su nombre (C1-E8)', async () => {
  montar(cancionLista())
  await irAFunciones()
  expect(screen.queryByRole('textbox', { name: /Nombre del cantante/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Repartir entre varios cantantes/ }))
  const nombre = await screen.findByRole('textbox', { name: 'Nombre del cantante 2' })
  await waitFor(() => expect(nombre).toHaveFocus())
  expect(screen.getAllByText('Sin líneas')).toHaveLength(2) // Cantante 2 y Coro
  // Sin líneas de coro ni de Cantante 2 no hay reparto efectivo... pero hay 2 cantantes: carriles.
  expect(document.querySelectorAll('[data-carril]')).toHaveLength(3)
})

it('con varios: nombre (Intro guarda, Esc devuelve), recuento, quitar con toast y [Deshacer] (C1-E9…E11)', async () => {
  montar()
  await irAFunciones()
  const luis = screen.getByRole('textbox', { name: 'Nombre del cantante 2' })
  expect(luis).toHaveValue('Luis')
  expect(luis).toHaveAttribute('maxlength', '40')
  fireEvent.change(luis, { target: { value: 'Lola' } })
  fireEvent.keyDown(luis, { key: 'Escape' })
  expect(luis).toHaveValue('Luis')
  fireEvent.change(luis, { target: { value: ' Lola ' } })
  fireEvent.keyDown(luis, { key: 'Enter' })
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: 'Nombre del cantante 2' })).toHaveValue('Lola')
  )
  expect(filas()[1]!.getAttribute('aria-label')).toContain('Canta: Lola')

  // El recuento selecciona las líneas de esa parte.
  fireEvent.click(screen.getAllByRole('button', { name: '2 líneas' })[0]!)
  expect(filas().filter((f) => f.getAttribute('aria-selected') === 'true')).toHaveLength(2)

  fireEvent.click(screen.getByRole('button', { name: 'Quitar a Lola: sus líneas pasan a Ana' }))
  expect(
    (await screen.findAllByText('Lola quitado: sus líneas pasan a Ana.')).length
  ).toBeGreaterThan(0)
  expect(screen.queryByRole('textbox', { name: 'Nombre del cantante 2' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
  expect(await screen.findByRole('textbox', { name: 'Nombre del cantante 2' })).toHaveValue('Lola')
})

it('«+ Añadir cantante» hasta 4 y entonces `Hasta 4 cantantes por canción.`', async () => {
  montar()
  await irAFunciones()
  fireEvent.click(screen.getByRole('button', { name: /Añadir cantante/ }))
  fireEvent.click(screen.getByRole('button', { name: /Añadir cantante/ }))
  expect(screen.queryByRole('button', { name: /Añadir cantante/ })).toBeNull()
  expect(screen.getByText('Hasta 4 cantantes por canción.')).toBeVisible()
})

it('«Marcarlas como coro» solo con líneas enteras entre paréntesis; un paso y la sugerencia se va (C1-E12)', async () => {
  const c = cancionLista()
  c.letra!.lineas[0]!.texto = '(ah, ah, la lluvia)'
  c.letra!.lineas[1]!.texto = '(a medias'
  montar(c)
  await irAFunciones()
  expect(screen.getByText(/1 línea va entre paréntesis: suele ser un coro\./)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Marcarla como coro' }))
  expect(screen.queryByText(/va entre paréntesis/)).toBeNull()
  expect(filas()[0]!.getAttribute('aria-label')).toContain('Canta: Coro')
  expect(filas()[1]!.getAttribute('aria-label')).toContain('Canta: Cantante 1')
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
  expect(document.querySelector('[data-chip-parte]')).toBeNull()
})

it('«Nombres de los cantantes…» del menú lleva el foco al nombre del cantante de la selección', async () => {
  montar()
  await screen.findByRole('listbox', { name: 'Líneas' })
  fireEvent.click(filas()[1]!)
  fireEvent.keyDown(filas()[1]!, { key: 'c', code: 'KeyC' })
  fireEvent.click(await screen.findByRole('menuitem', { name: /Nombres de los cantantes/ }))
  const nombre = await screen.findByRole('textbox', { name: 'Nombre del cantante 2' })
  await waitFor(() => expect(nombre).toHaveFocus())
})

// --- Voz en los coros (0365) ---
it('«Voz en los coros» solo con coros, al 50 % sin dato y sin escribir al abrir (C2-E1)', async () => {
  const sin = montar(cancionLista())
  await irAFunciones()
  expect(screen.queryByRole('slider', { name: 'Voz en los coros' })).toBeNull()
  expect(guardados(sin.llamadas)).toHaveLength(0)
  sin.unmount()
  const { llamadas } = montar(cancionConCoros())
  await irAFunciones()
  const deslizador = screen.getByRole('slider', { name: 'Voz en los coros' })
  expect(deslizador).toHaveAttribute('aria-valuetext', '50 %')
  expect(deslizador.getAttribute('aria-describedby')).toMatch(/ayuda.*limite/)
  expect(guardados(llamadas)).toHaveLength(0)
})

it('el deslizador va de 5 en 5, una ráfaga es un paso y se guarda en la letra (C2-E2)', async () => {
  const { llamadas } = montar(cancionConCoros())
  await irAFunciones()
  const d = screen.getByRole('slider', { name: 'Voz en los coros' })
  fireEvent.keyDown(d, { key: 'ArrowRight' })
  fireEvent.keyDown(d, { key: 'ArrowRight' })
  fireEvent.keyDown(d, { key: 'PageUp' })
  expect(screen.getByRole('slider', { name: 'Voz en los coros' })).toHaveAttribute(
    'aria-valuetext',
    '85 %'
  )
  await waitFor(() => expect(guardados(llamadas)).toHaveLength(1), { timeout: 4000 })
  const [peticion] = guardados(llamadas)[0]!.args as [{ partes: { voz_en_coros: number } }]
  expect(peticion.partes.voz_en_coros).toBeCloseTo(0.85)
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
  expect(screen.getByRole('slider', { name: 'Voz en los coros' })).toHaveAttribute(
    'aria-valuetext',
    '50 %'
  )
})

it('«Escuchar un coro» suena de 2 s antes a 1 s después, no cambia la pista, y Esc devuelve el cabezal (C2-E5)', async () => {
  montar(cancionConCoros())
  await irAFunciones()
  fireEvent.click(screen.getByRole('button', { name: /Escuchar un coro/ }))
  await waitFor(() =>
    expect(motor.reproducir).toHaveBeenCalledWith({
      desdeMs: 6000,
      hastaMs: expect.any(Number),
      conCoros: true
    })
  )
  expect(motor.prepararCoros).toHaveBeenCalled()
  expect(motor.usarPista).toHaveBeenCalledTimes(1) // solo la pista inicial
  expect(await screen.findByRole('button', { name: /Detener/ })).toBeVisible()
  expect(screen.getByText('Escuchando el coro de 0:08 con la voz al 50 %.')).toBeInTheDocument()
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(motor.pausar).toHaveBeenCalled()
  expect(motor.buscar).toHaveBeenLastCalledWith(4200)
})

it('sin voz separada «Escuchar un coro» queda inactivo con su motivo y el nivel sigue editable', async () => {
  const c = cancionConCoros()
  c.pasos.separacion = { estado: 'pendiente', progreso: null, error: null, actualizado: null }
  montar(c)
  await irAFunciones()
  const boton = screen.getByRole('button', { name: /Escuchar un coro/ })
  expect(boton).toHaveAttribute('aria-disabled', 'true')
  fireEvent.click(boton)
  expect(motor.reproducir).not.toHaveBeenCalled()
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Voz en los coros' }), { key: 'ArrowLeft' })
  expect(screen.getByRole('slider', { name: 'Voz en los coros' })).toHaveAttribute(
    'aria-valuetext',
    '45 %'
  )
})

it('la etiqueta del carril de un cantante sin nombre dice «Cantante» (el número va en el chip)', async () => {
  montar(cancionLista())
  await screen.findByRole('listbox', { name: 'Líneas' })
  fireEvent.click(filas()[1]!)
  fireEvent.keyDown(filas()[1]!, { key: 'c', code: 'KeyC' })
  fireEvent.click(await screen.findByRole('menuitem', { name: /Añadir cantante/ }))
  const etiqueta = document.querySelector('[data-carril="c2"]')!.querySelector('div[title]')!
  expect(etiqueta).toHaveAttribute('title', 'Cantante 2')
  expect(etiqueta.textContent).toBe('2Cantante')
})

it('el hueco del chip de la lista mide el chip más ancho de la canción más 8 px a cada lado', async () => {
  montar()
  const lista = await screen.findByRole('listbox', { name: 'Líneas' })
  // «A·L» (3 caracteres) es el chip más ancho del dúo: 3 × 7 + 14 + 16.
  expect(lista.style.getPropertyValue('--ancho-col-chip')).toBe('51px')
})
