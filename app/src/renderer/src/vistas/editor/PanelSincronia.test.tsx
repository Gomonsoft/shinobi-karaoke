import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { estiloPredeterminado } from '@shared/estilo'
import { letra, linea, pausa } from '@shared/__fixtures__'
import { PanelSincronia } from './PanelSincronia'
import { estadoInicial, reducirEditor } from './estado'

it('explica el límite de una pausa junto a Inicio y conecta el ajuste por botones', () => {
  const l = letra([linea('a', 'Uno', 1000), pausa('p', 2000), linea('b', 'Dos', 3000)])
  const inicial = estadoInicial({ letra: l, estilo: estiloPredeterminado() }, 'a')
  const edicion = reducirEditor(inicial, { tipo: 'fijar_inicio', ms: 2000, ahora: 0 })
  const ajustar = vi.fn()
  render(
    <PanelSincronia
      edicion={edicion}
      duracionMs={30_000}
      escucharAjustes
      fijarEscucharAjustes={vi.fn()}
      ajustar={ajustar}
      fijar={vi.fn()}
      finAutomatico={vi.fn()}
      escuchar={vi.fn()}
      borrar={vi.fn()}
      desplazar={vi.fn()}
      fijarDesplazamiento={vi.fn()}
    />
  )
  expect(screen.getByRole('tooltip')).toHaveTextContent('No puede pasar de la pausa siguiente')
  fireEvent.click(screen.getByRole('button', { name: 'Inicio +0,01 s' }))
  expect(ajustar).toHaveBeenCalledExactlyOnceWith('inicio', 10)
  expect(screen.getByText('(automático)')).toBeVisible()
})
