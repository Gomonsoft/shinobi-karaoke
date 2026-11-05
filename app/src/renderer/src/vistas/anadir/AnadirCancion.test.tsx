import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ImportacionLeidaIpc } from '@shared/ipc'
import { mostrarToast } from '../../componentes/gestorToasts'
import { NavegacionContexto, type DatosInicialesAnadir, type Vista } from '../../navegacion/estado'
import { TrabajosContexto } from '../../trabajos/useTrabajos'
import { resumenPrueba } from '../biblioteca/resumenPrueba'
import { AnadirCancion } from './AnadirCancion'

vi.mock('../../componentes/gestorToasts', () => ({ mostrarToast: vi.fn() }))

const leida = (extra: Partial<ImportacionLeidaIpc> = {}): ImportacionLeidaIpc => ({
  importacionId: 'imp1',
  nombre: 'bohemian.mp3',
  duracionMs: 355_000,
  metadatos: { titulo: 'Bohemian Rhapsody', artista: 'Queen', album: 'A Night' },
  gananciaDb: 0,
  larga: false,
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

function montar(
  o: {
    archivo?: string
    iniciales?: DatosInicialesAnadir
    importar?: () => Promise<ImportacionLeidaIpc>
    elegida?: string | null
  } = {}
) {
  const api = {
    sistema: {
      info: vi.fn().mockResolvedValue({ youtube: false }),
      elegirArchivoAudio: vi.fn().mockResolvedValue(o.elegida ?? '/música/bohemian.mp3')
    },
    fuente: {
      importarArchivo: vi.fn(o.importar ?? (() => Promise.resolve(leida()))),
      cancelarImportacion: vi.fn().mockResolvedValue(undefined),
      confirmarArchivo: vi.fn().mockResolvedValue(resumenPrueba({ id: 'nueva' })),
      descartarImportacion: vi.fn().mockResolvedValue(undefined)
    },
    rutaDeArchivo: (f: File) => `/soltados/${f.name}`
  }
  window.shinobi = api as never
  const ir = vi.fn<(v: Vista) => void>()
  const r = render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'anadir' }, ir }}>
      <TrabajosContexto.Provider value={{ trabajos: [], progreso: {}, terminado: false }}>
        <AnadirCancion archivo={o.archivo} iniciales={o.iniciales} />
      </TrabajosContexto.Provider>
    </NavegacionContexto.Provider>
  )
  return { api, ir, ...r }
}

const elegir = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Elegir archivo…' }))
  return screen.findByLabelText(/Título/)
}

beforeEach(() => vi.mocked(mostrarToast).mockClear())

describe('AnadirCancion (archivo)', () => {
  it('abre con "Elegir archivo…" y la cabecera en modo nueva canción', () => {
    montar()
    expect(screen.getByText('Nueva canción')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Elegir archivo…' })).toBeInTheDocument()
    expect(screen.getByText('Arrastra aquí un archivo de audio o vídeo')).toBeInTheDocument()
    // Sin YouTube (0051) no hay selector de origen.
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('elegir: lectura con Cancelar y, al terminar, formulario con foco y texto seleccionado', async () => {
    const d = diferido<ImportacionLeidaIpc>()
    const { api } = montar({ importar: () => d.promesa })
    fireEvent.click(screen.getByRole('button', { name: 'Elegir archivo…' }))
    expect(await screen.findByText('bohemian.mp3')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Leyendo el audio…' })).toBeInTheDocument()
    expect(api.fuente.importarArchivo).toHaveBeenCalledWith('/música/bohemian.mp3')
    await act(async () => d.resolver(leida()))
    expect(await screen.findByText('Audio leído: bohemian.mp3 · 5:55')).toBeInTheDocument()
    const titulo = screen.getByLabelText(/Título/) as HTMLInputElement
    expect(titulo).toHaveFocus()
    expect(titulo.value).toBe('Bohemian Rhapsody')
    expect(titulo.selectionStart).toBe(0)
    expect(titulo.selectionEnd).toBe('Bohemian Rhapsody'.length)
    expect((screen.getByLabelText('Artista') as HTMLInputElement).value).toBe('Queen')
    expect(screen.getByText('Opcional, ayuda a encontrar la letra exacta')).toBeInTheDocument()
  })

  it('cancelar la lectura vuelve a la zona sin error', async () => {
    const d = diferido<ImportacionLeidaIpc>()
    const { api } = montar({ importar: () => d.promesa })
    fireEvent.click(screen.getByRole('button', { name: 'Elegir archivo…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(api.fuente.cancelarImportacion).toHaveBeenCalledWith()
    await act(async () => d.rechazar({ codigo: 'CANCELADO', mensaje: 'cancelado' }))
    expect(screen.getByRole('button', { name: 'Elegir archivo…' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('Esc con la lectura en curso la cancela y no sale de la vista', async () => {
    const d = diferido<ImportacionLeidaIpc>()
    const { api, ir } = montar({ importar: () => d.promesa })
    fireEvent.click(screen.getByRole('button', { name: 'Elegir archivo…' }))
    await screen.findByText('bohemian.mp3')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(api.fuente.cancelarImportacion).toHaveBeenCalled()
    expect(ir).not.toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: 'Elegir archivo…' })).toBeInTheDocument()
  })

  it('Esc sin operación vuelve a la Biblioteca; Esc en el formulario descarta al salir', async () => {
    const a = montar()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(a.ir).toHaveBeenCalledWith({ tipo: 'biblioteca' })
    a.unmount()

    const b = montar()
    await elegir()
    fireEvent.keyDown(screen.getByLabelText(/Título/), { key: 'Escape' })
    expect(b.ir).toHaveBeenCalledWith({ tipo: 'biblioteca' })
    b.unmount()
    expect(b.api.fuente.descartarImportacion).toHaveBeenCalledWith('imp1')
  })

  it('Cancelar en el formulario vuelve a la Biblioteca y descarta la importación', async () => {
    const { api, ir, unmount } = montar()
    await elegir()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'biblioteca' })
    unmount()
    expect(api.fuente.descartarImportacion).toHaveBeenCalledWith('imp1')
  })

  it('el título es obligatorio y se recorta; Continuar confirma y abre el progreso', async () => {
    const { api, ir } = montar()
    const titulo = await elegir()
    fireEvent.change(titulo, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByText('Escribe un título.')).toBeInTheDocument()
    expect(titulo).toHaveAttribute('aria-invalid', 'true')
    expect(titulo).toHaveFocus()
    expect(api.fuente.confirmarArchivo).not.toHaveBeenCalled()

    fireEvent.change(titulo, { target: { value: '  Otra  ' } })
    fireEvent.change(screen.getByLabelText('Álbum'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await waitFor(() =>
      expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'nueva', paso: 'progreso' })
    )
    expect(api.fuente.confirmarArchivo).toHaveBeenCalledWith(
      'imp1',
      { titulo: 'Otra', artista: 'Queen', album: null },
      undefined
    )
  })

  it('Intro solo envía en el último campo', async () => {
    const { api } = montar()
    const titulo = await elegir()
    fireEvent.keyDown(titulo, { key: 'Enter' })
    expect(screen.getByLabelText('Artista')).toHaveFocus()
    expect(api.fuente.confirmarArchivo).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByLabelText('Álbum'), { key: 'Enter' })
    await waitFor(() => expect(api.fuente.confirmarArchivo).toHaveBeenCalled())
  })

  it('canción de más de 10 min: aviso sin cifra (0036 pendiente) y se puede continuar', async () => {
    const { api } = montar({
      importar: () => Promise.resolve(leida({ duracionMs: 760_000, larga: true }))
    })
    await elegir()
    expect(
      screen.getByText('Esta canción dura 12:40. Separarla tardará más de lo normal.')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await waitFor(() => expect(api.fuente.confirmarArchivo).toHaveBeenCalled())
  })

  it('sin aviso si no es larga', async () => {
    montar()
    await elegir()
    expect(screen.queryByText(/Separarla tardará/)).toBeNull()
  })

  it.each([
    ['FORMATO_NO_SOPORTADO', 'No podemos leer este archivo.'],
    ['AUDIO_DEMASIADO_CORTO', 'El audio es demasiado corto.'],
    ['SIN_ESPACIO', 'No queda espacio en el disco.']
  ])('error %s: alerta con el foco y la zona disponible', async (codigo, texto) => {
    montar({ importar: () => Promise.reject({ codigo, mensaje: 'x' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Elegir archivo…' }))
    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent(texto)
    await waitFor(() => expect(alerta.parentElement).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Elegir archivo…' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copiar detalles' })).toBeNull()
  })

  it('error genérico con "Copiar detalles"', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: escribir },
      configurable: true
    })
    montar({
      importar: () =>
        Promise.reject({ codigo: 'ERROR_INTERNO', mensaje: 'fallo', detalles: 'traza' })
    })
    fireEvent.click(screen.getByRole('button', { name: 'Elegir archivo…' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal.')
    fireEvent.click(screen.getByRole('button', { name: 'Copiar detalles' }))
    expect(escribir).toHaveBeenCalledWith('ERROR_INTERNO: fallo\ntraza')
  })

  it('soltar varios archivos usa el primero y avisa', async () => {
    const { api } = montar()
    const zona = screen.getByTestId('zona-arrastre')
    const f = (n: string) => new File(['x'], n)
    const ev = createEvent.drop(zona)
    Object.defineProperty(ev, 'dataTransfer', {
      value: { files: [f('a.mp3'), f('b.mp3')], types: ['Files'] }
    })
    fireEvent(zona, ev)
    await waitFor(() => expect(api.fuente.importarArchivo).toHaveBeenCalledWith('/soltados/a.mp3'))
    expect(mostrarToast).toHaveBeenCalledWith({
      tipo: 'aviso',
      mensaje: 'Añade las canciones de una en una.'
    })
  })

  it('arrastrar encima muestra "Suelta para añadir"', () => {
    montar()
    const zona = screen.getByTestId('zona-arrastre')
    const ev = createEvent.dragEnter(zona)
    Object.defineProperty(ev, 'dataTransfer', { value: { files: [], types: ['Files'] } })
    fireEvent(zona, ev)
    expect(screen.getByText('Suelta para añadir')).toBeInTheDocument()
  })

  it('archivo recibido de la Biblioteca: empieza a leer solo', async () => {
    const { api } = montar({ archivo: '/música/recibido.flac' })
    expect(screen.getByText('recibido.flac')).toBeInTheDocument()
    expect(api.fuente.importarArchivo).toHaveBeenCalledWith('/música/recibido.flac')
    expect(await screen.findByLabelText(/Título/)).toBeInTheDocument()
  })

  it('con `iniciales` conserva los metadatos y sustituye la fuente de la misma canción', async () => {
    const { api, ir } = montar({
      iniciales: { cancionId: 'c9', titulo: 'Mi título', artista: 'Yo', album: null }
    })
    const titulo = await elegir()
    expect((titulo as HTMLInputElement).value).toBe('Mi título')
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await waitFor(() => expect(ir).toHaveBeenCalled())
    expect(api.fuente.confirmarArchivo).toHaveBeenCalledWith(
      'imp1',
      { titulo: 'Mi título', artista: 'Yo', album: null },
      { cancionId: 'c9' }
    )
  })

  it('un error al confirmar se muestra y se queda en el formulario', async () => {
    const { api, ir } = montar()
    await elegir()
    api.fuente.confirmarArchivo.mockRejectedValueOnce({ codigo: 'SIN_ESPACIO', mensaje: 'x' })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No queda espacio en el disco.')
    expect(ir).not.toHaveBeenCalled()
  })

  it('al navegar tras confirmar no se descarta la importación', async () => {
    const { api, unmount } = montar()
    await elegir()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    await waitFor(() => expect(api.fuente.confirmarArchivo).toHaveBeenCalled())
    await act(async () => undefined)
    unmount()
    expect(api.fuente.descartarImportacion).not.toHaveBeenCalled()
  })
})
