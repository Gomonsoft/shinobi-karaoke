import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PanelFunciones, type EstadoCancion } from './PanelFunciones'
import type { MotivoComprobar } from './comprobar/calcular'
import type { Motivo } from './silencios/useAjustarSilencios'

function montar(
  estado: EstadoCancion,
  opciones: {
    motivoExportar?: string
    motivos?: Motivo[]
    motivosComprobar?: MotivoComprobar[]
    desfaseCorregidoMs?: number
  } = {}
) {
  const props = {
    exportar: vi.fn(),
    pedir: vi.fn(),
    comprobar: vi.fn(),
    quitar: vi.fn(),
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
      comprobar={{
        motivos: opciones.motivosComprobar ?? [],
        calculando: false,
        pedir: props.comprobar,
        reintentar: vi.fn(),
        desfaseCorregidoMs: opciones.desfaseCorregidoMs ?? null,
        quitar: props.quitar
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

describe('Comprobar la letra con la voz (feature 4)', () => {
  it('F4-E1: va justo antes de «Ajustar los silencios» y antes de «Exportar video»', () => {
    montar('borrador')
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titulos.slice(0, 3)).toEqual([
      'Comprobar la letra con la voz',
      'Ajustar los silencios',
      'Exportar video'
    ])
    fireEvent.click(boton('Comprobar la letra con la voz…')!)
  })

  it('con todo listo, el botón comprueba', () => {
    const p = montar('borrador')
    fireEvent.click(boton('Comprobar la letra con la voz…')!)
    expect(p.comprobar).toHaveBeenCalledOnce()
  })

  it('F4-E1: sin 5 líneas o sin picos es aria-disabled y enfocable, con su motivo debajo', () => {
    const p = montar('borrador', {
      motivosComprobar: [{ tipo: 'lineas' }, { tipo: 'separacion' }]
    })
    const b = boton('Comprobar la letra con la voz…')!
    expect(b).toHaveAttribute('aria-disabled', 'true')
    expect(b).not.toBeDisabled()
    expect(
      screen.getByText('Para comprobar la letra hacen falta al menos 5 líneas sincronizadas.')
    ).toBeVisible()
    fireEvent.click(b)
    expect(p.comprobar).not.toHaveBeenCalled()
  })

  it('con error de picos ofrece Reintentar; la forma de onda preparándose usa el texto de los silencios', () => {
    montar('borrador', { motivosComprobar: [{ tipo: 'error' }] })
    expect(screen.getByText('La forma de onda de la voz (no se pudo preparar)')).toBeVisible()
    expect(boton('Reintentar')).toBeVisible()
  })

  it('F4-E5: la línea «Desfase corregido» sale si la canción recuerda una corrección y [Quitar] la quita', () => {
    const p = montar('borrador', { desfaseCorregidoMs: 800 })
    expect(screen.getByText(/Desfase corregido: toda la letra 0,8 s más tarde\./)).toBeVisible()
    fireEvent.click(boton('Quitar la corrección')!)
    expect(p.quitar).toHaveBeenCalledOnce()
  })

  it('sin corrección no hay línea ni botón', () => {
    montar('borrador')
    expect(screen.queryByText(/Desfase corregido/)).toBeNull()
    expect(boton('Quitar la corrección')).toBeNull()
  })
})
