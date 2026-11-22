import { expect, it } from 'vitest'
import { resolverTecla, type TeclaPreciso } from './atajosPreciso'

const t = (key: string, extra: Partial<TeclaPreciso> = {}): TeclaPreciso => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...extra
})

it('tabla de teclas con el foco fuera de un campo', () => {
  expect(resolverTecla(t(' '), 'general')).toEqual({ tipo: 'bucle' })
  expect(resolverTecla(t(' ', { shiftKey: true }), 'general')).toEqual({ tipo: 'escucharPalabra' })
  expect(resolverTecla(t('Backspace'), 'general')).toEqual({ tipo: 'retroceso' })
  expect(resolverTecla(t('i'), 'general')).toEqual({ tipo: 'fijar', campo: 'inicio' })
  expect(resolverTecla(t('O'), 'general')).toEqual({ tipo: 'fijar', campo: 'fin' })
  expect(resolverTecla(t('ArrowUp'), 'general')).toEqual({ tipo: 'linea', sentido: -1 })
  expect(resolverTecla(t('2'), 'general')).toEqual({ tipo: 'pista', indice: 2 })
  expect(resolverTecla(t('Escape'), 'general')).toEqual({ tipo: 'cerrar' })
  expect(resolverTecla(t('z', { ctrlKey: true }), 'general')).toEqual({ tipo: 'deshacer' })
  expect(resolverTecla(t('z', { metaKey: true, shiftKey: true }), 'general')).toEqual({
    tipo: 'rehacer'
  })
  expect(resolverTecla(t('y', { ctrlKey: true }), 'general')).toEqual({ tipo: 'rehacer' })
  expect(resolverTecla(t('Enter', { ctrlKey: true }), 'general')).toEqual({ tipo: 'aplicar' })
})

it('Alt ajusta el inicio y Ctrl el fin, 10 ms (Mayús 100)', () => {
  expect(resolverTecla(t('ArrowRight', { altKey: true }), 'general')).toEqual({
    tipo: 'ajustar',
    campo: 'inicio',
    deltaMs: 10
  })
  expect(resolverTecla(t('ArrowLeft', { ctrlKey: true, shiftKey: true }), 'general')).toEqual({
    tipo: 'ajustar',
    campo: 'fin',
    deltaMs: -100
  })
})

it('los atajos del editor no actúan en la ventana', () => {
  for (const tecla of [
    t('l'),
    t('L', { shiftKey: true }),
    t('p'),
    t('Delete'),
    t('f'),
    t('e', { ctrlKey: true })
  ]) {
    expect(resolverTecla(tecla, 'general')).toEqual({ tipo: 'ignorar' })
  }
})

it('en un campo de texto solo Ctrl/Cmd + Intro', () => {
  expect(resolverTecla(t('i'), 'campo')).toBeNull()
  expect(resolverTecla(t(' '), 'campo')).toBeNull()
  expect(resolverTecla(t('Escape'), 'campo')).toBeNull()
  expect(resolverTecla(t('Enter', { ctrlKey: true }), 'campo')).toEqual({ tipo: 'aplicar' })
})

it('sobre un botón o un grupo de opciones, Espacio y ↑/↓ son del control', () => {
  expect(resolverTecla(t(' '), 'control')).toBeNull()
  expect(resolverTecla(t('ArrowDown'), 'control')).toBeNull()
  expect(resolverTecla(t('i'), 'control')).toEqual({ tipo: 'fijar', campo: 'inicio' })
})
