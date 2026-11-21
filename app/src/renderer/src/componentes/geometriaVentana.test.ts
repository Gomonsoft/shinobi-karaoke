import { expect, it } from 'vitest'
import {
  acotarGeometria,
  acotarPosicion,
  acotarTamano,
  esReducida,
  moverConTeclado,
  posicionInicial,
  redimensionarConTeclado,
  tamanoMaximo,
  tamanosDiseno
} from './geometriaVentana'

const { inicial, minimo } = tamanosDiseno(16)
const area = { left: 0, top: 48, width: 1366, height: 600 }
const lista = { left: 0, top: 48, width: 300, height: 500 }

it('los tamaños de diseño son 760 × 440 y 560 × 360', () => {
  expect(inicial).toEqual({ ancho: 760, alto: 440 })
  expect(minimo).toEqual({ ancho: 560, alto: 360 })
})

it('posición inicial: arriba + 12 y junto a la lista + 12', () => {
  expect(posicionInicial(area, lista, inicial)).toEqual({ x: 312, y: 12 })
})

it('si no cabe junto a la lista se desplaza a la izquierda; si no, se centra', () => {
  const estrecha = { ...area, width: 1000 }
  expect(posicionInicial(estrecha, lista, inicial)).toEqual({ x: 228, y: 12 })
  const muyEstrecha = { ...area, width: 770 }
  expect(posicionInicial(muyEstrecha, lista, inicial)).toEqual({ x: 5, y: 12 })
  expect(posicionInicial(area, null, inicial).x).toBe(303)
})

it('acota el tamaño entre mínimo y máximo (área − 16 por lado)', () => {
  expect(tamanoMaximo(area)).toEqual({ ancho: 1334, alto: 568 })
  expect(acotarTamano({ ancho: 100, alto: 100 }, area, minimo)).toEqual(minimo)
  expect(acotarTamano({ ancho: 5000, alto: 5000 }, area, minimo)).toEqual({
    ancho: 1334,
    alto: 568
  })
})

it('la ventana queda entera dentro del área', () => {
  expect(acotarPosicion({ x: -50, y: 900 }, inicial, area)).toEqual({ x: 0, y: 160 })
  expect(acotarPosicion({ x: 2000, y: 0 }, inicial, area)).toEqual({ x: 606, y: 0 })
})

it('por debajo del mínimo ocupa el área menos 16 px por lado y no se mueve', () => {
  const pequena = { left: 0, top: 0, width: 500, height: 300 }
  expect(esReducida(pequena, minimo)).toBe(true)
  expect(acotarGeometria({ x: 100, y: 100, ...inicial }, pequena, minimo)).toEqual({
    x: 16,
    y: 16,
    ancho: 468,
    alto: 268
  })
})

it('teclado de mover: 16 px, Mayús 64, Inicio y topes', () => {
  const g = { x: 100, y: 100, ...inicial }
  const base = { x: 312, y: 12 }
  expect(moverConTeclado(g, 'ArrowRight', false, base, area)).toEqual({ x: 116, y: 100 })
  expect(moverConTeclado(g, 'ArrowUp', true, base, area)).toEqual({ x: 100, y: 36 })
  expect(moverConTeclado(g, 'Home', false, base, area)).toEqual(base)
  expect(moverConTeclado({ ...g, x: 2 }, 'ArrowLeft', true, base, area)).toEqual({ x: 0, y: 100 })
  expect(moverConTeclado(g, 'a', false, base, area)).toBeNull()
})

it('teclado de tamaño: ±16 / 64, Inicio y topes', () => {
  expect(redimensionarConTeclado(inicial, 'ArrowRight', false, inicial, area, minimo)).toEqual({
    ancho: 776,
    alto: 440
  })
  expect(redimensionarConTeclado(inicial, 'ArrowUp', true, inicial, area, minimo)).toEqual({
    ancho: 760,
    alto: 376
  })
  expect(
    redimensionarConTeclado({ ancho: 560, alto: 360 }, 'ArrowLeft', false, inicial, area, minimo)
  ).toEqual(minimo)
  expect(
    redimensionarConTeclado({ ancho: 900, alto: 500 }, 'Home', false, inicial, area, minimo)
  ).toEqual(inicial)
})
