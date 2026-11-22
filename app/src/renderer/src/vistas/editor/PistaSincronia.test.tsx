import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { letra as crearLetra, linea } from '@shared/__fixtures__'
import type { Letra } from '@shared/letra'
import { PistaSincronia } from './PistaSincronia'

const letra = { lineas: [], offset_ms: 0 } as unknown as Letra
const noop = () => {}

function montar(tiempoMs: number) {
  return render(
    <PistaSincronia
      letra={letra}
      seleccion={null}
      duracionMs={10_000}
      inactiva={false}
      sonando={false}
      posicionMs={tiempoMs}
      obtenerTiempoAudio={() => tiempoMs}
      buscar={noop}
      seleccionar={noop}
      iniciarMarcador={() => false}
      moverMarcador={noop}
      terminarMarcador={noop}
      ajustarMarcador={noop}
      bordeArrastrado={undefined}
      limite={null}
    />
  )
}

it('el cabezal no ocupa espacio fuera de la vista y se acota dentro', () => {
  const { container } = montar(5000)
  const cabezal = container.querySelector<HTMLElement>('[data-cabezal]')!
  expect(cabezal.style.display).toBe('')
  expect(cabezal.style.left).toBe('50%')
  const fuera = montar(20_000).container.querySelector<HTMLElement>('[data-cabezal]')!
  expect(fuera.style.display).toBe('none')
  const antes = montar(-500).container.querySelector<HTMLElement>('[data-cabezal]')!
  expect(antes.style.display).toBe('none')
  const borde = montar(10_000).container.querySelector<HTMLElement>('[data-cabezal]')!
  expect(Number.parseFloat(borde.style.left)).toBeLessThanOrEqual(100)
})

it('el doble clic en el cuerpo de una región escucha la línea y en un tirador no', () => {
  const escucharLinea = vi.fn(() => true)
  render(
    <PistaSincronia
      letra={crearLetra([linea('a', 'Uno', 1000, { fin_ms: 3000 })])}
      seleccion="a"
      duracionMs={10_000}
      inactiva={false}
      sonando={false}
      posicionMs={0}
      obtenerTiempoAudio={() => 0}
      buscar={noop}
      seleccionar={noop}
      escucharLinea={escucharLinea}
      iniciarMarcador={() => false}
      moverMarcador={noop}
      terminarMarcador={noop}
      ajustarMarcador={noop}
      bordeArrastrado={undefined}
      limite={null}
    />
  )
  fireEvent.doubleClick(screen.getByRole('button', { name: 'Uno' }))
  expect(escucharLinea).toHaveBeenCalledExactlyOnceWith('a')
  fireEvent.doubleClick(screen.getByRole('slider', { name: 'Inicio de la línea' }))
  expect(escucharLinea).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: 'Uno' })).toHaveAttribute(
    'title',
    'Uno · Doble clic: escuchar esta línea'
  )
})

it('los tiradores de una línea con palabras a mano avisan de que moverlos las quita', () => {
  const props = {
    seleccion: 'a',
    duracionMs: 10_000,
    inactiva: false,
    sonando: false,
    posicionMs: 0,
    obtenerTiempoAudio: () => 0,
    buscar: noop,
    seleccionar: noop,
    iniciarMarcador: () => false,
    moverMarcador: noop,
    terminarMarcador: noop,
    ajustarMarcador: noop,
    bordeArrastrado: undefined,
    limite: null
  }
  const conPalabras = crearLetra([
    linea('a', 'Uno dos', 1000, {
      fin_ms: 3000,
      origen_palabras: 'manual',
      palabras: [
        { texto: 'Uno', inicio_ms: 1000, fin_ms: 2000 },
        { texto: 'dos', inicio_ms: 2000, fin_ms: 3000 }
      ]
    })
  ])
  const { unmount } = render(<PistaSincronia {...props} letra={conPalabras} />)
  const tiradores = screen.getAllByRole('slider', { name: /^(Inicio|Fin) de la línea/ })
  expect(tiradores).toHaveLength(2)
  for (const t of tiradores) {
    expect(t.title).toContain('Moverlo quitará los tiempos por palabra de esta línea.')
  }
  unmount()
  render(
    <PistaSincronia {...props} letra={crearLetra([linea('a', 'Uno', 1000, { fin_ms: 3000 })])} />
  )
  const sin = screen.getAllByRole('slider', { name: /^(Inicio|Fin) de la línea/ })
  expect(sin).toHaveLength(2)
  for (const t of sin) expect(t.title).toBe('')
})
