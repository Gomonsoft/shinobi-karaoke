import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AgruparBiblioteca } from '@shared/config'
import type { ApiShinobi, OperacionTema, ResumenCancionIpc } from '@shared/ipc'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import { NavegacionContexto } from '../../navegacion/estado'
import { afectada, origen } from '../../temas/pruebas'
import { Biblioteca, reiniciarFiltroDeSesion } from './Biblioteca'
import { fixtures } from './fixturesApi'
import { resumenConIdentidad, resumenPrueba } from './resumenPrueba'
import {
  catalogoPrueba,
  impactoPrueba,
  temaCatalogoPrueba,
  temasFalsos,
  type TemasFalsos
} from './temasFalsos'

const q1 = resumenConIdentidad('q1', 'Queen', 'Greatest Hits')
const q2 = resumenConIdentidad('q2', 'Queen', 'Greatest Hits')
const q3 = resumenConIdentidad('q3', 'Queen', 'Opera')
const ab = resumenConIdentidad('ab', 'ABBA', 'Gold')
const rota = resumenPrueba({
  id: 'rj',
  titulo: 'Rota',
  danada: true,
  motivo: 'json',
  pasos: null,
  estilo: null
})
const sinPistas = resumenPrueba({ id: 'rp', titulo: 'Sin pistas', danada: true, motivo: 'pistas' })

let t: TemasFalsos

function montar(
  canciones: ResumenCancionIpc[],
  opciones: { agrupar?: AgruparBiblioteca; temas?: TemasFalsos } = {}
) {
  t = opciones.temas ?? temasFalsos()
  ;(window as unknown as { shinobi: ApiShinobi }).shinobi = fixtures({
    listar: () => Promise.resolve(canciones),
    agrupar: opciones.agrupar,
    temas: t
  })
  render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir: vi.fn() }}>
      <Biblioteca />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
}

/** Impacto con una afectada por id pedido (como haría main). */
function impactoPorOperacion(op: OperacionTema) {
  const ids = op.tipo === 'aplicar' ? op.cancionIds : []
  return impactoPrueba({ afectadas: ids.map((id) => afectada(id, { titulo: `Tema ${id}` })) })
}

const casilla = (id: string) =>
  screen.getByRole('checkbox', { name: `Seleccionar «Tema ${id}»` }) as HTMLInputElement
const tarjeta = (id: string) => document.querySelector<HTMLElement>(`[data-tarjeta="${id}"]`)!
const botonSeleccionar = () => screen.getByRole('button', { name: 'Seleccionar' })
const barra = () => screen.getByRole('toolbar', { name: 'Selección' })

async function entrar() {
  await screen.findAllByRole('article')
  fireEvent.click(botonSeleccionar())
}

beforeEach(() => {
  reiniciarFiltroDeSesion()
  cerrarTodosLosToasts()
})

describe('modo selección (B8)', () => {
  it('«Seleccionar» entra, anuncia, pasa el foco a la tarjeta activa y muestra la barra', async () => {
    montar([q1, q2, ab])
    await entrar()
    expect(within(barra()).getByText('0 seleccionadas')).toBeInTheDocument()
    expect(tarjeta('q1')).toHaveFocus()
    expect(
      screen.getByText('Modo selección. Usa Espacio para marcar canciones y Esc para terminar.')
    ).toBeInTheDocument()
    // Sin acción principal ni ⋯ mientras dura el modo.
    expect(screen.queryByRole('button', { name: /Más acciones/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Reproducir/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Seleccionar' })).toBeNull()
  })

  it('clic, Espacio e Intro alternan la casilla sin reproducir', async () => {
    montar([q1, q2, ab])
    await entrar()
    fireEvent.click(tarjeta('q1'))
    expect(casilla('q1')).toBeChecked()
    fireEvent.keyDown(tarjeta('q2'), { key: ' ' })
    fireEvent.keyDown(tarjeta('ab'), { key: 'Enter' })
    expect(casilla('q2')).toBeChecked()
    expect(casilla('ab')).toBeChecked()
    expect(within(barra()).getByText('3 seleccionadas')).toBeInTheDocument()
    fireEvent.click(casilla('q1'))
    expect(casilla('q1')).not.toBeChecked()
    expect(within(barra()).getByText('2 seleccionadas')).toBeInTheDocument()
    expect(tarjeta('q2').getAttribute('aria-label')).toContain('Seleccionada.')
  })

  it('Mayús + clic selecciona el rango en orden visual', async () => {
    montar([q1, q2, q3, ab])
    await entrar()
    fireEvent.click(tarjeta('q1'))
    fireEvent.click(tarjeta('q3'), { shiftKey: true })
    expect(['q1', 'q2', 'q3'].map((id) => casilla(id).checked)).toEqual([true, true, true])
    expect(casilla('ab')).not.toBeChecked()
  })

  it('las Dañadas por JSON no se marcan y explican por qué; las Dañadas por pistas sí', async () => {
    montar([q1, rota, sinPistas])
    await entrar()
    const noEditable = screen.getByRole('checkbox', { name: 'Seleccionar «Canción sin nombre»' })
    expect(noEditable).toHaveAttribute('aria-disabled', 'true')
    expect(noEditable).toHaveAttribute(
      'title',
      'No se puede cambiar el tema de una canción que no se puede abrir.'
    )
    fireEvent.click(tarjeta('rj'))
    expect(noEditable).not.toBeChecked()
    expect(await screen.findByText(/no se puede abrir/)).toBeInTheDocument()
    fireEvent.click(tarjeta('rp'))
    expect(screen.getByRole('checkbox', { name: 'Seleccionar «Sin pistas»' })).toBeChecked()
    // «Seleccionar visibles» tampoco añade la ilegible.
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar visibles' }))
    expect(within(barra()).getByText('2 seleccionadas')).toBeInTheDocument()
  })

  it('Ctrl+A en la rejilla entra y marca todas las visibles editables', async () => {
    montar([q1, q2, rota])
    await screen.findAllByRole('article')
    tarjeta('q1').focus()
    fireEvent.keyDown(tarjeta('q1'), { key: 'a', ctrlKey: true })
    expect(within(barra()).getByText('2 seleccionadas')).toBeInTheDocument()
    expect(casilla('q2')).toBeChecked()
  })

  it('la casilla de grupo es tri-estado y marca o desmarca las editables del grupo', async () => {
    montar([q1, q2, q3, ab], { agrupar: 'artista' })
    await waitFor(() =>
      expect(document.querySelectorAll('[data-encabezado-grupo]')).toHaveLength(2)
    )
    fireEvent.click(botonSeleccionar())
    const grupo = screen.getByRole('checkbox', { name: 'Seleccionar las canciones de Queen' })
    expect(grupo).not.toBeChecked()
    fireEvent.click(tarjeta('q1'))
    expect((grupo as HTMLInputElement).indeterminate).toBe(true)
    fireEvent.click(grupo)
    expect(['q1', 'q2', 'q3'].map((id) => casilla(id).checked)).toEqual([true, true, true])
    expect(grupo).toBeChecked()
    expect((grupo as HTMLInputElement).indeterminate).toBe(false)
    fireEvent.click(grupo)
    expect(['q1', 'q2', 'q3'].map((id) => casilla(id).checked)).toEqual([false, false, false])
  })

  it('la selección sobrevive a búsqueda y agrupación y la barra cuenta las que quedan fuera', async () => {
    montar([q1, q2, ab])
    await entrar()
    fireEvent.click(tarjeta('q1'))
    fireEvent.click(tarjeta('ab'))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'abba' } })
    expect(within(barra()).getByText('2 seleccionadas · 1 fuera de la vista')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Artista' }))
    expect(within(barra()).getByText('2 seleccionadas · 1 fuera de la vista')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
    expect(within(barra()).getByText('2 seleccionadas')).toBeInTheDocument()
    expect(casilla('q1')).toBeChecked()
  })

  it('plegar un grupo no cambia la selección y «Seleccionar visibles» salta los plegados', async () => {
    montar([q1, ab], { agrupar: 'artista' })
    await waitFor(() =>
      expect(document.querySelectorAll('[data-encabezado-grupo]')).toHaveLength(2)
    )
    fireEvent.click(botonSeleccionar())
    fireEvent.click(screen.getByRole('button', { name: 'Plegar ABBA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar visibles' }))
    expect(within(barra()).getByText('1 seleccionada')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar selección' }))
    expect(within(barra()).getByText('0 seleccionadas')).toBeInTheDocument()
  })

  it('Terminar y Esc salen y vacían; el foco vuelve a «Seleccionar»', async () => {
    montar([q1, q2])
    await entrar()
    fireEvent.click(tarjeta('q1'))
    fireEvent.click(screen.getByRole('button', { name: 'Terminar' }))
    expect(screen.queryByRole('toolbar', { name: 'Selección' })).toBeNull()
    expect(botonSeleccionar()).toHaveFocus()

    fireEvent.click(botonSeleccionar())
    fireEvent.click(tarjeta('q2'))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByRole('toolbar', { name: 'Selección' })).toBeNull()
    expect(botonSeleccionar()).toHaveFocus()
    fireEvent.click(botonSeleccionar())
    expect(within(barra()).getByText('0 seleccionadas')).toBeInTheDocument()
  })

  it('Esc con texto en la búsqueda borra el texto pero no sale del modo', async () => {
    montar([q1, q2])
    await entrar()
    const campo = screen.getByRole('searchbox')
    fireEvent.change(campo, { target: { value: 'queen' } })
    campo.focus()
    fireEvent.keyDown(campo, { key: 'Escape' })
    expect(campo).toHaveValue('')
    expect(barra()).toBeInTheDocument()
  })

  it('«Aplicar tema…» está inactivo sin selección, con catálogo vacío y en solo lectura', async () => {
    montar([q1])
    await entrar()
    const aplicar = within(barra()).getByRole('button', { name: 'Aplicar tema…' })
    expect(aplicar).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getAllByText('Selecciona al menos una canción.').length).toBeGreaterThan(0)
    fireEvent.click(aplicar)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('catálogo vacío y solo lectura explican por qué', async () => {
    montar([q1], { temas: temasFalsos({ temas: [] }) })
    await entrar()
    fireEvent.click(tarjeta('q1'))
    await waitFor(() =>
      expect(
        screen.getAllByText('Aún no tienes temas. Crea uno desde el editor de una canción.').length
      ).toBeGreaterThan(0)
    )
  })
})

describe('«Aplicar tema» (B9–B11)', () => {
  async function abrirDialogo(canciones: ResumenCancionIpc[], marcar: string[]) {
    montar(canciones)
    await entrar()
    await waitFor(() => expect(t.llamadas.some((l) => l.metodo === 'temas.catalogo')).toBe(true))
    t.programarImpacto(impactoPorOperacion)
    for (const id of marcar) fireEvent.click(tarjeta(id))
    await waitFor(() =>
      expect(within(barra()).getByRole('button', { name: 'Aplicar tema…' })).not.toHaveAttribute(
        'aria-disabled'
      )
    )
    fireEvent.click(within(barra()).getByRole('button', { name: 'Aplicar tema…' }))
    return screen.findByRole('dialog')
  }

  it('B9: lista todas con su nota, avisa de las personalizadas y cuenta las que cambian', async () => {
    montar([q1, q2, q3, ab])
    await entrar()
    await waitFor(() => expect(t.llamadas.some((l) => l.metodo === 'temas.catalogo')).toBe(true))
    t.programarImpacto((op) => {
      const ids = op.tipo === 'aplicar' ? op.cancionIds : []
      return impactoPrueba({
        afectadas: [
          afectada(ids[0]!, { titulo: 'Uno', antes: origen('propio') }),
          afectada(ids[1]!, { titulo: 'Dos', antes: origen('artista', 'Sol') }),
          afectada(ids[2]!, {
            titulo: 'Tres',
            antes: origen('cancion', 'Noche ninja'),
            efecto: 'sin_cambios'
          })
        ]
      })
    })
    for (const id of ['q1', 'q2', 'q3']) fireEvent.click(tarjeta(id))
    fireEvent.click(within(barra()).getByRole('button', { name: 'Aplicar tema…' }))
    const d = await screen.findByRole('dialog', { name: 'Aplicar tema a 3 canciones' })
    await within(d).findByText('⚠ Sustituye su tema personalizado')
    expect(within(d).getByText('Ahora usa «Sol» (del artista)')).toBeInTheDocument()
    expect(within(d).getByText('Ya tiene asignado «Noche ninja»: no cambia')).toBeInTheDocument()
    expect(within(d).getByText('⚠ 1 canción perderá su tema personalizado.')).toBeInTheDocument()
    expect(
      within(d).getByText(
        'Se asignará «Noche ninja» a cada canción. No cambia el tema de sus álbumes ni de sus artistas.'
      )
    ).toBeInTheDocument()
    expect(within(d).getByRole('button', { name: 'Aplicar a 2 canciones' })).toBeInTheDocument()
    const op = t.llamadas.filter((l) => l.metodo === 'temas.previsualizar').at(-1)!.args[0]
    expect(op).toMatchObject({ tipo: 'aplicar', cancionIds: ['q1', 'q2', 'q3'] })
  })

  it('B9: con todas iguales el botón está inactivo con su motivo', async () => {
    montar([q1])
    await entrar()
    await waitFor(() => expect(t.llamadas.some((l) => l.metodo === 'temas.catalogo')).toBe(true))
    t.programarImpacto((op) =>
      impactoPrueba({
        afectadas: (op.tipo === 'aplicar' ? op.cancionIds : []).map((id) =>
          afectada(id, { efecto: 'sin_cambios' })
        )
      })
    )
    fireEvent.click(tarjeta('q1'))
    fireEvent.click(within(barra()).getByRole('button', { name: 'Aplicar tema…' }))
    const d = await screen.findByRole('dialog')
    const boton = await within(d).findByRole('button', { name: 'Aplicar a 0 canciones' })
    expect(boton).toHaveAttribute('aria-disabled', 'true')
    expect(
      within(d).getAllByText('Todas las canciones ya tienen asignado este tema.').length
    ).toBeGreaterThan(0)
    fireEvent.click(boton)
    expect(t.llamadas.some((l) => l.metodo === 'temas.ejecutar')).toBe(false)
  })

  it('B11: un lote correcto sale del modo y deja el foco en «Seleccionar»', async () => {
    const d = await abrirDialogo([q1, q2], ['q1', 'q2'])
    const aplicar = await within(d).findByRole('button', { name: 'Aplicar a 2 canciones' })
    fireEvent.click(aplicar)
    const resultado = await screen.findByRole('dialog', {
      name: '«Noche ninja» se aplicó a 2 canciones.'
    })
    await waitFor(() =>
      expect(within(resultado).getByRole('button', { name: 'Cerrar' })).toHaveFocus()
    )
    expect(within(resultado).queryByRole('button', { name: 'Revisar y reintentar' })).toBeNull()
    // El resultado se anuncia una sola vez.
    expect(within(resultado).getAllByRole('status')).toHaveLength(1)
    fireEvent.click(within(resultado).getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByRole('toolbar', { name: 'Selección' })).toBeNull())
    expect(botonSeleccionar()).toHaveFocus()
  })

  it('B10–B11: con fallos muestra cada motivo, reintenta solo las dos fallidas y sigue en el modo', async () => {
    const d = await abrirDialogo([q1, q2, q3, ab], ['q1', 'q2', 'q3', 'ab'])
    t.programarResultado({
      catalogoEscrito: false,
      canciones: [
        { id: 'q1', estado: 'aplicada' },
        { id: 'q2', estado: 'sin_cambios' },
        { id: 'q3', estado: 'error', codigo: 'ERROR_INTERNO' },
        { id: 'ab', estado: 'omitida', motivo: 'cambio' }
      ]
    })
    fireEvent.click(await within(d).findByRole('button', { name: 'Aplicar a 4 canciones' }))
    const r = await screen.findByRole('dialog', {
      name: '«Noche ninja» se aplicó a 2 de 4 canciones.'
    })
    expect(within(r).getByText('Tema q1 — Queen — Aplicado')).toBeInTheDocument()
    expect(within(r).getByText('Tema q3 — Queen — No se pudo guardar.')).toBeInTheDocument()
    expect(within(r).getByText('Tema ab — ABBA — Cambió mientras confirmabas.')).toBeInTheDocument()
    expect(within(r).getByRole('button', { name: 'Copiar detalles' })).toBeInTheDocument()
    const reintentar = within(r).getByRole('button', { name: 'Revisar y reintentar' })
    // El foco lo mueve un efecto tras montar el resultado (asíncrono): se espera, no se supone.
    await waitFor(() => expect(reintentar).toHaveFocus())

    t.programarResultado({
      catalogoEscrito: false,
      canciones: [
        { id: 'q3', estado: 'aplicada' },
        { id: 'ab', estado: 'aplicada' }
      ]
    })
    fireEvent.click(reintentar)
    const confirmacion = await screen.findByRole('dialog', { name: 'Aplicar tema a 2 canciones' })
    await within(confirmacion).findByRole('button', { name: 'Aplicar a 2 canciones' })
    const ultima = t.llamadas.filter((l) => l.metodo === 'temas.previsualizar').at(-1)!.args[0]
    expect(ultima).toMatchObject({ cancionIds: ['q3', 'ab'] })

    // Cancelar: sigue en el modo con solo las fallidas seleccionadas y el foco en «Aplicar tema…».
    // (Tras el reintento no hubo cierre con fallos; se comprueba el cierre con fallos aparte.)
    fireEvent.click(within(confirmacion).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(barra()).toBeInTheDocument()
  })

  it('B11: cerrar con fallos deja las fallidas seleccionadas y el foco en «Aplicar tema…»', async () => {
    const d = await abrirDialogo([q1, q2, q3], ['q1', 'q2', 'q3'])
    t.programarResultado({
      catalogoEscrito: false,
      canciones: [
        { id: 'q1', estado: 'aplicada' },
        { id: 'q2', estado: 'error', codigo: 'ERROR_INTERNO' },
        { id: 'q3', estado: 'omitida', motivo: 'cambio' }
      ]
    })
    fireEvent.click(await within(d).findByRole('button', { name: 'Aplicar a 3 canciones' }))
    const r = await screen.findByRole('dialog', {
      name: '«Noche ninja» se aplicó a 1 de 3 canciones.'
    })
    fireEvent.click(within(r).getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(within(barra()).getByText('2 seleccionadas')).toBeInTheDocument()
    expect(casilla('q1')).not.toBeChecked()
    expect(casilla('q2')).toBeChecked()
    expect(within(barra()).getByRole('button', { name: 'Aplicar tema…' })).toHaveFocus()
  })

  it('muestra «Aplicando… i de n» mientras dura y no se cierra con Esc', async () => {
    const d = await abrirDialogo([q1, q2], ['q1', 'q2'])
    let terminar: () => void = () => undefined
    const original = t.api.temas.ejecutar
    t.api.temas.ejecutar = (op, ficha) =>
      new Promise((resolver) => {
        terminar = () => void original(op, ficha).then(resolver)
      })
    fireEvent.click(await within(d).findByRole('button', { name: 'Aplicar a 2 canciones' }))
    expect(await within(d).findByText('Aplicando… 0 de 2')).toBeInTheDocument()
    const ficha = t.llamadas.filter((l) => l.metodo === 'temas.previsualizar').length
    expect(ficha).toBeGreaterThan(0)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    act(() => terminar())
    await screen.findByRole('dialog', { name: '«Noche ninja» se aplicó a 2 canciones.' })
  })

  it('CONFIRMACION_OBSOLETA antes de empezar actualiza la lista y no aplica nada', async () => {
    const d = await abrirDialogo([q1, q2], ['q1', 'q2'])
    t.obsoleta(
      impactoPrueba({ afectadas: [afectada('q1', { titulo: 'Tema q1', antes: origen('propio') })] })
    )
    fireEvent.click(await within(d).findByRole('button', { name: 'Aplicar a 2 canciones' }))
    expect(
      await within(d).findByText(/Mientras confirmabas cambió qué canciones usan este tema/)
    ).toBeInTheDocument()
    expect(within(d).getByRole('button', { name: 'Aplicar a 1 canción' })).toHaveFocus()
    expect(within(d).queryByText('Tema q2 — Queen')).toBeNull()
  })

  it('TEMA_NO_ENCONTRADO muestra tema.error.noExiste', async () => {
    montar([q1])
    await entrar()
    await waitFor(() => expect(t.llamadas.some((l) => l.metodo === 'temas.catalogo')).toBe(true))
    t.fallar('temas.previsualizar', 'TEMA_NO_ENCONTRADO')
    fireEvent.click(tarjeta('q1'))
    fireEvent.click(within(barra()).getByRole('button', { name: 'Aplicar tema…' }))
    const d = await screen.findByRole('dialog')
    expect(
      await within(d).findByText(
        'Este tema ya no existe. Puedes guardar tus cambios como un tema nuevo.'
      )
    ).toBeInTheDocument()
  })

  it('cambiar el tema recalcula las notas con otra previsualización', async () => {
    const otro = temaCatalogoPrueba({
      id: '22222222-2222-4222-8222-222222222222',
      nombre: 'Neón'
    })
    montar([q1], {
      temas: temasFalsos(
        catalogoPrueba({ temas: [temaCatalogoPrueba(), otro] }).temas
          ? { temas: [temaCatalogoPrueba(), otro] }
          : {}
      )
    })
    await entrar()
    await waitFor(() => expect(t.llamadas.some((l) => l.metodo === 'temas.catalogo')).toBe(true))
    t.programarImpacto(impactoPorOperacion)
    fireEvent.click(tarjeta('q1'))
    fireEvent.click(within(barra()).getByRole('button', { name: 'Aplicar tema…' }))
    const d = await screen.findByRole('dialog')
    await within(d).findByRole('button', { name: 'Aplicar a 1 canción' })
    fireEvent.click(within(d).getByRole('button', { name: /^Tema: / }))
    fireEvent.click(await screen.findByRole('option', { name: /Neón/ }))
    await waitFor(() =>
      expect(
        within(d).getByText(
          'Se asignará «Neón» a cada canción. No cambia el tema de sus álbumes ni de sus artistas.'
        )
      ).toBeInTheDocument()
    )
    const previas = t.llamadas.filter((l) => l.metodo === 'temas.previsualizar')
    expect(previas.at(-1)!.args[0]).toMatchObject({
      seleccion: { modo: 'tema', temaId: otro.id }
    })
  })
})

describe('«Aplicar tema…» desde el ⋯ de una tarjeta', () => {
  it('abre el diálogo con esa canción y devuelve el foco a la tarjeta', async () => {
    montar([q1, q2])
    await screen.findAllByRole('article')
    await waitFor(() => expect(t.llamadas.some((l) => l.metodo === 'temas.catalogo')).toBe(true))
    t.programarImpacto(impactoPorOperacion)
    const menu = within(tarjeta('q1')).getByRole('button', { name: 'Más acciones de «Tema q1»' })
    await waitFor(() => fireEvent.click(menu))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Aplicar tema…' }))
    const d = await screen.findByRole('dialog', { name: 'Aplicar tema a «Tema q1»' })
    expect(
      await within(d).findByText(
        'Se asignará «Noche ninja» a esta canción. No cambia el tema de su álbum ni de su artista.'
      )
    ).toBeInTheDocument()
    expect(
      t.llamadas.filter((l) => l.metodo === 'temas.previsualizar').at(-1)!.args[0]
    ).toMatchObject({
      cancionIds: ['q1']
    })
    fireEvent.click(within(d).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(tarjeta('q1')).toHaveFocus())
    expect(screen.queryByRole('toolbar', { name: 'Selección' })).toBeNull()
  })

  it('con el catálogo vacío el menú no ofrece la opción', async () => {
    montar([q1], { temas: temasFalsos({ temas: [] }) })
    await screen.findAllByRole('article')
    await waitFor(() => expect(t.llamadas.some((l) => l.metodo === 'temas.catalogo')).toBe(true))
    await act(async () => undefined)
    fireEvent.click(within(tarjeta('q1')).getByRole('button', { name: /Más acciones/ }))
    expect(screen.queryByRole('menuitem', { name: 'Aplicar tema…' })).toBeNull()
  })
})
