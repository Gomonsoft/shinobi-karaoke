import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from '@testing-library/react'
import type { LecturaLoteIpc, ListaYoutubeIpc } from '@shared/ipc'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { crearNavegacionGuardada } from '../../navegacion/salida'
import { TrabajosContexto } from '../../trabajos/useTrabajos'
import { AnadirCancion } from './AnadirCancion'

const REF = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const GB = 1024 ** 3

const lectura = (n: number, extra: Partial<LecturaLoteIpc> = {}): LecturaLoteIpc => ({
  filas: Array.from({ length: n }, (_, i) => ({
    ref: REF(i),
    nombre: `pista-${i}.mp3`,
    duracionMs: 240_000,
    metadatos: { titulo: `Canción ${i + 1}`, artista: 'Grupo Inventado', album: null },
    duplicado: null,
    problema: null
  })),
  rechazadas: 0,
  truncada: false,
  libreBytes: 100 * GB,
  factorMinutos: 2,
  ...extra
})

const lista = (n: number): ListaYoutubeIpc => ({
  titulo: 'Álbum Inventado',
  tipo: 'album',
  entradas: Array.from({ length: n }, (_, i) => ({
    id: `aaaaaaaaa${String(i).padStart(2, '0')}`,
    titulo: `Tema ${i + 1}`,
    canal: 'Canal Inventado',
    duracionS: 200,
    disponible: true,
    problema: null,
    duplicado: null
  })),
  recortada: false,
  libreBytes: 100 * GB,
  factorMinutos: 2
})

interface Opciones {
  lectura?: LecturaLoteIpc
  lista?: ListaYoutubeIpc
  config?: Record<string, unknown>
  lote?: () => Promise<unknown>
  espacio?: number | null
  factor?: number | null
}

function montar(o: Opciones = {}) {
  const config = { aviso_youtube_aceptado: '2026-11-01T10:00:00.000Z', ...o.config }
  const api = {
    sistema: { info: vi.fn().mockResolvedValue({ youtube: true }), elegirArchivoAudio: vi.fn() },
    config: {
      obtener: vi.fn().mockResolvedValue({ ...config, preparacion: { automatica: true } }),
      actualizar: vi.fn().mockResolvedValue({})
    },
    biblioteca: { valoresDatos: vi.fn().mockResolvedValue({ artistas: [], albumes: [] }) },
    fuente: {
      importarArchivo: vi.fn(),
      cancelarImportacion: vi.fn().mockResolvedValue(undefined),
      descartarImportacion: vi.fn().mockResolvedValue(undefined),
      leerArchivos: vi.fn().mockResolvedValue(o.lectura ?? lectura(3)),
      leerCarpeta: vi.fn().mockResolvedValue(o.lectura ?? lectura(3)),
      infoLista: vi.fn().mockResolvedValue(o.lista ?? lista(12)),
      infoYoutube: vi.fn().mockImplementation((url: string) => {
        const id = /v=([\w-]{11})/.exec(url)?.[1] ?? 'xxxxxxxxxxx'
        return Promise.resolve({
          consultaId: `q-${id}`,
          idVideo: id,
          tituloOriginal: `Tema ${id}`,
          canal: 'Canal Inventado',
          duracionS: 200,
          metadatos: {
            titulo: `Título ${id}`,
            artista: 'Artista Inventado',
            album: 'Álbum Inventado'
          },
          miniaturaDataUrl: null
        })
      }),
      cancelarInfo: vi.fn().mockResolvedValue(undefined),
      espacioLibre: vi.fn().mockResolvedValue({
        libreBytes: o.espacio === undefined ? 100 * GB : o.espacio,
        factorMinutos: o.factor === undefined ? 2 : o.factor
      }),
      lote: vi.fn(
        o.lote ??
          (() =>
            Promise.resolve({
              creadas: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
              omitidas: []
            }))
      )
    },
    runtime: { estimarSeparacion: vi.fn().mockResolvedValue(null) },
    rutaDeArchivo: (f: File) => `/soltados/${f.name}`
  }
  window.shinobi = api as never
  const navegadas: Vista[] = []
  const guardada = crearNavegacionGuardada((v) => navegadas.push(v))
  render(
    <NavegacionContexto.Provider
      value={{
        vista: { tipo: 'anadir' },
        ir: guardada.ir,
        registrarGuardaSalida: guardada.registrarGuardaSalida
      }}
    >
      <TrabajosContexto.Provider value={{ trabajos: [], progreso: {}, terminado: false }}>
        <AnadirCancion />
      </TrabajosContexto.Provider>
    </NavegacionContexto.Provider>
  )
  return { api, navegadas }
}

const soltar = (nombres: string[]) => {
  const zona = screen.getByTestId('zona-arrastre')
  const ev = createEvent.drop(zona)
  Object.defineProperty(ev, 'dataTransfer', {
    value: { files: nombres.map((n) => new File(['x'], n)), types: ['Files'] }
  })
  fireEvent(zona, ev)
}
const tabla = () => screen.findByRole('table')
const botonAnadir = () =>
  screen.getByRole('button', { name: /^(Descargar y )?[Aa]ñadir \d+ canciones?$/ })

describe('modo lote · archivos', () => {
  it('«Elegir carpeta…» usa el nombre de la carpeta que devuelve main como origen (0384)', async () => {
    montar({ lectura: lectura(3, { carpeta: 'Disco de Prueba' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Elegir carpeta…' }))
    await tabla()
    expect(screen.getByText(/Disco de Prueba/)).toBeInTheDocument()
  })

  it('soltar 3 archivos muestra la tabla con 3 filas marcadas y el resumen', async () => {
    const { api } = montar()
    soltar(['a.mp3', 'b.mp3', 'c.mp3'])
    const t = await tabla()
    expect(within(t).getAllByRole('checkbox', { name: /^Añadir «/ })).toHaveLength(3)
    // El foco llega en un efecto tras montar la tabla: bajo carga puede tardar un turno.
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Añadir 3 canciones' })).toHaveFocus()
    )
    expect(
      screen.getByText(/^3 canciones · unos \d+ MB · unos 24 minutos en tu equipo$/)
    ).toBeInTheDocument()
    expect(botonAnadir()).toBeEnabled()
    expect(api.fuente.leerArchivos).toHaveBeenCalledWith([
      '/soltados/a.mp3',
      '/soltados/b.mp3',
      '/soltados/c.mp3'
    ])
    expect(screen.queryByText('Añade las canciones de una en una.')).toBeNull()
  })

  it('«Álbum para todas…» aplica a las marcadas y Ctrl+Z lo deshace; Añadir envía lo de la tabla en su orden', async () => {
    const { api, navegadas } = montar()
    soltar(['a.mp3', 'b.mp3', 'c.mp3'])
    await tabla()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Añadir «Canción 2»' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Añadir 2 canciones')
    fireEvent.click(screen.getByRole('button', { name: 'Álbum para todas…' }))
    fireEvent.change(await screen.findByLabelText('Álbum'), { target: { value: 'Mi álbum' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar a las 2 marcadas' }))
    const album1 = screen.getByLabelText('Álbum de «Canción 1»') as HTMLInputElement
    expect(album1.value).toBe('Mi álbum')
    fireEvent.keyDown(album1, { key: 'z', ctrlKey: true })
    expect((screen.getByLabelText('Álbum de «Canción 1»') as HTMLInputElement).value).toBe('')
    fireEvent.change(screen.getByLabelText('Título de «Canción 3»'), {
      target: { value: 'Otro título' }
    })
    fireEvent.click(botonAnadir())
    await waitFor(() => expect(api.fuente.lote).toHaveBeenCalled())
    expect(api.fuente.lote).toHaveBeenCalledWith({
      entradas: [
        { tipo: 'archivo', ref: REF(0) },
        { tipo: 'archivo', ref: REF(2) }
      ],
      metadatos: [
        { titulo: 'Canción 1', artista: 'Grupo Inventado', album: null },
        { titulo: 'Otro título', artista: 'Grupo Inventado', album: null }
      ]
    })
    await waitFor(() =>
      expect(navegadas.at(-1)).toMatchObject({ tipo: 'biblioteca', lote: { n: 3, conLetra: true } })
    )
  })

  it('un título vacío en una fila marcada bloquea Añadir; desmarcarla lo desbloquea', async () => {
    montar()
    soltar(['a.mp3', 'b.mp3', 'c.mp3'])
    await tabla()
    fireEvent.change(screen.getByLabelText('Título de «Canción 1»'), { target: { value: '' } })
    expect(await screen.findByText('Escribe un título.')).toBeInTheDocument()
    expect(botonAnadir()).toBeDisabled()
    fireEvent.click(screen.getAllByRole('checkbox', { name: /^Añadir «/ })[0]!)
    expect(botonAnadir()).toBeEnabled()
  })

  it('con 80 filas marca 50, avisa del límite y marcar la 51 no hace nada', async () => {
    montar({ lectura: lectura(80) })
    soltar(['a.mp3', 'b.mp3'])
    await tabla()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Añadir 50 canciones')
    expect(screen.getByText(/Se pueden añadir hasta 50 canciones de una vez/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Añadir «Canción 51»' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Añadir 50 canciones')
    expect(
      screen.getByText('Ya hay 50 marcadas. Desmarca alguna para marcar esta.')
    ).toBeInTheDocument()
  })

  it('las filas ✕ no se marcan ni cuentan, y la lectura recortada avisa', async () => {
    const l = lectura(4, { truncada: true })
    l.filas[0]!.problema = 'ilegible'
    l.filas[0]!.duracionMs = null
    l.filas[1]!.problema = 'corta'
    montar({ lectura: l })
    soltar(['a.mp3', 'b.mp3'])
    await tabla()
    expect(screen.getByText('No podemos leer este archivo')).toBeInTheDocument()
    expect(screen.getByText('Dura menos de 10 segundos')).toBeInTheDocument()
    expect(screen.getByText(/Hay más de 500 archivos de audio/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Añadir 2 canciones')
  })

  it('sin espacio libre suficiente avisa antes de pulsar y bloquea; se vuelve a pedir al marcar', async () => {
    const { api } = montar({
      lectura: lectura(3, { libreBytes: GB + 150 * 1024 * 1024 }),
      espacio: GB + 150 * 1024 * 1024
    })
    soltar(['a.mp3', 'b.mp3', 'c.mp3'])
    await tabla()
    expect(await screen.findAllByText(/No hay espacio para todas/)).not.toHaveLength(0)
    expect(screen.getByText(/Caben unas 1\./)).toBeInTheDocument()
    expect(botonAnadir()).toBeDisabled()
    api.fuente.espacioLibre.mockClear()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Añadir «Canción 3»' }))
    await waitFor(() => expect(api.fuente.espacioLibre).toHaveBeenCalled())
  })

  it('sin espacio ni para una canción (k = 0) dice «No hay espacio para ninguna» sin «Caben unas 0»', async () => {
    montar({ lectura: lectura(3, { libreBytes: 500 * 1024 * 1024 }), espacio: 500 * 1024 * 1024 })
    soltar(['a.mp3', 'b.mp3', 'c.mp3'])
    await tabla()
    expect(await screen.findAllByText(/No hay espacio para ninguna/)).not.toHaveLength(0)
    expect(
      screen.getByText(/Libera espacio en el disco o desmarca canciones\./)
    ).toBeInTheDocument()
    expect(screen.queryByText(/Caben unas/)).toBeNull()
  })

  it('las filas sin artista dan un solo aviso con «Artista para todas…», no una marca por fila (0323)', async () => {
    const base = lectura(3)
    montar({
      lectura: {
        ...base,
        filas: base.filas.map((f, i) =>
          i < 2 ? { ...f, metadatos: { ...f.metadatos, artista: '' } } : f
        )
      }
    })
    soltar(['a.mp3', 'b.mp3', 'c.mp3'])
    await tabla()
    expect(
      screen.getAllByText('2 canciones no tienen artista: con él es más fácil encontrar su letra.')
    ).toHaveLength(1)
    expect(screen.queryByText('Sin artista es más difícil encontrar la letra.')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Artista para todas…' })[0]!)
    expect(await screen.findByRole('dialog', { name: 'Artista para todas…' })).toBeInTheDocument()
  })

  it('con libreBytes null no avisa; un SIN_ESPACIO de main al pulsar lo muestra y no navega', async () => {
    const { navegadas } = montar({
      lectura: lectura(3, { libreBytes: null }),
      espacio: null,
      lote: () => Promise.reject({ codigo: 'SIN_ESPACIO', mensaje: 'x', detalles: '{"caben":2}' })
    })
    soltar(['a.mp3', 'b.mp3', 'c.mp3'])
    await tabla()
    expect(screen.queryByText(/No hay espacio para todas/)).toBeNull()
    fireEvent.click(botonAnadir())
    expect(await screen.findByText(/Caben unas 2\./)).toBeInTheDocument()
    expect(navegadas).toHaveLength(0)
  })

  it('sin factor medido el resumen omite el tiempo', async () => {
    montar({ lectura: lectura(3, { factorMinutos: null }) })
    soltar(['a.mp3', 'b.mp3', 'c.mp3'])
    await tabla()
    expect(screen.getByText(/^3 canciones · unos \d+ MB$/)).toBeInTheDocument()
  })

  it('cancelar sin cambios vuelve a la Biblioteca; con cambios pide confirmar con el foco en «Seguir revisando»', async () => {
    const { navegadas } = montar()
    soltar(['a.mp3', 'b.mp3', 'c.mp3'])
    await tabla()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Añadir «Canción 1»' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    const dialogo = await screen.findByRole('dialog', { name: '¿Descartar este lote?' })
    await waitFor(() =>
      expect(within(dialogo).getByRole('button', { name: 'Seguir revisando' })).toHaveFocus()
    )
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Descartar' }))
    await waitFor(() => expect(navegadas.at(-1)).toEqual({ tipo: 'biblioteca' }))
  })

  it('Esc sin cambios cancela', async () => {
    const { navegadas } = montar()
    soltar(['a.mp3', 'b.mp3', 'c.mp3'])
    await tabla()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    await waitFor(() => expect(navegadas.at(-1)).toEqual({ tipo: 'biblioteca' }))
  })

  it('Elegir carpeta… lee la carpeta y una carpeta sin audio muestra su aviso', async () => {
    const { api } = montar({ lectura: lectura(0) })
    fireEvent.click(screen.getByRole('button', { name: 'Elegir carpeta…' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'En esa carpeta no hay archivos de audio ni de video.'
    )
    expect(api.fuente.leerCarpeta).toHaveBeenCalled()
  })
})

describe('modo lote · YouTube', () => {
  const LISTA = 'https://www.youtube.com/playlist?list=OLAK5uy_inventadoLista01'
  const elegirYoutube = async () =>
    fireEvent.click(await screen.findByRole('radio', { name: 'Enlaces de YouTube' }))
  const buscar = async (texto: string) => {
    fireEvent.change(await screen.findByLabelText('Enlaces de YouTube'), {
      target: { value: texto }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
  }

  it('una lista con el aviso de listas ya aceptado da la tabla sin descargar nada', async () => {
    const { api } = montar({
      config: { aviso_youtube_listas_aceptado: '2026-11-02T10:00:00.000Z' },
      lista: lista(12)
    })
    await elegirYoutube()
    await buscar(LISTA)
    await tabla()
    expect(api.fuente.infoLista).toHaveBeenCalledWith(LISTA)
    expect(screen.getByText('De la lista «Álbum Inventado» · 12 videos')).toBeInTheDocument()
    expect(
      screen.getByText(/Hemos puesto «Álbum Inventado» como álbum de todas/)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descargar y añadir 12 canciones' })).toBeEnabled()
    expect(screen.getByText('Leer el aviso')).toBeInTheDocument()
    // Sin consultar vídeo a vídeo: los datos propios de cada uno llegan al descargarlo (0384).
    await new Promise((r) => setTimeout(r, 1800))
    expect(api.fuente.infoYoutube).not.toHaveBeenCalled()
    expect(screen.queryByText(/Completando los datos/)).toBeNull()
  })

  it('enlaces sueltos: una sola lectura del espacio da el factor y el resumen trae el tiempo (0384)', async () => {
    const { api } = montar()
    await elegirYoutube()
    await buscar(
      [
        'https://www.youtube.com/watch?v=aaaaaaaaa01',
        'https://www.youtube.com/watch?v=aaaaaaaaa02'
      ].join('\n')
    )
    await tabla()
    expect(
      screen.getByText(/^2 canciones · unos \d+ MB · unos \d+ minutos en tu equipo$/)
    ).toBeInTheDocument()
    expect(api.fuente.infoLista).not.toHaveBeenCalled()
  })

  it('sin factor medido, los enlaces sueltos no llevan tiempo', async () => {
    montar({ factor: null })
    await elegirYoutube()
    await buscar(
      [
        'https://www.youtube.com/watch?v=aaaaaaaaa01',
        'https://www.youtube.com/watch?v=aaaaaaaaa02'
      ].join('\n')
    )
    await tabla()
    expect(screen.getByText(/^2 canciones · unos \d+ MB$/)).toBeInTheDocument()
  })

  it('la primera lista pide el aviso (aunque el de YouTube ya esté aceptado) y «Entendido» guarda la clave', async () => {
    const { api } = montar()
    await elegirYoutube()
    await buscar(LISTA)
    expect(await screen.findByText('Antes de usar YouTube')).toBeInTheDocument()
    expect(screen.getByText(/también para las listas de reproducción/)).toBeInTheDocument()
    expect(api.fuente.infoLista).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
    await tabla()
    const arg = api.config.actualizar.mock.calls[0]![0] as Record<string, string>
    expect(Object.keys(arg)).toEqual(['aviso_youtube_listas_aceptado'])
    expect(api.fuente.infoLista).toHaveBeenCalledTimes(1)
  })

  it('tres renglones dan tres filas; un renglón que no es de YouTube se ignora y se avisa', async () => {
    const { api } = montar()
    await elegirYoutube()
    await buscar(
      [
        'https://www.youtube.com/watch?v=aaaaaaaaa01',
        'https://www.youtube.com/watch?v=aaaaaaaaa02',
        'https://www.youtube.com/watch?v=aaaaaaaaa03',
        'hola'
      ].join('\n')
    )
    const t = await tabla()
    expect(within(t).getAllByRole('checkbox', { name: /^Añadir «/ })).toHaveLength(3)
    expect(
      screen.getByText('1 renglón no es un enlace de YouTube y se ha ignorado.')
    ).toBeInTheDocument()
    expect(api.fuente.infoLista).not.toHaveBeenCalled()
  })

  it('un video con lista ofrece añadirla y no la consulta hasta pulsar', async () => {
    const { api } = montar({
      config: { aviso_youtube_listas_aceptado: '2026-11-02T10:00:00.000Z' }
    })
    await elegirYoutube()
    await buscar('https://www.youtube.com/watch?v=aaaaaaaaa00&list=PLinventadaLista01')
    expect(await screen.findByText('Este video está en una lista.')).toBeInTheDocument()
    expect(api.fuente.infoLista).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Añadir la lista entera' }))
    await tabla()
    expect(api.fuente.infoLista).toHaveBeenCalledTimes(1)
  })

  it('una lista no disponible muestra su aviso bajo el campo', async () => {
    const { api } = montar({
      config: { aviso_youtube_listas_aceptado: '2026-11-02T10:00:00.000Z' }
    })
    api.fuente.infoLista.mockRejectedValue({ codigo: 'LISTA_NO_DISPONIBLE', mensaje: 'x' })
    await elegirYoutube()
    await buscar(LISTA)
    expect(await screen.findByRole('alert')).toHaveTextContent('No podemos abrir esta lista.')
    await act(async () => undefined)
  })
})
