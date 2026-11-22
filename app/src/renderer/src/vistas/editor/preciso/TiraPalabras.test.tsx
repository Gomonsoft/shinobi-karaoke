import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { PalabraBorrador } from '@shared/letras'
import { TiraPalabras } from './TiraPalabras'

const palabras: PalabraBorrador[] = [
  { texto: 'Is', inicio_ms: 12000, fin_ms: 12200, marcada: true },
  { texto: 'this', inicio_ms: 12200, fin_ms: 12600, marcada: false },
  { texto: 'real?', inicio_ms: 12600, fin_ms: 13000, marcada: false }
]
const vista = { inicioMs: 11750, finMs: 13250 }

function montar(seleccionada = 0) {
  const alSeleccionar = vi.fn()
  const alEscucharPalabra = vi.fn()
  render(
    <TiraPalabras
      palabras={palabras}
      seleccionada={seleccionada}
      vista={vista}
      alSeleccionar={alSeleccionar}
      alEscucharPalabra={alEscucharPalabra}
    />
  )
  return { alSeleccionar, alEscucharPalabra, lista: screen.getByRole('listbox') }
}

it('es un listbox horizontal con una opción por palabra y su estado en el nombre', () => {
  const { lista } = montar()
  expect(lista).toHaveAttribute('aria-orientation', 'horizontal')
  expect(lista).toHaveAccessibleName('Palabras de la línea')
  const o = screen.getAllByRole('option')
  expect(o).toHaveLength(3)
  expect(o[0]).toHaveAccessibleName('Palabra 1 de 3, Is, de 00:12.00 a 00:12.20, marcada a mano')
  expect(o[1]).toHaveAccessibleName('Palabra 2 de 3, this, de 00:12.20 a 00:12.60, sin marcar')
  expect(o.map((x) => x.tabIndex)).toEqual([0, -1, -1])
  expect(o[0]).toHaveAttribute('aria-selected', 'true')
})

it('clic selecciona, doble clic escucha y las flechas / Inicio / Fin mueven la selección', () => {
  const { alSeleccionar, alEscucharPalabra, lista } = montar(1)
  const o = screen.getAllByRole('option')
  fireEvent.click(o[2]!)
  expect(alSeleccionar).toHaveBeenLastCalledWith(2)
  fireEvent.doubleClick(o[2]!)
  expect(alEscucharPalabra).toHaveBeenCalledWith(2)
  fireEvent.keyDown(lista, { key: 'ArrowRight' })
  expect(alSeleccionar).toHaveBeenLastCalledWith(2)
  fireEvent.keyDown(lista, { key: 'ArrowLeft' })
  expect(alSeleccionar).toHaveBeenLastCalledWith(0)
  fireEvent.keyDown(lista, { key: 'End' })
  expect(alSeleccionar).toHaveBeenLastCalledWith(2)
  fireEvent.keyDown(lista, { key: 'Home' })
  expect(alSeleccionar).toHaveBeenLastCalledWith(0)
})

it('con Alt o Ctrl las flechas no cambian la selección (son de los tiradores)', () => {
  const { alSeleccionar, lista } = montar(1)
  fireEvent.keyDown(lista, { key: 'ArrowRight', altKey: true })
  expect(alSeleccionar).not.toHaveBeenCalled()
})
