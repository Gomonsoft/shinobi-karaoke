import { expect, it } from 'vitest'
import { accionDeTecla, type FocoEditor } from './atajos'

const opciones = { enCampoTexto: false, sync: false, focoEn: 'otro' as FocoEditor }
const tecla = (key: string, modificadores: Partial<KeyboardEvent> = {}) => ({
  key,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...modificadores
})

it.each([
  [' ', 'reproducir'],
  ['Home', 'principio'],
  ['f', 'probar'],
  ['Backspace', 'borrar_tiempos'],
  ['Delete', 'borrar_tiempos'],
  ['Escape', 'escapar'],
  ['ArrowUp', 'mover_seleccion'],
  ['ArrowDown', 'mover_seleccion'],
  ['i', 'fijar_inicio'],
  ['o', 'fijar_fin'],
  ['l', 'escuchar_linea'],
  ['1', 'pista'],
  ['2', 'pista'],
  ['3', 'pista'],
  ['F1', 'atajos'],
  ['?', 'atajos']
])('%s activa %s', (key, tipo) => {
  expect(accionDeTecla(tecla(key), opciones)?.tipo).toBe(tipo)
})

it('respeta modificadores, controles, campos de texto y la fase del editor', () => {
  expect(accionDeTecla(tecla('ArrowLeft', { altKey: true }), opciones)).toEqual({
    tipo: 'ajustar_inicio',
    deltaMs: -10
  })
  expect(accionDeTecla(tecla('ArrowRight', { metaKey: true, shiftKey: true }), opciones)).toEqual({
    tipo: 'ajustar_fin',
    deltaMs: 100
  })
  expect(accionDeTecla(tecla('ArrowLeft'), { ...opciones, focoEn: 'barra' })).toEqual({
    tipo: 'buscar',
    deltaMs: -5000
  })
  expect(accionDeTecla(tecla('ArrowUp'), { ...opciones, focoEn: 'volumen' })).toBeNull()
  expect(
    accionDeTecla(tecla('z', { ctrlKey: true }), { ...opciones, enCampoTexto: true })
  ).toBeNull()
  expect(accionDeTecla(tecla('z', { metaKey: true }), opciones)).toEqual({ tipo: 'deshacer' })
  expect(accionDeTecla(tecla('Z', { ctrlKey: true, shiftKey: true }), opciones)).toEqual({
    tipo: 'rehacer'
  })
  expect(accionDeTecla(tecla('y', { ctrlKey: true }), { ...opciones, mac: true })).toBeNull()
  expect(accionDeTecla(tecla('y', { ctrlKey: true }), opciones)).toEqual({ tipo: 'rehacer' })
  expect(accionDeTecla(tecla('Enter'), { ...opciones, sync: true })).toEqual({ tipo: 'marcar' })
  expect(accionDeTecla(tecla('Enter', { repeat: true }), { ...opciones, sync: true })).toBeNull()
  expect(accionDeTecla(tecla('Backspace'), { ...opciones, sync: true })).toEqual({
    tipo: 'deshacer_marca'
  })
  expect(accionDeTecla(tecla('f'), { ...opciones, sync: true })).toBeNull()
  expect(accionDeTecla(tecla('f'), { ...opciones, enCampoTexto: true })).toBeNull()
  expect(accionDeTecla(tecla('f', { repeat: true }), opciones)).toBeNull()
})

it('con el foco en un divisor las flechas y Inicio son suyas, pero Espacio y el resto siguen', () => {
  const divisor = { ...opciones, focoEn: 'divisor' as FocoEditor }
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home']) {
    expect(accionDeTecla(tecla(key), divisor)).toBeNull()
    expect(accionDeTecla(tecla(key, { shiftKey: true }), divisor)).toBeNull()
  }
  expect(accionDeTecla(tecla(' '), divisor)).toEqual({ tipo: 'reproducir' })
  expect(accionDeTecla(tecla('i'), divisor)).toEqual({ tipo: 'fijar_inicio' })
  expect(accionDeTecla(tecla('Escape'), divisor)).toEqual({ tipo: 'escapar' })
})

it('S, coma y punto ya no hacen nada; Mayús + L escucha el tramo de la línea', () => {
  for (const key of ['s', 'S', ',', '.']) expect(accionDeTecla(tecla(key), opciones)).toBeNull()
  expect(accionDeTecla(tecla('L', { shiftKey: true }), opciones)).toEqual({
    tipo: 'escuchar_tramo_linea'
  })
  expect(accionDeTecla(tecla('L', { shiftKey: true }), { ...opciones, sync: true })).toBeNull()
  expect(
    accionDeTecla(tecla('L', { shiftKey: true }), { ...opciones, enCampoTexto: true })
  ).toBeNull()
})

it('P abre el editor preciso, salvo en el modo al ritmo', () => {
  expect(accionDeTecla(tecla('p'), opciones)).toEqual({ tipo: 'abrir_preciso' })
  expect(accionDeTecla(tecla('p'), { ...opciones, sync: true })).toBeNull()
})

it('Ctrl/Cmd + E exporta, salvo en un campo de texto', () => {
  expect(accionDeTecla(tecla('e', { ctrlKey: true }), opciones)?.tipo).toBe('exportar')
  expect(accionDeTecla(tecla('e', { metaKey: true }), opciones)?.tipo).toBe('exportar')
  expect(
    accionDeTecla(tecla('e', { ctrlKey: true }), { ...opciones, enCampoTexto: true })
  ).toBeNull()
  expect(accionDeTecla(tecla('e'), opciones)).toBeNull()
})
