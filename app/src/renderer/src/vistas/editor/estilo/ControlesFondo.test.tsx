import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Fondo } from '@shared/estilo'
import { E } from '../textos'
import {
  ControlesFondo,
  ControlesMovimiento,
  resumenFondo,
  type FondoDegradado
} from './ControlesFondo'

const T = E.fondoG
const actual = (): FondoDegradado => JSON.parse(screen.getByTestId('fondo').textContent ?? '')

function Montaje({ inicial }: { inicial: FondoDegradado }) {
  const [fondo, setFondo] = useState(inicial)
  const props = {
    fondo,
    claveNueva: (c: string) => c,
    alCambiar: (nuevo: FondoDegradado) => setFondo(nuevo)
  }
  return (
    <>
      <ControlesFondo {...props} />
      <ControlesMovimiento {...props} />
      <pre data-testid="fondo">{JSON.stringify(fondo)}</pre>
    </>
  )
}

const base: FondoDegradado = {
  tipo: 'degradado',
  angulo_grados: 135,
  paradas: [
    { color: '#111111', posicion: 0 },
    { color: '#222222', posicion: 1 }
  ]
}

afterEach(() => vi.unstubAllGlobals())

describe('ControlesFondo', () => {
  it('cambia de forma conservando datos y repartiendo las paradas', () => {
    render(<Montaje inicial={{ ...base, movimiento: { periodo_s: 15, sentido: 'antihorario' } }} />)
    expect(screen.queryByRole('radiogroup', { name: T.centro })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: T.formas.conico }))
    expect(actual()).toMatchObject({
      forma: 'conico',
      angulo_grados: 135,
      movimiento: { periodo_s: 15, sentido: 'antihorario' },
      paradas: [{ posicion: 0 }, { posicion: 0.5 }]
    })
    expect(screen.getByText(T.anguloInicio)).toBeVisible()
    fireEvent.click(screen.getByRole('radio', { name: T.formas.radial }))
    expect(actual().paradas[1]!.posicion).toBe(1)
    expect(screen.queryByText(E.angulo)).toBeNull()
    expect(actual().angulo_grados).toBe(135)
  })

  it('mueve el centro con el teclado sin dar la vuelta', () => {
    render(<Montaje inicial={{ ...base, forma: 'radial' }} />)
    const centro = screen.getByRole('radio', { name: 'Centro' })
    expect(centro).toBeChecked()
    centro.focus()
    fireEvent.keyDown(centro, { key: 'ArrowUp' })
    expect(actual().centro).toEqual({ x: 0.5, y: 0 })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(actual().centro).toEqual({ x: 0.5, y: 0 })
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(actual().centro).toEqual({ x: 1, y: 1 })
  })

  it('no marca ninguna celda con un centro fuera de la cuadrícula', () => {
    render(<Montaje inicial={{ ...base, forma: 'radial', centro: { x: 0.3, y: 0.5 } }} />)
    expect(
      screen.queryByRole('radio', { checked: true, name: /^(Arriba|Abajo|Centro)/ })
    ).toBeNull()
    expect(screen.getByRole('radiogroup', { name: T.centro })).toHaveAccessibleDescription(
      T.centroOtro
    )
  })

  it('activa el movimiento, cambia la velocidad y conserva el sentido', () => {
    render(<Montaje inicial={base} />)
    expect(screen.queryByRole('radiogroup', { name: T.velocidad })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: T.movimiento }))
    expect(actual().movimiento).toEqual({ periodo_s: 30, sentido: 'horario' })
    fireEvent.click(screen.getByRole('radio', { name: T.velocidades.rapida }))
    expect(actual().movimiento?.periodo_s).toBe(15)
    fireEvent.click(screen.getByRole('checkbox', { name: T.movimiento }))
    expect(actual().movimiento).toBeNull()
  })

  it('muestra un periodo guardado distinto como cuarta opción', () => {
    render(<Montaje inicial={{ ...base, movimiento: { periodo_s: 45, sentido: 'antihorario' } }} />)
    expect(screen.getByRole('radio', { name: '45 s' })).toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: T.velocidades.lenta }))
    expect(actual().movimiento).toEqual({ periodo_s: 60, sentido: 'antihorario' })
    expect(screen.queryByRole('radio', { name: '45 s' })).toBeNull()
  })

  it('avisa del movimiento reducido y deja la casilla editable', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
    render(<Montaje inicial={base} />)
    expect(screen.getByText(T.reducido)).toBeVisible()
    fireEvent.click(screen.getByRole('checkbox', { name: T.movimiento }))
    expect(actual().movimiento).not.toBeNull()
  })

  it('resume el fondo en D1 y D4', () => {
    expect(resumenFondo({ tipo: 'solido', color: '#111111' } as Fondo)).toBe('Sólido')
    expect(resumenFondo(base)).toBe('Degradado lineal · 135°')
    expect(
      resumenFondo({
        ...base,
        forma: 'radial',
        centro: { x: 0, y: 0.5 },
        movimiento: { periodo_s: 30, sentido: 'horario' }
      })
    ).toBe('Degradado radial · izquierda · en movimiento (media)')
    expect(resumenFondo({ ...base, forma: 'conico', angulo_grados: 90 })).toBe(
      'Degradado cónico · 90° · centro'
    )
  })
})
