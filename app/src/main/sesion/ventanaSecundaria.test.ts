import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type { PantallaIpc } from '../../shared/sesion'
import { listarPantallas } from './pantallas'
import { ScreenSimulado } from './pantallasPrueba'
import {
  abrirSecundaria,
  ErrorPantallaNoDisponible,
  limitesAl80,
  type OpcionesVentanaSecundaria,
  type PeticionSecundaria
} from './ventanaSecundaria'

const P1 = { id: 1, label: 'Portátil', bounds: { x: 0, y: 0, width: 1920, height: 1080 } }
const P2 = {
  id: 2,
  label: 'Proyector',
  bounds: { x: 1920, y: 0, width: 1280, height: 720 },
  workArea: { x: 1920, y: 40, width: 1280, height: 680 }
}

class WebContentsFalso extends EventEmitter {
  readonly setZoomFactor = vi.fn()
}

class VentanaFalsa extends EventEmitter {
  readonly webContents = new WebContentsFalso()
  pantallaCompleta = false
  destruida = false
  minimizada = false
  bounds = { x: 0, y: 0, width: 0, height: 0 }
  readonly setBounds = vi.fn((b: typeof this.bounds) => {
    this.bounds = b
  })
  readonly setPosition = vi.fn()
  readonly show = vi.fn()
  readonly showInactive = vi.fn()
  readonly restore = vi.fn(() => {
    this.minimizada = false
  })
  readonly setMenu = vi.fn()
  readonly close = vi.fn()
  readonly destroy = vi.fn(() => {
    this.destruida = true
  })
  readonly setFullScreen = vi.fn((activa: boolean) => {
    this.pantallaCompleta = activa
    this.emit(activa ? 'enter-full-screen' : 'leave-full-screen')
  })
  isFullScreen = () => this.pantallaCompleta
  isMaximized = () => false
  maximize = vi.fn()
  getBounds = () => this.bounds
  isMinimized = () => this.minimizada
  isDestroyed = () => this.destruida
}

function montar(peticionParcial: Partial<PeticionSecundaria> & { pantallaId?: number } = {}) {
  const screen = new ScreenSimulado([P1, P2])
  const ventana = new VentanaFalsa()
  let opciones: OpcionesVentanaSecundaria | undefined
  const lista = listarPantallas(screen, {
    getBounds: () => ({ x: 100, y: 100, width: 800, height: 600 })
  })
  const pantalla = (id: number): PantallaIpc => lista.pantallas.find((p) => p.id === id)!
  const peticion: PeticionSecundaria = {
    pantalla: pantalla(peticionParcial.pantallaId ?? 2),
    pantallaCompleta: false,
    colocacion: 'libre',
    ...peticionParcial
  }
  const manejador = abrirSecundaria(peticion, {
    screen,
    rutaPreload: '/p/secundaria.js',
    crear: (o) => {
      opciones = o
      return ventana
    }
  })
  return { screen, ventana, manejador, pantalla, opciones: () => opciones! }
}

describe('abrirSecundaria', () => {
  it('crea la ventana dentro del workArea de la pantalla 2 sin darle el foco', () => {
    const { ventana, opciones } = montar()
    const o = opciones()
    expect(o).toMatchObject({
      title: 'Shinobi Karaoke · Reproductor',
      show: false,
      backgroundColor: '#000000',
      webPreferences: {
        preload: '/p/secundaria.js',
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        autoplayPolicy: 'no-user-gesture-required'
      }
    })
    expect(o).toMatchObject(limitesAl80(P2.workArea))
    expect(o.x).toBeGreaterThanOrEqual(P2.workArea.x)
    expect(o.y! + o.height).toBeLessThanOrEqual(P2.workArea.y + P2.workArea.height)
    expect(ventana.setMenu).toHaveBeenCalledWith(null)
    expect(ventana.webContents.setZoomFactor).toHaveBeenCalledWith(1)
    ventana.emit('ready-to-show')
    expect(ventana.setBounds).toHaveBeenCalledWith(limitesAl80(P2.workArea))
    expect(ventana.showInactive).toHaveBeenCalled()
    expect(ventana.show).not.toHaveBeenCalled()
    expect(ventana.setFullScreen).not.toHaveBeenCalled()
  })

  it('el zoom se restablece a 1', () => {
    const { ventana } = montar()
    ventana.webContents.setZoomFactor.mockClear()
    ventana.webContents.emit('zoom-changed')
    expect(ventana.webContents.setZoomFactor).toHaveBeenCalledWith(1)
  })

  it('en la pantalla de la principal y a pantalla completa toma el foco', () => {
    const { ventana } = montar({ pantallaId: 1, pantallaCompleta: true })
    ventana.emit('ready-to-show')
    expect(ventana.show).toHaveBeenCalled()
    expect(ventana.showInactive).not.toHaveBeenCalled()
    expect(ventana.setFullScreen).toHaveBeenCalledWith(true)
  })

  it('en otra pantalla y a pantalla completa no toma el foco', () => {
    const { ventana } = montar({ pantallaCompleta: true })
    ventana.emit('ready-to-show')
    expect(ventana.showInactive).toHaveBeenCalled()
    expect(ventana.show).not.toHaveBeenCalled()
    expect(ventana.setFullScreen).toHaveBeenCalledWith(true)
  })

  it('una pantalla inexistente da PANTALLA_NO_DISPONIBLE', () => {
    const screen = new ScreenSimulado([P1])
    expect(() =>
      abrirSecundaria(
        {
          pantalla: {
            id: 9,
            etiqueta: 'x',
            ancho: 1,
            alto: 1,
            escala: 1,
            principal: false,
            conVentanaPrincipal: false
          },
          pantallaCompleta: false,
          colocacion: 'libre'
        },
        { screen, rutaPreload: '', crear: () => new VentanaFalsa() }
      )
    ).toThrow(ErrorPantallaNoDisponible)
  })

  it('perder la pantalla en pantalla completa la saca, la coloca en la primaria y avisa; reconectar no la mueve; moverA la devuelve', () => {
    const { screen, ventana, manejador, pantalla } = montar({ pantallaCompleta: true })
    const perdida = vi.fn()
    const reconectada = vi.fn()
    manejador.alPantallaPerdida(perdida)
    manejador.alPantallaReconectada(reconectada)
    ventana.emit('ready-to-show')
    expect(ventana.pantallaCompleta).toBe(true)
    ventana.show.mockClear()
    ventana.showInactive.mockClear()

    const antesDePerder = pantalla(2)
    screen.quitar(2)
    expect(ventana.pantallaCompleta).toBe(false)
    expect(ventana.setBounds).toHaveBeenLastCalledWith(limitesAl80(P1.bounds))
    expect(perdida).toHaveBeenCalledWith({ id: 2, etiqueta: 'Proyector', ancho: 1280, alto: 720 })
    expect(ventana.show).not.toHaveBeenCalled()
    expect(ventana.showInactive).not.toHaveBeenCalled()

    ventana.setBounds.mockClear()
    screen.añadir(P2)
    expect(reconectada).toHaveBeenCalledOnce()
    expect(ventana.setBounds).not.toHaveBeenCalled()
    expect(ventana.pantallaCompleta).toBe(false)

    manejador.moverA(antesDePerder)
    expect(ventana.setBounds).toHaveBeenCalledWith(limitesAl80(P2.workArea))
    expect(ventana.pantallaCompleta).toBe(true)
  })

  it('moverA en ventana no activa la pantalla completa y en pantalla completa sale, mueve y vuelve a entrar', () => {
    const { ventana, manejador, pantalla } = montar({ pantallaId: 1 })
    ventana.emit('ready-to-show')
    manejador.moverA(pantalla(2))
    expect(ventana.setFullScreen).not.toHaveBeenCalled()
    manejador.fijarPantallaCompleta(true)
    expect(manejador.estaEnPantallaCompleta()).toBe(true)
    ventana.setBounds.mockClear()
    manejador.moverA(pantalla(1))
    expect(ventana.setFullScreen.mock.calls.map(([a]) => a)).toEqual([true, false, true])
    expect(ventana.setBounds).toHaveBeenCalledWith(limitesAl80(P1.bounds))
  })

  it('con colocación "sistema" no hay coordenadas, ni avisos ni moverA', () => {
    const screen = new ScreenSimulado([P1, P2])
    const ventana = new VentanaFalsa()
    let opciones: OpcionesVentanaSecundaria | undefined
    const manejador = abrirSecundaria(
      { pantalla: null, pantallaCompleta: true, colocacion: 'sistema' },
      {
        screen,
        rutaPreload: '',
        crear: (o) => {
          opciones = o
          return ventana
        }
      }
    )
    const perdida = vi.fn()
    manejador.alPantallaPerdida(perdida)
    ventana.emit('ready-to-show')
    screen.quitar(2)
    expect(opciones?.x).toBeUndefined()
    expect(ventana.setBounds).not.toHaveBeenCalled()
    expect(ventana.setPosition).not.toHaveBeenCalled()
    expect(perdida).not.toHaveBeenCalled()
    expect(ventana.showInactive).toHaveBeenCalled()
    expect(() => manejador.moverA({ id: 1 } as PantallaIpc)).toThrow(ErrorPantallaNoDisponible)
  })

  it('recoloca en ventana si cambian las métricas y ya no cabe', () => {
    const { screen, ventana } = montar()
    ventana.emit('ready-to-show')
    ventana.setBounds.mockClear()
    const menor = { ...P2, workArea: { x: 1920, y: 0, width: 800, height: 400 } }
    screen.emit('display-metrics-changed', {}, menor, ['workArea'])
    expect(ventana.setBounds).toHaveBeenCalledWith(limitesAl80(menor.workArea))
  })

  it('mostrar restaura sin foco; cerrar y destruir actúan sobre la ventana', () => {
    const { ventana, manejador } = montar()
    ventana.minimizada = true
    manejador.mostrar()
    expect(ventana.restore).toHaveBeenCalled()
    expect(ventana.showInactive).toHaveBeenCalled()
    manejador.cerrar()
    expect(ventana.close).toHaveBeenCalled()
    manejador.destruir()
    expect(ventana.destroy).toHaveBeenCalled()
    manejador.cerrar()
    expect(ventana.close).toHaveBeenCalledTimes(1)
  })

  it('intercepta el cierre y reenvía caída, bloqueo y recuperación', () => {
    const { ventana, manejador } = montar()
    const cierre = vi.fn((e: { preventDefault(): void }) => e.preventDefault())
    const cae = vi.fn()
    const noResponde = vi.fn()
    const responde = vi.fn()
    manejador.alCerrarSolicitado(cierre)
    manejador.alCaer(cae)
    manejador.alNoResponder(noResponde)
    manejador.alResponder(responde)
    const evento = { preventDefault: vi.fn() }
    ventana.emit('close', evento)
    expect(cierre).toHaveBeenCalled()
    expect(evento.preventDefault).toHaveBeenCalled()
    ventana.webContents.emit('render-process-gone', {}, { reason: 'crashed' })
    expect(cae).toHaveBeenCalledWith('crashed')
    ventana.webContents.emit('unresponsive')
    ventana.webContents.emit('responsive')
    expect(noResponde).toHaveBeenCalledOnce()
    expect(responde).toHaveBeenCalledOnce()
  })

  it('una recarga confirmada cuenta como caída; la carga inicial y una navegación cancelada, no', () => {
    const { ventana, manejador } = montar()
    const cae = vi.fn()
    manejador.alCaer(cae)
    ventana.webContents.emit('did-navigate')
    expect(cae).not.toHaveBeenCalled()
    ventana.webContents.emit('did-finish-load')
    // Una navegación bloqueada por `will-navigate` solo llega a `did-start-navigation`.
    ventana.webContents.emit('did-start-navigation', { isMainFrame: true, isSameDocument: false })
    expect(cae).not.toHaveBeenCalled()
    ventana.webContents.emit('did-navigate')
    expect(cae).toHaveBeenCalledWith('recarga')
  })

  it('con la pantalla completa simulada no toca la real', () => {
    const screen = new ScreenSimulado([P1, P2])
    const ventana = new VentanaFalsa()
    const manejador = abrirSecundaria(
      {
        pantalla: {
          id: 2,
          etiqueta: 'P',
          ancho: 1,
          alto: 1,
          escala: 1,
          principal: false,
          conVentanaPrincipal: false
        },
        pantallaCompleta: true,
        colocacion: 'libre'
      },
      { screen, rutaPreload: '', crear: () => ventana, pantallaCompletaSimulada: true }
    )
    ventana.emit('ready-to-show')
    expect(ventana.setFullScreen).not.toHaveBeenCalled()
    expect(manejador).toBeDefined()
  })
})
