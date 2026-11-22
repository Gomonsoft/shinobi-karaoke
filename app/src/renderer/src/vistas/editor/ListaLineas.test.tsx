import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { letra, linea } from '@shared/__fixtures__'
import { ListaLineas } from './ListaLineas'

function montar(extra: Partial<Parameters<typeof ListaLineas>[0]> = {}) {
  const props = {
    seleccionar: vi.fn(),
    escuchar: vi.fn(),
    escucharLinea: vi.fn(),
    borrarTiempos: vi.fn(),
    abrirPreciso: vi.fn(),
    corregir: vi.fn()
  }
  render(
    <ListaLineas
      letra={letra([linea('a', 'Uno', 1000), linea('b', 'Dos', 3000)])}
      seleccion="b"
      actual={-1}
      foco={0}
      {...props}
      {...extra}
    />
  )
  return props
}
const fila = () => screen.getAllByRole('option')[1]!

it('el clic secundario selecciona la fila y abre el menú con las acciones de la spec', () => {
  const p = montar()
  fireEvent.contextMenu(fila(), { clientX: 40, clientY: 60 })
  expect(p.seleccionar).toHaveBeenCalledWith('b')
  const items = screen.getAllByRole('menuitem').map((i) => i.textContent)
  expect(items).toEqual([
    'Editor preciso de línea… (P)',
    'Escuchar la línea (Mayús + L)',
    'Escuchar desde esta línea (L)',
    'Borrar tiempos de esta línea (Supr)'
  ])
  expect(screen.getByRole('separator', { hidden: true })).toBeInTheDocument()
})

it('la tecla Menú y Mayús + F10 abren el menú y Esc devuelve el foco a la fila', () => {
  montar()
  fireEvent.keyDown(fila(), { key: 'ContextMenu' })
  expect(screen.getByRole('menu')).toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
  expect(screen.queryByRole('menu')).toBeNull()
  expect(fila()).toHaveFocus()
  fireEvent.keyDown(fila(), { key: 'F10', shiftKey: true })
  expect(screen.getByRole('menu')).toBeInTheDocument()
})

it('cada entrada llama a su acción y «Editor preciso» respeta el motivo de no disponible', () => {
  const p = montar()
  fireEvent.contextMenu(fila())
  fireEvent.click(screen.getByRole('menuitem', { name: /Editor preciso de línea/ }))
  expect(p.abrirPreciso).toHaveBeenCalledTimes(1)
  fireEvent.contextMenu(fila())
  fireEvent.click(screen.getByRole('menuitem', { name: /Escuchar la línea/ }))
  expect(p.escucharLinea).toHaveBeenCalledWith('b')
  fireEvent.contextMenu(fila())
  fireEvent.click(screen.getByRole('menuitem', { name: /Escuchar desde/ }))
  expect(p.escuchar).toHaveBeenCalledWith('b')
  fireEvent.contextMenu(fila())
  fireEvent.click(screen.getByRole('menuitem', { name: /Borrar tiempos/ }))
  expect(p.borrarTiempos).toHaveBeenCalledTimes(1)
})

it('sin poder abrirlo, la entrada del editor preciso queda aria-disabled y no actúa', () => {
  const p = montar({ motivoPreciso: 'Fija primero el inicio de esta línea.' })
  fireEvent.contextMenu(fila())
  const item = screen.getByRole('menuitem', { name: /Editor preciso de línea/ })
  expect(item).toHaveAttribute('aria-disabled', 'true')
  fireEvent.click(item)
  expect(p.abrirPreciso).not.toHaveBeenCalled()
})
