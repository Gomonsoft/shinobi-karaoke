import { expect, it } from 'vitest'
import type { BorradorLinea } from '@shared/letras'
import {
  estadoInicial,
  hayCambios,
  reducirPreciso,
  type EstadoPreciso,
  type MarcaPasada
} from './estadoPreciso'

const palabra = (texto: string, inicio_ms: number, fin_ms: number, marcada = false) => ({
  texto,
  inicio_ms,
  fin_ms,
  marcada
})
const base: BorradorLinea = {
  texto: 'a b c',
  inicio_ms: 0,
  fin_ms: 3000,
  quitar: false,
  palabras: [palabra('a', 0, 1000), palabra('b', 1000, 2000), palabra('c', 2000, 3000)]
}
const marcada = (b: BorradorLinea, k: number, ms: number): BorradorLinea => ({
  ...b,
  palabras: b.palabras.map((p, i) => (i === k ? { ...p, inicio_ms: ms, marcada: true } : p))
})

it('abre con la primera palabra sin marcar seleccionada y sin cambios', () => {
  const e = estadoInicial({
    ...base,
    palabras: [palabra('a', 0, 1000, true), ...base.palabras.slice(1)]
  })
  expect(e.seleccionada).toBe(1)
  expect(hayCambios(e)).toBe(false)
})

it('cada operación es un paso; deshacer y rehacer solo tocan el borrador', () => {
  let e = estadoInicial(base)
  e = reducirPreciso(e, { tipo: 'cambiar', borrador: marcada(base, 0, 100) })
  e = reducirPreciso(e, { tipo: 'cambiar', borrador: marcada(e.actual, 1, 1100) })
  expect(e.pasado).toHaveLength(2)
  expect(hayCambios(e)).toBe(true)
  e = reducirPreciso(e, { tipo: 'deshacer' })
  expect(e.actual.palabras[1]!.marcada).toBe(false)
  e = reducirPreciso(e, { tipo: 'deshacer' })
  expect(hayCambios(e)).toBe(false)
  e = reducirPreciso(e, { tipo: 'rehacer' })
  expect(e.actual.palabras[0]!.marcada).toBe(true)
  e = reducirPreciso(e, { tipo: 'cambiar', borrador: marcada(e.actual, 2, 2100) })
  expect(e.futuro).toHaveLength(0)
})

it('un cambio idéntico no añade paso', () => {
  const e = reducirPreciso(estadoInicial(base), { tipo: 'cambiar', borrador: { ...base } })
  expect(e.pasado).toHaveLength(0)
})

it('pasada: la primera marca fija su inicio, el reinicio vuelve a él y Retroceso deshace la última', () => {
  let e: EstadoPreciso = estadoInicial(base)
  const m1: MarcaPasada = { k: 0, antes: e.actual, ms: 100 }
  e = reducirPreciso(e, {
    tipo: 'marca',
    borrador: marcada(e.actual, 0, 100),
    marca: m1,
    siguiente: 1
  })
  const m2: MarcaPasada = { k: 1, antes: e.actual, ms: 1100 }
  e = reducirPreciso(e, {
    tipo: 'marca',
    borrador: marcada(e.actual, 1, 1100),
    marca: m2,
    siguiente: 2
  })
  expect(e.seleccionada).toBe(2)
  expect(e.inicioPasada).toBe(0)
  e = reducirPreciso(e, { tipo: 'reiniciarPasada' })
  expect(e.seleccionada).toBe(0)
  e = reducirPreciso(e, { tipo: 'retroceso' })
  expect(e.seleccionada).toBe(1)
  expect(e.actual.palabras[1]!.marcada).toBe(false)
  expect(e.actual.palabras[0]!.marcada).toBe(true)
  e = reducirPreciso(e, { tipo: 'retroceso' })
  expect(e.actual).toEqual(base)
  expect(reducirPreciso(e, { tipo: 'retroceso' })).toBe(e)
})

it('seleccionar a mano empieza una pasada nueva', () => {
  let e = estadoInicial(base)
  e = reducirPreciso(e, {
    tipo: 'marca',
    borrador: marcada(base, 0, 100),
    marca: { k: 0, antes: base, ms: 100 },
    siguiente: 1
  })
  e = reducirPreciso(e, { tipo: 'seleccionar', indice: 2 })
  expect(e.inicioPasada).toBeNull()
  expect(e.seleccionada).toBe(2)
})
