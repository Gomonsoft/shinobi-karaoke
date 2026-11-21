import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { CANALES } from '../../shared/canales'
import { crearVentanaExportacion, probarCaptura, type DepsVentanaExportacion } from './ventana'

/** `respeta`: sigue el tamaño pedido; `recorta`: nace recortada y `setContentSize` la arregla; `rebelde`: no se deja fijar. */
function montar(imagen = { w: 640, h: 480 }, modo: 'respeta' | 'recorta' | 'rebelde' = 'respeta') {
  const tam = { w: 0, h: 0 }
  const wc = Object.assign(new EventEmitter(), {
    send: vi.fn(),
    setWindowOpenHandler: vi.fn(),
    setAudioMuted: vi.fn(),
    setZoomFactor: vi.fn(),
    setVisualZoomLevelLimits: vi.fn(),
    setFrameRate: vi.fn(),
    getOSProcessId: () => 4242,
    isDestroyed: () => false,
    capturePage: () =>
      Promise.resolve({
        getSize: () => ({ width: imagen.w, height: imagen.h }),
        toBitmap: () => Buffer.alloc(imagen.w * imagen.h * 4)
      })
  })
  const ventana = Object.assign(new EventEmitter(), {
    webContents: wc,
    loadURL: vi.fn(() => Promise.resolve()),
    destroy: vi.fn(),
    isDestroyed: () => false,
    setContentSize: vi.fn((w: number, h: number) => {
      if (modo !== 'rebelde') Object.assign(tam, { w, h })
    }),
    getContentSize: () => [tam.w, tam.h]
  })
  const deps: DepsVentanaExportacion = {
    crear: vi.fn((o) => {
      // Al crearla: respeta el tamaño pedido, o la recorta (como Windows con el área de trabajo).
      Object.assign(
        tam,
        modo === 'respeta' ? { w: o.width, h: o.height } : { w: o.width, h: o.height - 48 }
      )
      return ventana as never
    }),
    url: 'shinobi-app://app/exportacion.html',
    preload: '/x/exportacion.js',
    registrarRol: vi.fn(),
    bajarPrioridad: vi.fn(),
    plazoMs: 50
  }
  return { wc, ventana, deps }
}

const opciones = { ancho: 640, alto: 480, trabajoId: '00000000-0000-4000-8000-000000000001' }

describe('crearVentanaExportacion', () => {
  it('crea la ventana oculta, a escala 1, sin sonido y con prioridad baja', async () => {
    const { wc, deps } = montar()
    await crearVentanaExportacion(opciones, deps)
    const o = vi.mocked(deps.crear).mock.calls[0]![0]
    expect(o.show).toBe(false)
    expect(o.webPreferences.offscreen).toEqual({ useSharedTexture: false, deviceScaleFactor: 1 })
    expect(o.webPreferences.sandbox).toBe(true)
    expect(o.webPreferences.backgroundThrottling).toBe(false)
    expect(wc.setAudioMuted).toHaveBeenCalledWith(true)
    expect(wc.setFrameRate).toHaveBeenCalledWith(240)
    expect(deps.registrarRol).toHaveBeenCalled()
    expect(deps.bajarPrioridad).toHaveBeenCalledWith(4242)
  })

  it('fija el tamaño tras crear una ventana recortada, antes de cargar', async () => {
    const { ventana, deps } = montar(undefined, 'recorta')
    const v = await crearVentanaExportacion(opciones, deps)
    expect((await v.capturar()).imagen.length).toBe(640 * 480 * 4)
    expect(ventana.setContentSize.mock.invocationCallOrder[0]).toBeLessThan(
      ventana.loadURL.mock.invocationCallOrder[0]!
    )
  })

  it('si el tamaño no se deja fijar, falla con PERFIL_NO_SOPORTADO sin dejar rastro', async () => {
    const { ventana, deps } = montar(undefined, 'rebelde')
    deps.registrar = vi.fn()
    await expect(crearVentanaExportacion(opciones, deps)).rejects.toMatchObject({
      codigo: 'PERFIL_NO_SOPORTADO'
    })
    expect(ventana.destroy).toHaveBeenCalled()
    expect(deps.registrarRol).not.toHaveBeenCalled()
    expect(ventana.loadURL).not.toHaveBeenCalled()
    expect(deps.registrar).toHaveBeenCalledWith('error', expect.stringContaining('640×432'))
  })

  it('pintar espera el listo del mismo trabajo y fotograma', async () => {
    const { wc, deps } = montar()
    const v = await crearVentanaExportacion(opciones, deps)
    const p = v.pintar(3)
    expect(wc.send).toHaveBeenCalledWith(CANALES.eventos.exportacionFotograma, {
      trabajoId: opciones.trabajoId,
      n: 3
    })
    expect(() => v.confirmarListo({ trabajoId: 'ajeno', n: 3 })).toThrow('ajeno')
    v.confirmarListo({ trabajoId: opciones.trabajoId, n: 3 })
    await expect(p).resolves.toBeUndefined()
  })

  it('sin confirmación en el plazo falla con ERROR_INTERNO', async () => {
    const { deps } = montar()
    const v = await crearVentanaExportacion(opciones, deps)
    await expect(v.pintar(0)).rejects.toMatchObject({ codigo: 'ERROR_INTERNO' })
  })

  it('la caída del renderer rechaza el fotograma y avisa', async () => {
    const alCaer = vi.fn()
    const { wc, deps } = montar()
    const v = await crearVentanaExportacion({ ...opciones, alCaer }, deps)
    const p = v.pintar(0)
    wc.emit('render-process-gone')
    await expect(p).rejects.toMatchObject({ codigo: 'ERROR_INTERNO' })
    expect(alCaer).toHaveBeenCalled()
  })

  it('capturar devuelve BGRA del tamaño exacto y rechaza otro tamaño', async () => {
    const bien = await crearVentanaExportacion(opciones, montar().deps)
    expect((await bien.capturar()).imagen.length).toBe(640 * 480 * 4)
    const mal = await crearVentanaExportacion(opciones, montar({ w: 1280, h: 960 }).deps)
    await expect(mal.capturar()).rejects.toMatchObject({ codigo: 'PERFIL_NO_SOPORTADO' })
  })

  it('capturar repite hasta que dos capturas seguidas son iguales (cuadro obsoleto)', async () => {
    const { wc, deps } = montar()
    const tam = 640 * 480 * 4
    const colas = [Buffer.alloc(tam, 1), Buffer.alloc(tam, 2), Buffer.alloc(tam, 2)]
    wc.capturePage = () =>
      Promise.resolve({
        getSize: () => ({ width: 640, height: 480 }),
        toBitmap: () => colas.shift()!
      })
    const v = await crearVentanaExportacion(opciones, deps)
    expect(await v.capturar()).toMatchObject({ asentada: true, intentos: 3 })
    expect(colas).toHaveLength(0)
  })

  it('capturar entrega la última y avisa si nunca se asienta', async () => {
    const { wc, deps } = montar()
    let n = 0
    wc.capturePage = () =>
      Promise.resolve({
        getSize: () => ({ width: 640, height: 480 }),
        toBitmap: () => Buffer.alloc(640 * 480 * 4, ++n)
      })
    const v = await crearVentanaExportacion(opciones, deps)
    const c = await v.capturar()
    expect(c).toMatchObject({ asentada: false, intentos: 5 })
    expect(c.imagen[0]).toBe(5)
  })

  it('bloquea la navegación', async () => {
    const { wc, deps } = montar()
    await crearVentanaExportacion(opciones, deps)
    const evento = { preventDefault: vi.fn() }
    wc.emit('will-navigate', evento)
    expect(evento.preventDefault).toHaveBeenCalled()
  })
})

describe('probarCaptura', () => {
  it('captura una ventana sin preload, de una vez, y la destruye', async () => {
    const { ventana, deps } = montar({ w: 640, h: 480 })
    expect(await probarCaptura(640, 480, { crear: deps.crear })).toBe(true)
    const o = vi.mocked(deps.crear).mock.calls[0]![0]
    expect(o.webPreferences.preload).toBeUndefined()
    expect(ventana.loadURL).toHaveBeenCalledWith('about:blank')
    expect(ventana.destroy).toHaveBeenCalledOnce()
  })

  it('un tamaño recortado a 2159 líneas da false', async () => {
    const { ventana, deps } = montar({ w: 3840, h: 2159 })
    expect(await probarCaptura(3840, 2160, { crear: deps.crear })).toBe(false)
    expect(ventana.destroy).toHaveBeenCalledOnce()
  })

  it('pasar del plazo rechaza y destruye la ventana', async () => {
    const { ventana, deps } = montar()
    ventana.loadURL.mockReturnValue(new Promise(() => undefined))
    await expect(probarCaptura(640, 480, { crear: deps.crear, plazoMs: 20 })).rejects.toThrow(
      /sin respuesta/
    )
    expect(ventana.destroy).toHaveBeenCalledOnce()
  })

  it('el fallo de captura de un trabajo lleva causa «captura»', async () => {
    const { deps } = montar(undefined, 'rebelde')
    await expect(crearVentanaExportacion(opciones, deps)).rejects.toMatchObject({
      codigo: 'PERFIL_NO_SOPORTADO',
      causa: 'captura'
    })
  })
})
