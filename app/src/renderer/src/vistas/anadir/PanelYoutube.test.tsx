import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { InfoYoutubeIpc } from '@shared/ipc'
import { NavegacionContexto, type DatosInicialesAnadir, type Vista } from '../../navegacion/estado'
import { TrabajosContexto } from '../../trabajos/useTrabajos'
import { resumenPrueba } from '../biblioteca/resumenPrueba'
import { AnadirCancion } from './AnadirCancion'

const URL_BUENA = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

const info = (extra: Partial<InfoYoutubeIpc> = {}): InfoYoutubeIpc => ({
  consultaId: 'q1',
  idVideo: 'dQw4w9WgXcQ',
  tituloOriginal: 'Queen – Bohemian Rhapsody (Official Video)',
  canal: 'Queen Official',
  duracionS: 359,
  metadatos: { titulo: 'Bohemian Rhapsody', artista: 'Queen', album: '' },
  miniaturaDataUrl: 'data:image/jpeg;base64,AAAA',
  ...extra
})

interface Diferido<T> {
  promesa: Promise<T>
  resolver: (v: T) => void
  rechazar: (e: unknown) => void
}
function diferido<T>(): Diferido<T> {
  let resolver!: (v: T) => void
  let rechazar!: (e: unknown) => void
  const promesa = new Promise<T>((a, b) => {
    resolver = a
    rechazar = b
  })
  return { promesa, resolver, rechazar }
}

interface Opciones {
  youtube?: boolean
  aceptado?: string | null
  consulta?: (url: string) => Promise<InfoYoutubeIpc>
  iniciales?: DatosInicialesAnadir
}

function montar(o: Opciones = {}) {
  let estado: ((ev: { consultaId: string; fase: string }) => void) | null = null
  const api = {
    sistema: {
      info: vi.fn().mockResolvedValue({ youtube: o.youtube ?? true }),
      elegirArchivoAudio: vi.fn()
    },
    config: {
      obtener: vi.fn().mockResolvedValue({ aviso_youtube_aceptado: o.aceptado ?? null }),
      actualizar: vi.fn().mockResolvedValue({})
    },
    fuente: {
      importarArchivo: vi.fn(),
      cancelarImportacion: vi.fn().mockResolvedValue(undefined),
      descartarImportacion: vi.fn().mockResolvedValue(undefined),
      infoYoutube: vi.fn(o.consulta ?? (() => Promise.resolve(info()))),
      cancelarInfo: vi.fn().mockResolvedValue(undefined),
      confirmarYoutube: vi.fn().mockResolvedValue(resumenPrueba({ id: 'nueva' }))
    },
    alCambiarEstadoInfo: (cb: (ev: { consultaId: string; fase: string }) => void) => {
      estado = cb
      return () => {
        estado = null
      }
    },
    rutaDeArchivo: (f: File) => f.name
  }
  window.shinobi = api as never
  const ir = vi.fn<(v: Vista) => void>()
  const r = render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'anadir' }, ir }}>
      <TrabajosContexto.Provider value={{ trabajos: [], progreso: {}, terminado: false }}>
        <AnadirCancion iniciales={o.iniciales} />
      </TrabajosContexto.Provider>
    </NavegacionContexto.Provider>
  )
  return { api, ir, emitir: (fase: string) => estado?.({ consultaId: 'q1', fase }), ...r }
}

const elegirYoutube = async () => {
  fireEvent.click(await screen.findByRole('radio', { name: 'Enlace de YouTube' }))
}
const campo = () => screen.findByLabelText('Enlace del vídeo')

const ACEPTADO = '2026-11-01T10:00:00.000Z'

async function conCampo(o: Opciones = {}) {
  const m = montar({ aceptado: ACEPTADO, ...o })
  await elegirYoutube()
  return { ...m, campo: (await campo()) as HTMLInputElement }
}

function buscar(c: HTMLElement, url = URL_BUENA) {
  fireEvent.change(c, { target: { value: url } })
  fireEvent.click(screen.getByRole('button', { name: 'Buscar vídeo' }))
}

describe('selector de origen', () => {
  it('se oculta si el módulo de YouTube está desactivado', async () => {
    const { api } = montar({ youtube: false })
    await waitFor(() => expect(api.sistema.info).toHaveBeenCalled())
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByText('Enlace de YouTube')).toBeNull()
  })

  it('se muestra con YouTube activo', async () => {
    montar()
    expect(await screen.findByRole('radio', { name: 'Archivo de tu equipo' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Enlace de YouTube' })).toBeInTheDocument()
  })
})

describe('aviso legal', () => {
  it('la primera vez sustituye al campo; "Entendido" guarda la fecha y enfoca el campo', async () => {
    const { api } = montar({ aceptado: null })
    await elegirYoutube()
    expect(await screen.findByText('Antes de usar YouTube')).toBeInTheDocument()
    expect(screen.getByText(/Solo te lo mostraremos esta vez/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Enlace del vídeo')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
    const c = await campo()
    expect(api.config.actualizar).toHaveBeenCalledTimes(1)
    const arg = api.config.actualizar.mock.calls[0]![0] as { aviso_youtube_aceptado: string }
    expect(new Date(arg.aviso_youtube_aceptado).toISOString()).toBe(arg.aviso_youtube_aceptado)
    await waitFor(() => expect(c).toHaveFocus())
    expect(screen.queryByText('Antes de usar YouTube')).toBeNull()
  })

  it('con el aviso ya aceptado no vuelve a aparecer', async () => {
    montar({ aceptado: ACEPTADO })
    await elegirYoutube()
    await campo()
    expect(screen.queryByText('Antes de usar YouTube')).toBeNull()
  })

  it('"Usar un archivo en su lugar" vuelve a Archivo sin guardar nada', async () => {
    const { api } = montar({ aceptado: null })
    await elegirYoutube()
    fireEvent.click(await screen.findByRole('button', { name: 'Usar un archivo en su lugar' }))
    expect(await screen.findByRole('button', { name: 'Elegir archivo…' })).toBeInTheDocument()
    expect(api.config.actualizar).not.toHaveBeenCalled()
  })
})

describe('enlace', () => {
  it.each([
    ['', 'Este enlace no es de un vídeo de YouTube.'],
    ['hola mundo', 'Este enlace no es de un vídeo de YouTube.'],
    ['https://vimeo.com/12345', 'Este enlace no es de un vídeo de YouTube.'],
    ['javascript:alert(1)', 'Este enlace no es de un vídeo de YouTube.'],
    ['https://www.youtube.com/watch?v=corto', 'Este enlace no es de un vídeo de YouTube.'],
    ['https://www.youtube.com/playlist?list=PL123', 'Las listas y los directos no se pueden usar.'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', 'Las listas y los directos no se pueden usar.']
  ])('valida en local %j sin llamar a la red', async (url, titulo) => {
    const { api, campo: c } = await conCampo()
    buscar(c, url)
    expect(await screen.findByRole('alert')).toHaveTextContent(titulo)
    expect(api.fuente.infoYoutube).not.toHaveBeenCalled()
  })

  it('pegar una URL válida lanza la búsqueda', async () => {
    const { api, campo: c } = await conCampo()
    fireEvent.paste(c, { clipboardData: { getData: () => URL_BUENA } })
    await waitFor(() => expect(api.fuente.infoYoutube).toHaveBeenCalledWith(URL_BUENA))
    expect(
      await screen.findByText('Queen – Bohemian Rhapsody (Official Video)')
    ).toBeInTheDocument()
  })

  it('Intro busca; mientras busca muestra "Buscando…" y Cancelar, y Esc cancela sin error', async () => {
    const d = diferido<InfoYoutubeIpc>()
    const { api, campo: c } = await conCampo({ consulta: () => d.promesa })
    fireEvent.change(c, { target: { value: URL_BUENA } })
    fireEvent.submit(c.closest('form')!)
    expect(await screen.findByText('Buscando…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buscar vídeo' })).toBeNull()
    expect(c).toHaveAttribute('readonly')
    fireEvent.keyDown(c, { key: 'Escape' })
    await waitFor(() => expect(api.fuente.cancelarInfo).toHaveBeenCalled())
    expect(c).not.toHaveAttribute('readonly')
    expect(c).toHaveValue(URL_BUENA)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Buscar vídeo' })).toBeInTheDocument()
    // El resultado tardío de una consulta cancelada se descarta.
    await act(async () => d.resolver(info()))
    expect(screen.queryByText('Queen – Bohemian Rhapsody (Official Video)')).toBeNull()
    expect(api.fuente.cancelarInfo).toHaveBeenCalledWith('q1')
  })
})

describe('vista previa', () => {
  it('con miniatura, título original, canal y duración, y el formulario prerrellenado', async () => {
    const { campo: c } = await conCampo()
    buscar(c)
    expect(await screen.findByText('Queen Official · 5:59')).toBeInTheDocument()
    expect(document.querySelector('img')).toHaveAttribute('src', 'data:image/jpeg;base64,AAAA')
    expect(screen.queryByTestId('miniatura-vacia')).toBeNull()
    expect(screen.getByLabelText(/Título/)).toHaveValue('Bohemian Rhapsody')
    expect(screen.getByLabelText('Artista')).toHaveValue('Queen')
    expect(screen.getByRole('button', { name: 'Descargar y continuar' })).toBeInTheDocument()
    expect(screen.queryByText(/Separarla tardará/)).toBeNull()
  })

  it('sin miniatura muestra el marcador', async () => {
    const { campo: c } = await conCampo({
      consulta: () => Promise.resolve(info({ miniaturaDataUrl: null }))
    })
    buscar(c)
    expect(await screen.findByTestId('miniatura-vacia')).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })

  it('si la imagen no carga muestra el marcador sin avisos', async () => {
    const { campo: c } = await conCampo()
    buscar(c)
    await screen.findByText('Queen Official · 5:59')
    fireEvent.error(document.querySelector('img')!)
    expect(await screen.findByTestId('miniatura-vacia')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('avisa de las canciones largas con la duración de YouTube', async () => {
    const { campo: c } = await conCampo({
      consulta: () => Promise.resolve(info({ duracionS: 760 }))
    })
    buscar(c)
    expect(await screen.findByText(/Esta canción dura 12:40/)).toBeInTheDocument()
  })

  it('"Descargar y continuar" confirma y navega al progreso', async () => {
    const { api, ir, campo: c } = await conCampo()
    buscar(c)
    await screen.findByText('Queen Official · 5:59')
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: '  Otro título ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Descargar y continuar' }))
    await waitFor(() =>
      expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'nueva', paso: 'progreso' })
    )
    expect(api.fuente.confirmarYoutube).toHaveBeenCalledWith(
      'q1',
      { titulo: 'Otro título', artista: 'Queen', album: null },
      undefined
    )
  })

  it('con título vacío no avanza', async () => {
    const { api, campo: c } = await conCampo()
    buscar(c)
    await screen.findByText('Queen Official · 5:59')
    fireEvent.change(screen.getByLabelText(/Título/), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Descargar y continuar' }))
    expect(await screen.findByText('Escribe un título.')).toBeInTheDocument()
    expect(api.fuente.confirmarYoutube).not.toHaveBeenCalled()
  })

  it('sustitución: con iniciales conserva los metadatos y confirma con el mismo cancionId', async () => {
    const {
      api,
      ir,
      campo: c
    } = await conCampo({
      iniciales: {
        cancionId: 'c9',
        titulo: 'Mi título',
        artista: 'Mi artista',
        album: 'Mi álbum',
        origen: 'youtube'
      }
    })
    buscar(c)
    await screen.findByText('Queen Official · 5:59')
    expect(screen.getByLabelText(/Título/)).toHaveValue('Mi título')
    fireEvent.click(screen.getByRole('button', { name: 'Descargar y continuar' }))
    await waitFor(() => expect(ir).toHaveBeenCalled())
    expect(api.fuente.confirmarYoutube).toHaveBeenCalledWith(
      'q1',
      { titulo: 'Mi título', artista: 'Mi artista', album: 'Mi álbum' },
      { cancionId: 'c9' }
    )
  })
})

describe('C1: actualización automática del descargador', () => {
  it('muestra el aviso, campo de solo lectura, Cancelar y vuelve a editable sin error', async () => {
    const d = diferido<InfoYoutubeIpc>()
    const { api, emitir, campo: c } = await conCampo({ consulta: () => d.promesa })
    buscar(c)
    await screen.findByText('Buscando…')
    act(() => emitir('actualizando'))
    const aviso = await screen.findByText(/Actualizando el descargador de YouTube/)
    expect(aviso.closest('[role="status"]')).not.toBeNull()
    expect(screen.queryByText(/Pega el enlace de un vídeo/)).toBeNull()
    expect(c).toHaveAttribute('readonly')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(api.fuente.cancelarInfo).toHaveBeenCalled())
    expect(c).not.toHaveAttribute('readonly')
    expect(screen.getByText(/Pega el enlace de un vídeo/)).toBeInTheDocument()
    expect(screen.queryByText(/Actualizando el descargador/)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('un segundo bloqueo muestra YOUTUBE_BLOQUEADO', async () => {
    const d = diferido<InfoYoutubeIpc>()
    const { emitir, campo: c } = await conCampo({ consulta: () => d.promesa })
    buscar(c)
    await screen.findByText('Buscando…')
    act(() => emitir('actualizando'))
    await act(async () => d.rechazar({ codigo: 'YOUTUBE_BLOQUEADO', mensaje: 'x' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'YouTube no permite la descarga ahora mismo.'
    )
    expect(screen.queryByText(/Actualizando el descargador/)).toBeNull()
    expect(c).not.toHaveAttribute('readonly')
  })
})

describe('errores', () => {
  it.each([
    ['VIDEO_NO_DISPONIBLE', 'Este vídeo no está disponible.'],
    ['YOUTUBE_BLOQUEADO', 'YouTube no permite la descarga ahora mismo.'],
    ['SIN_CONEXION', 'Sin conexión a internet.'],
    ['SIN_ESPACIO', 'No queda espacio en el disco.']
  ])('%s muestra su texto en un alert', async (codigo, titulo) => {
    const { campo: c } = await conCampo({
      consulta: () => Promise.reject({ codigo, mensaje: 'x' })
    })
    buscar(c)
    expect(await screen.findByRole('alert')).toHaveTextContent(titulo)
  })

  it('SIN_CONEXION ofrece "Usar un archivo de tu equipo"', async () => {
    const { campo: c } = await conCampo({
      consulta: () => Promise.reject({ codigo: 'SIN_CONEXION', mensaje: 'x' })
    })
    buscar(c)
    fireEvent.click(await screen.findByRole('button', { name: 'Usar un archivo de tu equipo' }))
    expect(await screen.findByRole('button', { name: 'Elegir archivo…' })).toBeInTheDocument()
  })

  it('un error desconocido es genérico con "Copiar detalles"', async () => {
    const { campo: c } = await conCampo({
      consulta: () => Promise.reject({ codigo: 'ERROR_INTERNO', mensaje: 'x' })
    })
    buscar(c)
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal.')
    expect(screen.getByRole('button', { name: 'Copiar detalles' })).toBeInTheDocument()
  })

  it('un error al confirmar (sin espacio) se muestra y deja reintentar', async () => {
    const { api, campo: c } = await conCampo()
    api.fuente.confirmarYoutube.mockRejectedValueOnce({ codigo: 'SIN_ESPACIO', mensaje: 'x' })
    buscar(c)
    await screen.findByText('Queen Official · 5:59')
    fireEvent.click(screen.getByRole('button', { name: 'Descargar y continuar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No queda espacio en el disco.')
    expect(screen.getByRole('button', { name: 'Descargar y continuar' })).toBeEnabled()
  })
})
