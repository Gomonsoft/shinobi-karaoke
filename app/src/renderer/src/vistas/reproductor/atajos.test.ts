import { describe, expect, it } from 'vitest'
import { accionDeTeclaReproductor, type AccionReproductor } from './atajos'

const opciones = { origen: 'editor', vozDisponible: true, focoEnBoton: false } as const
const tecla = (key: string) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  isComposing: false
})

describe('atajos del reproductor', () => {
  it.each<[string, AccionReproductor]>([
    [' ', { tipo: 'alternar' }],
    ['k', { tipo: 'alternar' }],
    ['ArrowLeft', { tipo: 'saltar', deltaMs: -5000 }],
    ['ArrowRight', { tipo: 'saltar', deltaMs: 5000 }],
    ['j', { tipo: 'saltar', deltaMs: -10000 }],
    ['l', { tipo: 'saltar', deltaMs: 10000 }],
    ['ArrowUp', { tipo: 'volumen', delta: 0.1 }],
    ['ArrowDown', { tipo: 'volumen', delta: -0.1 }],
    ['m', { tipo: 'silenciar' }],
    ['v', { tipo: 'voz' }],
    ['Home', { tipo: 'principio' }],
    ['0', { tipo: 'principio' }],
    ['f', { tipo: 'pantalla_completa' }],
    ['Escape', { tipo: 'salir' }],
    [',', { tipo: 'desplazar', deltaMs: -100 }],
    ['.', { tipo: 'desplazar', deltaMs: 100 }],
    ['F1', { tipo: 'atajos' }],
    ['?', { tipo: 'atajos' }]
  ])('interpreta %j', (key, accion) => {
    expect(accionDeTeclaReproductor(tecla(key), opciones)).toEqual(accion)
  })

  it.each(['ctrlKey', 'metaKey', 'altKey', 'isComposing'] as const)(
    'ignora %s incluso para F1',
    (modificador) => {
      expect(accionDeTeclaReproductor({ ...tecla('F1'), [modificador]: true }, opciones)).toBeNull()
    }
  )

  it('Mayús cuenta para ? y para las flechas de voz, si hay voz', () => {
    const conMayus = (key: string) => ({ ...tecla(key), shiftKey: true })
    expect(accionDeTeclaReproductor(conMayus('?'), opciones)).toEqual({ tipo: 'atajos' })
    expect(accionDeTeclaReproductor(conMayus('ArrowUp'), opciones)).toEqual({
      tipo: 'nivel_voz',
      delta: 0.1
    })
    expect(accionDeTeclaReproductor(conMayus('ArrowDown'), opciones)).toEqual({
      tipo: 'nivel_voz',
      delta: -0.1
    })
    expect(
      accionDeTeclaReproductor(conMayus('ArrowUp'), { ...opciones, vozDisponible: false })
    ).toBeNull()
    expect(accionDeTeclaReproductor(conMayus('K'), opciones)).toBeNull()
  })

  it('respeta los botones y limita los atajos al origen y a la disponibilidad', () => {
    expect(accionDeTeclaReproductor(tecla(' '), { ...opciones, focoEnBoton: true })).toBeNull()
    expect(accionDeTeclaReproductor(tecla('Enter'), { ...opciones, focoEnBoton: true })).toBeNull()
    expect(accionDeTeclaReproductor(tecla('k'), { ...opciones, focoEnBoton: true })).toEqual({
      tipo: 'alternar'
    })
    expect(accionDeTeclaReproductor(tecla('v'), { ...opciones, vozDisponible: false })).toBeNull()
    expect(accionDeTeclaReproductor(tecla('.'), { ...opciones, origen: 'biblioteca' })).toBeNull()
    expect(accionDeTeclaReproductor(tecla('Tab'), opciones)).toBeNull()
  })
})
