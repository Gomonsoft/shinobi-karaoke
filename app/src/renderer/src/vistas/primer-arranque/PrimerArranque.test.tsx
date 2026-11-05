import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type {
  ApiShinobi,
  EstadoRuntimeIpc,
  ProgresoRuntimeIpc,
  RequisitosRuntimeIpc
} from '@shared/ipc'
import { configPredeterminada } from '@shared/config'
import { ContenedorToasts } from '../../componentes/Toasts'
import { cerrarTodosLosToasts } from '../../componentes/gestorToasts'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { PrimerArranque } from './PrimerArranque'
import { ENLACE_ACTUALIZAR_MACOS } from './textos'

const estadoBase = (extra: Partial<EstadoRuntimeIpc> = {}): EstadoRuntimeIpc => ({
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
  volverACalidad: null,
  ...extra
})

const requisitosBase = (extra: Partial<RequisitosRuntimeIpc> = {}): RequisitosRuntimeIpc => ({
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
  modoPrevisto: 'calidad',
  ...extra
})

const progreso = (extra: Partial<ProgresoRuntimeIpc> = {}): ProgresoRuntimeIpc => ({
  faseVisible: 'componentes',
  estados: { motor: 'completada', componentes: 'en_curso', modelo: 'pendiente' },
  bytes: 312e6,
  total: 780e6,
  totalGlobal: 1000e6,
  porcentajeGlobal: 10,
  etaSegundos: 360,
  modo: 'calidad',
  motivoRebaja: null,
  comprobando: false,
  ...extra
})

interface Opciones {
  estado?: EstadoRuntimeIpc
  requisitos?: RequisitosRuntimeIpc
  estimacion?: { min: number; max: number } | null
}

let cambiar: (e: EstadoRuntimeIpc) => void
let emitirProgreso: (p: ProgresoRuntimeIpc) => void
let solicitarCierre: () => void
let api: {
  instalar: ReturnType<typeof vi.fn>
  aceptarRapido: ReturnType<typeof vi.fn>
  pausar: ReturnType<typeof vi.fn>
  requisitos: ReturnType<typeof vi.fn>
  confirmarCierre: ReturnType<typeof vi.fn>
  salir: ReturnType<typeof vi.fn>
  abrirEnlace: ReturnType<typeof vi.fn>
  copiar: ReturnType<typeof vi.fn>
  ir: ReturnType<typeof vi.fn>
}

function montar(o: Opciones = {}) {
  const estado = o.estado ?? estadoBase()
  const requisitos = o.requisitos ?? requisitosBase()
  api = {
    instalar: vi.fn().mockResolvedValue(undefined),
    aceptarRapido: vi.fn().mockResolvedValue(undefined),
    pausar: vi.fn().mockResolvedValue(undefined),
    requisitos: vi.fn().mockResolvedValue(requisitos),
    confirmarCierre: vi.fn().mockResolvedValue(undefined),
    salir: vi.fn().mockResolvedValue(undefined),
    abrirEnlace: vi.fn().mockResolvedValue(undefined),
    copiar: vi.fn().mockResolvedValue(undefined),
    ir: vi.fn()
  }
  Object.assign(navigator, { clipboard: { writeText: api.copiar } })
  window.shinobi = {
    runtime: {
      estado: () => Promise.resolve(estado),
      requisitos: api.requisitos,
      instalar: api.instalar,
      aceptarYUsarRapido: api.aceptarRapido,
      pausar: api.pausar,
      detalles: () => Promise.resolve('DETALLES DE SOPORTE'),
      estimarSeparacion: () => Promise.resolve(o.estimacion === undefined ? null : o.estimacion),
      alCambiar: (cb: (e: EstadoRuntimeIpc) => void) => {
        cambiar = cb
        return () => undefined
      },
      alProgreso: (cb: (p: ProgresoRuntimeIpc) => void) => {
        emitirProgreso = cb
        return () => undefined
      }
    },
    config: { obtener: () => Promise.resolve(configPredeterminada()) },
    alCambiarConfig: () => () => undefined,
    app: {
      confirmarCierre: api.confirmarCierre,
      salir: api.salir,
      alSolicitudCierre: (cb: () => void) => {
        solicitarCierre = cb
        return () => undefined
      }
    },
    sistema: {
      abrirEnlace: api.abrirEnlace,
      info: () =>
        Promise.resolve({
          version: '0.1.0',
          so: 'Darwin 23.6.0',
          plataforma: 'darwin',
          youtube: false,
          versionSo: '13.6'
        })
    }
  } as unknown as ApiShinobi
  render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'primer-arranque' }, ir: api.ir as (v: Vista) => void }}
    >
      <PrimerArranque />
      <ContenedorToasts />
    </NavegacionContexto.Provider>
  )
}

const asentar = () => act(async () => {})
const titulo = (nombre: string | RegExp) => screen.getByRole('heading', { level: 1, name: nombre })

afterEach(() => {
  vi.useRealTimers()
  cerrarTodosLosToasts()
})

describe('B1 Bienvenida', () => {
  it('muestra los requisitos del perfil previsto y prepara con foco inicial en el primario', async () => {
    montar()
    await asentar()
    expect(titulo('Hola. Vamos a preparar tu estudio de karaoke.')).toBeInTheDocument()
    expect(screen.getByText('Descarga: unos 0,7 GB para tu equipo')).toBeInTheDocument()
    expect(screen.getByText('Tiempo: de 5 a 25 minutos, según tu conexión')).toBeInTheDocument()
    expect(
      screen.getByText('Espacio: necesitas al menos 3 GB libres (tienes 120 GB)')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Conexión: necesaria solo durante esta preparación')
    ).toBeInTheDocument()
    const boton = screen.getByRole('button', { name: 'Preparar Shinobi Karaoke' })
    expect(boton).toHaveFocus()
    fireEvent.click(boton)
    expect(api.instalar).toHaveBeenCalledTimes(1)
  })

  it('sin perfil detectado usa la descarga genérica y el mayor espacio del manifiesto', async () => {
    montar({
      requisitos: requisitosBase({
        perfil: null,
        bytesDescarga: null,
        rangoDescarga: [1_233_000_000, 5_350_000_000],
        espacioRequerido: 10_000_000_000
      })
    })
    await asentar()
    expect(screen.getByText('Descarga: entre 1 y 6 GB según tu equipo')).toBeInTheDocument()
    expect(screen.getByText(/necesitas al menos 10 GB libres/)).toBeInTheDocument()
  })

  it('con poco espacio marca la fila en error y "Comprobar de nuevo" recalcula', async () => {
    montar({ requisitos: requisitosBase({ espacioLibre: 3_100_000_000, espacioRequerido: 10e9 }) })
    await asentar()
    expect(
      screen.getByText(
        'Necesitas 10 GB libres y tienes 3,1 GB. Libera espacio y pulsa "Comprobar de nuevo".'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Preparar Shinobi Karaoke' })).toBeNull()
    api.requisitos.mockResolvedValueOnce(requisitosBase({ espacioLibre: 50e9 }))
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar de nuevo' }))
    await asentar()
    expect(api.requisitos).toHaveBeenLastCalledWith({ recalcularEspacio: true })
    expect(screen.getByRole('button', { name: 'Preparar Shinobi Karaoke' })).toBeInTheDocument()
    expect(api.instalar).not.toHaveBeenCalled()
  })

  it('"Licencias" abre el diálogo Acerca de', async () => {
    montar()
    await asentar()
    fireEvent.click(screen.getByRole('button', { name: 'Licencias' }))
    expect(await screen.findByRole('dialog', { name: 'Licencias' })).toBeInTheDocument()
  })
})

describe('B5 Reanudar / Reparar', () => {
  it('con fases completadas ofrece continuar y dice cuánto falta', async () => {
    montar({
      estado: estadoBase({
        fases: { motor: 'completada', componentes: 'pendiente', modelo: 'pendiente' },
        bytesRestantes: 450e6
      })
    })
    await asentar()
    expect(titulo('Continuamos donde lo dejamos')).toBeInTheDocument()
    expect(screen.getByText('Faltan unos 450 MB por descargar.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar la preparación' }))
    expect(api.instalar).toHaveBeenCalled()
  })

  it('con un error guardado también continúa', async () => {
    montar({
      estado: estadoBase({ error: { codigo: 'SIN_CONEXION', mensaje: 'x', fase: 'motor' } })
    })
    await asentar()
    expect(titulo('Continuamos donde lo dejamos')).toBeInTheDocument()
  })

  it('con la instalación dañada ofrece reparar', async () => {
    montar({ estado: estadoBase({ estado: 'dañada' }) })
    await asentar()
    expect(titulo('Hay que reparar el motor de audio')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Falta una parte de lo que se descargó la primera vez. Vamos a descargarla de nuevo.'
      )
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reparar' }))
    expect(api.instalar).toHaveBeenCalled()
  })
})

describe('B0 Comprobando', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: false }))

  async function montarB0() {
    montar({ estado: estadoBase({ estado: 'verificando' }) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  }

  it('los primeros 300 ms solo hay logotipo; después título, cuerpo y barra indeterminada', async () => {
    await montarB0()
    expect(screen.getByText('Shinobi Karaoke')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(titulo('Comprobando tu instalación…')).toBeInTheDocument()
    expect(screen.getByText('Solo tardará unos segundos.')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('anuncia el título una sola vez y a los 15 s cambia el subtítulo', async () => {
    await montarB0()
    const anuncios = screen.getAllByRole('status')
    expect(anuncios.filter((a) => a.textContent === 'Comprobando tu instalación…')).toHaveLength(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(
      screen.getByText('Está tardando un poco más de lo normal. No cierres la aplicación.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Solo tardará unos segundos.')).toBeNull()
  })

  it('Esc no hace nada y la solicitud de cierre se responde sin diálogo', async () => {
    await montarB0()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => solicitarCierre())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.confirmarCierre).toHaveBeenCalledTimes(1)
  })

  it('si pasa, abre la Biblioteca directamente (sin B3)', async () => {
    await montarB0()
    act(() =>
      cambiar(
        estadoBase({
          estado: 'completa',
          fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' }
        })
      )
    )
    expect(api.ir).toHaveBeenCalledWith({ tipo: 'biblioteca' })
    expect(screen.queryByText('Todo listo')).toBeNull()
  })

  it('si falta solo el modelo, B5 "Continuamos donde lo dejamos"', async () => {
    await montarB0()
    act(() =>
      cambiar(
        estadoBase({
          fases: { motor: 'completada', componentes: 'completada', modelo: 'pendiente' },
          bytesRestantes: 100e6
        })
      )
    )
    expect(titulo('Continuamos donde lo dejamos')).toBeInTheDocument()
  })

  it('si el entorno no vale, B5 "Hay que reparar el motor de audio"', async () => {
    await montarB0()
    act(() => cambiar(estadoBase({ estado: 'dañada' })))
    expect(titulo('Hay que reparar el motor de audio')).toBeInTheDocument()
  })
})

describe('B6 / B6b: equipo no compatible', () => {
  const linuxArm = requisitosBase({
    plataforma: null,
    motivo: 'arquitectura',
    perfil: null,
    bytesDescarga: null,
    equipo: { so: 'linux', versionSo: '6.8', arquitectura: 'arm64' }
  })
  const macIntel = (versionSo: string) =>
    requisitosBase({
      plataforma: null,
      motivo: 'arquitectura',
      equipo: { so: 'macos', versionSo, arquitectura: 'x64' }
    })
  const macAntiguo = requisitosBase({
    plataforma: null,
    motivo: 'so_antiguo',
    versionMinimaSo: { version: '14', nombre: 'Sonoma' },
    equipo: { so: 'macos', versionSo: '13.6', arquitectura: 'arm64' }
  })

  it('Linux arm64 -> B6 con "Linux · procesador ARM de 64 bits" y sus tres botones', async () => {
    montar({ requisitos: linuxArm })
    await asentar()
    expect(titulo('Tu equipo no es compatible todavía')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'solo existe para Windows 10/11 y Linux con procesador de 64 bits (x64) y para Mac con chip Apple y macOS 14 o posterior.'
    )
    expect(screen.getByText('Tu equipo: Linux · procesador ARM de 64 bits')).toBeInTheDocument()
    expect(screen.getByText(/ábrenos una incidencia en la web del proyecto/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salir' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    expect(api.salir).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /Preparar/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Pedir soporte para mi equipo/ }))
    expect(api.abrirEnlace).toHaveBeenCalledWith(
      'https://github.com/Gomonsoft/shinobi-karaoke/issues'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Copiar detalles' }))
    await waitFor(() => expect(api.copiar).toHaveBeenCalled())
    const detalles = api.copiar.mock.calls[0]![0] as string
    expect(detalles).toContain('plataforma no compatible')
    expect(detalles).toContain('0.1.0')
    expect(detalles).toContain('arm64')
    expect(await screen.findByText('Detalles copiados')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Licencias' })).toBeInTheDocument()
  })

  it.each([
    ['13.6', 'macOS 13.6 · procesador Intel'],
    ['15.1', 'macOS 15.1 · procesador Intel']
  ])('Mac Intel con macOS %s -> B6 (nunca B6b)', async (version, equipo) => {
    montar({ requisitos: macIntel(version) })
    await asentar()
    expect(titulo('Tu equipo no es compatible todavía')).toBeInTheDocument()
    expect(screen.getByText(`Tu equipo: ${equipo}`)).toBeInTheDocument()
    expect(screen.queryByText('Necesitas actualizar macOS')).toBeNull()
  })

  it('Mac con chip Apple y macOS 13.6 -> B6b con banner aviso, tres botones y foco en Salir', async () => {
    montar({ requisitos: macAntiguo })
    await asentar()
    expect(titulo('Necesitas actualizar macOS')).toBeInTheDocument()
    const cuerpo = screen.getByText(/necesita macOS 14 \(Sonoma\)/)
    expect(cuerpo.closest('[class*="aviso"]')).not.toBeNull()
    expect(
      screen.getByText(
        'Shinobi Karaoke necesita macOS 14 (Sonoma) o posterior y tu Mac tiene macOS 13.6.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('Todos los Mac con chip Apple pueden actualizar gratis.')
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText(/Actualización de software/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pedir soporte/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Preparar/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Salir' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    expect(api.salir).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /Cómo actualizar macOS/ }))
    expect(api.abrirEnlace).toHaveBeenCalledWith(ENLACE_ACTUALIZAR_MACOS)
    expect(ENLACE_ACTUALIZAR_MACOS).toBe('https://support.apple.com/es-es/108382')

    fireEvent.click(screen.getByRole('button', { name: 'Copiar detalles' }))
    await waitFor(() => expect(api.copiar).toHaveBeenCalled())
    expect(api.copiar.mock.calls[0]![0]).toContain('macos por debajo del mínimo (14)')
    expect(api.copiar.mock.calls[0]![0]).not.toContain('plataforma no compatible')
  })

  it('B6b sin nombre de versión usa solo el número', async () => {
    montar({
      requisitos: { ...macAntiguo, versionMinimaSo: { version: '15', nombre: null } }
    })
    await asentar()
    expect(screen.getByText(/necesita macOS 15 o posterior/)).toBeInTheDocument()
  })

  it('macOS 14.0 con chip Apple (hay plataforma) -> B1', async () => {
    montar({
      requisitos: requisitosBase({
        plataforma: 'darwin-arm64',
        perfil: 'mps',
        equipo: { so: 'macos', versionSo: '14.0', arquitectura: 'arm64' }
      })
    })
    await asentar()
    expect(titulo('Hola. Vamos a preparar tu estudio de karaoke.')).toBeInTheDocument()
  })
})

describe('B2 Instalando', () => {
  async function instalando(extra: Partial<EstadoRuntimeIpc> = {}) {
    montar({
      estado: estadoBase({
        estado: 'en_curso',
        fases: { motor: 'completada', componentes: 'en_curso', modelo: 'pendiente' },
        ...extra
      })
    })
    await asentar()
  }

  it('muestra las tres fases, X MB de Y MB, la barra total y el modo desde el inicio', async () => {
    await instalando()
    expect(titulo('Preparando Shinobi Karaoke')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    act(() => emitirProgreso(progreso()))
    expect(screen.getByText('Preparando el motor de audio')).toBeInTheDocument()
    expect(screen.getByText('312 MB de 780 MB')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Total' })).toBeInTheDocument()
    expect(
      screen.getByText(
        /Tu equipo no tiene una tarjeta gráfica compatible: separaremos las pistas con el modelo Calidad usando el procesador/
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/Rápido/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Pausar y salir' })).toHaveFocus()
  })

  it('modo Calidad con NVIDIA y con chip Apple', async () => {
    await instalando({ perfilPrevisto: 'cuda', modo: 'calidad' })
    expect(
      screen.getByText(
        /Separaremos las pistas con el modelo Calidad usando tu tarjeta gráfica NVIDIA/
      )
    ).toBeInTheDocument()
  })

  it('el tiempo restante sale a los 10 s y se redondea', async () => {
    vi.useFakeTimers()
    montar({ estado: estadoBase({ estado: 'en_curso' }) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    act(() => emitirProgreso(progreso({ etaSegundos: 360 })))
    expect(screen.getByText(/Calculando tiempo…/)).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(screen.getByText(/quedan unos 6 minutos/)).toBeInTheDocument()
    act(() => emitirProgreso(progreso({ etaSegundos: 30 })))
    expect(screen.getByText(/menos de 1 minuto/)).toBeInTheDocument()
    act(() => emitirProgreso(progreso({ etaSegundos: 3600 })))
    expect(screen.getByText(/más de 30 minutos/)).toBeInTheDocument()
  })

  it('las barras no retroceden ni llegan a 100 % antes de terminar la fase', async () => {
    await instalando()
    act(() => emitirProgreso(progreso({ porcentajeGlobal: 40, bytes: 400e6, total: 400e6 })))
    expect(screen.getByRole('progressbar', { name: 'Total' })).toHaveAttribute(
      'aria-valuenow',
      '40'
    )
    expect(screen.getByRole('progressbar', { name: 'Instalando componentes' })).toHaveAttribute(
      'aria-valuenow',
      '99'
    )
    act(() => emitirProgreso(progreso({ porcentajeGlobal: 30, bytes: 100e6, total: 400e6 })))
    expect(screen.getByRole('progressbar', { name: 'Total' })).toHaveAttribute(
      'aria-valuenow',
      '40'
    )
    expect(screen.getByRole('progressbar', { name: 'Instalando componentes' })).toHaveAttribute(
      'aria-valuenow',
      '99'
    )
  })

  it('muestra "Comprobando tu equipo…" como subestado', async () => {
    await instalando()
    act(() => emitirProgreso(progreso({ comprobando: true })))
    expect(screen.getByText('Comprobando tu equipo…')).toBeInTheDocument()
  })

  it('una rebaja sustituye el mensaje, se resalta 4 s y se anuncia', async () => {
    vi.useFakeTimers()
    montar({ estado: estadoBase({ estado: 'en_curso', perfilPrevisto: 'cuda', modo: 'calidad' }) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    act(() => emitirProgreso(progreso({ modo: 'calidad' })))
    expect(screen.getByText(/modelo Calidad/)).toBeInTheDocument()
    act(() => emitirProgreso(progreso({ modo: 'calidad', motivoRebaja: 'memoria' })))
    const mensaje =
      /Tu tarjeta gráfica no tiene memoria suficiente: separaremos las pistas con el modelo Calidad usando el procesador/
    const banner = screen.getAllByRole('status').find((s) => mensaje.test(s.textContent ?? ''))
    expect(banner).toBeDefined()
    expect(screen.getAllByText(mensaje).length).toBeGreaterThanOrEqual(2) // banner + anuncio
    expect(document.querySelector('[class*="aviso"]')).not.toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000)
    })
    expect(document.querySelector('[class*="aviso"]')).toBeNull()
    expect(screen.getAllByText(mensaje).length).toBeGreaterThanOrEqual(1)
  })

  it('anuncia el cambio de fase y cada 25 % del total, no cada evento', async () => {
    await instalando()
    const region = () =>
      screen.getAllByRole('status').find((s) => s.getAttribute('aria-live') === 'polite')!
    act(() => emitirProgreso(progreso({ porcentajeGlobal: 5 })))
    expect(region()).toHaveTextContent('Instalando componentes')
    act(() => emitirProgreso(progreso({ porcentajeGlobal: 12 })))
    expect(region()).toHaveTextContent('Instalando componentes')
    act(() => emitirProgreso(progreso({ porcentajeGlobal: 26 })))
    expect(region()).toHaveTextContent('25 % completado')
    act(() => emitirProgreso(progreso({ porcentajeGlobal: 49 })))
    expect(region()).toHaveTextContent('25 % completado')
    act(() => emitirProgreso(progreso({ porcentajeGlobal: 51 })))
    expect(region()).toHaveTextContent('50 % completado')
  })

  it('"Ver detalles" despliega el registro y "Copiar detalles" lo copia con un toast', async () => {
    await instalando()
    fireEvent.click(screen.getByRole('button', { name: /Ver detalles/ }))
    expect(await screen.findByText('DETALLES DE SOPORTE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copiar detalles' }))
    await waitFor(() => expect(api.copiar).toHaveBeenCalledWith('DETALLES DE SOPORTE'))
    expect(await screen.findByText('Detalles copiados')).toBeInTheDocument()
  })

  describe('pausar y salir', () => {
    it('por el botón: diálogo, "Seguir preparando" lo cierra', async () => {
      await instalando()
      fireEvent.click(screen.getByRole('button', { name: 'Pausar y salir' }))
      const dialogo = screen.getByRole('dialog', { name: '¿Pausar la preparación?' })
      expect(
        within(dialogo).getByText(/Se guardará lo descargado y continuará la próxima vez/)
      ).toBeInTheDocument()
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Seguir preparando' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(api.pausar).not.toHaveBeenCalled()
    })

    it('con Esc abre el diálogo y confirmar pausa y sale de la app (no solo de la ventana)', async () => {
      const cerrar = vi.spyOn(window, 'close').mockImplementation(() => undefined)
      await instalando()
      fireEvent.keyDown(window, { key: 'Escape' })
      const dialogo = screen.getByRole('dialog', { name: '¿Pausar la preparación?' })
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Pausar y salir' }))
      await waitFor(() => expect(api.salir).toHaveBeenCalledTimes(1))
      expect(cerrar).not.toHaveBeenCalled()
      expect(api.pausar).toHaveBeenCalled()
      expect(api.confirmarCierre).not.toHaveBeenCalled()
      cerrar.mockRestore()
    })

    it('Esc con el diálogo abierto lo cierra (no lo reabre)', async () => {
      await instalando()
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('la solicitud de cierre abre el mismo diálogo y confirmar responde a main', async () => {
      await instalando()
      act(() => solicitarCierre())
      const dialogo = screen.getByRole('dialog', { name: '¿Pausar la preparación?' })
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Pausar y salir' }))
      expect(api.confirmarCierre).toHaveBeenCalledTimes(1)
      expect(api.pausar).not.toHaveBeenCalled()
    })
  })
})

describe('B4 Error', () => {
  async function conError(codigo: string) {
    montar({
      estado: estadoBase({
        fases: { motor: 'completada', componentes: 'pendiente', modelo: 'pendiente' }
      }),
      requisitos: requisitosBase({ espacioRequerido: 10e9 })
    })
    await asentar()
    // El usuario lanza la preparación y esta falla.
    fireEvent.click(screen.getByRole('button', { name: 'Continuar la preparación' }))
    act(() => cambiar(estadoBase({ estado: 'en_curso' })))
    act(() =>
      cambiar(
        estadoBase({
          fases: { motor: 'completada', componentes: 'error', modelo: 'pendiente' },
          error: { codigo, mensaje: 'x', fase: 'componentes' }
        })
      )
    )
  }

  it.each([
    ['SIN_CONEXION', 'Sin conexión a internet.', 'No perderás lo que ya se ha descargado.'],
    ['SIN_ESPACIO', 'No queda espacio en el disco.', 'Necesitas 10 GB libres.'],
    [
      'SERVICIO_NO_DISPONIBLE',
      'Uno de los servidores de descarga no responde.',
      'Suele ser temporal.'
    ],
    [
      'VERIFICACION_FALLIDA',
      'El archivo descargado no es correcto.',
      'Lo hemos descargado dos veces y no coincide con el original.'
    ],
    ['OTRO', 'Algo salió mal durante la preparación.', 'copia los detalles']
  ])('%s -> texto propio, Reintentar y Salir', async (codigo, titulo1, cuerpo) => {
    await conError(codigo)
    const aviso = screen.getByRole('alert')
    expect(aviso).toHaveTextContent(titulo1)
    expect(aviso).toHaveTextContent(cuerpo)
    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }))
    expect(api.salir).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /Ver detalles/ })).toBeInTheDocument()
  })

  it('Reintentar vuelve a pedir la instalación', async () => {
    await conError('SIN_CONEXION')
    api.instalar.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(api.instalar).toHaveBeenCalledTimes(1)
    expect(titulo('Preparando Shinobi Karaoke')).toBeInTheDocument()
  })
})

describe('Oferta del modelo Rápido (0057, ux/01 criterios 18-22)', () => {
  const FASES_ERROR_MODELO = {
    motor: 'completada',
    componentes: 'completada',
    modelo: 'error'
  } as const

  async function conErrorModelo(codigo: string, extra: Partial<EstadoRuntimeIpc> = {}) {
    montar({
      estado: estadoBase({
        fases: { motor: 'completada', componentes: 'completada', modelo: 'pendiente' }
      }),
      requisitos: requisitosBase({ espacioRequerido: 10e9, bytesRapido: 59_074_342 })
    })
    await asentar()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar la preparación' }))
    act(() => cambiar(estadoBase({ estado: 'en_curso' })))
    act(() =>
      cambiar(
        estadoBase({
          fases: FASES_ERROR_MODELO,
          error: { codigo, mensaje: 'x', fase: 'modelo' },
          ...extra
        })
      )
    )
  }

  it('con ofrecerRapido el banner añade la oferta y el botón secundario; Reintentar conserva el foco', async () => {
    await conErrorModelo('SERVICIO_NO_DISPONIBLE', { ofrecerRapido: true })
    const aviso = screen.getByRole('alert')
    expect(aviso).toHaveTextContent('Los servidores de descarga no responden.')
    expect(aviso).toHaveTextContent(
      'Si no puedes esperar, hay otra opción: el modelo Rápido, más ligero. Antes de usarlo, lee el aviso.'
    )
    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Usar el modelo Rápido…' })).toBeInTheDocument()
    // Nunca descarga nada por sí mismo.
    expect(api.aceptarRapido).not.toHaveBeenCalled()
  })

  it('con SIN_ESPACIO la oferta usa rapido.oferta.espacio con el tamaño de Rápido', async () => {
    await conErrorModelo('SIN_ESPACIO', { ofrecerRapido: true })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Si no puedes liberar espacio, hay otra opción: el modelo Rápido, que ocupa mucho menos (59 MB).'
    )
  })

  it.each([
    ['SIN_CONEXION', 'Sin conexión a internet.'],
    ['VERIFICACION_FALLIDA', 'El archivo descargado no es correcto.']
  ])('sin ofrecerRapido (%s) no hay oferta ni botón', async (codigo, texto) => {
    await conErrorModelo(codigo, { ofrecerRapido: false })
    expect(screen.getByRole('alert')).toHaveTextContent(texto)
    expect(screen.getByRole('alert')).not.toHaveTextContent('modelo Rápido')
    expect(screen.queryByRole('button', { name: /Usar el modelo Rápido/ })).toBeNull()
  })

  it('el diálogo describe el riesgo, tiene foco en Cancelar y Cancelar no consiente ni descarga', async () => {
    await conErrorModelo('VERIFICACION_FALLIDA', { ofrecerRapido: true })
    const boton = screen.getByRole('button', { name: 'Usar el modelo Rápido…' })
    boton.focus()
    fireEvent.click(boton)
    const dialogo = screen.getByRole('dialog', { name: '¿Usar el modelo Rápido?' })
    expect(dialogo).toHaveAccessibleDescription(/No hemos podido preparar el modelo Calidad\./)
    expect(dialogo).toHaveAccessibleDescription(/no han declarado bajo qué licencia/)
    expect(dialogo).toHaveAccessibleDescription(/se descarga desde su origen \(59 MB\)/)
    expect(dialogo).toHaveAccessibleDescription(/Si lo usas, es bajo tu responsabilidad\./)
    expect(dialogo).toHaveTextContent(
      'Se usará en todas las separaciones a partir de ahora. Podrás volver al modelo Calidad desde Ajustes.'
    )
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.aceptarRapido).not.toHaveBeenCalled()
    expect(boton).toHaveFocus()
    // Esc también cancela sin guardar nada y devuelve el foco.
    fireEvent.click(boton)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.aceptarRapido).not.toHaveBeenCalled()
    expect(boton).toHaveFocus()
  })

  it('"Ver créditos y licencias de terceros" abre el diálogo encima y devuelve el foco al enlace', async () => {
    await conErrorModelo('VERIFICACION_FALLIDA', { ofrecerRapido: true })
    window.shinobi.sistema.textoLegal = vi.fn().mockResolvedValue('AVISOS')
    fireEvent.click(screen.getByRole('button', { name: 'Usar el modelo Rápido…' }))
    const enlace = screen.getByRole('button', { name: 'Ver créditos y licencias de terceros' })
    enlace.focus()
    fireEvent.click(enlace)
    const creditos = screen.getByRole('dialog', { name: 'Créditos y licencias de terceros' })
    expect(creditos).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '¿Usar el modelo Rápido?' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Créditos y licencias de terceros' })).toBeNull()
    expect(screen.getByRole('dialog', { name: '¿Usar el modelo Rápido?' })).toBeInTheDocument()
    expect(enlace).toHaveFocus()
  })

  it('aceptar es el consentimiento: llama a aceptarYUsarRapido, muestra B2 con Rápido y lo anuncia', async () => {
    await conErrorModelo('VERIFICACION_FALLIDA', { ofrecerRapido: true })
    fireEvent.click(screen.getByRole('button', { name: 'Usar el modelo Rápido…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Usar el modelo Rápido' }))
    expect(api.aceptarRapido).toHaveBeenCalledWith('primer_arranque')
    expect(api.instalar).toHaveBeenCalledTimes(1) // solo el "Continuar" inicial
    expect(titulo('Preparando Shinobi Karaoke')).toBeInTheDocument()
    // Anuncio inmediato a lectores de pantalla (criterio 22).
    expect(screen.getByText('Descargando el modelo Rápido.')).toBeInTheDocument()
    act(() =>
      cambiar(
        estadoBase({
          estado: 'en_curso',
          fases: { motor: 'completada', componentes: 'completada', modelo: 'en_curso' }
        })
      )
    )
    act(() =>
      emitirProgreso(
        progreso({
          faseVisible: 'modelo',
          estados: { motor: 'completada', componentes: 'completada', modelo: 'en_curso' },
          bytes: 20e6,
          total: 59e6,
          porcentajeGlobal: 10,
          modo: 'rapido'
        })
      )
    )
    expect(screen.getByText('Descargando el modelo de separación (Rápido)')).toBeInTheDocument()
    expect(screen.getByText('20 MB de 59 MB')).toBeInTheDocument()
    expect(
      screen.getByText('Separaremos las pistas con el modelo Rápido usando el procesador.')
    ).toBeInTheDocument()
    expect(document.body).toHaveTextContent('Descargando el modelo Rápido.')
  })

  it('al terminar muestra B3 con la variante Rápido', async () => {
    montar({
      estado: estadoBase({ modo: 'calidad' }),
      estimacion: { min: 3, max: 6.5 }
    })
    await asentar()
    fireEvent.click(screen.getByRole('button', { name: 'Preparar Shinobi Karaoke' }))
    act(() => cambiar(estadoBase({ estado: 'en_curso' })))
    act(() =>
      emitirProgreso(
        progreso({
          faseVisible: 'modelo',
          estados: { motor: 'completada', componentes: 'completada', modelo: 'en_curso' },
          modo: 'rapido'
        })
      )
    )
    act(() =>
      emitirProgreso(
        progreso({
          faseVisible: null,
          estados: { motor: 'completada', componentes: 'completada', modelo: 'completada' },
          porcentajeGlobal: 100,
          modo: 'rapido'
        })
      )
    )
    act(() =>
      cambiar(
        estadoBase({
          estado: 'completa',
          perfil: 'cpu',
          modo: 'rapido',
          fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' }
        })
      )
    )
    await asentar()
    expect(titulo('Todo listo')).toBeInTheDocument()
    expect(screen.getByText('Modelo de separación: Rápido, con el procesador.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Usas el modelo Rápido bajo tu responsabilidad. Cuando quieras, puedes volver al modelo Calidad desde Ajustes.'
      )
    ).toBeInTheDocument()
  })

  it('si la descarga de Rápido falla: B4 sin oferta y Reintentar no vuelve a pedir el consentimiento', async () => {
    await conErrorModelo('SERVICIO_NO_DISPONIBLE', { rapidoPendiente: true, ofrecerRapido: false })
    expect(screen.queryByRole('button', { name: /Usar el modelo Rápido/ })).toBeNull()
    expect(screen.getByRole('alert')).not.toHaveTextContent('Si no puedes esperar')
    api.instalar.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(api.aceptarRapido).toHaveBeenCalledWith('primer_arranque')
    expect(api.instalar).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('B3 Todo listo', () => {
  it('tras instalar muestra el modo, el tiempo y "Empezar" abre la Biblioteca', async () => {
    montar({
      estado: estadoBase({ perfilPrevisto: 'cuda', modo: 'calidad' }),
      estimacion: { min: 0.8, max: 1.7 }
    })
    await asentar()
    fireEvent.click(screen.getByRole('button', { name: 'Preparar Shinobi Karaoke' }))
    act(() => cambiar(estadoBase({ estado: 'en_curso', perfilPrevisto: 'cuda', modo: 'calidad' })))
    act(() =>
      cambiar(
        estadoBase({
          estado: 'completa',
          perfil: 'cuda',
          perfilPrevisto: 'cuda',
          modo: 'calidad',
          fases: { motor: 'completada', componentes: 'completada', modelo: 'completada' }
        })
      )
    )
    await asentar()
    expect(titulo('Todo listo')).toBeInTheDocument()
    expect(
      screen.getByText('Shinobi Karaoke ya puede separar la voz de tus canciones.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Modelo de separación: Calidad, con tu tarjeta gráfica NVIDIA.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Una canción de 4 minutos tardará entre 1 y 2 minutos.')
    ).toBeInTheDocument()
    expect(api.ir).not.toHaveBeenCalled()
    const empezar = screen.getByRole('button', { name: 'Empezar' })
    expect(empezar).toHaveFocus()
    fireEvent.click(empezar)
    expect(api.ir).toHaveBeenCalledWith({ tipo: 'biblioteca' })
  })
})
