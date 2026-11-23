import { createRef } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { estiloPredeterminado } from '@shared/estilo'
import { carriles, cantantesDe, type Parte } from '@shared/reparto'
import { cancionConReparto } from './fixturesApi'
import { PistaSincronia } from './PistaSincronia'

const letra = cancionConReparto().letra!
const noop = () => {}
const estilo = estiloPredeterminado()
const crearAsignar = () => vi.fn<(destino: Parte | 'nuevo', ids: string[]) => void>()

function montar(
  extra: {
    juntos?: boolean
    asignar?: ReturnType<typeof crearAsignar>
    seleccionadas?: string[]
  } = {}
) {
  const asignar = extra.asignar ?? crearAsignar()
  const cancelar = createRef<(() => boolean) | null>() as { current: (() => boolean) | null }
  render(
    <PistaSincronia
      letra={letra}
      seleccion="d1"
      seleccionadas={extra.seleccionadas}
      duracionMs={30_000}
      inactiva={false}
      sonando={false}
      posicionMs={0}
      obtenerTiempoAudio={() => 0}
      buscar={noop}
      seleccionar={noop}
      iniciarMarcador={() => false}
      moverMarcador={noop}
      terminarMarcador={noop}
      ajustarMarcador={noop}
      bordeArrastrado={undefined}
      limite={null}
      cancelarArrastreRef={cancelar}
      reparto={{
        carriles: carriles(letra),
        altoCarril: 32,
        juntos: extra.juntos ?? false,
        juntosPorEspacio: false,
        alternarJuntos: noop,
        estilo,
        cantantes: cantantesDe(letra).length,
        asignar
      }}
    />
  )
  return { asignar, cancelar }
}
const region = (texto: RegExp) => screen.getByRole('button', { name: texto })
const mover = (el: HTMLElement, y: number, x = 0) =>
  fireEvent.pointerMove(el, { pointerId: 1, clientX: x, clientY: y })

it('un carril por parte (Ana, Luis, Todos con líneas y Coro) con su etiqueta y sin nodos de más', () => {
  montar()
  const carrilesDom = document.querySelectorAll('[data-carril]')
  expect([...carrilesDom].map((c) => c.getAttribute('data-carril'))).toEqual([
    'c1',
    'c2',
    'todos',
    'coro'
  ])
  expect(screen.getAllByRole('button', { name: /Canta:/ })).toHaveLength(6)
  expect(within(document.querySelector('[data-carril="c2"]')!).getByText('Luis')).toBeVisible()
})

it('un clic o un gesto de menos de 8 px no arrastra; 8 px o más lleva la región al carril de destino', () => {
  const { asignar } = montar()
  const r = region(/Cruza el faro/)
  fireEvent.pointerDown(r, { button: 0, pointerId: 1, clientX: 50, clientY: 16 })
  mover(r, 20, 400) // 4 px en vertical, mucho en horizontal: sigue siendo un clic
  fireEvent.pointerUp(r, { pointerId: 1, clientX: 400, clientY: 20 })
  expect(asignar).not.toHaveBeenCalled()

  fireEvent.pointerDown(r, { button: 0, pointerId: 1, clientX: 50, clientY: 16 })
  mover(r, 16 + 40, 300) // baja al carril de Luis (y = 32..64)
  fireEvent.pointerUp(r, { pointerId: 1, clientX: 300, clientY: 40 })
  expect(asignar).toHaveBeenCalledExactlyOnceWith('c2', ['d1'])
})

it('Esc (cancelar) y soltar fuera de los carriles no asignan nada', () => {
  const { asignar, cancelar } = montar()
  const r = region(/Cruza el faro/)
  fireEvent.pointerDown(r, { button: 0, pointerId: 1, clientX: 0, clientY: 16 })
  mover(r, 60)
  let cancelado = false
  act(() => {
    cancelado = cancelar.current?.() ?? false
  })
  expect(cancelado).toBe(true)
  fireEvent.pointerUp(r, { pointerId: 1, clientX: 0, clientY: 70 })
  expect(asignar).not.toHaveBeenCalled()
  expect(cancelar.current).toBeNull()

  fireEvent.pointerDown(r, { button: 0, pointerId: 1, clientX: 0, clientY: 16 })
  mover(r, 900)
  fireEvent.pointerUp(r, { pointerId: 1, clientX: 0, clientY: 900 })
  expect(asignar).not.toHaveBeenCalled()
})

it('durante el arrastre aparecen «+ Nuevo cantante» (menos de 4) y, soltando ahí, pide uno nuevo', () => {
  const { asignar } = montar()
  const r = region(/Cruza el faro/)
  expect(screen.queryByText('Suelta aquí para un cantante nuevo')).toBeNull()
  fireEvent.pointerDown(r, { button: 0, pointerId: 1, clientX: 0, clientY: 16 })
  mover(r, 50)
  expect(screen.getByText('Suelta aquí para un cantante nuevo')).toBeVisible()
  // Filas durante el arrastre: c1, c2, «nuevo» (64..96), Todos y Coro.
  fireEvent.pointerUp(r, { pointerId: 1, clientX: 0, clientY: 70 })
  expect(asignar).toHaveBeenCalledWith('nuevo', ['d1'])
})

it('con varias seleccionadas, arrastrar una lleva todas', () => {
  const { asignar } = montar({ seleccionadas: ['d1', 'd2'] })
  const r = region(/Cruza el faro/)
  fireEvent.pointerDown(r, { button: 0, pointerId: 1, clientX: 0, clientY: 16 })
  mover(r, 120)
  fireEvent.pointerUp(r, { pointerId: 1, clientX: 0, clientY: 120 })
  expect(asignar).toHaveBeenCalledWith(expect.any(String), ['d1', 'd2'])
})

it('con los carriles juntos hay una sola pista, con inicial y franja, y no hay arrastre', () => {
  const { asignar } = montar({ juntos: true })
  expect(document.querySelectorAll('[data-carril]')).toHaveLength(0)
  const r = region(/Cruza el faro/)
  expect(r).toHaveAttribute('data-juntas')
  expect(within(r).getByText('A')).toBeVisible()
  fireEvent.pointerDown(r, { button: 0, pointerId: 1, clientX: 0, clientY: 16 })
  mover(r, 120)
  fireEvent.pointerUp(r, { pointerId: 1, clientX: 0, clientY: 120 })
  expect(asignar).not.toHaveBeenCalled()
})

it('las regiones llevan data-foco-editor="region" (Alt + ↑/↓ con el foco en una región)', () => {
  montar()
  expect(region(/Cruza el faro/)).toHaveAttribute('data-foco-editor', 'region')
})
