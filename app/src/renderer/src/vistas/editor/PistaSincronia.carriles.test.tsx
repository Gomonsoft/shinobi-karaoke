import { createRef } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
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
    letra?: typeof letra
    alArrastrar?: (n: number) => void
    mensajeOnda?: { texto: string; reintentar?: () => void }
    solapaAl?: () => string | null
    asignar?: ReturnType<typeof crearAsignar>
    seleccionadas?: string[]
  } = {}
) {
  const asignar = extra.asignar ?? crearAsignar()
  const cancelar = createRef<(() => boolean) | null>() as { current: (() => boolean) | null }
  render(
    <PistaSincronia
      letra={extra.letra ?? letra}
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
      mensajeOnda={extra.mensajeOnda}
      reparto={{
        carriles: carriles(extra.letra ?? letra),
        altoCarril: 32,
        juntos: extra.juntos ?? false,
        juntosPorEspacio: false,
        alternarJuntos: noop,
        estilo,
        cantantes: cantantesDe(extra.letra ?? letra).length,
        asignar,
        solapaAl: extra.solapaAl,
        alArrastrar: extra.alArrastrar
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

it('un carril donde la línea se solaparía con otra de la misma parte se tiñe de prohibido (C1S-E3)', () => {
  montar({ solapaAl: () => 'No puede ser de Ana: se solapa con su línea 1.' })
  const r = region(/Cruza el faro/)
  fireEvent.pointerDown(r, { button: 0, pointerId: 1, clientX: 0, clientY: 16 })
  mover(r, 50)
  expect(document.querySelector('[data-carril="c2"]')).toHaveAttribute('data-prohibido')
  expect(document.querySelector('[data-carril="c1"]')).not.toHaveAttribute('data-prohibido')
  // El motivo va dentro del carril (no solo el color) y el borde es discontinuo por CSS.
  expect(document.querySelector('[data-motivo-prohibido]')).toHaveTextContent(
    'No puede ser de Ana: se solapa con su línea 1.'
  )
})

afterEach(() => vi.unstubAllGlobals())

it('por debajo de 1280 px «Juntar carriles» es solo el icono, con nombre accesible y aria-pressed', () => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: true,
    media: q,
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  }))
  montar()
  const boton = screen.getByRole('button', { name: 'Juntar carriles' })
  expect(boton).toHaveAttribute('aria-pressed', 'false')
  expect(boton.textContent).toBe('')
  expect(boton.querySelector('svg')).not.toBeNull()
})

it('con carriles, «Cantante» con nombre predeterminado en la etiqueta y mensajes de la onda fuera de ellos', () => {
  const reintentar = vi.fn()
  montar({ mensajeOnda: { texto: 'Forma de onda no disponible.', reintentar } })
  const dentro = document.querySelector('[data-carril="c1"]')!
  expect(within(dentro as HTMLElement).queryByText(/Forma de onda/)).toBeNull()
  const icono = document.querySelector<HTMLElement>('[data-mensaje-onda]')!
  expect(icono).toBeVisible()
  expect(screen.getByRole('status')).toHaveTextContent('Forma de onda no disponible.')
  fireEvent.click(icono)
  expect(reintentar).toHaveBeenCalledTimes(1)
})

it('la franja «+ Nuevo cantante» mide 24 px, se resalta con el puntero encima y el editor la cuenta en el alto', () => {
  const alArrastrar = vi.fn()
  montar({ alArrastrar })
  const r = region(/Cruza el faro/)
  fireEvent.pointerDown(r, { button: 0, pointerId: 1, clientX: 0, clientY: 16 })
  mover(r, 50)
  expect(alArrastrar).toHaveBeenLastCalledWith(1)
  const franja = document.querySelector<HTMLElement>('[data-carril="nuevo"]')!
  expect(franja.style.height).toBe('24px')
  // Filas: c1 (0–32), c2 (32–64), nuevo (64–88).
  mover(r, 70)
  expect(document.querySelector('[data-carril="nuevo"]')).toHaveAttribute('data-destino')
  fireEvent.pointerUp(r, { pointerId: 1, clientX: 0, clientY: 70 })
  expect(alArrastrar).toHaveBeenLastCalledWith(0)
})

it('C1S-E6: con carriles juntos y solapes, ninguna región tapa a otra: sub-filas de 24 px, fijas y seleccionables', () => {
  const solapes = structuredClone(letra)
  solapes.lineas[0]!.fin_ms = 6000 // Ana pisa a Luis (5 s) de 5 a 6 s
  montar({ juntos: true, letra: solapes })
  const sub = (nombre: RegExp) => Number(region(nombre).style.getPropertyValue('--sub'))
  // Sub-filas distintas (el CSS las centra en su fila): las cajas no se pisan.
  expect(sub(/Cruza el faro/)).toBe(0)
  expect(sub(/Responde el viento/)).toBe(1)
  expect(document.querySelector('[class*="conSubfilas"]')).not.toBeNull()
  // Una línea que no se pisa con nadie vuelve a la primera sub-fila.
  expect(sub(/Cantemos todos/)).toBe(0)
  // Cada región se puede seleccionar con un clic.
  expect(region(/Responde el viento/)).toBeEnabled()
})

it('sin solapes los carriles juntos son la pista de siempre (una sola fila, sin sub-filas)', () => {
  montar({ juntos: true })
  expect(document.querySelector('[class*="conSubfilas"]')).toBeNull()
  expect(region(/Cruza el faro/).style.getPropertyValue('--sub')).toBe('')
})
