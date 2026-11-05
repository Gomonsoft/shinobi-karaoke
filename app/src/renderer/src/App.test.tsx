import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from './App'
import { resumenPrueba } from './vistas/biblioteca/resumenPrueba'
import { mostrarToast } from './componentes/gestorToasts'
import { configPredeterminada } from '@shared/config'
import type { AccionMenu, ApiShinobi, EventoProgresoIpc, TrabajoIpc } from '@shared/ipc'
import { DURACION_TERMINADO_MS } from './trabajos/useTrabajos'

let cambioTrabajo: (t: TrabajoIpc) => void = () => undefined
let progresoTrabajo: (p: EventoProgresoIpc) => void = () => undefined
let trabajosIniciales: TrabajoIpc[] = []
let llamadasListar = 0

const trabajo = (extra: Partial<TrabajoIpc> = {}): TrabajoIpc => ({
  id: 't1',
  cancionId: 'c0',
  paso: 'separacion',
  cola: 'pesada',
  comando: 'demo',
  estado: 'en_curso',
  posicion: null,
  resultado: null,
  error: null,
  progreso: null,
  ...extra
})

interface Opciones {
  instalacion?: 'pendiente' | 'completa'
  canciones?: number
}

let accionMenu: ((a: AccionMenu) => void) | null = null

function instalarApi({ instalacion = 'completa', canciones = 2 }: Opciones = {}) {
  cambioTrabajo = () => undefined
  progresoTrabajo = () => undefined
  llamadasListar = 0
  const config = configPredeterminada()
  config.instalacion.estado = instalacion
  accionMenu = null
  const api = {
    biblioteca: {
      listar: () => {
        llamadasListar++
        return Promise.resolve(
          Array.from({ length: canciones }, (_, i) =>
            resumenPrueba({ id: `c${i}`, titulo: `Canción ${i}` })
          )
        )
      }
    },
    config: { obtener: () => Promise.resolve(config) },
    sistema: { info: () => Promise.resolve({ youtube: false }) },
    trabajos: {
      listar: () => Promise.resolve(trabajosIniciales),
      alCambiar: (cb: (t: TrabajoIpc) => void) => {
        cambioTrabajo = cb
        return () => undefined
      },
      alProgreso: (cb: (p: EventoProgresoIpc) => void) => {
        progresoTrabajo = cb
        return () => undefined
      }
    },
    rutaDeArchivo: (f: File) => `/ruta/${f.name}`,
    fuente: {
      importarArchivo: vi.fn(() => new Promise(() => undefined)),
      cancelarImportacion: () => Promise.resolve(),
      descartarImportacion: () => Promise.resolve()
    },
    alCambiarCancion: () => () => undefined,
    alCambiarConfig: () => () => undefined,
    runtime: {
      estado: () =>
        Promise.resolve({
          estado: 'pendiente',
          fases: { motor: 'pendiente', componentes: 'pendiente', modelo: 'pendiente' },
          error: null,
          perfilPrevisto: 'cpu',
          perfil: null,
          motivoRebaja: null,
          modo: 'calidad',
          bytesRestantes: null,
          rapidoPendiente: false,
          ofrecerRapido: false,
          volverACalidad: null
        }),
      requisitos: () =>
        Promise.resolve({
          plataforma: 'linux-x64',
          motivo: null,
          versionMinimaSo: null,
          equipo: { so: 'linux', versionSo: '6.8', arquitectura: 'x64' },
          emulada: false,
          perfil: 'cpu',
          gpu: null,
          bytesDescarga: 700_000_000,
          espacioRequerido: 3_000_000_000,
          espacioLibre: 120_000_000_000,
          modoPrevisto: 'calidad'
        }),
      instalar: () => Promise.resolve(),
      alCambiar: () => () => undefined,
      alProgreso: () => () => undefined
    },
    app: {
      confirmarCierre: () => Promise.resolve(),
      salir: () => Promise.resolve(),
      alSolicitudCierre: () => () => undefined
    },
    avisos: { alAviso: () => () => undefined, alAbrirCancion: () => () => undefined },
    alAccionMenu: (cb: (a: AccionMenu) => void) => {
      accionMenu = cb
      return () => {
        accionMenu = null
      }
    }
  }
  ;(window as unknown as { shinobi: unknown }).shinobi = api as unknown as ApiShinobi
}

async function abrir(opciones?: Opciones) {
  instalarApi(opciones)
  render(<App />)
  await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument())
  // Deja resolver listar() para conocer si la biblioteca está vacía.
  await act(async () => {})
}

const teclear = (init: KeyboardEventInit, destino: Element | Window = window) =>
  fireEvent.keyDown(destino, init)

describe('arranque', () => {
  it('con la instalación completa muestra la Biblioteca con barra superior', async () => {
    await abrir()
    expect(screen.getByRole('heading', { level: 1, name: 'Biblioteca' })).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('con la instalación incompleta muestra la Bienvenida de Primer arranque sin barra', async () => {
    await abrir({ instalacion: 'pendiente' })
    const bienvenida = { level: 1, name: 'Hola. Vamos a preparar tu estudio de karaoke.' } as const
    expect(await screen.findByRole('heading', bienvenida)).toBeInTheDocument()
    expect(screen.queryByRole('banner')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ir a la Biblioteca' })).toBeNull()
    teclear({ key: ',', ctrlKey: true })
    teclear({ key: 'n', ctrlKey: true })
    expect(screen.getByRole('heading', bienvenida)).toBeInTheDocument()
  })
})

describe('barra superior', () => {
  it('muestra "Añadir canción" solo en la Biblioteca y lo oculta si está vacía', async () => {
    await abrir()
    const barra = screen.getByRole('banner')
    expect(within(barra).getByRole('button', { name: 'Añadir canción' })).toBeInTheDocument()
    fireEvent.click(within(barra).getByRole('button', { name: 'Ajustes' }))
    expect(
      within(screen.getByRole('banner')).queryByRole('button', { name: 'Añadir canción' })
    ).toBeNull()
  })

  it('en la biblioteca vacía solo hay un botón primario "Añadir canción" (el del contenido)', async () => {
    await abrir({ canciones: 0 })
    expect(
      within(screen.getByRole('banner')).queryByRole('button', { name: 'Añadir canción' })
    ).toBeNull()
    const principal = within(screen.getByRole('main')).getByRole('button', {
      name: 'Añadir canción'
    })
    fireEvent.click(principal)
    expect(screen.getByRole('heading', { level: 1, name: 'Añadir canción' })).toBeInTheDocument()
  })

  it('el logotipo lleva a la Biblioteca y el botón ⚙ a Ajustes', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Shinobi Karaoke' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Biblioteca' })).toBeInTheDocument()
  })

  it('"‹ Biblioteca" de un marcador vuelve a la Biblioteca', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }))
    fireEvent.click(screen.getByRole('button', { name: '‹ Biblioteca' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Biblioteca' })).toBeInTheDocument()
  })
})

describe('atajos globales', () => {
  it('Ctrl+N abre Añadir canción y Cmd+N también', async () => {
    await abrir()
    teclear({ key: 'n', ctrlKey: true })
    expect(screen.getByRole('heading', { level: 1, name: 'Añadir canción' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Biblioteca' }))
    teclear({ key: 'n', metaKey: true })
    expect(screen.getByRole('heading', { level: 1, name: 'Añadir canción' })).toBeInTheDocument()
  })

  it('Ctrl/Cmd+, abre Ajustes y Esc vuelve a la Biblioteca', async () => {
    await abrir()
    teclear({ key: ',', ctrlKey: true })
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument()
    teclear({ key: 'Escape' })
    expect(screen.getByRole('heading', { level: 1, name: 'Biblioteca' })).toBeInTheDocument()
    teclear({ key: ',', metaKey: true })
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument()
  })

  it('Esc no hace nada en la Biblioteca', async () => {
    await abrir()
    teclear({ key: 'Escape' })
    expect(screen.getByRole('heading', { level: 1, name: 'Biblioteca' })).toBeInTheDocument()
  })

  it('Esc con el foco en un campo de texto no cambia de vista', async () => {
    await abrir()
    teclear({ key: 'n', ctrlKey: true })
    const campo = document.createElement('input')
    document.getElementById('contenido')!.appendChild(campo)
    campo.focus()
    teclear({ key: 'Escape' }, campo)
    expect(screen.getByRole('heading', { level: 1, name: 'Añadir canción' })).toBeInTheDocument()
    campo.blur()
    teclear({ key: 'Escape' })
    expect(screen.getByRole('heading', { level: 1, name: 'Biblioteca' })).toBeInTheDocument()
  })

  it('con un diálogo abierto, Esc y los atajos no navegan', async () => {
    await abrir()
    teclear({ key: ',', ctrlKey: true })
    const dialogo = document.createElement('div')
    dialogo.setAttribute('aria-modal', 'true')
    document.body.appendChild(dialogo)
    teclear({ key: 'Escape' })
    teclear({ key: 'n', ctrlKey: true })
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument()
    dialogo.remove()
  })

  it('Ctrl+N desde Ajustes no navega (solo Biblioteca y espacio de canción)', async () => {
    await abrir()
    teclear({ key: ',', ctrlKey: true })
    teclear({ key: 'n', ctrlKey: true })
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument()
  })

  it('las acciones del menú nativo navegan igual que los atajos', async () => {
    await abrir()
    act(() => accionMenu?.('ajustes'))
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument()
    act(() => accionMenu?.('anadir'))
    // Desde Ajustes no aplica.
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument()
  })
})

describe('foco y landmarks', () => {
  it('al cambiar de vista el foco va al título de la nueva vista', async () => {
    await abrir()
    teclear({ key: ',', ctrlKey: true })
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toHaveFocus()
    teclear({ key: 'Escape' })
    expect(screen.getByRole('heading', { level: 1, name: 'Biblioteca' })).toHaveFocus()
  })

  it('"Saltar al contenido" mueve el foco al área principal', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('link', { name: 'Saltar al contenido' }))
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('hay un único banner y un único main', async () => {
    await abrir()
    expect(screen.getAllByRole('banner')).toHaveLength(1)
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('el gestor de toasts global está montado en la raíz', async () => {
    await abrir()
    act(() => {
      mostrarToast({ tipo: 'exito', mensaje: 'Información copiada' })
    })
    expect(screen.getByText('Información copiada')).toBeInTheDocument()
  })
})

describe('indicador de actividad', () => {
  afterEach(() => {
    vi.useRealTimers()
    trabajosIniciales = []
  })

  it('no aparece sin trabajos', async () => {
    await abrir()
    expect(screen.queryByText(/en curso|en cola/)).toBeNull()
  })

  it('el estado inicial sale de listar() y las altas y bajas llegan por alCambiar', async () => {
    trabajosIniciales = [trabajo({ id: 't1' })]
    await abrir()
    expect(within(screen.getByRole('banner')).getByText('1 en curso')).toBeInTheDocument()

    act(() => cambioTrabajo(trabajo({ id: 't2', estado: 'en_cola', posicion: 1, cola: 'ligera' })))
    expect(screen.getByText('1 en curso · 1 en cola')).toBeInTheDocument()

    act(() => cambioTrabajo(trabajo({ id: 't1', estado: 'terminado', resultado: 'cancelado' })))
    expect(screen.getByText('1 en cola')).toBeInTheDocument()
  })

  it('biblioteca.listar() se llama una sola vez al montar App + Biblioteca (y no al navegar)', async () => {
    await abrir()
    expect(llamadasListar).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }))
    fireEvent.click(screen.getByRole('button', { name: /Shinobi Karaoke/ }))
    await act(async () => {})
    expect(screen.getByRole('heading', { level: 1, name: 'Biblioteca' })).toBeInTheDocument()
    expect(llamadasListar).toBe(1)
  })

  it('el botón de actividad abre el panel con el título de la canción', async () => {
    trabajosIniciales = [trabajo()]
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: '1 en curso' }))
    expect(screen.getByRole('heading', { name: 'Actividad' })).toBeInTheDocument()
    expect(screen.getByText(/Canción 0 — /)).toBeInTheDocument()
  })

  it('al terminar todos muestra "Terminado" 4 s y desaparece', async () => {
    trabajosIniciales = [trabajo()]
    await abrir()
    vi.useFakeTimers()
    act(() => cambioTrabajo(trabajo({ estado: 'terminado', resultado: 'completado' })))
    expect(screen.getByText('Terminado')).toBeInTheDocument()
    expect(screen.queryByText(/en curso/)).toBeNull()
    act(() => {
      vi.advanceTimersByTime(DURACION_TERMINADO_MS + 10)
    })
    expect(screen.queryByText('Terminado')).toBeNull()
  })

  it('un trabajo cancelado o fallido no muestra "Terminado"', async () => {
    trabajosIniciales = [trabajo()]
    await abrir()
    act(() => cambioTrabajo(trabajo({ estado: 'terminado', resultado: 'error' })))
    expect(screen.queryByText('Terminado')).toBeNull()
    expect(screen.queryByText(/en curso/)).toBeNull()
  })

  it('la línea de paso de la tarjeta refleja el progreso en vivo', async () => {
    const c = resumenPrueba({ id: 'c0', titulo: 'Canción 0' })
    void c
    trabajosIniciales = [trabajo({ cancionId: 'c0' })]
    await abrir()
    act(() =>
      progresoTrabajo({
        id: 't1',
        cancionId: 'c0',
        paso: 'separacion',
        fase: 'separando',
        valor: 0.42,
        etaSegundos: 180
      })
    )
    expect(screen.getByText('Separando 42 % · quedan unos 3 min')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /Separando 42/ })).toBeInTheDocument()
  })
})

describe('arrastrar un archivo', () => {
  const soltar = (nombres: string[]) => {
    const archivos = nombres.map((n) => new File(['x'], n))
    fireEvent.drop(window, { dataTransfer: { types: ['Files'], files: archivos } })
  }

  it('sobre la Biblioteca abre la vista Añadir recordando la ruta', async () => {
    await abrir()
    soltar(['tema.MP3'])
    expect(screen.getByRole('heading', { level: 1, name: 'Añadir canción' })).toBeInTheDocument()
    expect(screen.getByText('tema.MP3')).toBeInTheDocument()
    expect(window.shinobi.fuente.importarArchivo).toHaveBeenCalledWith('/ruta/tema.MP3')
  })

  it('un formato no admitido avisa y no navega; varios archivos avisan y usan el primero', async () => {
    await abrir()
    soltar(['notas.txt'])
    expect(screen.getByRole('heading', { level: 1, name: 'Biblioteca' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Ese tipo de archivo no se puede usar. Prueba con un archivo de audio o de vídeo.'
      )
    ).toBeInTheDocument()
    soltar(['a.flac', 'b.wav'])
    expect(screen.getByText('Añade las canciones de una en una.')).toBeInTheDocument()
    expect(screen.getByText('a.flac')).toBeInTheDocument()
    expect(window.shinobi.fuente.importarArchivo).toHaveBeenCalledWith('/ruta/a.flac')
  })

  it('fuera de la Biblioteca no navega', async () => {
    await abrir()
    teclear({ key: ',', ctrlKey: true })
    soltar(['tema.mp3'])
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument()
  })
})
