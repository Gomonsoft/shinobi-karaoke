import { expect, it } from 'vitest'
import { linea } from '@shared/__fixtures__'
import { vecinaPendiente } from './useRevision'
import { motivoPrincipal } from './textos'

const letra = {
  lineas: [
    linea('a', 'A', 1000),
    linea('b', 'B', 2000),
    linea('c', 'C', 3000),
    linea('d', 'D', 4000)
  ]
}

it('va a la pendiente siguiente o anterior en el orden de la letra, con vuelta', () => {
  const pendientes = ['d', 'b']
  expect(vecinaPendiente(letra, pendientes, 'a', 1)).toEqual({ id: 'b', vuelta: false })
  expect(vecinaPendiente(letra, pendientes, 'b', 1)).toEqual({ id: 'd', vuelta: false })
  expect(vecinaPendiente(letra, pendientes, 'c', 1)).toEqual({ id: 'd', vuelta: false })
  expect(vecinaPendiente(letra, pendientes, 'd', 1)).toEqual({ id: 'b', vuelta: true })
  expect(vecinaPendiente(letra, pendientes, 'd', -1)).toEqual({ id: 'b', vuelta: false })
  expect(vecinaPendiente(letra, pendientes, 'b', -1)).toEqual({ id: 'd', vuelta: true })
})

it('sin selección empieza por la primera; sin pendientes no hay nada', () => {
  expect(vecinaPendiente(letra, ['c', 'b'], null, 1)).toEqual({ id: 'b', vuelta: false })
  expect(vecinaPendiente(letra, [], 'a', 1)).toBeNull()
})

it('R4: el motivo del fin automático usa su variante', () => {
  const base = {
    id: 'x',
    motivos: ['finTarde' as const],
    detalles: { finTarde: 3000 },
    prioridad: 1
  }
  expect(motivoPrincipal({ ...base, finAutomatico: true })).toBe(
    'El fin es automático y llega 3,0 s después de la voz.'
  )
  expect(motivoPrincipal({ ...base, finAutomatico: false })).toBe(
    'El fin llega 3,0 s después de la voz.'
  )
})
