import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { CANALES } from '../../shared/canales'
import { crearVentanaExportacion, type DepsVentanaExportacion } from './ventana'

function montar(imagen = { w: 640, h: 480 }) {
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
    isDestroyed: () => false
  })
  const deps: DepsVentanaExportacion = {
    crear: vi.fn(() => ventana as never),
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
    expect((await bien.capturar()).length).toBe(640 * 480 * 4)
    const mal = await crearVentanaExportacion(opciones, montar({ w: 1280, h: 960 }).deps)
    await expect(mal.capturar()).rejects.toMatchObject({ codigo: 'PERFIL_NO_SOPORTADO' })
  })

  it('bloquea la navegación', async () => {
    const { wc, deps } = montar()
    await crearVentanaExportacion(opciones, deps)
    const evento = { preventDefault: vi.fn() }
    wc.emit('will-navigate', evento)
    expect(evento.preventDefault).toHaveBeenCalled()
  })
})
