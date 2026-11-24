import { expect, it } from 'vitest'
import { letra as crear, linea } from '@shared/__fixtures__'
import type { Letra } from '@shared/letra'
import { anadirCantante, asignar } from '@shared/reparto'
import { lineasQueSuenanALaVez, solapeAlAsignar, subfilasJuntas } from './partes'

/** Ana canta de 2 a 6 s y Luis responde de 5 a 8 s; Ana vuelve a las 9 s. */
function duo(): Letra {
  const base = anadirCantante(
    crear([
      linea('a', 'Primera voz', 2000, { fin_ms: 6000 }),
      linea('l', 'Responde la otra', 5000, { fin_ms: 8000 }),
      linea('b', 'Vuelve la primera', 9000, { fin_ms: 11_000 })
    ])
  )
  return asignar(base, ['l'], 'c2')
}

it('marca la línea que empieza mientras suena otra y dice cuál es', () => {
  const m = lineasQueSuenanALaVez(duo(), 20_000)
  expect([...m]).toEqual([['l', 1]])
})

it('sin solapes no marca nada', () => {
  const sin = asignar(
    anadirCantante(
      crear([linea('a', 'Uno', 1000), linea('b', 'Dos', 3000), linea('c', 'Tres', 5000)])
    ),
    ['b'],
    'c2'
  )
  expect(lineasQueSuenanALaVez(sin, 20_000).size).toBe(0)
})

it('pasar a la misma parte dos líneas que se pisan se rechaza y dice con cuál', () => {
  expect(solapeAlAsignar(duo(), ['l'], 'c1')).toBe(1)
  expect(solapeAlAsignar(duo(), ['b'], 'c2')).toBeNull()
  // «Todos» cuenta como de todos los cantantes: choca con las dos voces, no con el coro.
  expect(solapeAlAsignar(duo(), ['l'], 'todos')).toBe(1)
  expect(solapeAlAsignar(duo(), ['l'], 'coro')).toBeNull()
})

it('sin partes, una canción de un solo cantante nunca rechaza una asignación por solape', () => {
  const una = crear([linea('a', 'Uno', 1000), linea('b', 'Dos', 3000)])
  expect(solapeAlAsignar(una, ['a'], 'coro')).toBeNull()
  expect(lineasQueSuenanALaVez(una, 20_000).size).toBe(0)
})

it('subfilasJuntas: k es el máximo de líneas a la vez, estable y 1 sin solapes', () => {
  const r = (id: string, a: number, b: number) => ({ id, real: { inicioMs: a, finMs: b } })
  const orden = (id: string) => (id === 'c' ? 0 : 1)
  const dos = subfilasJuntas([r('a', 0, 5), r('b', 3, 8), r('c', 5, 9)], orden)
  expect(dos.k).toBe(2)
  expect([...dos.sub]).toEqual([
    ['a', 0],
    ['b', 1],
    ['c', 0]
  ])
  expect(subfilasJuntas([r('a', 0, 5), r('b', 5, 8)], orden).k).toBe(1)
  expect(subfilasJuntas([r('a', 0, 9), r('b', 1, 8), r('c', 2, 7)], orden).k).toBe(3)
})
