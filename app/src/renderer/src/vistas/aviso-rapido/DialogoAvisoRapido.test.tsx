import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DialogoAvisoRapido } from './DialogoAvisoRapido'

describe('DialogoAvisoRapido (0057)', () => {
  const montar = (
    o: { motivo?: 'preparar' | 'memoria' | 'descarga'; bytes?: number | null } = {}
  ) => {
    const alCancelar = vi.fn()
    const alAceptar = vi.fn()
    render(
      <DialogoAvisoRapido
        abierto
        motivo={o.motivo ?? 'preparar'}
        bytes={o.bytes === undefined ? 59_074_342 : o.bytes}
        alCancelar={alCancelar}
        alAceptar={alAceptar}
      />
    )
    return { alCancelar, alAceptar }
  }

  it.each([
    ['preparar', 'No hemos podido preparar el modelo Calidad.'],
    ['memoria', 'Tu equipo no tiene memoria suficiente para el modelo Calidad.'],
    ['descarga', 'No hemos podido descargar de nuevo el modelo Calidad.']
  ] as const)('motivo %s', (motivo, texto) => {
    montar({ motivo })
    expect(screen.getByText(texto)).toBeInTheDocument()
  })

  it('cuerpo, tres viñetas, alcance y foco inicial en Cancelar', () => {
    montar()
    expect(screen.getByRole('dialog', { name: '¿Usar el modelo Rápido?' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(
      screen.getByText('Shinobi Karaoke no lo distribuye: se descarga desde su origen (59 MB).')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
  })

  it('con Rápido ya descargado la viñeta no lleva tamaño', () => {
    montar({ bytes: null })
    expect(
      screen.getByText('Shinobi Karaoke no lo distribuye: se descargó desde su origen.')
    ).toBeInTheDocument()
  })

  it('solo "Usar el modelo Rápido" consiente; Cancelar y Esc no', () => {
    const { alCancelar, alAceptar } = montar()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(alCancelar).toHaveBeenCalledTimes(2)
    expect(alAceptar).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Usar el modelo Rápido' }))
    expect(alAceptar).toHaveBeenCalledOnce()
  })
})
