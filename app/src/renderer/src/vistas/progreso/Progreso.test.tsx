import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Cancion } from '@shared/cancion'
import type { EventoProgresoIpc, TrabajoIpc } from '@shared/ipc'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { TrabajosContexto } from '../../trabajos/useTrabajos'
import { paso, resumenPrueba } from '../biblioteca/resumenPrueba'
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
  progreso?: EventoProgresoIpc[]
  fuenteApi?: { reintentar: ReturnType<typeof vi.fn> }
  otras?: { id: string; titulo: string }[]
}

function montar(o: Opciones = {}) {
  const resumen = resumenPrueba({
    pasos: {
      fuente: o.fuente ?? paso('completado'),
      separacion: paso('pendiente'),
      letra: paso('pendiente'),
      edicion: paso('pendiente')
    }
  })
  const otras = (o.otras ?? []).map((x) => resumenPrueba({ id: x.id, titulo: x.titulo }))
  const cancion = {
    metadatos: { album: 'Álbum' },
    fuente: { tipo: o.tipo ?? 'youtube' }
  } as unknown as Cancion
  const cancelar = vi.fn().mockResolvedValue(true)
  window.shinobi = {
    biblioteca: {
      listar: () => Promise.resolve([resumen, ...otras]),
      obtener: () => Promise.resolve(cancion)
    },
    trabajos: { cancelar },
    alCambiarCancion: () => () => undefined,
    fuente: o.fuenteApi
  } as never
  const ir = vi.fn<(v: Vista) => void>()
  render(
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
  return { ir, cancelar }
}

describe('Progreso', () => {
  it('archivo local: sin fila de descarga, preparar completado y foco en "Buscar la letra"', async () => {
    montar({ tipo: 'archivo' })
    expect(await screen.findByText('Preparar el audio')).toBeInTheDocument()
    expect(screen.queryByText('Descargar de YouTube')).toBeNull()
    const filas = screen.getByRole('list', { name: 'Subpasos' }).children
    expect(filas).toHaveLength(2)
    expect(within(filas[0] as HTMLElement).getByText('completado')).toBeInTheDocument()
    expect(within(filas[1] as HTMLElement).getByText('pendiente')).toBeInTheDocument()
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
