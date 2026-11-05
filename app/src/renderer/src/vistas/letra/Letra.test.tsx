import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Cancion } from '@shared/cancion'
import type { ResultadoBusquedaLetra } from '@shared/letrasBusqueda'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { TrabajosContexto } from '../../trabajos/useTrabajos'
import { resumenPrueba } from '../biblioteca/resumenPrueba'
import {
  apiLetrasFalsa,
  candidatosDeEjemplo,
  lineasPorLinea,
  type OpcionesApiLetrasFalsa
} from './fixturesApi'
import { Letra } from './Letra'

interface Opciones extends OpcionesApiLetrasFalsa {
  conLetra?: boolean
  buscar?: (p: never) => Promise<ResultadoBusquedaLetra>
}

function montar(o: Opciones = {}) {
  const { letras, llamadas } = apiLetrasFalsa(o)
  if (o.buscar) letras.buscar = o.buscar as never
  const cancion = {
    metadatos: { titulo: 'Canción inventada', artista: 'Artista inventado', album: null },
    letra: o.conLetra ? { origen: 'lrclib', lineas: lineasPorLinea() } : null
  } as unknown as Cancion
  const abrirEnlace = vi.fn().mockResolvedValue(undefined)
  window.shinobi = {
    biblioteca: {
      listar: () => Promise.resolve([resumenPrueba()]),
      obtener: () => Promise.resolve(cancion)
    },
    alCambiarCancion: () => () => undefined,
    sistema: { abrirEnlace },
    letras
  } as never
  const ir = vi.fn<(v: Vista) => void>()
  render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: 'c1', paso: 'letra' }, ir }}
    >
      <TrabajosContexto.Provider value={{ trabajos: [], progreso: {}, terminado: false }}>
        <Letra id="c1" />
      </TrabajosContexto.Provider>
    </NavegacionContexto.Provider>
  )
  return { ir, llamadas, abrirEnlace, letras }
}

const llamadasDe = <T extends { canal: string }>(l: T[], canal: string): T[] =>
  l.filter((x) => x.canal === canal)

describe('Letra: búsqueda (A)', () => {
  it('sin letra busca sola con caché y los metadatos de la canción', async () => {
    const { llamadas } = montar()
    await screen.findByRole('listbox')
    expect(llamadasDe(llamadas, 'buscar')[0]?.args[0]).toEqual({
      cancionId: 'c1',
      titulo: 'Canción inventada',
      artista: 'Artista inventado',
      usarCache: true
    })
  })

  it('con letra muestra C con el número de líneas y no busca', async () => {
    const { llamadas } = montar({ conLetra: true })
    expect(await screen.findByText(/^Letra actual · .* · 3 líneas$/)).toBeInTheDocument()
    expect(llamadasDe(llamadas, 'buscar')).toHaveLength(0)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('muestra los tres tipos de insignia y de duración', async () => {
    montar()
    const lista = await screen.findByRole('listbox')
    const op = within(lista).getAllByRole('option') as [HTMLElement, HTMLElement, HTMLElement]
    expect(op).toHaveLength(3)
    expect(within(op[0]).getByText('Sincronizada por línea')).toBeInTheDocument()
    expect(within(op[1]).getByText('Sincronizada por palabra')).toBeInTheDocument()
    expect(within(op[2]).getByText('Solo texto')).toBeInTheDocument()
    expect(within(op[0]).getByText('Duración igual que tu audio')).toBeInTheDocument()
    expect(within(op[1]).getByText('4 s más larga que tu audio')).toBeInTheDocument()
    expect(
      within(op[2]).getByText('Duración muy distinta: puede ser otra versión')
    ).toBeInTheDocument()
    expect(within(op[0]).getByText('Álbum inventado · 3:35')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Resultados (3)' })).toBeInTheDocument()
  })

  it('el primero viene seleccionado, con foco, y ↑/↓ cambian la vista previa', async () => {
    montar()
    const lista = await screen.findByRole('listbox')
    await waitFor(() => expect(lista).toHaveFocus())
    const op = within(lista).getAllByRole('option') as [HTMLElement, HTMLElement, HTMLElement]
    expect(op[0]).toHaveAttribute('aria-selected', 'true')
    expect(lista).toHaveAttribute('aria-activedescendant', op[0].id)
    expect(screen.getByText('Luciérnagas sobre el tejado')).toBeInTheDocument()
    expect(screen.getByText('[00:12.0]')).toBeInTheDocument()
    expect(screen.getByText('3 líneas')).toBeInTheDocument()

    fireEvent.keyDown(lista, { key: 'ArrowDown' })
    expect(lista).toHaveAttribute('aria-activedescendant', op[1].id)
    expect(screen.getByText('Por el río seco')).toBeInTheDocument()
    expect(screen.queryByText('Luciérnagas sobre el tejado')).toBeNull()

    fireEvent.keyDown(lista, { key: 'ArrowDown' })
    expect(screen.getByText('Segunda estrofa inventada')).toBeInTheDocument()
    expect(screen.getByText('3 líneas')).toBeInTheDocument()
    fireEvent.keyDown(lista, { key: 'ArrowUp' })
    expect(op[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('cargando: esqueleto, "Buscando…" y alternativas disponibles', async () => {
    montar({ retardoMs: 50 })
    expect(await screen.findByText('Buscando la letra…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Buscando…/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pegar la letra' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Importar archivo .lrc o .txt' })).toBeEnabled()
    await screen.findByRole('listbox')
  })

  it('LETRA_NO_ENCONTRADA: banner info y foco en Título', async () => {
    montar({ errorBuscar: 'LETRA_NO_ENCONTRADA' })
    expect(await screen.findByText('No encontramos la letra.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Título')).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Pegar la letra' })).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('INSTRUMENTAL sin candidatos', async () => {
    montar({ errorBuscar: 'INSTRUMENTAL' })
    expect(await screen.findByText('Esta canción es instrumental')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
  })

  it('instrumental con candidatos: aviso propio y lista usable', async () => {
    montar({
      buscar: () => Promise.resolve({ candidatos: candidatosDeEjemplo(), instrumental: true })
    })
    expect(await screen.findByText('La versión más parecida es instrumental')).toBeInTheDocument()
    expect(screen.queryByText('Esta canción es instrumental')).toBeNull()
    const lista = screen.getByRole('listbox')
    await waitFor(() => expect(lista).toHaveFocus())
    expect(within(lista).getAllByRole('option')).toHaveLength(3)
  })

  it.each([
    ['SIN_CONEXION', 'Sin conexión a internet.'],
    ['SERVICIO_NO_DISPONIBLE', 'El servicio de letras no responde.']
  ] as const)('%s: banner con Reintentar', async (codigo, texto) => {
    const { llamadas } = montar({ errorBuscar: codigo })
    expect(await screen.findByText(texto)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(llamadasDe(llamadas, 'buscar')).toHaveLength(2))
    expect(llamadasDe(llamadas, 'buscar')[1]?.args[0]).toMatchObject({ usarCache: false })
  })

  it('Intro en Título busca con los valores nuevos y sin caché', async () => {
    const { llamadas } = montar()
    await screen.findByRole('listbox')
    const titulo = screen.getByLabelText('Título')
    fireEvent.change(titulo, { target: { value: '  Otro título ' } })
    fireEvent.change(screen.getByLabelText('Artista'), { target: { value: 'Otra banda' } })
    fireEvent.submit(titulo.closest('form') as HTMLFormElement)
    await waitFor(() => expect(llamadasDe(llamadas, 'buscar')).toHaveLength(2))
    expect(llamadasDe(llamadas, 'buscar')[1]?.args[0]).toEqual({
      cancionId: 'c1',
      titulo: 'Otro título',
      artista: 'Otra banda',
      usarCache: false
    })
  })

  it('con el título vacío, Buscar está deshabilitado', async () => {
    const { llamadas } = montar()
    await screen.findByRole('listbox')
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: '  ' } })
    expect(screen.getByRole('button', { name: 'Buscar' })).toBeDisabled()
    fireEvent.submit(screen.getByLabelText('Título').closest('form') as HTMLFormElement)
    expect(llamadasDe(llamadas, 'buscar')).toHaveLength(1)
  })

  it('ignora la respuesta tardía de una búsqueda sustituida (CANCELADO)', async () => {
    const resolvers: ((r: ResultadoBusquedaLetra) => void)[] = []
    const rechazos: ((e: unknown) => void)[] = []
    montar({
      buscar: () =>
        new Promise((res, rej) => {
          resolvers.push(res)
          rechazos.push(rej)
        })
    })
    await waitFor(() => expect(resolvers.length).toBeGreaterThan(0))
    const antes = resolvers.length
    fireEvent.submit(screen.getByLabelText('Título').closest('form') as HTMLFormElement)
    await waitFor(() => expect(resolvers.length).toBe(antes + 1))
    // La anterior llega tarde con resultados distintos y otra rechazada con CANCELADO.
    await act(async () => {
      resolvers[antes - 1]?.({ candidatos: [], instrumental: false })
      rechazos[antes - 1]?.({ codigo: 'CANCELADO', mensaje: '' })
    })
    expect(screen.queryByText('No encontramos la letra.')).toBeNull()
    expect(screen.getByText('Buscando la letra…')).toBeInTheDocument()
    await act(async () => {
      resolvers[antes]?.({ candidatos: candidatosDeEjemplo(), instrumental: false })
    })
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
  })

  it('"Usar esta letra" guarda la del candidato y muestra C con foco en "Ir al editor"', async () => {
    const { llamadas, ir } = montar()
    await screen.findByRole('listbox')
    fireEvent.click(screen.getByRole('button', { name: 'Usar esta letra' }))
    await screen.findByText(/^Letra actual · .* · 3 líneas$/)
    expect(llamadasDe(llamadas, 'guardar')[0]?.args[0]).toMatchObject({
      cancionId: 'c1',
      origen: 'lrclib',
      lrclib_id: 9001,
      lineas: candidatosDeEjemplo()[0]?.lineas
    })
    const boton = screen.getByRole('button', { name: 'Ir al editor' })
    await waitFor(() => expect(boton).toHaveFocus())
    fireEvent.click(boton)
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c1', paso: 'editor' })
  })

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }]
  ])('%s+Intro equivale a "Usar esta letra"', async (_n, mod) => {
    const { llamadas } = montar()
    await screen.findByRole('listbox')
    fireEvent.keyDown(screen.getByLabelText('Título'), { key: 'Enter', ...mod })
    await waitFor(() => expect(llamadasDe(llamadas, 'guardar')).toHaveLength(1))
    expect(llamadasDe(llamadas, 'buscar')).toHaveLength(1)
  })

  it('la atribución abre lrclib.net en el navegador del sistema', async () => {
    const { abrirEnlace } = montar()
    await screen.findByRole('listbox')
    fireEvent.click(screen.getByRole('link', { name: 'Letra: LRCLIB' }))
    expect(abrirEnlace).toHaveBeenCalledWith('https://lrclib.net')
  })

  it('"¿No es ninguna?" está siempre visible, también sin resultados', async () => {
    montar({ errorBuscar: 'SIN_CONEXION' })
    await screen.findByText('Sin conexión a internet.')
    expect(screen.getByText('¿No es ninguna?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Usar esta letra' })).toBeDisabled()
  })
})
