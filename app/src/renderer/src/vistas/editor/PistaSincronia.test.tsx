import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
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
