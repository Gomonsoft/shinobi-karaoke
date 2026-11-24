import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { estiloPredeterminado } from '@shared/estilo'
import { cancionConReparto } from './fixturesApi'
import { ChipParte } from './ChipParte'
import { RielLista } from './RielLista'
import { RielPanel } from './RielPanel'

const letra = cancionConReparto().letra!
const estilo = estiloPredeterminado()
const chip = <ChipParte letra={letra} estilo={estilo} parte="c2" />

it('el riel de la lista minimizada lleva el chip de la parte, con nombre accesible (C1-E23)', () => {
  render(
    <RielLista
      letra={letra}
      seleccion="d2"
      sincronizando={false}
      anterior={vi.fn()}
      siguiente={vi.fn()}
      fijarInicio={vi.fn()}
      expandir={vi.fn()}
      chipParte={chip}
      soloPrincipal="Solo en la línea 2"
    />
  )
  expect(screen.getByRole('img', { name: 'Canta: Luis' })).toBeVisible()
})

it('el riel del panel minimizado lleva el chip bajo «Fin» y abre el menú', () => {
  const abrir = vi.fn()
  render(
    <RielPanel
      letra={letra}
      seleccion="d2"
      duracionMs={30_000}
      sincronizando={false}
      bucle={false}
      fijarFin={vi.fn()}
      avisos={false}
      expandir={vi.fn()}
      abrirFunciones={vi.fn()}
      canta={{ chip, etiqueta: 'Luis', abierto: false, abrir }}
    />
  )
  const boton = screen.getByRole('button', { name: 'Canta: Luis' })
  expect(boton).toHaveAttribute('aria-haspopup', 'menu')
  fireEvent.click(boton)
  expect(abrir).toHaveBeenCalledWith(boton)
})
