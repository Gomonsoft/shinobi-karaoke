import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { ControlModoReproductor, simularPantallaCompleta } from './modoReproductor'

class VentanaFalsa extends EventEmitter {
  pantallaCompleta = false
  maximizada = false
  readonly setFullScreen = vi.fn<(activa: boolean) => void>()
  readonly maximize = vi.fn(() => {
    this.maximizada = true
  })

  isFullScreen(): boolean {
    return this.pantallaCompleta
  }

  isMaximized(): boolean {
    return this.maximizada
  }

  cambiarPantalla(activa: boolean): void {
    this.pantallaCompleta = activa
    this.maximizada = false
    this.emit(activa ? 'enter-full-screen' : 'leave-full-screen')
  }
}

function montar() {
  let activo = false
  const bloqueador = {
    start: vi.fn(() => {
      activo = true
      return 0
    }),
    stop: vi.fn(() => {
      activo = false
    }),
    isStarted: vi.fn(() => activo)
  }
  const fijarZoomActivo = vi.fn()
  const control = new ControlModoReproductor({ bloqueador, fijarZoomActivo })
  const ventana = new VentanaFalsa()
  control.vincular(ventana)
  return { control, ventana, fijarZoomActivo, bloqueador }
}

describe('ControlModoReproductor', () => {
  it('entra una vez, desactiva zoom y vuelve a ventana normal al salir', () => {
    const { control, ventana, fijarZoomActivo } = montar()
    control.modoReproductor(true)
    control.modoReproductor(true)
    expect(ventana.setFullScreen.mock.calls).toEqual([[true]])
    expect(fijarZoomActivo.mock.calls).toEqual([[false]])
    expect(control.estaEnPantallaCompleta()).toBe(false)
    ventana.cambiarPantalla(true)
    expect(control.estaEnPantallaCompleta()).toBe(true)

    control.modoReproductor(false)
    expect(ventana.setFullScreen.mock.calls).toEqual([[true], [false]])
    ventana.cambiarPantalla(false)
    expect(ventana.maximize).not.toHaveBeenCalled()
    expect(control.estaEnPantallaCompleta()).toBe(false)
    expect(fijarZoomActivo.mock.calls).toEqual([[false], [true]])
  })

  it.each([false, true])(
    'restaura la maximización tras salir de pantalla completa (nativa: %s)',
    (restauradaPorElectron) => {
      const { control, ventana } = montar()
      ventana.maximizada = true
      control.modoReproductor(true)
      ventana.cambiarPantalla(true)
      control.modoReproductor(false)
      expect(ventana.maximize).not.toHaveBeenCalled()

      ventana.pantallaCompleta = false
      ventana.maximizada = restauradaPorElectron
      ventana.emit('leave-full-screen')
      expect(ventana.maximize).toHaveBeenCalledTimes(restauradaPorElectron ? 0 : 1)
      expect(ventana.isMaximized()).toBe(true)
    }
  )

  it('recupera la pantalla completa que había antes de entrar', () => {
    const { control, ventana } = montar()
    ventana.cambiarPantalla(true)
    control.modoReproductor(true)
    expect(ventana.setFullScreen).not.toHaveBeenCalled()

    control.fijarPantallaCompleta(false)
    ventana.cambiarPantalla(false)
    control.modoReproductor(false)
    expect(ventana.setFullScreen.mock.calls).toEqual([[false], [true]])
  })

  it('reaplica una petición de salida hecha durante la transición de entrada', () => {
    const { control, ventana } = montar()
    const cambio = vi.fn()
    control.suscribir(cambio)
    control.modoReproductor(true)
    control.modoReproductor(false)
    expect(ventana.setFullScreen.mock.calls).toEqual([[true]])
    ventana.cambiarPantalla(true)
    expect(ventana.setFullScreen.mock.calls).toEqual([[true], [false]])
    ventana.cambiarPantalla(false)
    expect(cambio.mock.calls).toEqual([[true], [false]])
    expect(control.estaEnPantallaCompleta()).toBe(false)
  })

  it('conserva el estado anterior si el reproductor se reabre durante la salida', () => {
    const { control, ventana } = montar()
    control.modoReproductor(true)
    ventana.cambiarPantalla(true)
    control.modoReproductor(false)
    control.modoReproductor(true)
    ventana.cambiarPantalla(false)
    ventana.cambiarPantalla(true)

    control.modoReproductor(false)
    ventana.cambiarPantalla(false)
    expect(ventana.setFullScreen.mock.calls).toEqual([[true], [false], [true], [false]])
  })

  it('conserva la pantalla completa original si se reabre antes de restaurarla', () => {
    const { control, ventana } = montar()
    ventana.cambiarPantalla(true)
    control.modoReproductor(true)
    control.fijarPantallaCompleta(false)
    control.modoReproductor(false)
    ventana.cambiarPantalla(false)
    control.modoReproductor(true)
    ventana.cambiarPantalla(true)

    control.modoReproductor(false)
    expect(ventana.setFullScreen.mock.calls).toEqual([[false], [true]])
    expect(control.estaEnPantallaCompleta()).toBe(true)
  })

  it('notifica cambios nativos sin revertirlos y permite desuscribirse', () => {
    const { control, ventana } = montar()
    const cambio = vi.fn()
    const baja = control.suscribir(cambio)
    control.modoReproductor(true)
    ventana.cambiarPantalla(true)
    ventana.cambiarPantalla(false)
    expect(ventana.setFullScreen.mock.calls).toEqual([[true]])
    expect(cambio.mock.calls).toEqual([[true], [false]])
    baja()
    ventana.cambiarPantalla(true)
    expect(cambio).toHaveBeenCalledTimes(2)
  })

  it('mantiene un solo bloqueo, lo libera en pausa y al salir del reproductor', () => {
    const { control, bloqueador } = montar()
    control.modoReproductor(true)
    control.evitarReposo(true)
    control.evitarReposo(true)
    expect(bloqueador.start.mock.calls).toEqual([['prevent-display-sleep']])
    control.evitarReposo(false)
    control.evitarReposo(false)
    expect(bloqueador.stop.mock.calls).toEqual([[0]])

    control.evitarReposo(true)
    control.modoReproductor(false)
    expect(bloqueador.start).toHaveBeenCalledTimes(2)
    expect(bloqueador.stop.mock.calls).toEqual([[0], [0]])
  })

  it('al reiniciar el renderer restaura la ventana y libera el bloqueo', () => {
    const { control, ventana, bloqueador, fijarZoomActivo } = montar()
    control.modoReproductor(true)
    ventana.cambiarPantalla(true)
    control.evitarReposo(true)
    control.reiniciar()
    expect(ventana.setFullScreen.mock.calls).toEqual([[true], [false]])
    expect(bloqueador.stop).toHaveBeenCalledWith(0)
    expect(fijarZoomActivo).toHaveBeenLastCalledWith(true)
  })

  it('al cerrar o sustituir una ventana desvincula sus eventos y libera el bloqueo', () => {
    const { control, ventana, bloqueador, fijarZoomActivo } = montar()
    const cambio = vi.fn()
    control.suscribir(cambio)
    control.modoReproductor(true)
    control.evitarReposo(true)
    ventana.emit('closed')
    expect(bloqueador.stop).toHaveBeenCalledOnce()
    expect(fijarZoomActivo).toHaveBeenLastCalledWith(true)
    expect(ventana.setFullScreen.mock.calls).toEqual([[true]])
    expect(control.estaEnPantallaCompleta()).toBe(false)
    control.evitarReposo(true)
    expect(bloqueador.start).toHaveBeenCalledOnce()

    const nueva = new VentanaFalsa()
    control.vincular(nueva)
    ventana.cambiarPantalla(true)
    expect(cambio).not.toHaveBeenCalled()
    nueva.cambiarPantalla(true)
    expect(cambio).toHaveBeenCalledWith(true)
    control.vincular(new VentanaFalsa())
    nueva.cambiarPantalla(false)
    expect(cambio).toHaveBeenCalledOnce()
  })

  it('el adaptador simula el cambio en el siguiente tick y delega el cierre', async () => {
    const { control, ventana, bloqueador } = montar()
    const cambio = vi.fn()
    control.suscribir(cambio)
    control.vincular(simularPantallaCompleta(ventana))
    control.modoReproductor(true)
    expect(control.estaEnPantallaCompleta()).toBe(false)
    expect(cambio).not.toHaveBeenCalled()
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(control.estaEnPantallaCompleta()).toBe(true)
    expect(cambio).toHaveBeenCalledWith(true)
    expect(ventana.setFullScreen).not.toHaveBeenCalled()

    control.evitarReposo(true)
    ventana.emit('closed')
    expect(bloqueador.stop).toHaveBeenCalledWith(0)
  })
})
