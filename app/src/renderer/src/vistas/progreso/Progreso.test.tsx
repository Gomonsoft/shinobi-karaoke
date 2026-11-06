import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Cancion } from '@shared/cancion'
import type { EventoProgresoIpc, TrabajoIpc } from '@shared/ipc'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { TrabajosContexto } from '../../trabajos/useTrabajos'
import { paso, resumenPrueba } from '../biblioteca/resumenPrueba'
import { olvidarProgresosVistos, progresoVisto } from '../../navegacion/progresoVisto'
import { Progreso } from './Progreso'

const trabajo = (extra: Partial<TrabajoIpc> = {}): TrabajoIpc => ({
  id: 't1',
  cancionId: 'c1',
  paso: 'fuente',
  cola: 'ligera',
  comando: 'descargar-youtube',
  estado: 'en_curso',
  posicion: null,
  resultado: null,
  error: null,
  progreso: null,
  ...extra
})
const prog = (extra: Partial<EventoProgresoIpc> = {}): EventoProgresoIpc => ({
  id: 't1',
  cancionId: 'c1',
  paso: 'fuente',
  fase: 'descargando',
  valor: 0.42,
  etaSegundos: null,
  ...extra
})

interface Opciones {
  tipo?: 'archivo' | 'youtube'
  fuente?: ReturnType<typeof paso>
  trabajos?: TrabajoIpc[]
  trabajosApi?: { cancelar?: ReturnType<typeof vi.fn> }
  progreso?: EventoProgresoIpc[]
  fuenteApi?: { reintentar: ReturnType<typeof vi.fn> }
  otras?: { id: string; titulo: string }[]
  separacion?: ReturnType<typeof paso>
  /** Estado del runtime (modo vigente, oferta de Rápido). */
  runtime?: Record<string, unknown>
  runtimeApi?: Record<string, unknown>
  /** `true` = letra con líneas; `'vacia'` = letra con cero líneas. */
  letra?: boolean | 'vacia'
  pistasPerfil?: string
  estimacion?: { min: number; max: number; origen: string } | null
}

const terminada = (segundos?: number) =>
  paso('completado', segundos === undefined ? {} : { segundos })

function montar(o: Opciones = {}) {
  const resumen = resumenPrueba({
    pasos: {
      fuente: o.fuente ?? paso('completado'),
      separacion: o.separacion ?? paso('en_curso'),
      letra: paso('pendiente'),
      edicion: paso('pendiente')
    }
  })
  const otras = (o.otras ?? []).map((x) => resumenPrueba({ id: x.id, titulo: x.titulo }))
  const cancion = {
    metadatos: { album: 'Álbum' },
    fuente: { tipo: o.tipo ?? 'youtube' },
    letra: o.letra
      ? { lineas: o.letra === 'vacia' ? [] : [{ tipo: 'linea', texto: 'x', inicio_ms: null }] }
      : null,
    pistas: o.pistasPerfil ? { modelo: { perfil: o.pistasPerfil } } : null
  } as unknown as Cancion
  const separar = vi.fn().mockResolvedValue(undefined)
  const cancelar = vi.fn().mockResolvedValue(true)
  window.shinobi = {
    biblioteca: {
      listar: () => Promise.resolve([resumen, ...otras]),
      obtener: () => Promise.resolve(cancion)
    },
    trabajos: {
      listar: () => Promise.resolve(o.trabajos ?? []),
      cancelar,
      ...o.trabajosApi
    },
    alCambiarCancion: () => () => undefined,
    fuente: o.fuenteApi,
    separacion: {
      separar,
      estimar: () => Promise.resolve(o.estimacion === undefined ? null : o.estimacion)
    },
    runtime: {
      estado: () => Promise.resolve({ modo: 'calidad', perfil: 'cpu', ...o.runtime }),
      alCambiar: () => () => undefined,
      alProgreso: () => () => undefined,
      requisitos: () => Promise.resolve({ bytesRapido: 59_000_000, rapidoDescargado: false }),
      aceptarYUsarRapido: vi.fn().mockResolvedValue(undefined),
      ...o.runtimeApi
    }
  } as never
  const ir = vi.fn<(v: Vista) => void>()
  const { unmount, container } = render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: 'c1', paso: 'progreso' }, ir }}
    >
      <TrabajosContexto.Provider
        value={{
          trabajos: o.trabajos ?? [],
          progreso: Object.fromEntries((o.progreso ?? []).map((p) => [p.id, p])),
          terminado: false
        }}
      >
        <Progreso id="c1" />
      </TrabajosContexto.Provider>
    </NavegacionContexto.Provider>
  )
  return { ir, cancelar, separar, container, desmontar: () => unmount() }
}

describe('Progreso', () => {
  it('archivo local: sin fila de descarga, preparar completado y foco en "Buscar la letra"', async () => {
    montar({ tipo: 'archivo' })
    expect(await screen.findByText('Preparar el audio')).toBeInTheDocument()
    expect(screen.queryByText('Descargar de YouTube')).toBeNull()
    const filas = screen.getByRole('list', { name: 'Subpasos' }).children
    expect(filas).toHaveLength(2)
    expect(within(filas[0] as HTMLElement).getByText('completado')).toBeInTheDocument()
    expect(within(filas[1] as HTMLElement).getByText('en curso')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Buscar la letra mientras tanto' })).toHaveFocus()
    )
    expect(screen.queryByRole('button', { name: 'Cancelar descarga' })).toBeNull()
  })

  it('descarga con %, MB y "Calculando tiempo…"', async () => {
    montar({
      fuente: paso('pendiente'),
      trabajos: [trabajo()],
      progreso: [prog({ detalle: { bytes: 2_400_000, total: 5_800_000 } })]
    })
    expect(await screen.findByText('Descargando… 42 % · 2,4 MB de 5,8 MB')).toBeInTheDocument()
    expect(screen.getByText('Calculando tiempo…')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Descargar de YouTube' })).toHaveAttribute(
      'aria-valuenow',
      '42'
    )
  })

  it('con ETA muestra los minutos', async () => {
    montar({
      fuente: paso('pendiente'),
      trabajos: [trabajo()],
      progreso: [prog({ etaSegundos: 190 })]
    })
    expect(await screen.findByText('quedan unos 3 minutos')).toBeInTheDocument()
  })

  it('preparando: preparar indeterminado', async () => {
    montar({
      fuente: paso('pendiente'),
      trabajos: [trabajo()],
      progreso: [prog({ fase: 'preparando', valor: null })]
    })
    expect(await screen.findByText('Preparando el audio…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar descarga' })).toBeInTheDocument()
  })

  it('actualizando: texto de reintento y cancelar disponible', async () => {
    montar({
      fuente: paso('pendiente'),
      trabajos: [trabajo()],
      progreso: [prog({ fase: 'actualizando', valor: null })]
    })
    expect(
      await screen.findByText('Actualizando el descargador de YouTube y reintentando…')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar descarga' })).toBeInTheDocument()
  })

  it('en cola tras otra descarga; cancelar sin diálogo', async () => {
    const { cancelar } = montar({
      fuente: paso('pendiente'),
      trabajos: [
        trabajo({ id: 'otro', cancionId: 'c2' }),
        trabajo({ estado: 'en_cola', posicion: 1 })
      ],
      otras: [{ id: 'c2', titulo: 'La flaca' }]
    })
    expect(
      await screen.findByText('En cola: se descargará cuando termine «La flaca».')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar descarga' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(cancelar).toHaveBeenCalledWith('t1')
  })

  it('en cola tras la actualización de yt-dlp (trabajo sin canción)', async () => {
    montar({
      fuente: paso('pendiente'),
      trabajos: [
        trabajo({ id: 'mant', cancionId: '' }),
        trabajo({ estado: 'en_cola', posicion: 1 })
      ]
    })
    expect(
      await screen.findByText(
        'En cola: el descargador de YouTube se está actualizando. Empezará enseguida.'
      )
    ).toBeInTheDocument()
  })

  it('cancelar en curso: diálogo con foco en "Seguir descargando" y confirma', async () => {
    const { cancelar } = montar({
      fuente: paso('pendiente'),
      trabajos: [trabajo()],
      progreso: [prog()]
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar descarga' }))
    const dialogo = screen.getByRole('dialog', { name: '¿Cancelar la descarga?' })
    expect(within(dialogo).getByRole('button', { name: 'Seguir descargando' })).toHaveFocus()
    expect(dialogo).toHaveTextContent('«Canción de prueba» se quedará en tu biblioteca')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar descarga' }))
    expect(cancelar).toHaveBeenCalledWith('t1')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('completado: bloque "Mientras tanto…" con navegación', async () => {
    const { ir } = montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Buscar la letra mientras tanto' }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c1', paso: 'letra' })
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la biblioteca' }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'biblioteca' })
  })

  it('pendiente sin trabajo: banner info y "Descargar ahora"', async () => {
    const reintentar = vi.fn().mockResolvedValue(undefined)
    montar({ fuente: paso('pendiente'), fuenteApi: { reintentar } })
    expect(await screen.findByText('Falta descargar el audio.')).toBeInTheDocument()
    expect(screen.queryByText('Mientras tanto…')).toBeNull()
    const boton = screen.getByRole('button', { name: 'Descargar ahora' })
    await waitFor(() => expect(boton).toHaveFocus())
    fireEvent.click(boton)
    expect(reintentar).toHaveBeenCalledWith('c1')
  })

  it('error reintentable: banner con Reintentar', async () => {
    const reintentar = vi.fn().mockResolvedValue(undefined)
    montar({
      fuente: paso('error', { error: { codigo: 'SIN_CONEXION', mensaje: 'x' } }),
      fuenteApi: { reintentar }
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión a internet.')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(reintentar).toHaveBeenCalledWith('c1')
  })

  it('error no reintentable: "Usar otro enlace" abre Añadir con los metadatos', async () => {
    const { ir } = montar({
      fuente: paso('error', { error: { codigo: 'VIDEO_NO_DISPONIBLE', mensaje: 'x' } })
    })
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'Usar otro enlace' }))
    expect(ir).toHaveBeenCalledWith({
      tipo: 'anadir',
      iniciales: {
        cancionId: 'c1',
        titulo: 'Canción de prueba',
        artista: 'Artista',
        album: 'Álbum',
        origen: 'youtube'
      }
    })
  })

  it('interrumpido: aviso con Reintentar', async () => {
    montar({ fuente: paso('interrumpido'), fuenteApi: { reintentar: vi.fn() } })
    expect(await screen.findByText('La descarga se interrumpió')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})

const trabajoSep = (extra: Partial<TrabajoIpc> = {}): TrabajoIpc =>
  trabajo({
    id: 's1',
    paso: 'separacion',
    cola: 'pesada',
    comando: 'separar',
    modo: 'calidad',
    dispositivo: 'cuda',
    ...extra
  })
const progSep = (extra: Partial<EventoProgresoIpc> = {}): EventoProgresoIpc =>
  prog({ id: 's1', paso: 'separacion', fase: 'separando', valor: 0.42, ...extra })

describe('Progreso: reparar el motor de audio', () => {
  const motorIncompleto = paso('error', {
    error: { codigo: 'RUNTIME_NO_DISPONIBLE', mensaje: 'Falta audio_separator' }
  })
  const reparar = () => screen.findByRole('button', { name: 'Reparar el motor de audio' })

  it('muestra el error, ofrece copiar sus detalles y enfoca Reparar sin oferta de Rápido', async () => {
    montar({
      separacion: motorIncompleto,
      runtime: { estado: 'dañada', ofrecerRapido: true, rapidoPendiente: true }
    })
    const boton = await reparar()
    expect(boton).toHaveFocus()
    const aviso = screen.getByRole('alert')
    expect(aviso).toHaveTextContent(
      'Hay que reparar el motor de audio. Falta una parte del motor que separa la voz de la música. Al repararlo se descarga de nuevo lo que falta; después, vuelve a separar esta canción.'
    )
    expect(within(aviso).getByRole('button', { name: 'Copiar detalles' })).toBeInTheDocument()
    expect(within(aviso).queryByRole('button', { name: 'Reintentar' })).toBeNull()
    expect(within(aviso).queryByRole('button', { name: /Usar el modelo Rápido/ })).toBeNull()
  })

  it('con el motor reparado reintenta separar incluso si Rápido quedó pendiente', async () => {
    const { separar } = montar({
      separacion: motorIncompleto,
      runtime: { estado: 'completa', rapidoPendiente: true }
    })
    expect(await screen.findByText('El motor de audio ya está reparado.')).toBeInTheDocument()
    const boton = screen.getByRole('button', { name: 'Reintentar' })
    expect(boton).toHaveFocus()
    fireEvent.click(boton)
    expect(separar).toHaveBeenCalledWith('c1')
  })

  it('actualiza el banner en vivo al reparar el motor', async () => {
    let emitir: ((e: { estado: 'completa' }) => void) | undefined
    montar({
      separacion: motorIncompleto,
      runtime: { estado: 'dañada' },
      runtimeApi: {
        alCambiar: (cb: typeof emitir) => {
          emitir = cb
          return () => undefined
        }
      }
    })
    await reparar()
    act(() => emitir?.({ estado: 'completa' }))
    expect(await screen.findByText('El motor de audio ya está reparado.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Reparar el motor de audio' })).toBeNull()
  })

  it('sin trabajos vivos abre el primer arranque directamente', async () => {
    const { ir, cancelar } = montar({
      separacion: motorIncompleto,
      trabajos: [trabajo({ cancionId: 'otra', estado: 'terminado' })]
    })
    fireEvent.click(await reparar())
    await waitFor(() => expect(ir).toHaveBeenCalledWith({ tipo: 'primer-arranque' }))
    expect(cancelar).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('nombra los dos trabajos y espera su cancelación solo después de confirmar', async () => {
    let terminar!: (ok: boolean) => void
    const cancelar = vi.fn(
      () =>
        new Promise<boolean>((resolver) => {
          terminar = resolver
        })
    )
    cancelar.mockResolvedValueOnce(true)
    const { ir } = montar({
      separacion: motorIncompleto,
      trabajos: [
        trabajo({ id: 'descarga', cancionId: 'c2' }),
        trabajo({ id: 'separar', cancionId: 'c3', estado: 'en_cola', paso: 'separacion' })
      ],
      otras: [
        { id: 'c2', titulo: 'Faro' },
        { id: 'c3', titulo: 'Luna' }
      ],
      trabajosApi: { cancelar }
    })
    const boton = await reparar()
    fireEvent.click(boton)
    const dialogo = () => screen.findByRole('dialog', { name: '¿Reparar el motor de audio ahora?' })
    const modal = await dialogo()
    expect(modal).toHaveTextContent(
      'Hay 2 trabajos sin terminar («Faro» — Descargar de YouTube, «Luna» — Separar voz e instrumental).'
    )
    const seguir = within(modal).getByRole('button', { name: 'Seguir trabajando' })
    expect(seguir).toHaveFocus()
    fireEvent.click(seguir)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(cancelar).not.toHaveBeenCalled()
    expect(ir).not.toHaveBeenCalled()

    fireEvent.click(boton)
    fireEvent.click(within(await dialogo()).getByRole('button', { name: 'Reparar ahora' }))
    expect(cancelar.mock.calls).toEqual([['descarga'], ['separar']])
    expect(ir).not.toHaveBeenCalled()
    await act(async () => terminar(true))
    expect(ir).toHaveBeenCalledWith({ tipo: 'primer-arranque' })
  })

  it('abre el primer arranque a los cinco segundos aunque no responda una cancelación', async () => {
    const cancelar = vi.fn(() => new Promise<boolean>(() => undefined))
    const { ir } = montar({
      separacion: motorIncompleto,
      trabajos: [trabajo({ cancionId: 'otra' })],
      trabajosApi: { cancelar }
    })
    fireEvent.click(await reparar())
    const confirmar = await screen.findByRole('button', { name: 'Reparar ahora' })
    vi.useFakeTimers()
    try {
      fireEvent.click(confirmar)
      await act(async () => vi.advanceTimersByTimeAsync(4999))
      expect(ir).not.toHaveBeenCalled()
      await act(async () => vi.advanceTimersByTimeAsync(1))
      expect(ir).toHaveBeenCalledWith({ tipo: 'primer-arranque' })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Progreso: separación', () => {
  it('en cola con posición, título de la otra y estimación previa; cancelar sin diálogo', async () => {
    const { cancelar } = montar({
      trabajos: [
        trabajoSep({ estado: 'en_cola', posicion: 2 }),
        trabajoSep({ id: 's2', cancionId: 'c2' })
      ],
      otras: [{ id: 'c2', titulo: 'Otra' }],
      estimacion: { min: 3, max: 5, origen: 'estimado' }
    })
    expect(
      await screen.findByText('En cola: se separará cuando termine «Otra». · 2.ª en la cola')
    ).toBeInTheDocument()
    expect(await screen.findByText('Tardará unos 4 minutos')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar separación' }))
    expect(cancelar).toHaveBeenCalledWith('s1')
  })

  it('separando: % y "Calculando tiempo…", luego ETA; la barra no retrocede', async () => {
    montar({ trabajos: [trabajoSep()], progreso: [progSep({ detalle: { paso: 3, total: 10 } })] })
    expect(await screen.findByText('Separando… 42 %')).toBeInTheDocument()
    expect(screen.getByText('Calculando tiempo…')).toBeInTheDocument()
  })

  it('separando con ETA', async () => {
    montar({ trabajos: [trabajoSep()], progreso: [progSep({ etaSegundos: 190 })] })
    expect(await screen.findByText('quedan unos 3 minutos')).toBeInTheDocument()
  })

  it.each([
    ['preparando', 'Preparando la separación…'],
    ['cargando_modelo', 'Preparando la separación…'],
    ['guardando', 'Guardando las pistas…']
  ])('fase %s: texto y barra indeterminada', async (fase, texto) => {
    montar({ trabajos: [trabajoSep()], progreso: [progSep({ fase, valor: null })] })
    expect(await screen.findByText(texto)).toBeInTheDocument()
  })

  it('descargando_modelo con Calidad y con Rápido, con MB', async () => {
    const detalle = { bytes: 100_000_000, total: 400_000_000 }
    montar({
      trabajos: [trabajoSep()],
      progreso: [progSep({ fase: 'descargando_modelo', valor: 0.25, detalle })]
    })
    expect(
      await screen.findByText('Descargando el modelo Calidad… 25 % · 100,0 MB de 400,0 MB')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar separación' })).toBeInTheDocument()
  })

  it('descargando_modelo con Rápido', async () => {
    montar({
      trabajos: [trabajoSep({ modo: 'rapido' })],
      progreso: [
        progSep({
          fase: 'descargando_modelo',
          valor: 0.5,
          detalle: { bytes: 30_000_000, total: 60_000_000 }
        })
      ]
    })
    expect(
      await screen.findByText('Descargando el modelo Rápido… 50 % · 30,0 MB de 60,0 MB')
    ).toBeInTheDocument()
    expect(screen.getByText('Modelo Rápido')).toBeInTheDocument()
  })

  it.each([
    ['memoria', 'Reintentando por partes más pequeñas…'],
    ['memoria_cpu', 'Reintentando con el procesador… Tardará más.']
  ])('reintento %s: texto, sin banner de error', async (motivo, texto) => {
    montar({
      trabajos: [trabajoSep()],
      progreso: [progSep({ fase: 'reintentando', valor: null, detalle: { motivo } as never })]
    })
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'Cancelar separación' })).toBeInTheDocument()
  })

  it('cancelar en curso: diálogo con foco en "Seguir separando" y llama a cancelar', async () => {
    const { cancelar } = montar({ trabajos: [trabajoSep()], progreso: [progSep()] })
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar separación' }))
    const dialogo = await screen.findByRole('dialog')
    await waitFor(() =>
      expect(within(dialogo).getByRole('button', { name: 'Seguir separando' })).toHaveFocus()
    )
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar separación' }))
    expect(cancelar).toHaveBeenCalledWith('s1')
  })

  it('modelo y dispositivo reales: popover con Calidad, sin enlace; Esc lo cierra', async () => {
    const { ir } = montar({ trabajos: [trabajoSep()], progreso: [progSep()] })
    const info = await screen.findByRole('button', { name: 'Información sobre el modelo' })
    expect(screen.getByText('Modelo Calidad')).toBeInTheDocument()
    fireEvent.click(info)
    expect(screen.getByText(/se ejecuta con tu tarjeta gráfica NVIDIA\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ir a Ajustes' })).toBeNull()
    fireEvent.keyDown(info, { key: 'Escape' })
    expect(screen.queryByText(/se ejecuta con/)).toBeNull()
    expect(info).toHaveFocus()
    expect(ir).not.toHaveBeenCalled()
  })

  it('con Rápido el popover trae "Ir a Ajustes"', async () => {
    const { ir } = montar({
      trabajos: [trabajoSep({ modo: 'rapido', dispositivo: 'cpu' })],
      progreso: [progSep()]
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Información sobre el modelo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Ajustes' }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'ajustes' })
  })

  it('pendiente: "Separar ahora" con foco, estimación y llamada a separar', async () => {
    const { separar } = montar({
      separacion: paso('pendiente'),
      estimacion: { min: 2, max: 2, origen: 'medido_equipo' }
    })
    const boton = await screen.findByRole('button', { name: 'Separar ahora' })
    await waitFor(() => expect(boton).toHaveFocus())
    expect(screen.getByText('La separación está pendiente.')).toBeInTheDocument()
    expect(await screen.findByText(/Tardará unos 2 minutos/)).toBeInTheDocument()
    fireEvent.click(boton)
    expect(separar).toHaveBeenCalledWith('c1')
  })

  it('interrumpido: aviso y Reintentar', async () => {
    const { separar } = montar({ separacion: paso('interrumpido') })
    expect(await screen.findByText('La separación se interrumpió')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(separar).toHaveBeenCalledWith('c1')
  })

  it('primario "Ir al editor" si ya hay letra', async () => {
    const { ir } = montar({ trabajos: [trabajoSep()], progreso: [progSep()], letra: true })
    fireEvent.click(await screen.findByRole('button', { name: 'Ir al editor' }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c1', paso: 'editor' })
  })

  it('una letra con cero líneas no cuenta: sigue "Buscar la letra mientras tanto"', async () => {
    const { ir } = montar({ trabajos: [trabajoSep()], progreso: [progSep()], letra: 'vacia' })
    fireEvent.click(await screen.findByRole('button', { name: 'Buscar la letra mientras tanto' }))
    expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c1', paso: 'letra' })
    expect(screen.queryByRole('button', { name: 'Ir al editor' })).toBeNull()
  })

  it('al ir a Letra se marca el progreso como visto', async () => {
    olvidarProgresosVistos()
    montar({ trabajos: [trabajoSep()], progreso: [progSep()] })
    expect(progresoVisto('c1')).toBe(false)
    fireEvent.click(await screen.findByRole('button', { name: 'Buscar la letra mientras tanto' }))
    expect(progresoVisto('c1')).toBe(true)
  })

  describe('errores', () => {
    const error = (codigo: string) => paso('error', { error: { codigo, mensaje: 'x' } })

    it.each([
      [
        'MEMORIA_INSUFICIENTE',
        'calidad',
        'Tu equipo no tiene memoria suficiente para el modelo Calidad.'
      ],
      ['MEMORIA_INSUFICIENTE', 'rapido', 'Tu equipo se quedó sin memoria.'],
      ['MODELO_NO_DISPONIBLE', 'calidad', 'No hemos podido descargar el modelo de separación.'],
      ['SIN_ESPACIO', 'calidad', 'No queda espacio en el disco.'],
      ['PROCESO_TERMINADO', 'calidad', 'Algo salió mal al separar.']
    ])('%s con %s', async (codigo, modo, titulo) => {
      montar({ separacion: error(codigo), runtime: { modo } })
      expect(await screen.findByRole('alert')).toHaveTextContent(titulo)
      expect(screen.queryByText(/Descargar y reintentar/)).toBeNull()
      expect(screen.queryByRole('button', { name: /Usar el modelo Rápido/ })).toBeNull()
    })

    it('código desconocido: "Copiar detalles"', async () => {
      montar({ separacion: error('RARO') })
      expect(await screen.findByRole('button', { name: 'Copiar detalles' })).toBeInTheDocument()
    })

    it('Reintentar (con foco) llama a separar', async () => {
      const { separar } = montar({ separacion: error('SIN_ESPACIO') })
      const b = await screen.findByRole('button', { name: 'Reintentar' })
      await waitFor(() => expect(b).toHaveFocus())
      fireEvent.click(b)
      expect(separar).toHaveBeenCalledWith('c1')
    })

    it('oferta de Rápido: cancelar el diálogo no cambia nada', async () => {
      const aceptar = vi.fn().mockResolvedValue(undefined)
      montar({
        separacion: error('MEMORIA_INSUFICIENTE'),
        runtime: { ofrecerRapido: true },
        runtimeApi: { aceptarYUsarRapido: aceptar }
      })
      expect(await screen.findByText(/hay otra opción: el modelo Rápido/)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Usar el modelo Rápido…' }))
      const dialogo = await screen.findByRole('dialog')
      expect(within(dialogo).getByText(/no tiene memoria suficiente/)).toBeInTheDocument()
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(aceptar).not.toHaveBeenCalled()
    })

    it('oferta con MODELO_NO_DISPONIBLE usa el motivo de la descarga; aceptar llama y separa', async () => {
      const aceptar = vi.fn().mockResolvedValue(undefined)
      const { separar } = montar({
        separacion: error('MODELO_NO_DISPONIBLE'),
        runtime: { ofrecerRapido: true },
        runtimeApi: { aceptarYUsarRapido: aceptar }
      })
      fireEvent.click(await screen.findByRole('button', { name: 'Usar el modelo Rápido…' }))
      const dialogo = await screen.findByRole('dialog')
      expect(within(dialogo).getByText(/descargar de nuevo el modelo Calidad/)).toBeInTheDocument()
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Usar el modelo Rápido' }))
      await waitFor(() => expect(aceptar).toHaveBeenCalledWith('separacion'))
      await waitFor(() => expect(separar).toHaveBeenCalledWith('c1'))
    })

    it('sin oferta si ofrecerRapido es false (p. ej. SIN_CONEXION)', async () => {
      montar({ separacion: error('MODELO_NO_DISPONIBLE'), runtime: { ofrecerRapido: false } })
      await screen.findByRole('alert')
      expect(screen.queryByText(/hay otra opción/)).toBeNull()
    })

    it('fallo de la descarga de Rápido: error sin oferta y Reintentar sin diálogo', async () => {
      const aceptar = vi
        .fn()
        .mockRejectedValueOnce({ codigo: 'SIN_CONEXION', mensaje: 'x' })
        .mockResolvedValue(undefined)
      const { separar } = montar({
        separacion: error('MEMORIA_INSUFICIENTE'),
        runtime: { ofrecerRapido: true },
        runtimeApi: { aceptarYUsarRapido: aceptar }
      })
      fireEvent.click(await screen.findByRole('button', { name: 'Usar el modelo Rápido…' }))
      const dialogo = await screen.findByRole('dialog')
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Usar el modelo Rápido' }))
      expect(await screen.findByText('Sin conexión a internet.')).toBeInTheDocument()
      expect(screen.queryByText(/hay otra opción/)).toBeNull()
      expect(screen.queryByRole('button', { name: /Usar el modelo Rápido/ })).toBeNull()
      expect(separar).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
      await waitFor(() => expect(separar).toHaveBeenCalledWith('c1'))
      expect(aceptar).toHaveBeenCalledTimes(2)
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('rapidoPendiente tras reiniciar: botón sin "…" ni diálogo', async () => {
      const aceptar = vi.fn().mockResolvedValue(undefined)
      const { separar } = montar({
        separacion: error('MEMORIA_INSUFICIENTE'),
        runtime: { ofrecerRapido: false, rapidoPendiente: true },
        runtimeApi: { aceptarYUsarRapido: aceptar }
      })
      fireEvent.click(await screen.findByRole('button', { name: 'Usar el modelo Rápido' }))
      expect(screen.queryByRole('dialog')).toBeNull()
      await waitFor(() => expect(aceptar).toHaveBeenCalledWith('separacion'))
      await waitFor(() => expect(separar).toHaveBeenCalled())
    })
  })

  describe('separación terminada (0069)', () => {
    let play: ReturnType<typeof vi.spyOn>
    let pause: ReturnType<typeof vi.spyOn>
    // `paused` por elemento: jsdom no implementa la reproducción.
    beforeEach(() => {
      play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
        this: HTMLMediaElement
      ) {
        Object.defineProperty(this, 'paused', { value: false, configurable: true })
        this.dispatchEvent(new Event('play'))
        return Promise.resolve()
      })
      pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
        this: HTMLMediaElement
      ) {
        if (this.paused) return
        Object.defineProperty(this, 'paused', { value: true, configurable: true })
        this.dispatchEvent(new Event('pause'))
      })
    })
    afterAll(() => vi.restoreAllMocks())

    it('muestra la duración real y el primario "Buscar la letra" con el foco', async () => {
      montar({ tipo: 'archivo', separacion: terminada(108) })
      expect(await screen.findByText('1 min 48 s')).toBeInTheDocument()
      expect(screen.getByText('Escucha el resultado:')).toBeInTheDocument()
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Buscar la letra' })).toHaveFocus()
      )
      expect(screen.queryByRole('button', { name: /Cancelar/ })).toBeNull()
    })

    it('sin duración guardada no muestra dato', async () => {
      montar({ tipo: 'archivo', separacion: terminada() })
      await screen.findByText('Escucha el resultado:')
      expect(screen.queryByText(/\d+ s$/)).toBeNull()
    })

    it('con una letra de cero líneas el primario es "Buscar la letra"', async () => {
      montar({ tipo: 'archivo', separacion: terminada(30), letra: 'vacia' })
      expect(await screen.findByRole('button', { name: 'Buscar la letra' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Ir al editor' })).toBeNull()
    })

    it('con letra el primario es "Ir al editor"', async () => {
      const { ir } = montar({ tipo: 'archivo', separacion: terminada(30), letra: true })
      fireEvent.click(await screen.findByRole('button', { name: 'Ir al editor' }))
      expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c1', paso: 'editor' })
    })

    it('las pistas apuntan a shinobi-media y solo suena una a la vez', async () => {
      const { container } = montar({ tipo: 'archivo', separacion: terminada(30) })
      const voz = await screen.findByRole('button', { name: 'Reproducir Voz' })
      const audios = container.querySelectorAll('audio')
      expect(audios[0]).toHaveAttribute('src', 'shinobi-media://c1/pistas/voz.flac')
      expect(audios[1]).toHaveAttribute('src', 'shinobi-media://c1/pistas/instrumental.flac')
      fireEvent.click(voz)
      expect(screen.getByRole('button', { name: 'Pausar Voz' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Reproducir Instrumental' }))
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Reproducir Voz' })).toBeInTheDocument()
      )
      expect(screen.getByRole('button', { name: 'Pausar Instrumental' })).toBeInTheDocument()
      expect(play).toHaveBeenCalledTimes(2)
    })

    it('se para al salir de la vista', async () => {
      const vista = montar({ tipo: 'archivo', separacion: terminada(30) })
      fireEvent.click(await screen.findByRole('button', { name: 'Reproducir Voz' }))
      pause.mockClear()
      vista.desmontar()
      expect(pause).toHaveBeenCalled()
    })

    it('error de carga: mensaje en línea', async () => {
      const { container } = montar({ tipo: 'archivo', separacion: terminada(30) })
      await screen.findByText('Escucha el resultado:')
      fireEvent.error(container.querySelectorAll('audio')[0]!)
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No se pudo cargar la pista de voz.'
      )
    })
  })
})
