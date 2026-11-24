import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { estiloPredeterminado } from '@shared/estilo'
import { linea, letra as letraBase } from '@shared/__fixtures__'
import type { Letra } from '@shared/letra'
import { anadirCantante, asignar, renombrar } from '@shared/reparto'
import { ListaLineas } from './ListaLineas'
import { MenuQuienCanta } from './MenuQuienCanta'

const base = (): Letra => letraBase([linea('a', 'Uno', 1000), linea('b', 'Dos', 3000)])
const estilo = estiloPredeterminado()

function montar(letra: Letra, ids: string[] = ['a']) {
  const p = { elegir: vi.fn(), anadir: vi.fn(), nombres: vi.fn(), cerrar: vi.fn() }
  render(<MenuQuienCanta letra={letra} estilo={estilo} ids={ids} ancla={{ x: 10, y: 10 }} {...p} />)
  return p
}
const entradas = () =>
  Array.from(document.querySelectorAll('[role^="menuitem"]')).map((i) =>
    (i.textContent ?? '').replace(/\s+/g, ' ')
  )

it('un solo cantante: Cantante 1 ✓, Coro, separador y Añadir; sin Todos ni Nombres', () => {
  montar(base())
  expect(entradas()).toEqual(
    ['Cantante 1', 'Coro', 'Añadir cantante'].map((t) => expect.stringContaining(t))
  )
  expect(screen.queryByText(/Todos/)).toBeNull()
  expect(screen.queryByText(/Nombres de los cantantes/)).toBeNull()
  expect(screen.getByRole('menuitemradio', { name: /Cantante 1/ })).toBeChecked()
  expect(screen.getAllByRole('separator')).toHaveLength(1)
})

it('dueto: Todos (los dos) va al final, tras un separador, antes de Añadir y Nombres', () => {
  montar(renombrar(anadirCantante(base()), 'c1', 'Ana'))
  expect(entradas()).toEqual([
    expect.stringContaining('Cantante 1 · Ana'),
    expect.stringContaining('Cantante 2'),
    expect.stringContaining('Coro'),
    expect.stringContaining('Todos (los dos)'),
    expect.stringContaining('Añadir cantante'),
    expect.stringContaining('Nombres de los cantantes…')
  ])
  expect(screen.getAllByRole('separator')).toHaveLength(2)
})

it('con 3 cantantes Todos va junto a los cantantes; con 4 ya no hay Añadir', () => {
  const tres = anadirCantante(anadirCantante(base()))
  montar(tres)
  expect(entradas().findIndex((t) => t.startsWith('Todos'))).toBe(3)
  expect(screen.getByRole('menuitem', { name: /Añadir cantante/ })).toBeVisible()
  expect(screen.getByRole('menuitem', { name: /Nombres de los cantantes/ })).toBeVisible()
})

it('1–4, T, C y A eligen; un número sin cantante no hace nada; Esc cierra devolviendo el foco', () => {
  const p = montar(anadirCantante(base()))
  const menu = screen.getByRole('menu')
  fireEvent.keyDown(menu, { key: '2' })
  expect(p.elegir).toHaveBeenLastCalledWith('c2')
  fireEvent.keyDown(menu, { key: '3' })
  expect(p.elegir).toHaveBeenCalledTimes(1)
  fireEvent.keyDown(menu, { key: 't' })
  expect(p.elegir).toHaveBeenLastCalledWith('todos')
  fireEvent.keyDown(menu, { key: 'c' })
  expect(p.elegir).toHaveBeenLastCalledWith('coro')
  fireEvent.keyDown(menu, { key: 'a' })
  expect(p.anadir).toHaveBeenCalledTimes(1)
  fireEvent.keyDown(menu, { key: 'Escape' })
  expect(p.cerrar).toHaveBeenLastCalledWith(true)
})

it('marca ✓ la parte común de las seleccionadas y ninguna si son distintas', () => {
  const duo = asignar(anadirCantante(base()), ['b'], 'c2')
  montar(duo, ['a', 'b'])
  expect(screen.queryAllByRole('menuitemradio', { checked: true })).toHaveLength(0)
})

it('el chip de la lista abre el menú; sin reparto no hay chip', () => {
  const abrir = vi.fn()
  const duo = asignar(anadirCantante(base()), ['b'], 'c2')
  const { rerender } = render(
    <ListaLineas
      letra={duo}
      estilo={estilo}
      seleccion="a"
      actual={-1}
      foco={0}
      seleccionar={vi.fn()}
      escuchar={vi.fn()}
      corregir={vi.fn()}
      abrirQuienCanta={abrir}
    />
  )
  const fila = screen.getAllByRole('option')[1]!
  fireEvent.click(within(fila).getByText('2'))
  expect(abrir).toHaveBeenCalledTimes(1)
  rerender(
    <ListaLineas
      letra={base()}
      estilo={estilo}
      seleccion="a"
      actual={-1}
      foco={0}
      seleccionar={vi.fn()}
      escuchar={vi.fn()}
      corregir={vi.fn()}
    />
  )
  expect(document.querySelector('[data-chip-parte]')).toBeNull()
})
