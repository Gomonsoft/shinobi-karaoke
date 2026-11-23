import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DetalleNoCoincide } from '../../letra/comprobacion'
import { CC } from '../../letra/textosComprobacion'
import { DialogosComprobar } from './Dialogos'

const detalle = (extra: Partial<DetalleNoCoincide> = {}): DetalleNoCoincide => ({
  silencio: [{ desdeMs: 130_000, hastaMs: 161_000, lineaId: 'a' }],
  lineasSinVoz: 1,
  totalLineas: 6,
  vozSinLetra: [{ desdeMs: 72_000, hastaMs: 100_000 }],
  variable: false,
  ...extra
})

function montar(d: DetalleNoCoincide) {
  render(
    <DialogosComprobar
      dialogo={{ tipo: 'noEncaja', detalle: d }}
      mac={false}
      alConfirmar={vi.fn()}
      alCancelar={vi.fn()}
      alIr={vi.fn()}
      alBuscarOtra={vi.fn()}
    />
  )
  return screen.getByRole('dialog', { name: 'La letra no encaja con la voz' })
}

describe('diálogo «La letra no encaja con la voz» (C4, pregunta 0209)', () => {
  it('motivos en lista, singular con una línea y pie sin desfase variable', () => {
    const dlg = montar(detalle())
    expect(within(dlg).getAllByRole('listitem').length).toBeGreaterThanOrEqual(2)
    expect(dlg).toHaveTextContent('1 de 6 líneas cae donde no hay voz.')
    expect(dlg).not.toHaveTextContent('caen')
    expect(dlg).toHaveTextContent('No se puede arreglar moviendo toda la letra.')
  })

  it('con el motivo de desfase variable no repite el pie', () => {
    const dlg = montar(detalle({ variable: true }))
    expect(dlg).toHaveTextContent(CC.detalle.variable)
    expect(dlg).not.toHaveTextContent('No se puede arreglar moviendo toda la letra.')
  })
})

describe('concordancia de let.comp.detalle.silencio', () => {
  it('singular con 1 línea y plural con varias', () => {
    expect(CC.detalle.silencio(1, 6, [[130_000, 161_000]])).toBe(
      '1 de 6 líneas cae donde no hay voz (2:10).'
    )
    expect(CC.detalle.silencio(9, 52, [[130_000, 161_000]])).toBe(
      '9 de 52 líneas caen donde no hay voz (de 2:10 a 2:41).'
    )
    expect(CC.detalle.silencio(3, 6, [])).toBe('3 de 6 líneas caen donde no hay voz.')
  })
})

describe('diálogo de «dudosa» con limitación (0379)', () => {
  const montarDudosa = (limitacion?: 'vozContinua' | 'sinContraste') => {
    render(
      <DialogosComprobar
        dialogo={limitacion ? { tipo: 'dudosa', limitacion } : { tipo: 'dudosa' }}
        mac={false}
        alConfirmar={vi.fn()}
        alCancelar={vi.fn()}
        alIr={vi.fn()}
        alBuscarOtra={vi.fn()}
      />
    )
    return screen.getByRole('dialog')
  }

  it.each([
    ['vozContinua', 'suena casi sin pausas'],
    ['sinContraste', 'solo marca dónde empieza cada línea']
  ] as const)('%s: su texto y solo [Cerrar]', (limitacion, texto) => {
    const dlg = montarDudosa(limitacion)
    expect(dlg).toHaveAccessibleName('No podemos comprobar esta letra con la voz')
    expect(dlg).toHaveTextContent(texto)
    expect(
      within(dlg)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toStrictEqual(['Cerrar'])
  })

  it('sin limitación, el texto de siempre', () => {
    const dlg = montarDudosa()
    expect(dlg).toHaveTextContent('puede deberse a coros')
  })
})
