import { describe, expect, it, vi } from 'vitest'
import { colocacionDelSistema, listarPantallas, observarPantallas, preseleccion } from './pantallas'
import { ScreenSimulado, pantallasSimuladas } from './pantallasPrueba'

const P1 = { id: 11, label: 'Portátil', bounds: { x: 0, y: 0, width: 1920, height: 1080 } }
const P2 = { id: 22, label: 'Proyector', bounds: { x: 1920, y: 0, width: 1280, height: 720 } }
const P3 = { id: 33, label: '', bounds: { x: 0, y: -1080, width: 1920, height: 1080 } }

describe('listarPantallas', () => {
  it('numera las pantallas sin nombre, ordena por x e y y marca principal y ventana', () => {
    const screen = new ScreenSimulado([P1, P2, P3])
    const lista = listarPantallas(screen, {
      getBounds: () => ({ x: 100, y: 100, width: 800, height: 600 })
    })
    expect(lista.pantallas.map((p) => p.id)).toEqual([33, 11, 22])
    expect(lista.pantallas.map((p) => p.etiqueta)).toEqual(['Pantalla 1', 'Portátil', 'Proyector'])
    expect(lista.pantallas.map((p) => p.principal)).toEqual([false, true, false])
    expect(lista.pantallas.map((p) => p.conVentanaPrincipal)).toEqual([false, true, false])
    expect(lista.pantallas[2]).toMatchObject({ ancho: 1280, alto: 720, escala: 1 })
  })

  it('sin ventana principal usa la primaria', () => {
    const lista = listarPantallas(new ScreenSimulado([P1, P2]), null)
    expect(lista.pantallas.find((p) => p.conVentanaPrincipal)?.id).toBe(11)
  })
})

describe('colocacionDelSistema', () => {
  it('solo es "sistema" en Linux con Wayland', () => {
    expect(colocacionDelSistema('linux', { XDG_SESSION_TYPE: 'wayland' })).toBe('sistema')
    expect(colocacionDelSistema('linux', { XDG_SESSION_TYPE: 'x11' })).toBe('libre')
    expect(colocacionDelSistema('darwin', { XDG_SESSION_TYPE: 'wayland' })).toBe('libre')
    expect(colocacionDelSistema('win32', {})).toBe('libre')
  })
})

describe('preseleccion', () => {
  const lista = listarPantallas(new ScreenSimulado([P1, P2, P3]), null)
  it('busca por id', () => {
    expect(preseleccion({ id: 22, etiqueta: 'x', ancho: 1, alto: 1 }, lista)?.id).toBe(22)
  })
  it('después por etiqueta y tamaño', () => {
    expect(preseleccion({ id: 99, etiqueta: 'Proyector', ancho: 1280, alto: 720 }, lista)?.id).toBe(
      22
    )
    expect(preseleccion({ id: 99, etiqueta: 'Proyector', ancho: 800, alto: 600 }, lista)?.id).toBe(
      33
    )
  })
  it('si no, la primera que no es la de la principal', () => {
    expect(preseleccion(null, lista)?.id).toBe(33)
    const sola = listarPantallas(new ScreenSimulado([P1]), null)
    expect(preseleccion(null, sola)).toBeNull()
  })
})

describe('observarPantallas y simulación', () => {
  it('emite altas, bajas y métricas, y se da de baja', () => {
    const screen = new ScreenSimulado([P1, P2])
    const cb = vi.fn()
    const baja = observarPantallas(screen, cb)
    screen.quitar(22)
    screen.añadir(P2)
    screen.emit('display-metrics-changed', {}, screen.getPrimaryDisplay(), ['bounds'])
    expect(cb.mock.calls.map(([c]) => c.tipo)).toEqual(['quitada', 'anadida', 'metricas'])
    baja()
    screen.quitar(22)
    expect(cb).toHaveBeenCalledTimes(3)
  })

  it('las pantallas simuladas solo existen sin empaquetar y publican el puerto', () => {
    const env = { SHINOBI_PANTALLAS_SIMULADAS: JSON.stringify([P1, P2]) }
    expect(pantallasSimuladas({ env, empaquetada: true })).toBeNull()
    expect(
      pantallasSimuladas({ env: { SHINOBI_PANTALLAS_SIMULADAS: 'no json' }, empaquetada: false })
    ).toBeNull()
    const screen = pantallasSimuladas({ env, empaquetada: false })
    expect(screen?.getAllDisplays()).toHaveLength(2)
    const puerto = (
      globalThis as { __shinobiPruebas?: { pantallas?: { quitar(id: number): void } } }
    ).__shinobiPruebas?.pantallas
    puerto?.quitar(22)
    expect(screen?.getAllDisplays()).toHaveLength(1)
    delete (globalThis as { __shinobiPruebas?: unknown }).__shinobiPruebas
  })
})
