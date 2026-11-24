import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { estadoP1, estadoSinCola } from '@shared/__fixtures__/sesion'
import type { ApiShinobi, PrevisualizacionVariasIpc, ResumenCancionIpc } from '@shared/ipc'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import { NavegacionContexto } from '../../navegacion/estado'
import { Biblioteca, reiniciarFiltroDeSesion } from './Biblioteca'
import { fixtures } from './fixturesApi'
import { montarConSesion } from './montarConSesion'
import { resumenPrueba } from './resumenPrueba'

const lista = (id: string, extra: Partial<ResumenCancionIpc> = {}) =>
  resumenPrueba({ id, titulo: `Tema ${id}`, estado: 'lista', lineasConTiempo: 4, ...extra })
const borrador = (id: string) => resumenPrueba({ id, titulo: `Tema ${id}` })

const prev = (
  canciones: Partial<PrevisualizacionVariasIpc['canciones'][number]>[],
  version = 'v1'
): PrevisualizacionVariasIpc => ({
  version,
  canciones: canciones.map((c, i) => ({
    id: `c${i + 1}`,
    aplica: true,
    trabajos: 0,
    entradasCola: 0,
    cambiaTema: false,
    ...c
  }))
})

function montar(
  canciones: ResumenCancionIpc[],
  parcial: { biblioteca?: unknown; preparacion?: unknown } = {}
) {
  const api = fixtures({
    listar: () => Promise.resolve(canciones),
    biblioteca: parcial.biblioteca as Partial<ApiShinobi['biblioteca']> | undefined,
    preparacion: parcial.preparacion as Partial<ApiShinobi['preparacion']> | undefined
  })
  ;(window as unknown as { shinobi: ApiShinobi }).shinobi = api
  render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir: vi.fn() }}>
      <Biblioteca />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
}

async function seleccionar(...titulos: string[]) {
  await screen.findAllByRole('article')
  fireEvent.click(screen.getByRole('button', { name: 'Seleccionar' }))
  for (const t of titulos)
    fireEvent.click(screen.getByRole('checkbox', { name: `Seleccionar «${t}»` }))
}

const barra = () =>
  screen.getByRole('toolbar', { name: 'Acciones para las canciones seleccionadas' })
const abrirMas = () =>
  fireEvent.click(within(barra()).getByRole('button', { name: 'Más acciones' }))

beforeEach(() => {
  reiniciarFiltroDeSesion()
  cerrarTodosLosToasts()
})
afterEach(cleanup)

describe('barra de selección (F8-1, F8-2)', () => {
  it('lleva el recuento solo en las acciones que valen para una parte', async () => {
    montar([
      borrador('b1'),
      borrador('b2'),
      lista('l1'),
      lista('l2'),
      lista('r1', { estado: 'borrador' })
    ])
    await seleccionar('Tema b1', 'Tema b2', 'Tema l1', 'Tema l2', 'Tema r1')
    expect(within(barra()).getByRole('button', { name: /^Preparar/ })).toHaveTextContent(
      'Preparar (3 de 5)'
    )
    abrirMas()
    const nombres = screen.getAllByRole('menuitem').map((m) => m.textContent)
    expect(nombres).toEqual([
      'A la cola (2 de 5)',
      'Exportar video… (2 de 5)',
      'Exportar paquete…',
      'Exportar la letra (.lrc)…',
      'Editar datos…',
      'Eliminar…'
    ])
  })

  it('con solo Listas, «Preparar» está inactivo con su motivo y sigue enfocable', async () => {
    montar([lista('l1'), lista('l2')])
    await seleccionar('Tema l1')
    const preparar = within(barra()).getByRole('button', { name: /^Preparar/ })
    expect(preparar).toHaveAttribute('aria-disabled', 'true')
    preparar.focus()
    expect(preparar).toHaveFocus()
    expect(
      screen.getAllByText('Ninguna de las seleccionadas necesita preparación.').length
    ).toBeGreaterThan(0)
  })

  it('el menú se cierra con Esc y devuelve el foco a «Más acciones»', async () => {
    montar([lista('l1')])
    await seleccionar('Tema l1')
    abrirMas()
    fireEvent.keyDown(screen.getAllByRole('menuitem')[0]!, { key: 'Escape' })
    expect(within(barra()).getByRole('button', { name: 'Más acciones' })).toHaveFocus()
  })
})

describe('«Preparar» por lotes (F8-3)', () => {
  it('previsualiza, muestra notas y privacidad, y prepara solo las que aplican', async () => {
    const preparar = vi.fn().mockResolvedValue({ aceptadas: ['b1', 'b2'], omitidas: [] })
    montar([borrador('b1'), borrador('b2'), lista('l1')], {
      preparacion: {
        previsualizar: vi.fn().mockResolvedValue([
          { id: 'b1', aplica: true, pasos: ['buscando_letra'] },
          { id: 'b2', aplica: true, pasos: ['comprobando', 'ajustando_fines'] },
          { id: 'l1', aplica: false, pasos: [], motivo: 'YA_LISTA' }
        ]),
        preparar
      } as unknown as ApiShinobi['preparacion']
    })
    await seleccionar('Tema b1', 'Tema b2', 'Tema l1')
    fireEvent.click(within(barra()).getByRole('button', { name: /^Preparar/ }))
    const d = await screen.findByRole('dialog', { name: 'Preparar 2 canciones' })
    expect(await within(d).findByText('Ya está lista: no se prepara')).toBeInTheDocument()
    expect(
      within(d).getByText(/Para buscar la letra se envían el título y el artista/)
    ).toBeInTheDocument()
    expect(
      within(d).getByText('Ya tiene letra: comprobará la letra y ajustará los fines')
    ).toBeInTheDocument()
    fireEvent.click(within(d).getByRole('button', { name: 'Preparar 2 canciones' }))
    await waitFor(() => expect(preparar).toHaveBeenCalledWith(['b1', 'b2']))
    expect(await screen.findByText(/2 canciones en cola para preparar/)).toBeInTheDocument()
    expect(screen.queryByRole('toolbar')).toBeNull()
    expect(screen.getByRole('button', { name: 'Seleccionar' })).toHaveFocus()
  })
})

describe('«Eliminar…» por lotes (F8-8 a F8-10)', () => {
  it('pide la casilla con 10 o más y confirma con la versión vista', async () => {
    const cs = Array.from({ length: 10 }, (_, i) => lista(`c${i + 1}`))
    const previsualizar = vi.fn().mockResolvedValue(prev(cs.map(() => ({}))))
    const ejecutar = vi.fn().mockResolvedValue({
      resultados: cs.map((c) => ({ id: c.id, resultado: 'hecho' }))
    })
    montar(cs, { biblioteca: { eliminarVarias: { previsualizar, ejecutar } } as never })
    await screen.findAllByRole('article')
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar visibles' }))
    fireEvent.keyDown(screen.getAllByRole('article')[0]!, { key: 'Delete' })
    const d = await screen.findByRole('dialog', { name: '¿Eliminar 10 canciones?' })
    await within(d).findByText(/Todas están listas para cantar/)
    expect(within(d).getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    const boton = within(d).getByRole('button', { name: 'Eliminar 10 canciones' })
    expect(boton).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(within(d).getByRole('checkbox'))
    fireEvent.click(within(d).getByRole('button', { name: 'Eliminar 10 canciones' }))
    await waitFor(() => expect(ejecutar).toHaveBeenCalledOnce())
    expect(ejecutar.mock.calls[0]![1]).toBe('v1')
    expect(await screen.findByText('10 canciones se movieron a la papelera.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('con CONFIRMACION_OBSOLETA repinta la lista con la vista previa nueva y no ejecuta nada', async () => {
    const nueva = prev(
      [{ id: 'c1' }, { id: 'c2', aplica: false, motivo: 'CANCION_EN_REPRODUCCION' }],
      'v2'
    )
    const previsualizar = vi.fn().mockResolvedValue(prev([{}, {}]))
    const ejecutar = vi
      .fn()
      .mockRejectedValueOnce({
        codigo: 'CONFIRMACION_OBSOLETA',
        mensaje: 'x',
        detalles: JSON.stringify(nueva)
      })
      .mockResolvedValue({ resultados: [{ id: 'c1', resultado: 'hecho' }] })
    montar([lista('c1'), lista('c2')], {
      biblioteca: { eliminarVarias: { previsualizar, ejecutar } } as never
    })
    await seleccionar('Tema c1', 'Tema c2')
    abrirMas()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Eliminar…' }))
    const d = await screen.findByRole('dialog')
    fireEvent.click(await within(d).findByRole('button', { name: 'Eliminar 2 canciones' }))
    expect(await within(d).findByText(/Mientras confirmabas cambió/)).toBeInTheDocument()
    expect(ejecutar).toHaveBeenCalledTimes(1)
    expect(
      await within(d).findByText(/se está reproduciendo en la otra pantalla/)
    ).toBeInTheDocument()
    expect(within(d).getByRole('button', { name: 'Eliminar 1 canción' })).toBeInTheDocument()
    fireEvent.click(within(d).getByRole('button', { name: 'Eliminar 1 canción' }))
    await waitFor(() => expect(ejecutar.mock.calls[1]![1]).toBe('v2'))
  })

  it('con un fallo, el resultado lo dice y «Reintentar las que faltan» solo reintenta esa', async () => {
    const previsualizar = vi.fn().mockResolvedValue(prev([{}, {}, {}, {}]))
    const ejecutar = vi.fn().mockResolvedValue({
      resultados: [
        { id: 'c1', resultado: 'hecho' },
        { id: 'c2', resultado: 'error', motivo: 'ERROR_INTERNO' },
        { id: 'c3', resultado: 'hecho' },
        { id: 'c4', resultado: 'hecho' }
      ]
    })
    montar([lista('c1'), lista('c2'), lista('c3'), lista('c4')], {
      biblioteca: { eliminarVarias: { previsualizar, ejecutar } } as never
    })
    await seleccionar('Tema c1', 'Tema c2', 'Tema c3', 'Tema c4')
    abrirMas()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Eliminar…' }))
    const d = await screen.findByRole('dialog')
    fireEvent.click(await within(d).findByRole('button', { name: 'Eliminar 4 canciones' }))
    expect(await within(d).findByText('No se pudo mover a la papelera.')).toBeInTheDocument()
    fireEvent.click(within(d).getByRole('button', { name: 'Reintentar las que faltan' }))
    await waitFor(() => expect(previsualizar).toHaveBeenLastCalledWith(['c2']))
  })
})

describe('«Editar datos…» por lotes (F8-7)', () => {
  it('muestra el impacto, el aviso de aspecto y manda solo el álbum marcado', async () => {
    const previsualizar = vi
      .fn()
      .mockImplementation(async (p: { album?: string | null }) =>
        p.album === undefined
          ? prev([{ aplica: false, motivo: 'NADA_QUE_HACER' }, {}])
          : prev(
              [
                { aplica: false, motivo: 'NADA_QUE_HACER' },
                { cambiaTema: true },
                { cambiaTema: true },
                {}
              ],
              'v9'
            )
      )
    const ejecutar = vi.fn().mockResolvedValue({
      resultados: [{ id: 'c1', resultado: 'hecho' }]
    })
    montar([lista('c1'), lista('c2'), lista('c3'), lista('c4')], {
      biblioteca: { editarDatosVarias: { previsualizar, ejecutar } } as never
    })
    await seleccionar('Tema c1', 'Tema c2', 'Tema c3', 'Tema c4')
    abrirMas()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar datos…' }))
    const d = await screen.findByRole('dialog', { name: 'Editar datos de 4 canciones' })
    const boton = within(d).getByRole('button', { name: /^Cambiar/ })
    expect(boton).toHaveAttribute('aria-disabled', 'true')
    expect(
      within(d).getAllByText('Marca el artista o el álbum para cambiarlo.').length
    ).toBeGreaterThan(0)
    fireEvent.change(within(d).getByLabelText('Álbum'), { target: { value: 'Disco nuevo' } })
    expect(within(d).getByRole('checkbox', { name: 'Cambiar el álbum' })).toBeChecked()
    expect(
      await within(d).findByText('Cambiará el álbum de 3 canciones; 1 ya lo tiene.')
    ).toBeInTheDocument()
    expect(
      within(d).getByText('⚠ 2 cambiarán de aspecto: usarán el tema de su nuevo álbum.')
    ).toBeInTheDocument()
    fireEvent.click(within(d).getByRole('button', { name: 'Cambiar 3 canciones' }))
    await waitFor(() => expect(ejecutar).toHaveBeenCalled())
    expect(ejecutar.mock.calls[0]![0]).toEqual({
      ids: ['c1', 'c2', 'c3', 'c4'],
      album: 'Disco nuevo',
      version: 'v9'
    })
  })

  it('un campo marcado y vacío quita el dato', async () => {
    const previsualizar = vi.fn().mockResolvedValue(prev([{}]))
    montar([lista('c1', { album: 'Algo' })], {
      biblioteca: { editarDatosVarias: { previsualizar, ejecutar: vi.fn() } } as never
    })
    await seleccionar('Tema c1')
    abrirMas()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar datos…' }))
    const d = await screen.findByRole('dialog')
    fireEvent.click(within(d).getByRole('checkbox', { name: 'Cambiar el álbum' }))
    fireEvent.change(within(d).getByLabelText('Álbum'), { target: { value: '' } })
    expect(await within(d).findByText('Quedarán sin álbum.')).toBeInTheDocument()
    await waitFor(() =>
      expect(previsualizar).toHaveBeenLastCalledWith({ ids: ['c1'], album: null })
    )
  })
})

describe('«Editar datos…» con una sesión en vivo (F8-12, 0292)', () => {
  it('la canción que suena sale omitida con su texto y las demás se cambian', async () => {
    const previsualizar = vi.fn().mockResolvedValue(prev([{}, {}]))
    const ejecutar = vi.fn().mockResolvedValue({
      resultados: [
        { id: 'c1', resultado: 'hecho' },
        { id: 'c2', resultado: 'omitida', motivo: 'EDICION_BLOQUEADA' }
      ]
    })
    montar([lista('c1'), lista('c2')], {
      biblioteca: { editarDatosVarias: { previsualizar, ejecutar } }
    })
    await seleccionar('Tema c1', 'Tema c2')
    abrirMas()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar datos…' }))
    const d = await screen.findByRole('dialog')
    fireEvent.change(within(d).getByLabelText('Artista'), { target: { value: 'Nuevo' } })
    await within(d).findByText('Cambiará el artista de 2 canciones.')
    fireEvent.click(within(d).getByRole('button', { name: 'Cambiar 2 canciones' }))
    expect(
      await within(d).findByText(
        'No se ha cambiado: está sonando en la otra pantalla. Edítala cuando termine.'
      )
    ).toBeInTheDocument()
    expect(within(d).getByText('Hecho')).toBeInTheDocument()
    // Nada que reintentar: la omitida no es un fallo.
    expect(within(d).queryByRole('button', { name: 'Reintentar las fallidas' })).toBeNull()
  })
})

describe('«A la cola» por lotes (F8-6)', () => {
  it('añade las Listas, anuncia con [Deshacer] y lo deshace con las entradas devueltas', async () => {
    const { sesion } = montarConSesion(
      [lista('l1'), lista('l2'), borrador('b1')],
      estadoSinCola(),
      {}
    )
    await screen.findAllByRole('article')
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar' }))
    for (const t of ['Tema l1', 'Tema l2', 'Tema b1'])
      fireEvent.click(screen.getByRole('checkbox', { name: `Seleccionar «${t}»` }))
    abrirMas()
    fireEvent.click(screen.getByRole('menuitem', { name: 'A la cola (2 de 3)' }))
    expect(
      await screen.findByText('2 canciones se agregaron al final de la cola.')
    ).toBeInTheDocument()
    expect(sesion.llamadas).toContainEqual(['cola.agregarVarias', ['l1', 'l2']])
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => expect(sesion.llamadas).toContainEqual(['cola.quitarVarias', ['e1', 'e2']]))
  })

  it('durante una sesión sigue funcionando y la que suena sale omitida al eliminar', async () => {
    const previsualizar = vi
      .fn()
      .mockResolvedValue(prev([{ aplica: false, motivo: 'CANCION_EN_REPRODUCCION' }]))
    montarConSesion([lista('cancion-1')], estadoP1(), {
      biblioteca: { eliminarVarias: { previsualizar, ejecutar: vi.fn() } } as never
    })
    await screen.findAllByRole('article')
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Seleccionar «Tema cancion-1»' }))
    fireEvent.keyDown(screen.getAllByRole('article')[0]!, { key: 'Delete' })
    const d = await screen.findByRole('dialog')
    expect(await within(d).findByText(/No se elimina: se está reproduciendo/)).toBeInTheDocument()
  })
})
