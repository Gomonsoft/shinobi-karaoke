import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ESPERA_LEGADA } from '@shared/espera'
import { interpretarUmbral, SeccionEspera, type ControlEspera } from './SeccionEspera'

function control(parcial: Partial<ControlEspera> = {}): ControlEspera {
  return {
    resumen: false,
    propios: false,
    d3Propios: false,
    espera: { ...ESPERA_LEGADA },
    procedencia: 'cancion',
    temaNombre: 'Noche ninja',
    ejemploActivo: false,
    cambiar: vi.fn(),
    cambiarSoloCancion: vi.fn(),
    usarLosDelTema: vi.fn(),
    alternarEjemplo: vi.fn(),
    ...parcial
  }
}

const montar = (c: ControlEspera) => render(<SeccionEspera control={c} inactivo={false} />)
const campo = () => screen.getByRole('spinbutton', { name: 'Silencio mínimo' })

describe('interpretarUmbral', () => {
  it('acepta coma, punto y sufijo, y redondea a la décima', () => {
    expect(interpretarUmbral('4,5')).toBe(4500)
    expect(interpretarUmbral('4.54 s')).toBe(4500)
    expect(interpretarUmbral('abc')).toBeNull()
  })
})

describe('SeccionEspera', () => {
  it('D2: las casillas y el valor por defecto de 0.1.0', () => {
    const c = control()
    montar(c)
    expect(
      (screen.getByRole('checkbox', { name: 'Puntos de espera' }) as HTMLInputElement).checked
    ).toBe(true)
    expect(
      (screen.getByRole('checkbox', { name: 'Barra hasta la próxima línea' }) as HTMLInputElement)
        .checked
    ).toBe(false)
    expect(campo().getAttribute('aria-valuetext')).toBe('4,0 s')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Cuenta tres, dos, uno' }))
    expect(c.cambiar).toHaveBeenCalledWith(
      { ...ESPERA_LEGADA, cuenta: true },
      expect.stringContaining('espera.cuenta')
    )
  })

  it('«Antes de la primera línea» queda inactiva sin ningún indicador', () => {
    montar(control({ espera: { ...ESPERA_LEGADA, puntos: false } }))
    expect(
      (screen.getByRole('checkbox', { name: 'Antes de la primera línea' }) as HTMLInputElement)
        .disabled
    ).toBe(true)
    expect(screen.getByText(/Sin indicadores/)).toBeTruthy()
  })

  it('el campo admite flechas, Re Pág, coma y limita el rango con aviso', () => {
    const c = control()
    montar(c)
    fireEvent.keyDown(campo(), { key: 'ArrowUp' })
    expect(c.cambiar).toHaveBeenLastCalledWith(
      { ...ESPERA_LEGADA, umbral_ms: 4500 },
      'espera.umbral'
    )
    fireEvent.keyDown(campo(), { key: 'PageDown' })
    expect(c.cambiar).toHaveBeenLastCalledWith(
      { ...ESPERA_LEGADA, umbral_ms: 1000 },
      'espera.umbral'
    )
    fireEvent.change(campo(), { target: { value: '6,5' } })
    fireEvent.keyDown(campo(), { key: 'Enter' })
    expect(c.cambiar).toHaveBeenLastCalledWith(
      { ...ESPERA_LEGADA, umbral_ms: 6500 },
      'espera.umbral'
    )
    fireEvent.change(campo(), { target: { value: '99' } })
    fireEvent.keyDown(campo(), { key: 'Enter' })
    expect(c.cambiar).toHaveBeenLastCalledWith(
      { ...ESPERA_LEGADA, umbral_ms: 60_000 },
      'espera.umbral'
    )
    expect(screen.getByText('Entre 1 y 60 segundos.')).toBeTruthy()
  })

  it('D1 sin propios: resumen, procedencia y «Cambiar solo en esta canción»', () => {
    const c = control({ resumen: true })
    montar(c)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.getByText('Puntos ●●● · silencios de 4,0 s o más')).toBeTruthy()
    expect(screen.getByText('Del tema «Noche ninja»')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar solo en esta canción' }))
    expect(c.cambiarSoloCancion).toHaveBeenCalledOnce()
  })

  it('D1 con propios: controles, procedencia propia y «Usar los del tema»', () => {
    const c = control({ propios: true })
    montar(c)
    expect(screen.getByText(/Propios de esta canción/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Usar los del tema' }))
    expect(c.usarLosDelTema).toHaveBeenCalledOnce()
  })

  it('D3 con propios en la canción lo avisa', () => {
    montar(control({ d3Propios: true }))
    expect(screen.getByText(/fuera de esta edición seguirá usándolos/)).toBeTruthy()
  })

  it('el botón del ejemplo alterna su nombre', () => {
    const { rerender } = montar(control())
    expect(screen.getByRole('button', { name: 'Ver un ejemplo' })).toBeTruthy()
    rerender(<SeccionEspera control={control({ ejemploActivo: true })} inactivo={false} />)
    expect(screen.getByRole('button', { name: 'Detener el ejemplo' })).toBeTruthy()
  })
})
