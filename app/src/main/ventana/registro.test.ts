import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { CANALES } from '../../shared/canales'
import { RegistroVentanas, type VentanaRegistrable } from './registro'

function ventana(): VentanaRegistrable & EventEmitter {
  return Object.assign(new EventEmitter(), { webContents: { send: vi.fn() } })
}

describe('RegistroVentanas', () => {
  it('asigna roles por identidad de webContents', () => {
    const registro = new RegistroVentanas()
    const p = ventana()
    const s = ventana()
    registro.registrar(p, 'principal')
    registro.registrar(s, 'secundaria')
    expect(registro.principal()).toBe(p)
    expect(registro.secundaria()).toBe(s)
    expect(registro.rolDe(p.webContents)).toBe('principal')
    expect(registro.rolDe(s.webContents)).toBe('secundaria')
    expect(registro.rolDe({})).toBeNull()
    expect(registro.rolDe(null)).toBeNull()
  })

  it('da de baja al cerrarse y no confunde una ventana nueva', () => {
    const registro = new RegistroVentanas()
    const vieja = ventana()
    registro.registrar(vieja, 'principal')
    vieja.emit('closed')
    expect(registro.principal()).toBeNull()
    expect(registro.rolDe(vieja.webContents)).toBeNull()
    const nueva = ventana()
    registro.registrar(nueva, 'principal')
    vieja.emit('closed')
    expect(registro.principal()).toBe(nueva)
  })

  it('no admite dos ventanas con el mismo rol', () => {
    const registro = new RegistroVentanas()
    registro.registrar(ventana(), 'secundaria')
    expect(() => registro.registrar(ventana(), 'secundaria')).toThrow()
  })

  it('enviarA dirige el evento solo a la ventana con ese rol', () => {
    const registro = new RegistroVentanas()
    const p = ventana()
    const s = ventana()
    registro.registrar(p, 'principal')
    registro.registrar(s, 'secundaria')
    registro.enviarA('principal', CANALES.eventos.cancion, { id: 'a' })
    expect(p.webContents.send).toHaveBeenCalledWith(CANALES.eventos.cancion, { id: 'a' })
    expect(s.webContents.send).not.toHaveBeenCalled()
    registro.enviarA('secundaria', CANALES.eventos.sesionComando, 1)
    expect(s.webContents.send).toHaveBeenCalledWith(CANALES.eventos.sesionComando, 1)
    expect(p.webContents.send).toHaveBeenCalledTimes(1)
  })

  it('enviarA no falla si el rol no tiene ventana ni si el webContents está destruido', () => {
    const registro = new RegistroVentanas()
    expect(() => registro.enviarA('principal', 'x', 1)).not.toThrow()
    const p = ventana()
    Object.assign(p.webContents, { isDestroyed: () => true })
    registro.registrar(p, 'principal')
    registro.enviarA('principal', 'x', 1)
    expect(p.webContents.send).not.toHaveBeenCalled()
  })
})
