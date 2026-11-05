import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Cancion } from '@shared/cancion'
import type { TrabajoIpc } from '@shared/ipc'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { TrabajosContexto } from '../../trabajos/useTrabajos'
import { paso, resumenPrueba } from '../biblioteca/resumenPrueba'
import { ResumenFuente } from './ResumenFuente'

function montar(
  o: {
    miniatura?: string | null
    fuente?: ReturnType<typeof paso>
    tipo?: 'archivo' | 'youtube'
    trabajos?: TrabajoIpc[]
  } = {}
) {
  const resumen = resumenPrueba({
    miniatura: o.miniatura ?? null,
    pasos: {
      fuente: o.fuente ?? paso('completado'),
      separacion: paso('pendiente'),
      letra: paso('pendiente'),
      edicion: paso('pendiente')
    }
  })
  const cancion = {
    metadatos: {
      titulo: 'Canción de prueba',
      artista: 'Artista',
      album: null,
      duracion_ms: 235_000
    },
    fuente: {
      tipo: o.tipo ?? 'archivo',
      nombre_original: 'prueba.mp3',
      url: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ'
    }
  } as unknown as Cancion
  const reintentar = vi.fn().mockResolvedValue(undefined)
  const actualizarMetadatos = vi.fn().mockResolvedValue(resumen)
  window.shinobi = {
    biblioteca: {
      listar: () => Promise.resolve([resumen]),
      obtener: () => Promise.resolve(cancion),
      actualizarMetadatos
    },
    fuente: { reintentar },
    alCambiarCancion: () => () => undefined
  } as never
  const ir = vi.fn<(v: Vista) => void>()
  render(
    <NavegacionContexto.Provider
      value={{ vista: { tipo: 'cancion', id: 'c1', paso: 'fuente' }, ir }}
    >
      <TrabajosContexto.Provider
        value={{ trabajos: o.trabajos ?? [], progreso: {}, terminado: false }}
      >
        <ResumenFuente id="c1" />
      </TrabajosContexto.Provider>
    </NavegacionContexto.Provider>
  )
  return { ir, actualizarMetadatos, reintentar }
}

describe('ResumenFuente (paso 1 de una canción existente)', () => {
  it('muestra el archivo, la duración, la nota y no permite cambiar el audio', async () => {
    montar()
    expect(await screen.findByText('prueba.mp3')).toBeInTheDocument()
    expect(screen.getByText('3:55')).toBeInTheDocument()
    expect(screen.getByText('Para usar otro audio, añade una canción nueva.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Elegir/ })).toBeNull()
    expect(await screen.findByLabelText(/Título/)).toHaveFocus()
    expect(screen.getByTestId('miniatura-vacia')).toBeInTheDocument()
  })

  it('con miniatura la muestra', async () => {
    montar({ miniatura: 'shinobi-media://c1/fuente/miniatura.jpg' })
    await screen.findByText('prueba.mp3')
    expect(screen.queryByTestId('miniatura-vacia')).toBeNull()
    expect(document.querySelector('img')).toHaveAttribute(
      'src',
      'shinobi-media://c1/fuente/miniatura.jpg'
    )
  })

  it('autoguarda al salir del campo y muestra "Guardado"', async () => {
    const { actualizarMetadatos } = montar()
    const titulo = await screen.findByLabelText(/Título/)
    fireEvent.blur(titulo)
    expect(actualizarMetadatos).not.toHaveBeenCalled() // sin cambios
    fireEvent.change(titulo, { target: { value: ' Nuevo ' } })
    fireEvent.blur(titulo)
    await waitFor(() =>
      expect(actualizarMetadatos).toHaveBeenCalledWith('c1', {
        titulo: 'Nuevo',
        artista: 'Artista',
        album: null
      })
    )
    expect(await screen.findByText('Guardado')).toBeInTheDocument()
  })

  it('título vacío: no guarda y muestra el error', async () => {
    const { actualizarMetadatos } = montar()
    const titulo = await screen.findByLabelText(/Título/)
    fireEvent.change(titulo, { target: { value: '' } })
    fireEvent.blur(titulo)
    expect(await screen.findByText('Escribe un título.')).toBeInTheDocument()
    expect(actualizarMetadatos).not.toHaveBeenCalled()
  })

  it('un fallo al guardar se muestra', async () => {
    const { actualizarMetadatos } = montar()
    actualizarMetadatos.mockRejectedValueOnce({ codigo: 'ERROR_INTERNO', mensaje: 'disco' })
    const artista = await screen.findByLabelText('Artista')
    fireEvent.change(artista, { target: { value: 'Otro' } })
    fireEvent.blur(artista)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron guardar los datos.')
  })

  it('fuente de archivo en error: banner con "Elegir otro archivo" que conserva los datos', async () => {
    const { ir } = montar({
      fuente: paso('error', { error: { codigo: 'FORMATO_NO_SOPORTADO', mensaje: 'x' } })
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('No podemos leer este archivo.')
    fireEvent.click(screen.getByRole('button', { name: 'Elegir otro archivo' }))
    expect(ir).toHaveBeenCalledWith({
      tipo: 'anadir',
      iniciales: {
        cancionId: 'c1',
        titulo: 'Canción de prueba',
        artista: 'Artista',
        album: null,
        origen: 'archivo'
      }
    })
    expect(screen.queryByText('Para usar otro audio, añade una canción nueva.')).toBeNull()
  })

  describe('YouTube', () => {
    it('muestra el enlace y, sin miniatura, el marcador', async () => {
      montar({ tipo: 'youtube' })
      expect(await screen.findByText('youtube.com/watch?v=fJ9rUzIMcZQ')).toBeInTheDocument()
      expect(screen.getByTestId('miniatura-vacia')).toBeInTheDocument()
    })

    it('wireframe E: pendiente sin trabajo vivo, "Descargar ahora" con el foco y sin la nota', async () => {
      const { ir, reintentar } = montar({ tipo: 'youtube', fuente: paso('pendiente') })
      const descargar = await screen.findByRole('button', { name: 'Descargar ahora' })
      expect(screen.getByText('Falta descargar el audio.')).toBeInTheDocument()
      await waitFor(() => expect(descargar).toHaveFocus())
      expect(screen.queryByText('Para usar otro audio, añade una canción nueva.')).toBeNull()
      expect(screen.getByLabelText(/Título/)).toBeInTheDocument()
      fireEvent.click(descargar)
      await waitFor(() =>
        expect(ir).toHaveBeenCalledWith({ tipo: 'cancion', id: 'c1', paso: 'progreso' })
      )
      expect(reintentar).toHaveBeenCalledWith('c1')
    })

    it('"Usar otro enlace" abre la vista 03 de esta canción con los metadatos conservados', async () => {
      const { ir } = montar({ tipo: 'youtube', fuente: paso('pendiente') })
      fireEvent.click(await screen.findByRole('button', { name: 'Usar otro enlace' }))
      expect(ir).toHaveBeenCalledWith({
        tipo: 'anadir',
        iniciales: {
          cancionId: 'c1',
          titulo: 'Canción de prueba',
          artista: 'Artista',
          album: null,
          origen: 'youtube'
        }
      })
    })

    it('pendiente con trabajo vivo no muestra el wireframe E', async () => {
      montar({
        tipo: 'youtube',
        fuente: paso('pendiente'),
        trabajos: [{ id: 't1', cancionId: 'c1', paso: 'fuente', estado: 'en_cola' } as TrabajoIpc]
      })
      await screen.findByLabelText(/Título/)
      expect(screen.queryByRole('button', { name: 'Descargar ahora' })).toBeNull()
    })

    it('error reintentable: Reintentar; no reintentable: otro enlace u otro archivo', async () => {
      const a = montar({
        tipo: 'youtube',
        fuente: paso('error', { error: { codigo: 'SIN_CONEXION', mensaje: 'x' } })
      })
      fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
      await waitFor(() => expect(a.reintentar).toHaveBeenCalledWith('c1'))
      cleanup()
      montar({
        tipo: 'youtube',
        fuente: paso('error', { error: { codigo: 'VIDEO_NO_DISPONIBLE', mensaje: 'x' } })
      })
      expect(await screen.findByRole('button', { name: 'Usar otro enlace' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Elegir otro archivo' })).toBeInTheDocument()
    })

    it('interrumpido: aviso con Reintentar', async () => {
      const { reintentar } = montar({ tipo: 'youtube', fuente: paso('interrumpido') })
      expect(await screen.findByText('La descarga se interrumpió')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
      await waitFor(() => expect(reintentar).toHaveBeenCalledWith('c1'))
    })
  })
})
