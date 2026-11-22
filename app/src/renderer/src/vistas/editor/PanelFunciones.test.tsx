import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { PanelFunciones, type EstadoCancion } from './PanelFunciones'
import type { Motivo } from './silencios/useAjustarSilencios'

function montar(
  estado: EstadoCancion,
  opciones: { motivoExportar?: string; motivos?: Motivo[] } = {}
) {
  const props = {
    exportar: vi.fn(),
    pedir: vi.fn(),
    cambiarModalidad: vi.fn(),
    volverABorrador: vi.fn()
  }
  render(
    <PanelFunciones
      estado={estado}
      exportacion={{
        activa: undefined,
        motivo: opciones.motivoExportar,
        exportar: props.exportar
      }}
      silencios={{
        motivos: opciones.motivos ?? [],
        buscando: false,
        pedir: props.pedir,
        reintentar: vi.fn(),
        irAPrimera: vi.fn()
      }}
      cambiarModalidad={props.cambiarModalidad}
      volverABorrador={props.volverABorrador}
      tituloEstado={createRef<HTMLHeadingElement>()}
    />
  )
  return props
}

const boton = (nombre: string | RegExp) => screen.queryByRole('button', { name: nombre })

it('borrador: exportar y silencios con botón; modo y estado solo con texto', () => {
  montar('borrador')
  expect(screen.getByRole('heading', { name: 'Exportar video' })).toBeVisible()
  expect(boton('Exportar video…')).toBeVisible()
  expect(boton('Ajustar los silencios…')).toBeVisible()
  expect(screen.getByText(/Se elige al terminar la canción/)).toBeVisible()
  expect(screen.getByText(/Borrador\. Se guarda sola/)).toBeVisible()
  expect(boton(/Cambiar a/)).toBeNull()
  expect(boton('Volver a borrador…')).toBeNull()
})

it('Lista: «Cambiar a «Letra lista»…» y «Volver a borrador…» hacen su acción', () => {
  const p = montar('lista')
  expect(screen.getByText('✓ Lista: se canta con barrido.')).toBeVisible()
  fireEvent.click(boton('Cambiar a «Letra lista»…')!)
  expect(p.cambiarModalidad).toHaveBeenCalledWith('letra_lista')
  fireEvent.click(boton('Volver a borrador…')!)
  expect(p.volverABorrador).toHaveBeenCalledOnce()
})

it('Letra lista: «Cambiar a «Lista»» cambia a karaoke', () => {
  const p = montar('letra_lista')
  expect(screen.getByText(/Letra lista: la letra cambia línea a línea/)).toBeVisible()
  fireEvent.click(boton('Cambiar a «Lista»')!)
  expect(p.cambiarModalidad).toHaveBeenCalledWith('karaoke')
})

it('lo no disponible es aria-disabled y su motivo está siempre visible y enlazado', () => {
  const p = montar('borrador', {
    motivoExportar: 'Podrás exportar cuando termine la separación.',
    motivos: [{ tipo: 'lineas', pendientes: 3 }, { tipo: 'separacion' }]
  })
  const exportar = boton('Exportar video…')!
  expect(exportar).toHaveAttribute('aria-disabled', 'true')
  expect(exportar).toHaveAccessibleDescription('Podrás exportar cuando termine la separación.')

  const silencios = boton('Ajustar los silencios…')!
  expect(silencios).toHaveAttribute('aria-disabled', 'true')
  // Solo el primer renglón; el resto, en el popover que se abre al pulsar.
  expect(silencios).toHaveAccessibleDescription('Sincronizar 3 líneas')
  fireEvent.click(silencios)
  expect(p.pedir).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog', { name: 'Para ajustar los silencios falta:' })).toBeVisible()
})
