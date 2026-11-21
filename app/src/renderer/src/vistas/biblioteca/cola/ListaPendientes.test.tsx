import { readFileSync } from 'node:fs'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { entrada, estadoP1, estadoP2, estadoP4, estadoP5 } from '@shared/__fixtures__/sesion'
import type { EstadoSesionIpc } from '@shared/sesion'
import { ContenedorToasts } from '../../../componentes/Toasts'
import { cerrarTodosLosToasts } from '../../../componentes/gestorToasts'
import { instalarApiSesion } from '../../../sesion/pruebas'
import { ProveedorSesion } from '../../../sesion/ProveedorSesion'
import { ListaPendientes, type ListaPendientesProps } from './ListaPendientes'

const id = (n: number) => entrada(n).entradaId
const con = (revision: number, ns: number[], base = estadoP1()): EstadoSesionIpc => ({
  ...base,
  revision,
  pendientes: ns.map((n) => entrada(n))
})
/** Cuatro pendientes: 2, 3, 4, 5. */
const inicial = (extra: Partial<EstadoSesionIpc> = {}) => ({
  ...con(10, [2, 3, 4, 5]),
  ...extra
})

async function montar(estado: EstadoSesionIpc, props: ListaPendientesProps = {}) {
  window.shinobi = {} as never
  const api = instalarApiSesion(estado)
  render(
    <ProveedorSesion>
      <ListaPendientes {...props} />
      <ContenedorToasts />
    </ProveedorSesion>
  )
  await screen.findByRole('heading', { level: 3 })
  await waitFor(() => expect(screen.queryAllByRole('listitem').length).toBeGreaterThan(-1))
  return api
}

const movidas = (api: Awaited<ReturnType<typeof montar>>) =>
  api.llamadas.filter((l) => l[0] === 'cola.mover')

const fila = (n: number) =>
  document.querySelector<HTMLElement>(`[data-entrada-id="${id(n)}"]`) as HTMLElement

beforeEach(() => cerrarTodosLosToasts())

describe('ListaPendientes · filas (S4, parte de la lista)', () => {
  it('lista con nombre y filas con nombre accesible, posición y duración', async () => {
    await montar(inicial(), { duracionDe: () => 185_000 })
    const lista = await screen.findByRole('list', { name: 'A continuación (4)' })
    expect(within(lista).getAllByRole('listitem')).toHaveLength(4)
    expect(fila(2)).toHaveAccessibleName('1 de 4: Canción 2, de Artista 2, 3:05')
    expect(within(fila(3)).getByText('Canción 3 — Artista 3')).toBeInTheDocument()
    expect(within(fila(3)).getByText('3:05')).toBeInTheDocument()
  })

  it('«Siguiente» solo en la candidata y solo cuando se pide', async () => {
    await montar(inicial({ ...estadoP2(), pendientes: [entrada(2), entrada(3)] }), {
      etiquetarSiguiente: true
    })
    await screen.findByRole('list')
    expect(within(fila(2)).getByText('Siguiente')).toBeInTheDocument()
    expect(within(fila(3)).queryByText('Siguiente')).toBeNull()
    expect(fila(2)).toHaveAccessibleName(/, siguiente$/)
  })

  it('sin la etiqueta en reproducción normal', async () => {
    await montar(inicial())
    await screen.findByRole('list')
    expect(screen.queryByText('Siguiente')).toBeNull()
  })

  it('una pendiente no disponible muestra la causa, y una incompleta su aviso', async () => {
    await montar(
      inicial({
        pendientes: [entrada(2, { disponibilidad: 'sin_pistas' }), entrada(3), entrada(4)]
      }),
      { lineasSinSincronizarDe: (c) => (c === 'cancion-3' ? 2 : null) }
    )
    await screen.findByRole('list')
    expect(within(fila(2)).getByText('⚠ No disponible: faltan sus pistas separadas.')).toBeVisible()
    expect(fila(2)).toHaveAccessibleName(/no disponible: Faltan sus pistas separadas\./)
    expect(within(fila(3)).getByText('⚠ Faltan 2 líneas por sincronizar')).toBeVisible()
  })

  it('una canción repetida son dos filas con entradas distintas y se mueven por separado', async () => {
    const copia = entrada(9, { cancionId: 'cancion-3', titulo: 'Canción 3', artista: 'Artista 3' })
    const api = await montar(inicial({ pendientes: [entrada(2), entrada(3), copia] }))
    await screen.findByRole('list')
    const filas = screen.getAllByRole('listitem')
    expect(filas).toHaveLength(3)
    expect(filas[2]).toHaveAttribute('data-entrada-id', copia.entradaId)
    fireEvent.keyDown(filas[2]!, { key: 'ArrowUp', altKey: true })
    expect(movidas(api)).toEqual([['cola.mover', copia.entradaId, id(3)]])
  })

  it('sin pendientes: texto de cola vacía según haya sesión', async () => {
    await montar(estadoP4({ pendientes: [] }))
    expect(await screen.findByText(/No hay canciones pendientes/)).toBeInTheDocument()
  })

  it('sin sesión y sin pendientes: texto de preparar la cola', async () => {
    await montar(estadoP5({ pendientes: [] }))
    expect(
      await screen.findByText(/Puedes prepararla antes de abrir el reproductor/)
    ).toBeInTheDocument()
  })
})

describe('ListaPendientes · navegación (S16)', () => {
  it('roving tabindex: una sola parada y flechas / Inicio / Fin', async () => {
    await montar(inicial())
    await screen.findByRole('list')
    const filas = screen.getAllByRole('listitem')
    expect(filas.map((f) => f.tabIndex)).toEqual([0, -1, -1, -1])
    filas[0]!.focus()
    fireEvent.keyDown(filas[0]!, { key: 'ArrowDown' })
    expect(filas[1]).toHaveFocus()
    expect(filas.map((f) => f.tabIndex)).toEqual([-1, 0, -1, -1])
    fireEvent.keyDown(filas[1]!, { key: 'End' })
    expect(filas[3]).toHaveFocus()
    fireEvent.keyDown(filas[3]!, { key: 'ArrowDown' })
    expect(filas[3]).toHaveFocus()
    fireEvent.keyDown(filas[3]!, { key: 'Home' })
    expect(filas[0]).toHaveFocus()
  })

  it('Tab desde la fila activa llega a su ⋯ (solo ese está en el orden de tabulación)', async () => {
    await montar(inicial())
    await screen.findByRole('list')
    const botones = screen.getAllByRole('button', { name: /^Más acciones de/ })
    expect(botones.map((b) => b.tabIndex)).toEqual([0, -1, -1, -1])
  })

  it('el asa es decorativa', async () => {
    await montar(inicial())
    await screen.findByRole('list')
    expect(fila(2).querySelector('[aria-hidden="true"]')).not.toBeNull()
  })
})

describe('ListaPendientes · reordenar (S5)', () => {
  it('teclado: Alt+↓, Alt+↑, Alt+Inicio y Alt+Fin traducen a cola.mover por id', async () => {
    const api = await montar(inicial())
    await screen.findByRole('list')
    fireEvent.keyDown(fila(2), { key: 'ArrowDown', altKey: true })
    fireEvent.keyDown(fila(4), { key: 'ArrowUp', altKey: true })
    fireEvent.keyDown(fila(5), { key: 'Home', altKey: true })
    fireEvent.keyDown(fila(3), { key: 'End', altKey: true })
    expect(movidas(api)).toEqual([
      ['cola.mover', id(2), id(4)],
      ['cola.mover', id(4), id(3)],
      ['cola.mover', id(5), id(2)],
      ['cola.mover', id(3), null]
    ])
  })

  it('los extremos no llaman a mover', async () => {
    const api = await montar(inicial())
    await screen.findByRole('list')
    fireEvent.keyDown(fila(2), { key: 'ArrowUp', altKey: true })
    fireEvent.keyDown(fila(2), { key: 'Home', altKey: true })
    fireEvent.keyDown(fila(5), { key: 'ArrowDown', altKey: true })
    fireEvent.keyDown(fila(5), { key: 'End', altKey: true })
    expect(movidas(api)).toEqual([])
  })

  it('el ⋯ ofrece los ítems de la spec y se adapta a la primera y a la última', async () => {
    await montar(inicial())
    await screen.findByRole('list')
    const abrir = (n: number) =>
      fireEvent.click(within(fila(n)).getByRole('button', { name: /Más acciones/ }))
    abrir(2)
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
      'Bajar',
      'Mover al final',
      'Agregar otra vez al final',
      'Quitar de la cola'
    ])
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    abrir(5)
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
      'Reproducir a continuación',
      'Subir',
      'Agregar otra vez al final',
      'Quitar de la cola'
    ])
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    abrir(3)
    expect(screen.getAllByRole('menuitem')).toHaveLength(6)
  })

  it('el ⋯ da la misma llamada que el teclado', async () => {
    const api = await montar(inicial())
    await screen.findByRole('list')
    const elegir = (n: number, nombre: string) => {
      fireEvent.click(within(fila(n)).getByRole('button', { name: /Más acciones/ }))
      fireEvent.click(screen.getByRole('menuitem', { name: nombre }))
    }
    elegir(4, 'Reproducir a continuación')
    elegir(4, 'Subir')
    elegir(3, 'Bajar')
    elegir(3, 'Mover al final')
    fireEvent.keyDown(fila(4), { key: 'Home', altKey: true })
    fireEvent.keyDown(fila(4), { key: 'ArrowUp', altKey: true })
    fireEvent.keyDown(fila(3), { key: 'ArrowDown', altKey: true })
    fireEvent.keyDown(fila(3), { key: 'End', altKey: true })
    const m = movidas(api)
    expect(m.slice(0, 4)).toEqual(m.slice(4))
    expect(m[0]).toEqual(['cola.mover', id(4), id(2)])
  })

  it('«Agregar otra vez al final» agrega la canción al final sin mover la original', async () => {
    const api = await montar(inicial())
    await screen.findByRole('list')
    fireEvent.click(within(fila(3)).getByRole('button', { name: /Más acciones/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Agregar otra vez al final' }))
    expect(api.llamadas.filter((l) => l[0] === 'cola.agregar')).toEqual([
      ['cola.agregar', 'cancion-3', 'final']
    ])
    expect(movidas(api)).toEqual([])
  })

  it('el foco sigue a la fila movida y se anuncia su nueva posición', async () => {
    const api = await montar(inicial())
    await screen.findByRole('list')
    fila(2).focus()
    fireEvent.keyDown(fila(2), { key: 'ArrowDown', altKey: true })
    act(() => api.emitirEstado(con(11, [3, 2, 4, 5])))
    await waitFor(() => expect(fila(2)).toHaveFocus())
    expect(screen.getByRole('status')).toHaveTextContent('«Canción 2», posición 2 de 4.')
    expect(screen.getAllByRole('listitem').map((f) => f.dataset.entradaId)).toEqual([
      id(3),
      id(2),
      id(4),
      id(5)
    ])
  })

  describe('arrastre', () => {
    function preparar() {
      // jsdom no tiene layout: cada fila ocupa 48 px apiladas desde 100.
      for (const [i, n] of [2, 3, 4, 5].entries()) {
        fila(n).getBoundingClientRect = () =>
          ({ top: 100 + i * 48, bottom: 148 + i * 48, height: 48 }) as DOMRect
      }
    }
    const asa = (n: number) => fila(n).querySelector('[class*="asa"]') as HTMLElement
    const mover = (x: number, y: number) =>
      fireEvent(window, new MouseEvent('pointermove', { clientX: x, clientY: y }))

    it('arrastrar al final da lo mismo que Alt+Fin, con la línea de destino', async () => {
      const api = await montar(inicial())
      await screen.findByRole('list')
      preparar()
      fireEvent.pointerDown(asa(3), { button: 0, clientX: 10, clientY: 172 })
      mover(10, 400)
      expect(fila(5).className).toMatch(/destinoDespues/)
      expect(fila(3).className).toMatch(/arrastrando/)
      fireEvent(window, new MouseEvent('pointerup'))
      expect(movidas(api)).toEqual([['cola.mover', id(3), null]])
      expect(fila(5).className).not.toMatch(/destinoDespues/)
    })

    it('arrastrar al principio da lo mismo que Alt+Inicio', async () => {
      const api = await montar(inicial())
      await screen.findByRole('list')
      preparar()
      fireEvent.pointerDown(asa(4), { button: 0, clientX: 10, clientY: 220 })
      mover(10, 90)
      expect(fila(2).className).toMatch(/destinoAntes/)
      fireEvent(window, new MouseEvent('pointerup'))
      fireEvent.keyDown(fila(5), { key: 'Home', altKey: true })
      const m = movidas(api)
      expect(m[0]).toEqual(['cola.mover', id(4), id(2)])
      expect(m[1]).toEqual(['cola.mover', id(5), id(2)])
    })

    it('soltar en un hueco pegado a la propia fila no mueve nada', async () => {
      const api = await montar(inicial())
      await screen.findByRole('list')
      preparar()
      fireEvent.pointerDown(asa(3), { button: 0, clientX: 10, clientY: 172 })
      mover(10, 175)
      fireEvent(window, new MouseEvent('pointerup'))
      expect(movidas(api)).toEqual([])
    })

    it('Esc cancela el arrastre', async () => {
      const api = await montar(inicial())
      await screen.findByRole('list')
      preparar()
      fireEvent.pointerDown(asa(3), { button: 0, clientX: 10, clientY: 172 })
      mover(10, 400)
      fireEvent.keyDown(window, { key: 'Escape' })
      fireEvent(window, new MouseEvent('pointerup'))
      expect(movidas(api)).toEqual([])
      expect(fila(3).className).not.toMatch(/arrastrando/)
    })
  })

  it('sin animación fuera de «no-preference» de movimiento', () => {
    const css = readFileSync(`${__dirname}/listaPendientes.module.css`, 'utf8')
    const fuera = css.replace(/@media \(prefers-reduced-motion: no-preference\)[\s\S]*$/, '')
    expect(fuera).not.toMatch(/transition|animation/)
  })
})

describe('ListaPendientes · quitar y deshacer (S6)', () => {
  function instalarQuitar(api: Awaited<ReturnType<typeof montar>>, antesDe: string | null) {
    window.shinobi.cola.quitar = vi.fn((entradaId: string) => {
      api.llamadas.push(['cola.quitar', entradaId])
      return Promise.resolve({ estado: con(11, [2, 4, 5]), antesDe })
    }) as never
  }

  it('Supr quita sin confirmación, deja el foco en la siguiente y ofrece Deshacer', async () => {
    const api = await montar(inicial())
    await screen.findByRole('list')
    instalarQuitar(api, id(4))
    fila(3).focus()
    fireEvent.keyDown(fila(3), { key: 'Delete' })
    expect(await screen.findByText('«Canción 3» se quitó de la cola.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => api.emitirEstado(con(11, [2, 4, 5])))
    await waitFor(() => expect(fila(4)).toHaveFocus())
  })

  it('al quitar la última, el foco pasa a la anterior', async () => {
    const api = await montar(inicial())
    await screen.findByRole('list')
    fila(5).focus()
    fireEvent.keyDown(fila(5), { key: 'Delete' })
    act(() => api.emitirEstado(con(11, [2, 3, 4])))
    await waitFor(() => expect(fila(4)).toHaveFocus())
  })

  it('al quitar la única, el foco pasa al encabezado', async () => {
    const api = await montar(inicial({ pendientes: [entrada(2)] }))
    await screen.findByRole('list')
    fila(2).focus()
    fireEvent.keyDown(fila(2), { key: 'Delete' })
    act(() => api.emitirEstado(con(11, [])))
    await waitFor(() => expect(screen.getByRole('heading', { level: 3 })).toHaveFocus())
    expect(screen.getByRole('heading', { level: 3 })).toHaveAttribute('tabindex', '-1')
  })

  it('quitar desde el ⋯ también deja el foco en una fila', async () => {
    const api = await montar(inicial())
    await screen.findByRole('list')
    fireEvent.click(within(fila(2)).getByRole('button', { name: /Más acciones/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Quitar de la cola' }))
    act(() => api.emitirEstado(con(11, [3, 4, 5])))
    await waitFor(() => expect(fila(3)).toHaveFocus())
  })

  it('Deshacer vuelve a agregar con el antesDe y la revisión que devolvió quitar', async () => {
    const api = await montar(inicial())
    await screen.findByRole('list')
    instalarQuitar(api, id(4))
    fireEvent.keyDown(fila(3), { key: 'Delete' })
    fireEvent.click(await screen.findByRole('button', { name: 'Deshacer' }))
    expect(api.llamadas.filter((l) => l[0] === 'cola.agregar')).toEqual([
      ['cola.agregar', 'cancion-3', { antesDe: id(4), siRevision: 11 }]
    ])
  })

  it('quitar la última deshace con antesDe nulo (al final)', async () => {
    const api = await montar(inicial())
    await screen.findByRole('list')
    instalarQuitar(api, null)
    fireEvent.keyDown(fila(5), { key: 'Delete' })
    fireEvent.click(await screen.findByRole('button', { name: 'Deshacer' }))
    expect(api.llamadas.filter((l) => l[0] === 'cola.agregar')).toEqual([
      ['cola.agregar', 'cancion-5', { antesDe: null, siRevision: 11 }]
    ])
  })

  it('cambios de otros: la lista se actualiza sin mover el foco', async () => {
    const api = await montar(inicial())
    await screen.findByRole('list')
    fila(3).focus()
    act(() => api.emitirEstado(con(11, [6, 2, 3, 4, 5])))
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(5))
    expect(fila(3)).toHaveFocus()
  })

  it('cambios de otros: si desaparece la fila enfocada rige la regla de quitar', async () => {
    const api = await montar(inicial())
    await screen.findByRole('list')
    fila(3).focus()
    act(() => api.emitirEstado(con(11, [2, 4, 5])))
    await waitFor(() => expect(fila(4)).toHaveFocus())
  })

  it('si el foco estaba fuera de la lista no se roba', async () => {
    const api = await montar(inicial())
    await screen.findByRole('list')
    const fuera = document.createElement('button')
    document.body.append(fuera)
    fuera.focus()
    act(() => api.emitirEstado(con(11, [2, 4, 5])))
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3))
    expect(fuera).toHaveFocus()
    fuera.remove()
  })
})

describe('ListaPendientes · vaciar', () => {
  it('solo con 2 o más pendientes', async () => {
    await montar(inicial({ pendientes: [entrada(2)] }))
    await screen.findByRole('list')
    expect(screen.queryByRole('button', { name: 'Vaciar las pendientes…' })).toBeNull()
  })

  it('abre el diálogo con el foco en Cancelar y vacía sin contexto', async () => {
    const api = await montar(inicial())
    await screen.findByRole('list')
    fireEvent.click(screen.getByRole('button', { name: 'Vaciar las pendientes…' }))
    const dialogo = screen.getByRole('dialog', { name: '¿Quitar las 4 canciones pendientes?' })
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    expect(within(dialogo).getByText('La canción que suena no se interrumpe.')).toBeInTheDocument()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Quitar pendientes' }))
    expect(api.llamadas.filter((l) => l[0] === 'cola.vaciar')).toEqual([['cola.vaciar', false]])
    act(() => api.emitirEstado(con(11, [])))
    await waitFor(() => expect(screen.getByRole('heading', { level: 3 })).toHaveFocus())
  })

  it('Cancelar no llama a vaciar', async () => {
    const api = await montar(inicial())
    await screen.findByRole('list')
    fireEvent.click(screen.getByRole('button', { name: 'Vaciar las pendientes…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(api.llamadas.filter((l) => l[0] === 'cola.vaciar')).toEqual([])
  })
})
