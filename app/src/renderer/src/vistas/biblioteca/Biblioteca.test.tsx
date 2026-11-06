import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ApiShinobi, EventoCancionIpc, ResumenCancionIpc } from '@shared/ipc'
import { fixtures } from './fixturesApi'
import { Biblioteca, reiniciarFiltroDeSesion } from './Biblioteca'
import { marcarProgresoVisto, olvidarProgresosVistos } from '../../navegacion/progresoVisto'
import { paso, resumenPrueba } from './resumenPrueba'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { ReproductorContexto } from '../../navegacion/reproductor'
import { RETRASO_CARGA_LENTA_MS } from './useBiblioteca'

beforeEach(() => reiniciarFiltroDeSesion())

function montar(
  lista: Promise<ResumenCancionIpc[]> | ResumenCancionIpc[],
  biblioteca: Partial<ApiShinobi['biblioteca']> = {},
  enfocar?: Extract<Vista, { tipo: 'biblioteca' }>['enfocar']
) {
  const ir = vi.fn<(v: Vista) => void>()
  const abrir = vi.fn<(id: string) => void>()
  let emitir: (e: EventoCancionIpc) => void = () => undefined
  const api = fixtures({
    biblioteca,
    listar: () => Promise.resolve(lista),
    alCambiarCancion: (cb) => {
      emitir = cb
      return () => undefined
    }
  })
  ;(window as unknown as { shinobi: ApiShinobi }).shinobi = api
  const { unmount } = render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca', enfocar }, ir }}>
      <ReproductorContexto.Provider value={{ abrir, abierto: null }}>
        <Biblioteca />
      </ReproductorContexto.Provider>
    </NavegacionContexto.Provider>
  )
  return { ir, abrir, api, unmount, emitir: (e: EventoCancionIpc) => act(() => emitir(e)) }
}

const lista = resumenPrueba({ id: 'a', titulo: 'Bohemian Rhapsody', estado: 'lista' })
const incompleta = resumenPrueba({
  id: 'b',
  titulo: 'Casi lista',
  estado: 'lista',
  incompleta: true,
  lineasSinSincronizar: 1
})
const borrador = resumenPrueba({ id: 'c', titulo: 'La flaca' })
const danada = resumenPrueba({
  id: 'd',
  titulo: 'Rota',
  danada: true,
  motivo: 'json',
  pasos: null,
  estilo: null
})

describe('estados', () => {
  afterEach(() => vi.useRealTimers())

  it('cargando: 4 esqueletos y, tras 3 s, el texto de carga', async () => {
    vi.useFakeTimers()
    montar(new Promise(() => undefined))
    expect(document.querySelectorAll('[data-esqueleto]')).toHaveLength(4)
    expect(screen.queryByText('Cargando tu biblioteca…')).toBeNull()
    await act(async () => {
      vi.advanceTimersByTime(RETRASO_CARGA_LENTA_MS + 10)
    })
    expect(screen.getByText('Cargando tu biblioteca…')).toBeInTheDocument()
  })

  it('vacía: textos, formatos y un único botón "Añadir canción" que abre la vista añadir', async () => {
    const { ir } = montar([])
    expect(
      await screen.findByRole('heading', { name: 'Tu biblioteca está vacía' })
    ).toBeInTheDocument()
    expect(screen.getByText(/Formatos: MP3, M4A, FLAC, WAV, OGG/)).toBeInTheDocument()
    const botones = screen.getAllByRole('button', { name: 'Añadir canción' })
    expect(botones).toHaveLength(1)
    fireEvent.click(botones[0]!)
    expect(ir).toHaveBeenCalledWith({ tipo: 'anadir' })
  })

  it('error al listar: aviso con Reintentar', async () => {
    const api = fixtures({ listar: () => Promise.reject(new Error('x')) })
    ;(window as unknown as { shinobi: ApiShinobi }).shinobi = api
    render(
      <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir: vi.fn() }}>
        <Biblioteca />
      </NavegacionContexto.Provider>
    )
    expect(await screen.findByText('No se pudo cargar tu biblioteca.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})

describe('tarjetas', () => {
  it('muestra título, artista · duración, insignia y la accesibilidad bib.aria.tarjeta', async () => {
    montar([lista, incompleta, borrador, danada])
    const t = await screen.findByRole('article', {
      name: 'Bohemian Rhapsody, Artista, Lista.'
    })
    expect(within(t).getByText('Artista · 3:55')).toBeInTheDocument()
    expect(within(t).getByText('Lista')).toBeInTheDocument()
    expect(
      screen.getByRole('article', {
        name: 'Casi lista, Artista, Lista. Falta 1 línea por sincronizar.'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('article', { name: 'La flaca, Artista, Borrador. Falta la letra.' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('article', {
        name: 'Canción sin nombre, Artista, Dañada. No se puede abrir esta canción.'
      })
    ).toBeInTheDocument()
  })

  it('Lista incompleta: insignia y Reproducir sin cambios, más la línea de aviso', async () => {
    montar([incompleta])
    const t = await screen.findByRole('article')
    expect(within(t).getByText('Lista')).toBeInTheDocument()
    expect(within(t).getByText('Falta 1 línea por sincronizar')).toBeInTheDocument()
    expect(
      within(t).getByRole('button', { name: 'Reproducir «Casi lista»', hidden: true })
    ).toBeTruthy()
  })

  it('el título de la portada usa la fuente y el color del estilo', async () => {
    const estilo = {
      version: 1 as const,
      fondo: { tipo: 'solido' as const, color: '#112233' },
      letra: {
        fuente: { familia: 'Bangers', origen: 'incluida' as const },
        color: '#ABCDEF',
        color_resaltado: '#FFD400'
      }
    }
    montar([{ ...lista, estilo }])
    const titulo = (await screen.findAllByText('Bohemian Rhapsody')).find((n) =>
      n.className.includes('tituloPortada')
    )!
    expect(titulo).toHaveStyle({
      fontFamily: "'Bangers', var(--fuente-interfaz)",
      color: '#ABCDEF'
    })
  })

  it('Lista: portada y Reproducir abren el reproductor con el id', async () => {
    const { abrir, ir } = montar([lista])
    const t = await screen.findByRole('article')
    fireEvent.click(within(t).getByRole('button', { name: 'Bohemian Rhapsody', hidden: true }))
    expect(abrir).toHaveBeenLastCalledWith('a')
    fireEvent.click(within(t).getByRole('button', { name: 'Reproducir «Bohemian Rhapsody»' }))
    fireEvent.click(t.querySelector('[data-boton-redondo]')!)
    expect(abrir).toHaveBeenCalledTimes(3)
    expect(ir).not.toHaveBeenCalled()
  })

  it('Borrador: Continuar navega con vistaAlContinuar', async () => {
    const { ir, api } = montar([borrador])
    vi.spyOn(api.biblioteca, 'obtener').mockResolvedValue({
      // Separación completada y sin letra -> vista "letra".
      pasos: borrador.pasos,
      letra: null,
      pistas: null
    } as never)
    const t = await screen.findByRole('article')
    await act(async () => {
      fireEvent.click(within(t).getByRole('button', { name: 'Continuar «La flaca»', hidden: true }))
    })
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c', paso: 'letra' })
  })

  it('Borrador sin letra y separación en curso: Continuar abre Progreso, y Letra si ya lo vio', async () => {
    olvidarProgresosVistos()
    const sepando = resumenPrueba({
      id: 'e',
      titulo: 'En marcha',
      pasos: {
        fuente: paso('completado'),
        separacion: paso('en_curso', { progreso: 0.3 }),
        letra: paso('pendiente'),
        edicion: paso('pendiente')
      }
    })
    const { ir, api } = montar([sepando])
    vi.spyOn(api.biblioteca, 'obtener').mockResolvedValue({
      pasos: sepando.pasos,
      letra: null,
      pistas: null
    } as never)
    const t = await screen.findByRole('article')
    const boton = () =>
      within(t).getByRole('button', { name: 'Continuar «En marcha»', hidden: true })
    await act(async () => {
      fireEvent.click(boton())
    })
    expect(ir).toHaveBeenLastCalledWith({ tipo: 'cancion', id: 'e', paso: 'progreso' })
    marcarProgresoVisto('e')
    await act(async () => {
      fireEvent.click(boton())
    })
    expect(ir).toHaveBeenLastCalledWith({ tipo: 'cancion', id: 'e', paso: 'letra' })
    olvidarProgresosVistos()
  })

  it('Borrador con letra: Continuar abre el Editor', async () => {
    const { ir, api } = montar([borrador])
    vi.spyOn(api.biblioteca, 'obtener').mockResolvedValue({
      pasos: borrador.pasos,
      letra: { lineas: [{ tipo: 'linea', texto: 'x', inicio_ms: null }] },
      pistas: null
    } as never)
    const t = await screen.findByRole('article')
    await act(async () => {
      fireEvent.click(within(t).getByRole('button', { name: 'Continuar «La flaca»', hidden: true }))
    })
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c', paso: 'editor' })
  })

  it('la tarjeta cambia en vivo al guardar la letra desde Letra', async () => {
    const { emitir } = montar([borrador])
    const t = await screen.findByRole('article')
    expect(within(t).getByText('Falta la letra')).toBeInTheDocument()
    const conPasos = (letra: 'pendiente' | 'completado', n: number) => ({
      id: 'c',
      eliminada: false,
      resumen: {
        ...borrador,
        lineasSinSincronizar: n,
        pasos: { ...borrador.pasos!, letra: paso(letra) }
      }
    })
    emitir(conPasos('completado', 3) as unknown as EventoCancionIpc)
    expect(await within(t).findByText('Faltan 3 líneas por sincronizar')).toBeInTheDocument()
    emitir(conPasos('completado', 1) as unknown as EventoCancionIpc)
    expect(await within(t).findByText('Falta 1 línea por sincronizar')).toBeInTheDocument()
    emitir(conPasos('pendiente', 0) as unknown as EventoCancionIpc)
    expect(await within(t).findByText('Falta la letra')).toBeInTheDocument()
  })

  it('Dañada: clic en la portada abre su menú ⋯ (con Mostrar en la carpeta)', async () => {
    montar([danada])
    const t = await screen.findByRole('article')
    expect(within(t).queryByRole('button', { name: /^Reproducir/, hidden: true })).toBeNull()
    fireEvent.click(
      within(t).getByRole('button', { name: 'Abrir el menú de «Canción sin nombre»', hidden: true })
    )
    expect(
      await screen.findByRole('menuitem', { name: 'Mostrar en la carpeta' })
    ).toBeInTheDocument()
  })

  it('Intro actúa como la portada y Espacio como la acción principal', async () => {
    const { abrir } = montar([lista])
    const t = await screen.findByRole('article')
    act(() => t.focus())
    fireEvent.keyDown(t, { key: 'Enter' })
    fireEvent.keyDown(t, { key: ' ' })
    expect(abrir).toHaveBeenCalledTimes(2)
  })

  it('una sola tarjeta tiene tabindex 0 y las flechas mueven el foco', async () => {
    montar([lista, borrador, danada])
    const tarjetas = await screen.findAllByRole('article')
    expect(tarjetas.map((t) => t.tabIndex)).toEqual([0, -1, -1])
    tarjetas[0]!.focus()
    fireEvent.keyDown(tarjetas[0]!, { key: 'ArrowRight' })
    expect(tarjetas[1]).toHaveFocus()
    expect(tarjetas.map((t) => t.tabIndex)).toEqual([-1, 0, -1])
    fireEvent.keyDown(tarjetas[1]!, { key: 'End' })
    expect(tarjetas[2]).toHaveFocus()
  })
})

describe('en vivo', () => {
  it('actualiza la tarjeta en su sitio sin perder el foco ni reordenar; la línea de aviso desaparece', async () => {
    const { emitir } = montar([incompleta, borrador])
    const tarjetas = await screen.findAllByRole('article')
    tarjetas[0]!.focus()
    expect(
      screen.getByText('Falta 1 línea por sincronizar', { selector: 'span' })
    ).toBeInTheDocument()

    emitir({
      id: 'b',
      resumen: {
        ...incompleta,
        incompleta: false,
        lineasSinSincronizar: 0,
        modificada: '2030-01-01T00:00:00Z'
      }
    })

    expect(screen.queryByText('Falta 1 línea por sincronizar', { selector: 'span' })).toBeNull()
    const despues = screen.getAllByRole('article')
    expect(despues[0]).toBe(tarjetas[0])
    expect(despues[0]).toHaveFocus()
    expect(despues.map((t) => t.getAttribute('data-tarjeta'))).toEqual(['b', 'c'])
  })

  it('un cambio de estado no reordena; una canción nueva se añade al final; una eliminada se quita', async () => {
    const { emitir } = montar([lista, borrador])
    await screen.findAllByRole('article')
    emitir({
      id: 'c',
      resumen: { ...borrador, estado: 'lista', modificada: '2031-01-01T00:00:00Z' }
    })
    expect(screen.getAllByRole('article').map((t) => t.getAttribute('data-tarjeta'))).toEqual([
      'a',
      'c'
    ])
    emitir({ id: 'z', resumen: resumenPrueba({ id: 'z', titulo: 'Nueva' }) })
    expect(screen.getAllByRole('article').map((t) => t.getAttribute('data-tarjeta'))).toEqual([
      'a',
      'c',
      'z'
    ])
    emitir({ id: 'a', eliminada: true })
    expect(screen.getAllByRole('article').map((t) => t.getAttribute('data-tarjeta'))).toEqual([
      'c',
      'z'
    ])
  })

  it('al eliminar la última canción aparece el estado vacío', async () => {
    const { emitir } = montar([lista])
    await screen.findByRole('article')
    emitir({ id: 'a', eliminada: true })
    expect(screen.getByRole('heading', { name: 'Tu biblioteca está vacía' })).toBeInTheDocument()
  })
})

describe('vuelta del editor', () => {
  it('cambia Borradores por Todas al recibir el resumen de Lista y resalta durante 2 s', async () => {
    const previa = montar([borrador])
    fireEvent.click(await screen.findByRole('radio', { name: 'Borradores 1' }))
    previa.unmount()

    vi.useFakeTimers()
    try {
      const destino = { ...borrador, estado: 'lista' as const }
      const { emitir } = montar([borrador], {}, { id: destino.id, resaltar: true })
      await act(async () => undefined)
      expect(screen.getByRole('radio', { name: 'Borradores 1' })).toBeChecked()
      emitir({ id: destino.id, resumen: destino })
      await act(async () => vi.advanceTimersByTimeAsync(16))
      expect(screen.getByRole('radio', { name: 'Todas 1' })).toBeChecked()
      await act(async () => vi.advanceTimersByTimeAsync(16))
      const tarjeta = screen.getByRole('article')
      expect(tarjeta).toHaveFocus()
      expect(tarjeta.parentElement).toHaveAttribute('data-resaltada', 'true')
      await act(async () => vi.advanceTimersByTimeAsync(1999))
      expect(tarjeta.parentElement).toHaveAttribute('data-resaltada', 'true')
      await act(async () => vi.advanceTimersByTimeAsync(1))
      expect(tarjeta.parentElement).not.toHaveAttribute('data-resaltada')

      // El regreso no fuerza el filtro una segunda vez después de que la persona lo cambie.
      fireEvent.click(screen.getByRole('radio', { name: 'Borradores 0' }))
      expect(screen.getByRole('radio', { name: 'Borradores 0' })).toBeChecked()
    } finally {
      vi.useRealTimers()
    }
  })

  it('Hecho enfoca la tarjeta y no inicia el resalte', async () => {
    montar([lista, incompleta], {}, { id: incompleta.id, resaltar: false })
    const tarjeta = await screen.findByRole('article', { name: /^Casi lista,/ })
    await waitFor(() => expect(tarjeta).toHaveFocus())
    expect(tarjeta).toHaveAttribute('tabindex', '0')
    expect(tarjeta.parentElement).not.toHaveAttribute('data-resaltada')
  })
})
