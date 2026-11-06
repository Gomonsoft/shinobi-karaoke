import { fireEvent, render, screen, within } from '@testing-library/react'
import { DialogoReparar } from './DialogoReparar'

it('usa el singular y enfoca Seguir trabajando con un solo trabajo', () => {
  const alSeguir = vi.fn()
  render(
    <DialogoReparar
      trabajos={['«Faro» — Descargar de YouTube']}
      cancelando={false}
      alSeguir={alSeguir}
      alConfirmar={vi.fn()}
    />
  )
  const dialogo = screen.getByRole('dialog', { name: '¿Reparar el motor de audio ahora?' })
  expect(dialogo).toHaveAccessibleDescription(
    'Hay 1 trabajo sin terminar («Faro» — Descargar de YouTube). Si reparas ahora, se cancelarán y tendrás que repetirlos. Tu letra y tu estilo están guardados.'
  )
  expect(within(dialogo).getByRole('button', { name: 'Seguir trabajando' })).toHaveFocus()
  fireEvent.keyDown(dialogo, { key: 'Escape' })
  expect(alSeguir).toHaveBeenCalledOnce()
})
