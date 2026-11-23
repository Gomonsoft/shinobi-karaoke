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

it('feature 11: R y N, y Ctrl/Cmd + ↓ / ↑ para las líneas dudosas; nada en campos de texto ni al ritmo', () => {
  expect(accionDeTecla(tecla('r'), opciones)).toEqual({ tipo: 'revisar' })
  expect(accionDeTecla(tecla('n'), opciones)).toEqual({ tipo: 'revision_bien' })
  expect(accionDeTecla(tecla('ArrowDown', { ctrlKey: true }), opciones)).toEqual({
    tipo: 'dudosa',
    sentido: 1
  })
  expect(accionDeTecla(tecla('ArrowUp', { metaKey: true }), opciones)).toEqual({
    tipo: 'dudosa',
    sentido: -1
  })
  const campo = { ...opciones, enCampoTexto: true }
  const ritmo = { ...opciones, sync: true }
  for (const t of [tecla('r'), tecla('n'), tecla('ArrowDown', { ctrlKey: true })]) {
    expect(accionDeTecla(t, campo)).toBeNull()
    expect(accionDeTecla(t, ritmo)).toBeNull()
  }
  // Cmd + R (recargar) y Mayús + R no son el atajo.
  expect(accionDeTecla(tecla('r', { metaKey: true }), opciones)).toBeNull()
  expect(accionDeTecla(tecla('R', { shiftKey: true }), opciones)).toBeNull()
})

// --- Reparto (0.2.3 · feature 1) ---
const con = (key: string, code: string, extra: Partial<KeyboardEvent> = {}) =>
  tecla(key, { code, ...extra })

it('C abre «¿Quién canta?» fuera de campos de texto, sin Mayús y fuera del modo al ritmo', () => {
  expect(accionDeTecla(con('c', 'KeyC'), opciones)).toEqual({ tipo: 'quien_canta' })
  expect(accionDeTecla(con('c', 'KeyC'), { ...opciones, enCampoTexto: true })).toBeNull()
  expect(accionDeTecla(con('c', 'KeyC'), { ...opciones, sync: true })).toBeNull()
  expect(accionDeTecla(con('C', 'KeyC', { shiftKey: true }), opciones)).toBeNull()
  expect(accionDeTecla(con('c', 'KeyC', { ctrlKey: true }), opciones)).toBeNull()
})

it.each([
  ['1', 'Digit1', 1],
  ['2', 'Digit2', 2],
  ['@', 'Digit2', 2], // distribución española con Mayús
  ['¡', 'Digit1', 1], // Opción + 1 en macOS cambia `key`
  ['4', 'Digit4', 4]
])('Alt + %s (%s) asigna al cantante %i leyendo la tecla física', (key, code, n) => {
  expect(accionDeTecla(con(key, code, { altKey: true }), opciones)).toEqual({
    tipo: 'parte_n',
    n
  })
})

it('Alt + número no actúa con AltGr (Ctrl + Alt), Cmd, campos de texto ni al ritmo; 5 no existe', () => {
  const alt = { altKey: true }
  expect(accionDeTecla(con('|', 'Digit1', { ...alt, ctrlKey: true }), opciones)).toBeNull()
  expect(accionDeTecla(con('1', 'Digit1', { ...alt, metaKey: true }), opciones)).toBeNull()
  expect(accionDeTecla(con('1', 'Digit1', alt), { ...opciones, enCampoTexto: true })).toBeNull()
  expect(accionDeTecla(con('1', 'Digit1', alt), { ...opciones, sync: true })).toBeNull()
  expect(accionDeTecla(con('5', 'Digit5', alt), opciones)).toBeNull()
  // El 1 sin Alt sigue escuchando la pista original.
  expect(accionDeTecla(con('1', 'Digit1'), opciones)).toEqual({ tipo: 'pista', pista: 'original' })
})

it('Alt + ↑/↓ va a la parte vecina solo con el foco en la lista o en una región', () => {
  const alt = { altKey: true }
  expect(accionDeTecla(tecla('ArrowDown', alt), { ...opciones, focoEn: 'lista' })).toEqual({
    tipo: 'parte_vecina',
    sentido: 1
  })
  expect(accionDeTecla(tecla('ArrowUp', alt), { ...opciones, focoEn: 'region' })).toEqual({
    tipo: 'parte_vecina',
    sentido: -1
  })
  expect(accionDeTecla(tecla('ArrowUp', alt), { ...opciones, focoEn: 'barra' })).toBeNull()
  expect(
    accionDeTecla(tecla('ArrowUp', alt), { ...opciones, focoEn: 'lista', sync: true })
  ).toBeNull()
})

it('Mayús + ↑/↓ extiende la selección en la lista; sin Mayús mueve una sola', () => {
  const lista = { ...opciones, focoEn: 'lista' as const }
  expect(accionDeTecla(tecla('ArrowDown', { shiftKey: true }), lista)).toMatchObject({
    tipo: 'mover_seleccion',
    extender: true
  })
  expect(accionDeTecla(tecla('ArrowDown'), lista)).toMatchObject({ extender: false })
})

it('sin reparto Alt + ↑/↓ no se captura (la canción de un solo cantante no cambia)', () => {
  expect(
    accionDeTecla(tecla('ArrowDown', { altKey: true }), {
      ...opciones,
      focoEn: 'lista',
      reparto: false
    })
  ).toBeNull()
})
