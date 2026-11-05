import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { puertosDeElectron, puertosDePruebas, ventanaDeElectron } from './puertos'

describe('puertosDePruebas', () => {
  it('se ignora empaquetada o sin variable', () => {
    expect(puertosDePruebas({ env: { SHINOBI_AVISOS_PRUEBAS: 'x' }, empaquetada: true })).toBeNull()
    expect(puertosDePruebas({ env: {}, empaquetada: false })).toBeNull()
  })
  it('registra una línea JSON por llamada y la ventana está sin foco', () => {
    const dir = mkdtempSync(join(tmpdir(), 'avisos-'))
    try {
      const archivo = join(dir, 'registro.jsonl')
      const p = puertosDePruebas({ env: { SHINOBI_AVISOS_PRUEBAS: archivo }, empaquetada: false })!
      const traer = vi.fn()
      const v = p.ventana({ enfocada: () => true, parpadear: () => undefined, traer })
      expect(v.enfocada()).toBe(false)
      p.notificador.mostrar({
        titulo: 't',
        cuerpo: 'hola',
        alClic: () => undefined,
        alFallar: () => undefined
      })
      p.dock.rebotar()
      p.dock.fijarInsignia('2')
      v.parpadear(true)
      v.traer()
      const lineas = readFileSync(archivo, 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l))
      expect(lineas).toEqual([
        { tipo: 'notificacion', cuerpo: 'hola' },
        { tipo: 'rebote' },
        { tipo: 'insignia', texto: '2' },
        { tipo: 'parpadeo', activo: true }
      ])
      expect(traer).toHaveBeenCalled()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('adaptadores de Electron', () => {
  it('la ventana minimizada o sin foco no cuenta como enfocada; traer la restaura', () => {
    const v = {
      isFocused: () => true,
      isMinimized: () => true,
      isVisible: () => true,
      flashFrame: vi.fn(),
      show: vi.fn(),
      restore: vi.fn(),
      focus: vi.fn()
    }
    const w = ventanaDeElectron(v)
    expect(w.enfocada()).toBe(false)
    w.traer()
    expect(v.restore).toHaveBeenCalled()
    expect(v.focus).toHaveBeenCalled()
    w.parpadear(true)
    expect(v.flashFrame).toHaveBeenCalledWith(true)
  })
  it('la notificación enlaza click y failed; el Dock puede no existir (Windows/Linux)', () => {
    const on = vi.fn()
    const show = vi.fn()
    class N {
      on = on
      show = show
    }
    const p = puertosDeElectron({
      Notification: Object.assign(N, { isSupported: () => true }) as never,
      dock: undefined
    })
    expect(p.notificador.soportado()).toBe(true)
    p.notificador.mostrar({
      titulo: 't',
      cuerpo: 'c',
      alClic: () => undefined,
      alFallar: () => undefined
    })
    expect(on.mock.calls.map((c) => c[0])).toEqual(['click', 'failed'])
    expect(show).toHaveBeenCalled()
    expect(() => {
      p.dock.rebotar()
      p.dock.fijarInsignia('1')
    }).not.toThrow()
  })
})
