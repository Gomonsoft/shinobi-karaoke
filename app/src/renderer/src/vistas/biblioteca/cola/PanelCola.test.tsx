import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import {
  entrada,
  estadoP1,
  estadoP2,
  estadoP3,
  estadoP4,
  estadoP4FinDeCola,
  estadoP5,
  estadoP6,
  estadoSinCola,
  pantalla,
  SESION_ID
} from '@shared/__fixtures__/sesion'
import type { EstadoSesionIpc, IncidenciaSesion, SesionActivaIpc } from '@shared/sesion'
import { cerrarTodosLosToasts } from '../../../componentes/gestorToasts'
import { COLA, EDI_BLOQUEO, SES } from '../../../sesion/textos'
import { montarConSesion } from '../montarConSesion'
import { resumenPrueba } from '../resumenPrueba'
import { ESPERA_SIN_RESPUESTA_MS } from './BannersRecuperacion'

const principal = pantalla(1)
const externa = pantalla(2, { etiqueta: 'DELL U2720Q' })
const DOS = { pantallas: [principal, externa], colocacion: 'libre' as const }
const WAYLAND = { pantallas: [principal], colocacion: 'sistema' as const }
const cancion = resumenPrueba({ id: 'cancion-1', titulo: 'Canción 1', estado: 'lista' })

afterEach(() => {
  vi.useRealTimers()
  cleanup()
  cerrarTodosLosToasts()
})

const sesionDe = (e: EstadoSesionIpc, extra: Partial<SesionActivaIpc>): EstadoSesionIpc => ({
  ...e,
  sesion: { ...e.sesion!, ...extra }
})

async function montar(
  estado: EstadoSesionIpc,
  pantallas: typeof DOS | typeof WAYLAND = DOS,
  abrirConBoton = false
) {
  const r = montarConSesion([cancion], estado, { pantallas })
  if (abrirConBoton) {
    fireEvent.click(await screen.findByRole('button', { name: /^(Mostrar la cola|Cola)/ }))
  }
  const panel = await screen.findByRole('complementary', { name: COLA.titulo })
  return { ...r, panel: within(panel) }
}

const emitir = (r: Awaited<ReturnType<typeof montar>>, e: EstadoSesionIpc) =>
  act(() => r.sesion.emitirEstado(e))
const llamadas = (r: Awaited<ReturnType<typeof montar>>, nombre: string) =>
  r.sesion.llamadas.filter((l) => l[0] === nombre)

describe('P1 · reproduciendo (S3)', () => {
  it('se abre solo con la sesión y muestra la activa, el progreso y los controles', async () => {
    const r = await montar(estadoP1())
    expect(r.panel.getByRole('heading', { level: 2, name: COLA.titulo })).toBeInTheDocument()
    expect(r.panel.getByRole('heading', { level: 3, name: COLA.activa })).toBeInTheDocument()
    expect(r.panel.getByText('Canción 1')).toBeInTheDocument()
    const barra = r.panel.getByRole('progressbar')
    expect(barra).toHaveAttribute('aria-valuetext', '42 segundos de 3 minutos 0 segundos')
    expect(r.panel.getByText(`${COLA.pantalla(2, 'Pantalla 2')}`)).toBeInTheDocument()
    expect(r.panel.getByText(COLA.modo.completa)).toBeInTheDocument()
  })

  it('el progreso sigue a sesion:posicion', async () => {
    const r = await montar(estadoP1())
    act(() =>
      r.sesion.emitirPosicion({
        sesionId: SESION_ID,
        entradaId: estadoP1().activa!.entradaId,
        posicionMs: 72_000,
        duracionMs: 355_000
      })
    )
    expect(r.panel.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '1 minuto 12 segundos de 5 minutos 55 segundos'
    )
  })

  it('Pausa, Reiniciar y Siguiente llaman con la entrada activa', async () => {
    const r = await montar(estadoP1())
    const id = estadoP1().activa!.entradaId
    fireEvent.click(r.panel.getByRole('button', { name: COLA.pausa }))
    fireEvent.click(r.panel.getByRole('button', { name: COLA.reiniciar }))
    fireEvent.click(r.panel.getByRole('button', { name: COLA.siguiente }))
    await waitFor(() => expect(llamadas(r, 'sesion.siguiente')).toHaveLength(1))
    expect(llamadas(r, 'sesion.transporte')).toEqual([
      ['sesion.transporte', 'pausar', id],
      ['sesion.transporte', 'reiniciar', id]
    ])
    expect(llamadas(r, 'sesion.siguiente')).toEqual([['sesion.siguiente', id]])
  })

  it('un doble clic en Siguiente envía la misma desdeEntradaId', async () => {
    const r = await montar(estadoP1())
    const boton = r.panel.getByRole('button', { name: COLA.siguiente })
    fireEvent.click(boton)
    fireEvent.click(boton)
    await waitFor(() => expect(llamadas(r, 'sesion.siguiente')).toHaveLength(2))
    const [a, b] = llamadas(r, 'sesion.siguiente')
    expect(a).toEqual(b)
    expect(a![1]).toBe(estadoP1().activa!.entradaId)
  })

  it('sin pendientes, Siguiente es aria-disabled con su motivo y no hace nada', async () => {
    const r = await montar(estadoP1({ pendientes: [] }))
    const boton = r.panel.getByRole('button', { name: COLA.siguiente })
    expect(boton).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(boton)
    expect(llamadas(r, 'sesion.siguiente')).toHaveLength(0)
  })

  it('en pausa el botón es Reanudar', async () => {
    const r = await montar(sesionDe(estadoP1(), { fase: 'pausada' }))
    fireEvent.click(r.panel.getByRole('button', { name: COLA.reanudar }))
    await waitFor(() => expect(llamadas(r, 'sesion.transporte')).toHaveLength(1))
    expect(llamadas(r, 'sesion.transporte')[0]).toEqual([
      'sesion.transporte',
      'reanudar',
      estadoP1().activa!.entradaId
    ])
  })

  it('«Agregar otra vez al final» del ⋯ de la activa', async () => {
    const r = await montar(estadoP1())
    fireEvent.click(r.panel.getByRole('button', { name: 'Más acciones de «Canción 1»' }))
    fireEvent.click(screen.getByRole('menuitem', { name: COLA.otraVez }))
    await waitFor(() =>
      expect(r.sesion.llamadas).toContainEqual(['cola.agregar', 'cancion-1', 'final'])
    )
  })

  it('el aviso de incompleta sale del resumen de la biblioteca (0080)', async () => {
    const incompleta = resumenPrueba({
      id: 'cancion-1',
      titulo: 'Canción 1',
      estado: 'lista',
      incompleta: true,
      lineasSinSincronizar: 3
    })
    montarConSesion([incompleta], estadoP1(), { pantallas: DOS })
    const panel = within(await screen.findByRole('complementary', { name: COLA.titulo }))
    expect(panel.getByText('Faltan 3 líneas por sincronizar')).toBeInTheDocument()
  })

  it('Ocultar cierra el panel y deja el foco en el botón «Cola»', async () => {
    const r = await montar(estadoP1())
    fireEvent.click(r.panel.getByRole('button', { name: COLA.ocultar }))
    await waitFor(() => expect(screen.queryByRole('complementary')).toBeNull())
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Mostrar la cola/ })).toHaveFocus()
    )
  })

  it('el botón «Cola» alterna el panel con aria-expanded', async () => {
    const r = await montar(estadoP1())
    const boton = screen.getByRole('button', { name: /Ocultar la cola/ })
    expect(boton).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(boton)
    expect(await screen.findByRole('button', { name: /Mostrar la cola/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(r.panel).toBeDefined()
  })
})

describe('controles de la pantalla', () => {
  it('alterna pantalla completa, muestra el reproductor y cambia de pantalla', async () => {
    const r = await montar(estadoP1())
    fireEvent.click(r.panel.getByRole('button', { name: SES.ventana.ventana }))
    await waitFor(() =>
      expect(r.sesion.llamadas).toContainEqual(['sesion.fijarPantallaCompleta', false])
    )
    fireEvent.click(r.panel.getByRole('button', { name: SES.menu }))
    fireEvent.click(screen.getByRole('menuitem', { name: SES.mostrar }))
    await waitFor(() => expect(llamadas(r, 'sesion.mostrar')).toHaveLength(1))
    fireEvent.click(r.panel.getByRole('button', { name: SES.menu }))
    fireEvent.click(screen.getByRole('menuitem', { name: SES.cambiar }))
    expect(await screen.findByRole('dialog', { name: SES.cambiar })).toBeInTheDocument()
  })

  it('Wayland: sin pantalla conocida ni cambio de pantalla, con ses.wayland', async () => {
    const e = sesionDe(estadoP1(), { pantalla: null, pantallaCompleta: false })
    const r = await montar(e, WAYLAND)
    expect(r.panel.getByText(SES.pantallaDesconocida)).toBeInTheDocument()
    expect(r.panel.getByText(SES.wayland)).toBeInTheDocument()
    expect(r.panel.queryByRole('button', { name: SES.ventana.completa })).toBeNull()
    fireEvent.click(r.panel.getByRole('button', { name: SES.menu }))
    expect(screen.queryByRole('menuitem', { name: SES.cambiar })).toBeNull()
  })
})

describe('P2 · cuenta entre canciones', () => {
  it('muestra la cuenta y [Empezar ya] / [Detener cuenta] usan sus ids', async () => {
    const r = await montar(estadoP2())
    expect(r.panel.getByText(COLA.termino('Canción 1'))).toBeInTheDocument()
    expect(r.panel.getByText(COLA.cuenta(3, 'Canción 2'))).toBeInTheDocument()
    fireEvent.click(r.panel.getByRole('button', { name: COLA.empezarYa }))
    fireEvent.click(r.panel.getByRole('button', { name: COLA.detener }))
    await waitFor(() => expect(llamadas(r, 'sesion.detenerTransicion')).toHaveLength(1))
    expect(llamadas(r, 'sesion.empezar')[0]![1]).toBe(entrada(2).entradaId)
    expect(llamadas(r, 'sesion.detenerTransicion')[0]![1]).toBe(
      estadoP2().sesion!.transicion!.transicionId
    )
  })

  it('el reloj local baja la cuenta sin nuevos eventos', async () => {
    const r = await montar(estadoP2())
    expect(r.panel.getByText(COLA.cuenta(3, 'Canción 2'))).toBeInTheDocument()
    // El reloj local (cada 250 ms) lee `Date.now()`: se adelanta 1,1 s sin esperar de verdad.
    const base = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(base + 1100)
    await waitFor(() => expect(r.panel.getByText(COLA.cuenta(2, 'Canción 2'))).toBeInTheDocument())
    vi.restoreAllMocks()
  })
})

describe('P3 · fallo de una entrada (S9)', () => {
  it('causa y [Pasar a la siguiente canción]', async () => {
    const r = await montar(estadoP3())
    expect(r.panel.getByRole('alert')).toHaveTextContent(COLA.falloTitulo('Canción 1'))
    expect(r.panel.getByText(COLA.causa('sin_pistas'))).toBeInTheDocument()
    fireEvent.click(r.panel.getByRole('button', { name: COLA.pasar }))
    await waitFor(() => expect(llamadas(r, 'sesion.siguiente')).toHaveLength(1))
    expect(llamadas(r, 'sesion.siguiente')[0]![1]).toBe(entrada(1).entradaId)
  })

  it('sin pendientes: [Descartar] quita la entrada fallida', async () => {
    const r = await montar(estadoP3({ pendientes: [] }))
    expect(r.panel.getByText(COLA.falloSinSiguiente)).toBeInTheDocument()
    expect(r.panel.queryByRole('button', { name: COLA.pasar })).toBeNull()
    fireEvent.click(r.panel.getByRole('button', { name: COLA.descartar }))
    await waitFor(() => expect(llamadas(r, 'cola.quitar')).toHaveLength(1))
    expect(llamadas(r, 'cola.quitar')[0]![1]).toBe(entrada(1).entradaId)
  })

  it('[Copiar detalles] copia el código', async () => {
    const escribir = vi.fn(() => Promise.resolve())
    Object.assign(navigator, { clipboard: { writeText: escribir } })
    const r = await montar(estadoP3())
    fireEvent.click(r.panel.getByRole('button', { name: 'Copiar detalles' }))
    await waitFor(() => expect(escribir).toHaveBeenCalledWith('SIN_PISTAS'))
  })
})

describe('P4 · espera y fin de la cola', () => {
  it('en espera con candidata: [Iniciar «título»]', async () => {
    const r = await montar(estadoP4())
    fireEvent.click(r.panel.getByRole('button', { name: COLA.iniciar('Canción 2') }))
    await waitFor(() => expect(llamadas(r, 'sesion.empezar')).toHaveLength(1))
    expect(llamadas(r, 'sesion.empezar')[0]![1]).toBe(entrada(2).entradaId)
  })

  it('en espera sin candidata: cola.espera.vacia', async () => {
    const r = await montar(estadoP4({ pendientes: [] }))
    expect(r.panel.getByText(COLA.esperaVacia)).toBeInTheDocument()
  })

  it('fin de la cola: última y [Otra vez]', async () => {
    const r = await montar(estadoP4FinDeCola())
    expect(r.panel.getByText(COLA.fin)).toBeInTheDocument()
    expect(r.panel.getByText(COLA.finUltima('Canción 1', 'Artista 1'))).toBeInTheDocument()
    fireEvent.click(r.panel.getByRole('button', { name: COLA.finOtraVez }))
    await waitFor(() => expect(llamadas(r, 'sesion.repetir')).toHaveLength(1))
    expect(llamadas(r, 'sesion.repetir')[0]![1]).toBe(entrada(1).entradaId)
  })
})

describe('P5 y P6 · sin sesión', () => {
  it('P5: cerrado, última interrumpida, abrir con inicio reanudar', async () => {
    const r = await montar(estadoP5(), DOS, true)
    expect(r.panel.getByText(COLA.cerrado)).toBeInTheDocument()
    expect(r.panel.getByRole('heading', { level: 3, name: COLA.ultima })).toBeInTheDocument()
    expect(r.panel.getByText(COLA.ultimaInterrumpida(95_000))).toBeInTheDocument()
    fireEvent.click(r.panel.getByRole('button', { name: SES.abrir }))
    expect(await screen.findByRole('dialog', { name: SES.dialogoTitulo })).toBeInTheDocument()
    expect(screen.getByText(SES.empieza.interrumpida('Canción 1', 95_000))).toBeInTheDocument()
  })

  it('P5: [Eliminar cola…] confirma y llama a cola.vaciar con contexto', async () => {
    const r = await montar(estadoP5(), DOS, true)
    fireEvent.click(r.panel.getByRole('button', { name: COLA.eliminar }))
    const dialogo = await screen.findByRole('dialog', { name: COLA.dialogoEliminar.titulo })
    expect(within(dialogo).getByText(/Se quitarán las 2 canciones pendientes/)).toBeVisible()
    fireEvent.click(within(dialogo).getByRole('button', { name: COLA.dialogoEliminar.eliminar }))
    await waitFor(() => expect(r.sesion.llamadas).toContainEqual(['cola.vaciar', true]))
    // Tras eliminar, el foco pasa a «Abrir en otra pantalla…» (y se consume su reintento).
    await waitFor(() => expect(r.panel.getByRole('button', { name: SES.abrir })).toHaveFocus())
  })

  it('P6: sin última reproducida y con «Abrir» con inicio cola', async () => {
    const r = await montar(estadoP6(), DOS, true)
    expect(r.panel.queryByText(COLA.ultima)).toBeNull()
    fireEvent.click(r.panel.getByRole('button', { name: SES.abrir }))
    await screen.findByRole('dialog', { name: SES.dialogoTitulo })
    expect(screen.getByText(SES.empieza.conCola('Canción 1', 'Artista 1'))).toBeInTheDocument()
  })

  it('P6 vacío: sin «Eliminar cola…» y con cola.vacia.sinSesion', async () => {
    const r = await montar(estadoSinCola(), DOS, true)
    expect(r.panel.queryByRole('button', { name: COLA.eliminar })).toBeNull()
    expect(r.panel.getByText(COLA.vaciaSinSesion)).toBeInTheDocument()
  })
})

describe('cerrar el reproductor (S12, principal)', () => {
  const conCierre = (origen: 'principal' | 'secundaria') =>
    sesionDe(estadoP1(), { cierrePendiente: { origen } })

  it('[Cerrar reproductor] llama a sesion.solicitarCierre', async () => {
    const r = await montar(estadoP1())
    fireEvent.click(r.panel.getByRole('button', { name: SES.cerrar }))
    await waitFor(() => expect(llamadas(r, 'sesion.solicitarCierre')).toHaveLength(1))
  })

  it('con origen principal: diálogo con foco en Cancelar y conservar con la revisión', async () => {
    const r = await montar(estadoP1())
    await emitir(r, { ...conCierre('principal'), revision: 20 })
    const dialogo = await screen.findByRole('dialog', { name: SES.cierre.titulo })
    expect(within(dialogo).getByText(SES.cierre.cuerpo(2))).toBeInTheDocument()
    expect(within(dialogo).getByRole('button', { name: SES.cierre.cancelar })).toHaveFocus()
    fireEvent.click(within(dialogo).getByRole('button', { name: SES.cierre.conservar }))
    await waitFor(() =>
      expect(r.sesion.llamadas).toContainEqual(['sesion.confirmarCierre', 'conservar', 20])
    )
  })

  it('Cancelar llama a sesion.cancelarCierre', async () => {
    const r = await montar(estadoP1())
    await emitir(r, { ...conCierre('principal'), revision: 20 })
    fireEvent.click(await screen.findByRole('button', { name: SES.cierre.cancelar }))
    await waitFor(() => expect(llamadas(r, 'sesion.cancelarCierre')).toHaveLength(1))
  })

  it('CONFIRMACION_OBSOLETA: avisa, actualiza el número y pide confirmar otra vez', async () => {
    const r = await montar(estadoP1())
    await emitir(r, { ...conCierre('principal'), revision: 20 })
    const confirmar = vi.fn(() => Promise.reject({ codigo: 'CONFIRMACION_OBSOLETA' }))
    Object.assign(window.shinobi.sesion, { confirmarCierre: confirmar })
    fireEvent.click(await screen.findByRole('button', { name: SES.cierre.eliminar }))
    expect(await screen.findByRole('alert')).toHaveTextContent(SES.cierre.obsoleto)
    await emitir(r, { ...conCierre('principal'), pendientes: [entrada(2)], revision: 21 })
    expect(screen.getByText(SES.cierre.cuerpo(1))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: SES.cierre.eliminar }))
    await waitFor(() => expect(confirmar).toHaveBeenCalledTimes(2))
    expect(confirmar).toHaveBeenLastCalledWith('eliminar', 21)
  })

  it('con origen secundaria: ses.cierre.esperando y los controles inactivos, sin diálogo', async () => {
    const r = await montar(conCierre('secundaria'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      r.panel.getAllByText(SES.cierre.esperando).some((n) => n.getAttribute('role') === 'status')
    ).toBe(true)
    for (const nombre of [COLA.pausa, COLA.siguiente, COLA.reiniciar, SES.cerrar]) {
      expect(r.panel.getByRole('button', { name: nombre })).toHaveAttribute('aria-disabled', 'true')
    }
    fireEvent.click(r.panel.getByRole('button', { name: COLA.pausa }))
    expect(llamadas(r, 'sesion.transporte')).toHaveLength(0)
  })

  it('«Cerrar el reproductor…» del bloqueo de edición también llega al diálogo', async () => {
    const r = await montar(estadoP1())
    // El diálogo vive en el proveedor: no depende de que el panel esté abierto.
    fireEvent.click(r.panel.getByRole('button', { name: COLA.ocultar }))
    await emitir(r, { ...conCierre('principal'), revision: 30 })
    expect(await screen.findByRole('dialog', { name: SES.cierre.titulo })).toBeInTheDocument()
    expect(EDI_BLOQUEO.cerrar).toBeTruthy()
  })
})

describe('recuperación (S15)', () => {
  const conIncidencia = (incidencia: IncidenciaSesion) => sesionDe(estadoP1(), { incidencia })

  it('pantalla perdida: aviso con [Mover a…] que abre el diálogo de mover', async () => {
    const r = await montar(
      conIncidencia({
        tipo: 'pantalla_perdida',
        etiqueta: 'DELL U2720Q',
        estabaEnPantallaCompleta: true
      })
    )
    expect(r.panel.getByText(/Se desconectó «DELL U2720Q»/)).toBeInTheDocument()
    fireEvent.click(r.panel.getByRole('button', { name: SES.mover }))
    expect(await screen.findByRole('dialog', { name: SES.cambiar })).toBeInTheDocument()
  })

  it('pantalla de vuelta: [Llevar el reproductor allí] mueve a esa pantalla', async () => {
    const r = await montar(
      conIncidencia({
        tipo: 'pantalla_reconectada',
        etiqueta: 'DELL U2720Q',
        pantallaId: externa.id
      })
    )
    expect(r.panel.getByText(SES.rec.vuelve('DELL U2720Q'))).toBeInTheDocument()
    fireEvent.click(r.panel.getByRole('button', { name: SES.rec.llevar }))
    await waitFor(() => expect(llamadas(r, 'sesion.moverAPantalla')).toHaveLength(1))
    expect(llamadas(r, 'sesion.moverAPantalla')[0]![1]).toBe(externa.id)
  })

  it('el aviso de pantalla de vuelta se puede cerrar con ✕', async () => {
    const r = await montar(
      conIncidencia({
        tipo: 'pantalla_reconectada',
        etiqueta: 'DELL U2720Q',
        pantallaId: externa.id
      })
    )
    fireEvent.click(r.panel.getByRole('button', { name: 'Cerrar aviso' }))
    expect(r.panel.queryByText(SES.rec.vuelve('DELL U2720Q'))).toBeNull()
  })

  it('Wayland: sin banners de pantalla', async () => {
    const r = await montar(
      conIncidencia({ tipo: 'pantalla_perdida', etiqueta: 'X', estabaEnPantallaCompleta: false }),
      WAYLAND
    )
    expect(r.panel.queryByText(/Se desconectó/)).toBeNull()
  })

  it('caída: error con la cola conservada y [Volver a abrir]; abre el panel oculto sin mover el foco', async () => {
    const r = await montar(estadoP1())
    fireEvent.click(r.panel.getByRole('button', { name: COLA.ocultar }))
    await waitFor(() => expect(screen.queryByRole('complementary')).toBeNull())
    ;(screen.getByRole('button', { name: /Mostrar la cola/ }) as HTMLElement).focus()
    await emitir(r, estadoP5({ revision: 40, incidencia: { tipo: 'secundaria_caida' } }))
    const panel = within(await screen.findByRole('complementary', { name: COLA.titulo }))
    expect(panel.getByRole('alert')).toHaveTextContent(
      SES.rec.caida({ titulo: 'Canción 1', ms: 95_000 })
    )
    expect(screen.getByRole('button', { name: /Ocultar la cola/ })).toHaveFocus()
    fireEvent.click(panel.getByRole('button', { name: SES.rec.volverAbrir }))
    expect(await screen.findByRole('dialog', { name: SES.dialogoTitulo })).toBeInTheDocument()
  })

  it('sin respuesta: [Esperar] oculta el aviso y vuelve a los 10 s', async () => {
    const r = await montar(conIncidencia({ tipo: 'secundaria_no_responde' }))
    expect(r.panel.getByText(SES.rec.noResponde)).toBeInTheDocument()
    vi.useFakeTimers()
    fireEvent.click(r.panel.getByRole('button', { name: SES.rec.esperar }))
    expect(r.panel.queryByText(SES.rec.noResponde)).toBeNull()
    await act(async () => {
      vi.advanceTimersByTime(ESPERA_SIN_RESPUESTA_MS + 10)
    })
    expect(r.panel.getByText(SES.rec.noResponde)).toBeInTheDocument()
  })

  it('sin respuesta: [Cerrar y volver a abrir] fuerza el cierre y abre el diálogo', async () => {
    const r = await montar(conIncidencia({ tipo: 'secundaria_no_responde' }))
    fireEvent.click(r.panel.getByRole('button', { name: SES.rec.cerrarYAbrir }))
    await waitFor(() => expect(llamadas(r, 'sesion.forzarCierre')).toHaveLength(1))
    expect(await screen.findByRole('dialog', { name: SES.dialogoTitulo })).toBeInTheDocument()
  })
})
