import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { estiloPredeterminado } from '@shared/estilo'
import { letra, linea, pausa } from '@shared/__fixtures__'
import { PanelSincronia } from './PanelSincronia'
import { estadoInicial, reducirEditor } from './estado'

it('explica el límite de una pausa junto a Inicio y conecta los campos de tiempo', () => {
  const l = letra([linea('a', 'Uno', 1000), pausa('p', 2000), linea('b', 'Dos', 3000)])
  const inicial = estadoInicial({ letra: l, estilo: estiloPredeterminado() }, 'a')
  const edicion = reducirEditor(inicial, { tipo: 'fijar_inicio', ms: 2000, ahora: 0 })
  const fijar = vi.fn()
  const panel = (estado = edicion) => (
    <PanelSincronia
      edicion={estado}
      duracionMs={30_000}
      escucharAjustes
      fijarEscucharAjustes={vi.fn()}
      fijar={fijar}
      finAutomatico={vi.fn()}
      escuchar={vi.fn()}
      borrar={vi.fn()}
      desplazar={vi.fn()}
      fijarDesplazamiento={vi.fn()}
    />
  )
  const { rerender } = render(panel())
  expect(screen.getByRole('tooltip')).toHaveTextContent('No puede pasar de la pausa siguiente')
  expect(screen.queryByRole('button', { name: 'Inicio +0,01 s' })).toBeNull()
  const fin = screen.getByRole('textbox', { name: 'Fin' })
  expect(fin).toHaveValue('00:02.00')
  expect(fin).toHaveAccessibleDescription(
    'Fin automático Fija el fin para dejar un silencio antes de la siguiente línea'
  )
  fireEvent.change(fin, { target: { value: '00:01.50' } })
  fireEvent.keyDown(fin, { key: 'Enter' })
  expect(fijar).toHaveBeenLastCalledWith('fin', 1500)
  fireEvent.click(screen.getByRole('button', { name: 'Fijar fin aquí (O)' }))
  expect(fijar).toHaveBeenLastCalledWith('fin')

  rerender(
    panel(
      reducirEditor(inicial, {
        tipo: 'fijar_fin',
        ms: 1500,
        duracionMs: 30_000,
        ahora: 10
      })
    )
  )
  expect(fin).toHaveValue('00:01.50')
  expect(fin).toHaveAccessibleDescription(
    'Fija el fin para dejar un silencio antes de la siguiente línea'
  )
  expect(screen.getByRole('button', { name: 'Usar fin automático' })).toBeEnabled()

  const sinInicio = estadoInicial(
    { letra: letra([linea('a', 'Uno', null)]), estilo: estiloPredeterminado() },
    'a'
  )
  rerender(panel(sinInicio))
  expect(fin).toBeDisabled()
  expect(fin).toHaveAccessibleDescription('Fija primero el inicio')
})
