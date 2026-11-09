import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FIXTURES } from '@shared/__fixtures__'
import type { AvisoTrabajoIpc } from '@shared/avisos'
import { configPredeterminada } from '@shared/config'
import type { ApiShinobi } from '@shared/ipc'
import { ContenedorToasts } from '../componentes/Toasts'
import { cerrarTodosLosToasts } from '../componentes/gestorToasts'
import { Biblioteca, reiniciarFiltroDeSesion } from '../vistas/biblioteca/Biblioteca'
import { fixtures } from '../vistas/biblioteca/fixturesApi'
import { cancionIpcPrueba, resumenPrueba } from '../vistas/biblioteca/resumenPrueba'
import { BibliotecaContexto, useBiblioteca } from '../vistas/biblioteca/useBiblioteca'
import { NavegacionContexto } from './estado'
import { CapaReproductor, ProveedorReproductor, useReproductor } from './reproductor'
import { useAtajosGlobales } from './useAtajosGlobales'
import { useAvisosTrabajos } from './useAvisosTrabajos'

const cancion = FIXTURES.lista()
cancion.metadatos.titulo = 'Brilla el faro'
const resumen = resumenPrueba({
  id: cancion.id,
  titulo: cancion.metadatos.titulo,
  estado: 'lista',
  estilo: cancion.estilo
})
const nombre = `Reproductor de «${resumen.titulo}»`
const boton = () => screen.findByRole('button', { name: `Reproducir «${resumen.titulo}»` })
const capa = () => screen.findByRole('dialog', { name: nombre })
const sinRespuesta = (): Promise<never> => new Promise(() => {})

function AccesoDirecto() {
  const { abrir } = useReproductor()
  return <button onClick={() => abrir('otra')}>Abrir otra canción</button>
}

function montar(
  obtener: ApiShinobi['biblioteca']['obtener'] = async () => cancionIpcPrueba(cancion)
) {
  let emitirAviso: ((a: AvisoTrabajoIpc) => void) | undefined
  let emitirMenu: ((accion: 'anadir' | 'ajustes') => void) | undefined
  const ir = vi.fn()
  const vista = { tipo: 'biblioteca' } as const
  const api = fixtures({ listar: async () => [resumen], biblioteca: { obtener } })
  api.config.obtener = async () => configPredeterminada()
  api.avisos = {
    alAviso: (cb) => {
      emitirAviso = cb
      return () => {}
    },
    alAbrirCancion: () => () => {}
  }
  api.alAccionMenu = (cb) => {
    emitirMenu = cb
    return () => {}
  }
  window.shinobi = api
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  vi.stubGlobal(
    'AudioContext',
    class {
      createGain() {
        return { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }
      }
      close() {
        return Promise.resolve()
      }
    }
  )
  const modoReproductor = vi.spyOn(api.ventana, 'modoReproductor')
  const comprobarPistas = vi.spyOn(api.biblioteca, 'comprobarPistas')
  function Sonda() {
    const biblioteca = useBiblioteca()
    useAtajosGlobales(vista, ir)
    useAvisosTrabajos(vista, ir)
    return (
      <NavegacionContexto.Provider value={{ vista, ir }}>
        <BibliotecaContexto.Provider value={biblioteca}>
          <ProveedorReproductor>
            <Biblioteca />
            <AccesoDirecto />
            <CapaReproductor />
          </ProveedorReproductor>
        </BibliotecaContexto.Provider>
        <ContenedorToasts />
      </NavegacionContexto.Provider>
    )
  }
  render(<Sonda />)
  return {
    ir,
    modoReproductor,
    comprobarPistas,
    avisar: (aviso: AvisoTrabajoIpc) => act(() => emitirAviso?.(aviso)),
    menu: () => act(() => emitirMenu?.('anadir'))
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  reiniciarFiltroDeSesion()
  act(() => cerrarTodosLosToasts())
})

it('abre desde la tarjeta y conserva la búsqueda y el foco al salir con Esc', async () => {
  vi.stubGlobal('fetch', vi.fn(sinRespuesta))
  const { ir, modoReproductor, avisar, menu } = montar()
  const reproducir = await boton()
  const otra = screen.getByRole('button', { name: 'Abrir otra canción' })
  const busqueda = screen.getByRole('searchbox')
  fireEvent.change(busqueda, { target: { value: 'faro' } })
  await act(async () => fireEvent.click(reproducir))
  await waitFor(() => expect(modoReproductor).toHaveBeenCalledExactlyOnceWith(true))
  expect(await capa()).toBeVisible()

  fireEvent.click(otra)
  fireEvent.keyDown(window, { key: 'n', ctrlKey: true })
  fireEvent.keyDown(window, { key: ',', metaKey: true })
  menu()
  expect(ir).not.toHaveBeenCalled()
  expect(await capa()).toBeVisible()

  const texto = 'Terminó otro trabajo.'
  avisar({ cancionId: 'otra', tipo: 'ok', texto, etiqueta: 'Abrir', destino: 'progreso' })
  expect(screen.queryByText(texto)).not.toBeInTheDocument()
  fireEvent.keyDown(window, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog', { name: nombre })).toBeNull())
  expect(modoReproductor.mock.calls).toEqual([[true], [false]])
  expect(busqueda).toHaveValue('faro')
  await waitFor(() => expect(screen.getByRole('article')).toHaveFocus())
  expect(screen.getByText(texto)).toBeVisible()
})

it('dibuja el título de inmediato y Esc cancela la espera de datos', async () => {
  const { modoReproductor } = montar(sinRespuesta)
  fireEvent.click(await boton())
  const preparando = await capa()
  expect(preparando).toHaveTextContent(resumen.titulo)
  fireEvent.keyDown(preparando, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog', { name: nombre })).toBeNull())
  expect(modoReproductor).not.toHaveBeenCalled()
})

it.each([404, 500])(
  'comprueba pistas ausentes, pero no errores de lectura (%s)',
  async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (url: string) =>
          new Response(null, { status: url.endsWith('/voz.flac') ? 500 : status })
      )
    )
    const { comprobarPistas } = montar()
    fireEvent.click(await boton())
    expect(await screen.findByText('No se puede reproducir esta canción.')).toBeVisible()
    if (status === 404) expect(comprobarPistas).toHaveBeenCalledExactlyOnceWith(cancion.id)
    else expect(comprobarPistas).not.toHaveBeenCalled()
  }
)

it('si desaparece la canción, cierra la capa con el aviso existente', async () => {
  montar(async () => null)
  fireEvent.click(await boton())
  expect(await screen.findByText('No se pudo abrir la canción.')).toBeVisible()
  expect(screen.queryByRole('dialog', { name: nombre })).not.toBeInTheDocument()
})
