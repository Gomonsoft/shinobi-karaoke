import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AgruparBiblioteca } from '@shared/config'
import type { ApiShinobi, EventoCancionIpc, ResumenCancionIpc } from '@shared/ipc'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { ContenedorToasts } from '../../componentes/Toasts'
import { NavegacionContexto } from '../../navegacion/estado'
import { Biblioteca, reiniciarFiltroDeSesion } from './Biblioteca'
import { fixtures } from './fixturesApi'
import { aparienciaResumenPrueba, resumenConIdentidad } from './resumenPrueba'

const ID_TEMA = '0b9f7a4e-3c1d-4f6a-9d2e-5a8b1c7e4f30'

function montar(
  canciones: ResumenCancionIpc[],
  opciones: {
    agrupar?: AgruparBiblioteca
    biblioteca?: Partial<ApiShinobi['biblioteca']>
    actualizarConfig?: (parcial: unknown) => Promise<unknown>
  } = {}
) {
  let emitir: (e: EventoCancionIpc) => void = () => undefined
  ;(window as unknown as { shinobi: ApiShinobi }).shinobi = fixtures({
    listar: () => Promise.resolve(canciones),
    alCambiarCancion: (cb) => {
      emitir = cb
      return () => undefined
    },
    ...opciones
  })
  render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir: vi.fn() }}>
      <Biblioteca />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
  return { emitir: (e: EventoCancionIpc) => act(() => emitir(e)) }
}

const ids = () => screen.queryAllByRole('article').map((t) => t.getAttribute('data-tarjeta'))
const encabezados = () =>
  Array.from(document.querySelectorAll('[data-encabezado-grupo] h2')).map((h) => h.textContent)
const tarjeta = (id: string) => document.querySelector<HTMLElement>(`[data-tarjeta="${id}"]`)!
const anuncio = () => document.querySelector('p[role="status"]')!

const queen1 = resumenConIdentidad('q1', 'Queen', 'Greatest Hits')
const queen2 = resumenConIdentidad('q2', 'QUEEN ', 'A Night at the Opera')
const abba = resumenConIdentidad('ab', 'ABBA', 'Greatest Hits')
const suelta = resumenConIdentidad('su', '', null)
const todas = [queen1, queen2, abba, suelta]

beforeEach(() => {
  reiniciarFiltroDeSesion()
  cerrarTodosLosToasts()
})

describe('Agrupar por', () => {
  it('B1: sin agrupar por defecto; elegir Artista agrupa y se guarda en config', async () => {
    const actualizarConfig = vi.fn().mockResolvedValue({})
    montar(todas, { actualizarConfig })
    await screen.findAllByRole('article')
    expect(encabezados()).toEqual([])
    expect(screen.getByRole('radio', { name: 'Sin agrupar' })).toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: 'Artista' }))
    expect(actualizarConfig).toHaveBeenCalledWith({ biblioteca: { agrupar: 'artista' } })
    expect(encabezados()).toEqual([
      'ABBA· 1 canción',
      'Queen· 2 canciones',
      'Sin artista· 1 canción'
    ])
  })

  it('B1: usa el valor guardado en config y sobrevive a volver a montar la vista', async () => {
    montar(todas, { agrupar: 'album' })
    await waitFor(() => expect(encabezados()).toHaveLength(4))
    expect(screen.getByRole('radio', { name: 'Álbum' })).toBeChecked()
    cleanup()
    montar(todas, { agrupar: 'album' })
    await screen.findAllByRole('article')
    expect(screen.getByRole('radio', { name: 'Álbum' })).toBeChecked()
  })

  it('B1: un fallo al guardar no impide agrupar', async () => {
    montar(todas, { actualizarConfig: () => Promise.reject(new Error('x')) })
    await screen.findAllByRole('article')
    fireEvent.click(screen.getByRole('radio', { name: 'Artista' }))
    expect(encabezados()).toHaveLength(3)
  })

  it('B2–B3: vista por álbum separa homónimos y deja «Sin álbum» al final sin tema', async () => {
    montar(todas, { agrupar: 'album' })
    await waitFor(() => expect(encabezados()).toHaveLength(4))
    expect(encabezados().map((t) => t?.split('·')[0])).toEqual([
      'Greatest Hits — ABBA',
      'A Night at the Opera — QUEEN',
      'Greatest Hits — Queen',
      'Sin álbum'
    ])
    expect(
      screen.getByText('Añade el álbum con «Editar datos» para darles un tema.')
    ).toBeInTheDocument()
  })

  it('plegar oculta las tarjetas, anuncia aria-expanded y se conserva al volver', async () => {
    montar(todas, { agrupar: 'artista' })
    const boton = await screen.findByRole('button', { name: 'Plegar Queen' })
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(boton)
    expect(screen.getByRole('button', { name: 'Desplegar Queen' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(ids()).toEqual(['ab', 'su'])
    cleanup()
    montar(todas, { agrupar: 'artista' })
    expect(await screen.findByRole('button', { name: 'Desplegar Queen' })).toBeInTheDocument()
  })

  it('B4: busca en álbum por palabras, muestra «v de n» y anuncia el recuento una vez', async () => {
    montar(todas, { agrupar: 'artista' })
    await screen.findAllByRole('article')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'queen   greatest' } })
    expect(ids()).toEqual(['q1'])
    expect(encabezados()).toEqual(['Queen· 1 de 2 canciones'])
    expect(anuncio()).toHaveTextContent('')
    await waitFor(() => expect(anuncio()).toHaveTextContent('1 canción'), { timeout: 2000 })
  })
})

describe('tarjeta: tema y portada', () => {
  const urlMiniatura = 'shinobi-media://x/fuente/miniatura.jpg'
  const velo = '[class*="velo"]'
  const conMiniatura = (procedencia: 'predeterminado' | 'predeterminado_anterior' | 'artista') =>
    resumenConIdentidad('y', 'Queen', null, {
      miniatura: urlMiniatura,
      apariencia: aparienciaResumenPrueba({
        procedencia,
        temaId: ID_TEMA,
        temaNombre: 'Noche ninja',
        neutra: procedencia !== 'artista'
      })
    })

  it('B6/B14: la línea muestra nombre y procedencia; la miniatura solo con neutra', async () => {
    montar([conMiniatura('predeterminado')])
    const t = await screen.findByRole('article')
    expect(within(t).getByText('Noche ninja · predeterminado')).toBeInTheDocument()
    expect(t.querySelector(velo)).not.toBeNull()
    cleanup()
    montar([conMiniatura('artista')])
    const a = await screen.findByRole('article')
    expect(within(a).getByText('Noche ninja · del artista')).toBeInTheDocument()
    expect(a.querySelector(velo)).toBeNull()
  })

  it('B14: de predeterminado a predeterminado anterior la portada no cambia y la línea sí', async () => {
    const { emitir } = montar([conMiniatura('predeterminado')])
    await screen.findByRole('article')
    emitir({ id: 'y', resumen: conMiniatura('predeterminado_anterior') })
    const t = await screen.findByRole('article')
    expect(within(t).getByText('Noche ninja · predeterminado anterior')).toBeInTheDocument()
    expect(t.querySelector(velo)).not.toBeNull()
  })

  it('el texto completo va en title y en el nombre accesible', async () => {
    montar([conMiniatura('predeterminado_anterior')])
    const t = await screen.findByRole('article')
    expect(t.querySelector('[data-linea-tema]')).toHaveAttribute(
      'title',
      'Noche ninja · predeterminado anterior'
    )
    expect(t).toHaveAccessibleName(/Tema: Noche ninja · predeterminado anterior\.$/)
  })

  it('tema no disponible', async () => {
    montar([
      resumenConIdentidad('z', 'Queen', null, {
        apariencia: aparienciaResumenPrueba({ procedencia: 'respaldo', neutra: false })
      })
    ])
    expect(await screen.findByText('Tema no disponible')).toBeInTheDocument()
  })
})

describe('teclado en vistas agrupadas', () => {
  it('B13: las flechas cruzan grupos, Inicio/Fin son del grupo y Ctrl+Fin de toda la biblioteca', async () => {
    montar(todas, { agrupar: 'artista' })
    await screen.findAllByRole('article')
    // Orden visual: ab | q1 q2 | su. Un solo punto de tabulación.
    expect(ids()).toEqual(['ab', 'q1', 'q2', 'su'])
    expect(document.querySelectorAll('[data-tarjeta][tabindex="0"]')).toHaveLength(1)
    tarjeta('ab').focus()
    fireEvent.keyDown(tarjeta('ab'), { key: 'ArrowRight' })
    expect(tarjeta('q1')).toHaveFocus()
    fireEvent.keyDown(tarjeta('q1'), { key: 'End' })
    expect(tarjeta('q2')).toHaveFocus()
    fireEvent.keyDown(tarjeta('q2'), { key: 'Home' })
    expect(tarjeta('q1')).toHaveFocus()
    fireEvent.keyDown(tarjeta('q1'), { key: 'End', ctrlKey: true })
    expect(tarjeta('su')).toHaveFocus()
    fireEvent.keyDown(tarjeta('su'), { key: 'Home', ctrlKey: true })
    expect(tarjeta('ab')).toHaveFocus()
  })

  it('los grupos plegados se saltan', async () => {
    montar(todas, { agrupar: 'artista' })
    fireEvent.click(await screen.findByRole('button', { name: 'Plegar Queen' }))
    tarjeta('ab').focus()
    fireEvent.keyDown(tarjeta('ab'), { key: 'ArrowRight' })
    expect(tarjeta('su')).toHaveFocus()
  })
})

describe('Editar datos mueve la tarjeta', () => {
  const obtener = () =>
    Promise.resolve({
      metadatos: { titulo: 'Tema su', artista: '', album: null, duracion_ms: 1 }
    } as never)

  async function abrirEditarDatos(id: string) {
    fireEvent.click(within(tarjeta(id)).getByRole('button', { name: /Más acciones/ }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Editar datos' }))
    return screen.findByRole('dialog', { name: 'Editar datos' })
  }

  it('B7: cambia de grupo, lo despliega, enfoca la tarjeta, anuncia y avisa del tema', async () => {
    const editada = resumenConIdentidad('su', 'ABBA', null, {
      apariencia: aparienciaResumenPrueba({
        procedencia: 'artista',
        temaId: ID_TEMA,
        temaNombre: 'Neón',
        neutra: false
      })
    })
    const actualizarMetadatos = vi.fn().mockResolvedValue(editada)
    const { emitir } = montar(todas, {
      agrupar: 'artista',
      biblioteca: { obtener, actualizarMetadatos }
    })
    // El grupo de destino está plegado.
    fireEvent.click(await screen.findByRole('button', { name: 'Plegar ABBA' }))
    const dialogo = await abrirEditarDatos('su')
    fireEvent.change(within(dialogo).getByLabelText('Artista'), { target: { value: 'ABBA' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(actualizarMetadatos).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    emitir({ id: 'su', resumen: editada })

    await waitFor(() => expect(tarjeta('su')).toHaveFocus())
    expect(ids()).toEqual(['ab', 'su', 'q1', 'q2'])
    expect(screen.getByRole('button', { name: 'Plegar ABBA' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(anuncio()).toHaveTextContent('«Tema su» está ahora en ABBA.')
    expect(
      await screen.findByText('«Tema su» usa ahora el tema «Neón», del artista.')
    ).toBeInTheDocument()
  })

  it('sin cambio de tema efectivo no hay aviso de tema', async () => {
    const editada = resumenConIdentidad('su', 'Otro', null)
    const { emitir } = montar(todas, {
      agrupar: 'artista',
      biblioteca: { obtener, actualizarMetadatos: vi.fn().mockResolvedValue(editada) }
    })
    await screen.findAllByRole('article')
    const dialogo = await abrirEditarDatos('su')
    fireEvent.change(within(dialogo).getByLabelText('Artista'), { target: { value: 'Otro' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    emitir({ id: 'su', resumen: editada })
    await waitFor(() => expect(tarjeta('su')).toHaveFocus())
    expect(screen.queryByText(/usa ahora/)).toBeNull()
  })

  it('sigue visible aunque deje de coincidir con la búsqueda, hasta el siguiente cambio', async () => {
    const editada = resumenConIdentidad('su', 'Otro', null, { titulo: 'Otro nombre' })
    const { emitir } = montar(todas, {
      agrupar: 'artista',
      biblioteca: { obtener, actualizarMetadatos: vi.fn().mockResolvedValue(editada) }
    })
    await screen.findAllByRole('article')
    const campo = screen.getByRole('searchbox')
    fireEvent.change(campo, { target: { value: 'su' } })
    expect(ids()).toEqual(['su'])
    const dialogo = await abrirEditarDatos('su')
    fireEvent.change(within(dialogo).getByLabelText('Título'), { target: { value: 'Otro nombre' } })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    emitir({ id: 'su', resumen: editada })
    await waitFor(() => expect(tarjeta('su')).toHaveFocus())
    expect(ids()).toEqual(['su'])
    fireEvent.change(campo, { target: { value: 'su ' } })
    expect(ids()).toEqual([])
  })
})
