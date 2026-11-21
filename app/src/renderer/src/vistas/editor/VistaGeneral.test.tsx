import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { Letra } from '@shared/letra'
import { crearVistaLineaTiempo, proyectarLineaTiempo } from './lineaTiempo'
import { VistaGeneral } from './VistaGeneral'

const letra = {
  origen: 'manual',
  lrclib_id: null,
  offset_ms: 0,
  lineas: [{ id: 'a', tipo: 'linea', texto: 'Hola', inicio_ms: 1000, fin_ms: 3000, palabras: null }]
} as unknown as Letra
const duracionMs = 10_000

function montar(informativa: boolean) {
  const buscar = vi.fn()
  const cambiarVista = vi.fn()
  const utils = render(
    <VistaGeneral
      informativa={informativa}
      vista={{ inicioMs: 2000, finMs: 4000 }}
      duracionMs={duracionMs}
      modelo={proyectarLineaTiempo(letra, duracionMs)}
      inactiva={false}
      cambiarVista={cambiarVista}
      buscar={buscar}
      obtenerTiempoAudio={() => 5000}
      sonando={false}
      posicionMs={5000}
    />
  )
  const caja = utils.container.firstElementChild as HTMLElement
  caja.getBoundingClientRect = () => ({ left: 100, width: 400 }) as DOMRect
  return { ...utils, caja, buscar, cambiarVista }
}

it('la variante informativa es aria-hidden, busca con un clic y no se puede arrastrar', () => {
  const { caja, buscar, cambiarVista, container } = montar(true)
  expect(caja).toHaveAttribute('aria-hidden', 'true')
  expect(screen.queryByRole('slider')).toBeNull()
  // 300 px de 400 → 75 % de 10 s.
  fireEvent.click(caja, { clientX: 400 })
  expect(buscar).toHaveBeenCalledExactlyOnceWith(7500)
  const rectangulo = container.querySelector<HTMLElement>('[class*="ventana"]')!
  fireEvent.pointerDown(rectangulo, { pointerId: 1, button: 0, clientX: 150 })
  fireEvent.pointerMove(rectangulo, { pointerId: 1, clientX: 300 })
  expect(cambiarVista).not.toHaveBeenCalled()
  // El cabezal propio de la fila minimizada sigue al audio.
  expect(container.querySelector<HTMLElement>('[data-cabezal-general]')!.style.left).toBe('50%')
})

it('la variante completa conserva el rectángulo interactivo del intervalo visible', () => {
  const { cambiarVista } = montar(false)
  const ventana = screen.getByRole('slider', { name: 'Vista general' })
  fireEvent.keyDown(ventana, { key: 'ArrowRight' })
  expect(cambiarVista).toHaveBeenCalledOnce()
  expect(crearVistaLineaTiempo(duracionMs).finMs).toBe(duracionMs)
})
