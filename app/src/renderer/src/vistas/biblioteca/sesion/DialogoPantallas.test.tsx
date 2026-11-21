import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { estadoP1, estadoP5, estadoP6, estadoSinCola, pantalla } from '@shared/__fixtures__/sesion'
import type { EstadoSesionIpc, ListaPantallasIpc } from '@shared/sesion'
import { instalarApiSesion } from '../../../sesion/pruebas'
import { ProveedorSesion, useSesion } from '../../../sesion/ProveedorSesion'
import { mmss, SES } from '../../../sesion/textos'
import { DialogoPantallasPedido } from './DialogoPantallas'

const principal = pantalla(1)
const externa = pantalla(2, { etiqueta: 'DELL U2720Q', ancho: 3840, alto: 2160 })
const DOS: ListaPantallasIpc = { pantallas: [principal, externa], colocacion: 'libre' }
const UNA: ListaPantallasIpc = { pantallas: [principal], colocacion: 'libre' }
const WAYLAND: ListaPantallasIpc = { pantallas: [principal], colocacion: 'sistema' }

type Pedido = Parameters<ReturnType<typeof useSesion>['abrirDialogoPantallas']>[0]

function Panel() {
  const s = useSesion()
  return <output data-testid="panel">{String(s.panelAbierto)}</output>
}

function Abridor({ pedido }: { pedido: Pedido }) {
  const s = useSesion()
  return (
    <button type="button" onClick={() => s.abrirDialogoPantallas(pedido)}>
      Abrir diálogo
    </button>
  )
}

async function montar(
  pedido: Pedido = { inicio: 'cola' },
  estado: EstadoSesionIpc = estadoSinCola(),
  pantallas: ListaPantallasIpc = DOS,
  guardada: unknown = null
) {
  window.shinobi = {} as never
  const api = instalarApiSesion(estado, pantallas)
  Object.assign(window.shinobi, {
    config: { obtener: () => Promise.resolve({ reproductor: { secundaria: guardada } }) }
  })
  render(
    <ProveedorSesion>
      <Abridor pedido={pedido} />
      <Panel />
      <DialogoPantallasPedido
        buscar={(id) => ({ titulo: `Título de ${id}`, artista: `Artista de ${id}` })}
      />
    </ProveedorSesion>
  )
  // La lista llega con la lectura inicial del proveedor.
  await waitFor(() => expect(api.llamadas.some((l) => l[0] === 'pantallas.listar')).toBe(true))
  await act(async () => {})
  fireEvent.click(screen.getByRole('button', { name: 'Abrir diálogo' }))
  await screen.findByRole('dialog')
  return api
}

const abrirBoton = () => screen.getByRole('button', { name: SES.boton.abrir })
const radios = () => screen.getAllByRole('radio') as HTMLInputElement[]
const completa = () => screen.getByRole('checkbox', { name: SES.completa }) as HTMLInputElement

function rechazarAbrir(codigo: string) {
  const abrir = vi.fn(() => Promise.reject({ codigo, mensaje: 'x' }))
  Object.assign(window.shinobi.sesion, { abrir })
  return abrir
}

describe('DialogoPantallas', () => {
  it('S1: preselecciona la que no es la principal, con «Pantalla completa» marcada', async () => {
    await montar()
    expect(radios()).toHaveLength(2)
    expect(radios()[0]).not.toBeChecked()
    expect(radios()[1]).toBeChecked()
    expect(completa()).toBeChecked()
    expect(screen.getByText(SES.pantallaOpcion(2, 'DELL U2720Q', 3840, 2160))).toBeInTheDocument()
    expect(screen.getByText(`${SES.pantallaPrincipal} · ${SES.pantallaAqui}`)).toBeInTheDocument()
    expect(screen.getByText(SES.audio)).toBeInTheDocument()
    expect(screen.getByText(SES.bloqueoNota)).toBeInTheDocument()
    expect(screen.getByText(SES.empieza.vacia)).toBeInTheDocument()
    expect(screen.queryByText(SES.completaMisma)).toBeNull()
    expect(screen.queryByText(SES.unaPantalla)).toBeNull()
  })

  it('el foco inicial está en la opción seleccionada', async () => {
    await montar()
    expect(radios()[1]).toHaveFocus()
  })

  it('usa la pantalla guardada y su modo', async () => {
    await montar({ inicio: 'cola' }, estadoSinCola(), DOS, {
      pantalla: { id: principal.id, etiqueta: principal.etiqueta, ancho: 1920, alto: 1080 },
      pantalla_completa: false
    })
    await waitFor(() => expect(radios()[0]).toBeChecked())
    expect(completa()).not.toBeChecked()
  })

  it('elegir la pantalla de la principal desmarca «Pantalla completa» y avisa', async () => {
    await montar()
    fireEvent.click(radios()[0]!)
    expect(completa()).not.toBeChecked()
    expect(screen.getByText(SES.completaMisma)).toBeInTheDocument()
    fireEvent.click(completa())
    expect(completa()).toBeChecked()
    expect(screen.getByText(SES.completaMisma)).toBeInTheDocument()
  })

  it('con una sola pantalla: nota, casilla desmarcada y la pantalla de la principal', async () => {
    await montar({ inicio: 'cola' }, estadoSinCola(), UNA)
    expect(screen.getByText(SES.unaPantalla)).toBeInTheDocument()
    expect(completa()).not.toBeChecked()
  })

  it('S2: Abrir llama a sesion.abrir, pasa a «Abriendo…» y, al terminar, cierra y abre el panel', async () => {
    const api = await montar()
    let resolver: (e: EstadoSesionIpc) => void = () => {}
    Object.assign(window.shinobi.sesion, {
      abrir: vi.fn((p: unknown) => {
        api.llamadas.push(['sesion.abrir', p])
        return new Promise<EstadoSesionIpc>((r) => (resolver = r))
      })
    })
    fireEvent.click(abrirBoton())
    expect(screen.getByText(SES.boton.abriendo).closest('button')).toHaveAttribute(
      'aria-busy',
      'true'
    )
    await act(async () => resolver(estadoP1({ revision: 50 })))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.llamadas.find((l) => l[0] === 'sesion.abrir')?.[1]).toEqual({
      pantallaId: externa.id,
      pantallaCompleta: true,
      inicio: { tipo: 'cola' }
    })
    expect(screen.getByTestId('panel')).toHaveTextContent('true')
  })

  it('Esc cancela y las pantallas son un único grupo de radio (las flechas lo recorren)', async () => {
    await montar()
    fireEvent.click(radios()[1]!)
    radios()[1]!.focus()
    // El navegador mueve la selección con las flechas; con jsdom se comprueba el grupo nativo.
    expect(new Set(radios().map((r) => r.name)).size).toBe(1)
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('si desaparece la pantalla elegida, vuelve a la inicial y avisa', async () => {
    const api = await montar()
    fireEvent.click(radios()[1]!)
    await act(async () => api.emitirPantallas(UNA))
    expect(screen.getByRole('alert')).toHaveTextContent(SES.pantallaDesaparecida)
    expect(radios()).toHaveLength(1)
    expect(radios()[0]).toBeChecked()
  })

  it('Wayland: sin lista ni casilla, con la nota, y abre en ventana', async () => {
    const api = await montar({ inicio: 'cola' }, estadoSinCola(), WAYLAND)
    expect(screen.getByText(SES.wayland)).toBeInTheDocument()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.click(abrirBoton())
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.llamadas.find((l) => l[0] === 'sesion.abrir')?.[1]).toMatchObject({
      pantallaCompleta: false
    })
  })

  describe('errores', () => {
    it('ses.error.abrir con [Reintentar], que vuelve a llamar con la misma selección', async () => {
      await montar()
      fireEvent.click(radios()[0]!)
      const abrir = rechazarAbrir('ERROR_INTERNO')
      fireEvent.click(abrirBoton())
      expect(await screen.findByRole('alert')).toHaveTextContent(SES.errorAbrir)
      expect(radios()[0]).toBeChecked()
      fireEvent.click(screen.getByRole('button', { name: SES.reintentar }))
      await waitFor(() => expect(abrir).toHaveBeenCalledTimes(2))
      expect(abrir.mock.calls[1]).toEqual(abrir.mock.calls[0])
    })

    it('PANTALLA_NO_DISPONIBLE: mismo banner y recarga la lista', async () => {
      const api = await montar()
      const antes = api.llamadas.filter((l) => l[0] === 'pantallas.listar').length
      rechazarAbrir('PANTALLA_NO_DISPONIBLE')
      fireEvent.click(abrirBoton())
      expect(await screen.findByText(SES.errorAbrir)).toBeInTheDocument()
      await waitFor(() =>
        expect(api.llamadas.filter((l) => l[0] === 'pantallas.listar').length).toBe(antes + 1)
      )
      expect(screen.getByRole('button', { name: SES.reintentar })).toBeInTheDocument()
    })

    it('GUARDADO_PENDIENTE: ses.error.guardando con [Reintentar]', async () => {
      await montar()
      rechazarAbrir('GUARDADO_PENDIENTE')
      fireEvent.click(abrirBoton())
      expect(await screen.findByText(SES.errorGuardando)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: SES.reintentar })).toBeInTheDocument()
    })

    it('CANCION_NO_DISPONIBLE: ses.error.noDisponible, sin cerrar', async () => {
      await montar({ inicio: { cancionId: 'x1' } })
      rechazarAbrir('CANCION_NO_DISPONIBLE')
      fireEvent.click(abrirBoton())
      expect(await screen.findByText(SES.errorNoDisponible('Título de x1'))).toBeInTheDocument()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(radios()[1]).toBeChecked()
    })

    it('SESION_EN_CURSO: cierra el diálogo y muestra el panel', async () => {
      await montar()
      rechazarAbrir('SESION_EN_CURSO')
      fireEvent.click(abrirBoton())
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(screen.getByTestId('panel')).toHaveTextContent('true')
    })
  })

  describe('«Empezará con»', () => {
    it('con pendientes y sin última reproducida', async () => {
      await montar({ inicio: 'cola' }, estadoP6())
      expect(screen.getByText(SES.empieza.conCola('Canción 1', 'Artista 1'))).toBeInTheDocument()
    })

    it('con la última interrumpida: seguirá desde su segundo y abre con inicio reanudar', async () => {
      const api = await montar({ inicio: 'reanudar' }, estadoP5())
      expect(screen.getByText(SES.empieza.interrumpida('Canción 1', 95_000))).toBeInTheDocument()
      fireEvent.click(abrirBoton())
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(api.llamadas.find((l) => l[0] === 'sesion.abrir')?.[1]).toMatchObject({
        inicio: { tipo: 'reanudar' }
      })
    })

    it('con la última terminada y pendientes', async () => {
      const base = estadoP5()
      await montar(
        { inicio: 'reanudar' },
        estadoP5({ contexto: { ...base.contexto!, terminada: true, posicionMs: null } })
      )
      expect(screen.getByText(SES.empieza.terminada('Canción 1', 'Canción 2'))).toBeInTheDocument()
    })

    it('con la última terminada y sin pendientes', async () => {
      const base = estadoP5()
      await montar(
        { inicio: 'reanudar' },
        estadoP5({
          pendientes: [],
          contexto: { ...base.contexto!, terminada: true, posicionMs: null }
        })
      )
      expect(screen.getByText(SES.empieza.terminadaSinPendientes('Canción 1'))).toBeInTheDocument()
    })

    it('S15b: «Reproducir en otra pantalla…» con una interrumpida avisa y abre con la canción', async () => {
      const api = await montar({ inicio: { cancionId: 'cancion-9' } }, estadoP5())
      const texto = screen.getByText(/Empezará con «Título de cancion-9»/)
      expect(texto).toHaveTextContent('Después seguirán las 2 canciones de la cola.')
      expect(texto).toHaveTextContent(`ya no seguirá desde ${mmss(95_000)}`)
      fireEvent.click(abrirBoton())
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(api.llamadas.find((l) => l[0] === 'sesion.abrir')?.[1]).toMatchObject({
        inicio: { tipo: 'cancion', cancionId: 'cancion-9', donde: 'ahora' }
      })
    })
  })

  it('«Mover a…»: sin «Empezará con» y llama a sesion.moverAPantalla', async () => {
    const api = await montar({ inicio: 'mover' }, estadoP1())
    expect(screen.queryByText(SES.audio)).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: SES.mover }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(api.llamadas.find((l) => l[0] === 'sesion.moverAPantalla')?.[1]).toBe(externa.id)
  })
})
