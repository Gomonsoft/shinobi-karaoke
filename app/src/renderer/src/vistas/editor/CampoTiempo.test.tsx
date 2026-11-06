import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { CampoTiempo } from './CampoTiempo'

it('aplica por Intro y al salir, y restaura un formato inválido con Esc', () => {
  const aplicar = vi.fn()
  render(<CampoTiempo etiqueta="Inicio" valor="00:04.20" aplicar={aplicar} />)
  const campo = screen.getByRole('textbox', { name: 'Inicio' })
  fireEvent.change(campo, { target: { value: '4,2' } })
  fireEvent.keyDown(campo, { key: 'Enter' })
  expect(campo).toBeInvalid()
  expect(aplicar).not.toHaveBeenCalled()
  fireEvent.keyDown(campo, { key: 'Escape' })
  expect(campo).toHaveValue('00:04.20')
  fireEvent.change(campo, { target: { value: '01:04.20' } })
  fireEvent.blur(campo)
  expect(aplicar).toHaveBeenCalledExactlyOnceWith(64_200)
})
