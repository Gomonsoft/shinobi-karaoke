import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { InfoYoutubeIpc } from '@shared/ipc'
import { NavegacionContexto, vistaDeOrigen, type Vista } from '../../navegacion/estado'
import { TrabajosContexto } from '../../trabajos/useTrabajos'
import { AnadirCancion } from './AnadirCancion'
import { olvidarBorrador } from './borrador'

const URL_BUENA = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const info: InfoYoutubeIpc = {
  consultaId: 'q1',
  idVideo: 'dQw4w9WgXcQ',
  tituloOriginal: 'Eco de Plata (video)',
  canal: 'Canal Inventado',
  duracionS: 200,
  metadatos: { titulo: 'Eco de Plata', artista: 'Duo Ficticio', album: '' },
  miniaturaDataUrl: 'data:image/jpeg;base64,AAAA'
}

function montar(automatica: boolean | undefined, restaurar = false, fuente: object = {}) {
  window.shinobi = {
    sistema: { info: vi.fn().mockResolvedValue({ youtube: true }) },
    config: {
      obtener: vi.fn().mockResolvedValue({
        aviso_youtube_aceptado: '2026-11-01T10:00:00.000Z',
        preparacion: automatica === undefined ? undefined : { automatica }
      }),
      actualizar: vi.fn()
    },
    fuente: {
      infoYoutube: vi.fn().mockResolvedValue(info),
      cancelarInfo: vi.fn().mockResolvedValue(undefined),
      ...fuente
    },
    biblioteca: { valoresDatos: vi.fn().mockResolvedValue({ artistas: [], albumes: [] }) }
  } as never
  const ir = vi.fn<(v: Vista) => void>()
  render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'anadir' }, ir }}>
      <TrabajosContexto.Provider value={{ trabajos: [], progreso: {}, terminado: false }}>
        <AnadirCancion restaurar={restaurar} />
      </TrabajosContexto.Provider>
    </NavegacionContexto.Provider>
  )
  return { ir }
}

async function buscar() {
  fireEvent.click(await screen.findByRole('radio', { name: 'Enlaces de YouTube' }))
  fireEvent.change(await screen.findByLabelText('Enlaces de YouTube'), {
    target: { value: URL_BUENA }
  })
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
  await screen.findByLabelText(/^Título/)
}

beforeEach(() => olvidarBorrador())
afterEach(cleanup)

describe('F6-N8 · aviso de búsqueda automática', () => {
  it('activada: muestra add.dato.lrclib con «Cambiar en Ajustes»', async () => {
    montar(true)
    await buscar()
    expect(await screen.findByText(/Al continuar buscaremos la letra en LRCLIB/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Cambiar en Ajustes' })).toBeVisible()
    // El ⓘ va a la izquierda del texto, en la misma fila (un contenedor en línea con el icono primero).
    const fila = document.querySelector('[data-aviso-busqueda] > span')!
    expect(fila.firstElementChild?.tagName.toLowerCase()).toBe('svg')
    expect(fila.lastElementChild?.textContent).toMatch(/Al continuar buscaremos la letra/)
  })

  it('desactivada: no lo muestra', async () => {
    montar(false)
    await buscar()
    await waitFor(() => expect(screen.getByLabelText(/^Título/)).toHaveValue('Eco de Plata'))
    expect(screen.queryByText(/Al continuar buscaremos la letra/)).toBeNull()
  })

  it('ir a Ajustes y volver conserva lo escrito', async () => {
    const { ir } = montar(true)
    await buscar()
    fireEvent.change(screen.getByLabelText(/^Título/), {
      target: { value: 'Eco de Plata (en vivo)' }
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar en Ajustes' }))
    const destino = ir.mock.calls.at(-1)![0]
    expect(destino).toEqual({
      tipo: 'ajustes',
      origen: { tipo: 'anadir' },
      seccion: 'preparacion'
    })
    // «Volver» de Ajustes lleva a Añadir pidiendo recuperar el formulario.
    const vuelta = vistaDeOrigen(destino.tipo === 'ajustes' ? destino.origen : undefined)
    expect(vuelta).toEqual({ tipo: 'anadir', restaurar: true })
    cleanup()
    montar(true, true)
    expect(await screen.findByLabelText(/^Título/)).toHaveValue('Eco de Plata (en vivo)')
    expect(screen.getByLabelText('Enlaces de YouTube')).toHaveValue(URL_BUENA)
  })
})

describe('F6-N8 · volver de Ajustes tras «Elegir archivos…»', () => {
  it('vuelve a leer el mismo archivo y recupera lo escrito', async () => {
    const leida = {
      importacionId: 'imp1',
      nombre: 'eco.mp3',
      duracionMs: 200_000,
      metadatos: { titulo: 'Eco', artista: 'Duo', album: '' },
      gananciaDb: 0,
      larga: false
    }
    const fila = {
      ref: '11111111-1111-4111-8111-111111111111',
      nombre: 'eco.mp3',
      duracionMs: 200_000,
      metadatos: { titulo: 'Eco', artista: 'Duo', album: null },
      duplicado: null,
      problema: null
    }
    const fuente = () => ({
      leerArchivos: vi.fn().mockResolvedValue({
        filas: [fila],
        rechazadas: 0,
        truncada: false,
        libreBytes: null,
        factorMinutos: null
      }),
      importarArchivo: vi.fn().mockResolvedValue(leida),
      descartarImportacion: vi.fn().mockResolvedValue(undefined),
      cancelarImportacion: vi.fn().mockResolvedValue(undefined)
    })
    const { ir } = montar(true, false, fuente())
    fireEvent.click(await screen.findByRole('radio', { name: /Archivos de tu equipo/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Elegir archivos…' }))
    fireEvent.change(await screen.findByLabelText(/^Título/), {
      target: { value: 'Eco (en vivo)' }
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar en Ajustes' }))
    expect(ir.mock.calls.at(-1)![0]).toMatchObject({ tipo: 'ajustes' })
    cleanup()
    const vuelta = fuente()
    montar(true, true, vuelta)
    expect(await screen.findByLabelText(/^Título/)).toHaveValue('Eco (en vivo)')
    expect(vuelta.importarArchivo).toHaveBeenCalledWith({
      ref: '11111111-1111-4111-8111-111111111111'
    })
  })
})
