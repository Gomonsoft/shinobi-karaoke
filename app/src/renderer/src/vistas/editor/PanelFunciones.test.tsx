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
    motivoLetra?: string
    motivos?: Motivo[]
    motivosComprobar?: MotivoComprobar[]
    desfaseCorregidoMs?: number
    pendientes?: number | null
    buenas?: number
    sinVoz?: boolean
  } = {}
) {
  const props = {
    exportar: vi.fn(),
    exportarLetra: vi.fn(),
    pedir: vi.fn(),
    comprobar: vi.fn(),
    quitar: vi.fn(),
    cambiarModalidad: vi.fn(),
    volverABorrador: vi.fn(),
    empezar: vi.fn(),
    reiniciar: vi.fn()
  }
  render(
    <PanelFunciones
      estado={estado}
      exportacion={{
        activa: undefined,
        motivo: opciones.motivoExportar,
        exportar: props.exportar
      }}
      letra={{ motivo: opciones.motivoLetra, exportar: props.exportarLetra }}
      revision={{
        pendientes: opciones.pendientes === undefined ? 3 : opciones.pendientes,
        buenas: opciones.buenas ?? 0,
        sinVoz: opciones.sinVoz ?? false,
        calculando: opciones.pendientes === null,
        empezar: props.empezar,
        reiniciar: props.reiniciar
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
    expect(titulos.slice(0, 4)).toEqual([
      'Revisar la sincronía',
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

describe('Revisar la sincronía (feature 11)', () => {
  it('es la primera sección, con el recuento en el botón y el resumen', () => {
    const p = montar('borrador', { pendientes: 5, buenas: 3 })
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titulos[0]).toBe('Revisar la sincronía')
    expect(titulos.indexOf('Comprobar la letra con la voz')).toBe(1)
    fireEvent.click(boton('Revisar (5)…')!)
    expect(p.empezar).toHaveBeenCalledOnce()
    expect(screen.getByText('5 líneas por revisar · 3 dadas por buenas')).toBeVisible()
    fireEvent.click(boton('Volver a señalarlas')!)
    expect(p.reiniciar).toHaveBeenCalledOnce()
  })

  it('sin pendientes: lo dice, el botón queda inactivo y no empieza', () => {
    const p = montar('borrador', { pendientes: 0 })
    expect(screen.getByText('No vemos nada raro en esta canción.')).toBeVisible()
    fireEvent.click(boton('Revisar…')!)
    expect(p.empezar).not.toHaveBeenCalled()
    expect(boton('Volver a señalarlas')).toBeNull()
  })

  it('sin la voz lo avisa y mientras se prepara no lleva número', () => {
    montar('borrador', { pendientes: 2, sinVoz: true })
    expect(screen.getByText(/Cuando la voz esté separada/)).toBeVisible()
  })
})

describe('«Exportar la letra» (F9-E1, F9-E2)', () => {
  it('va tras «Exportar video» y exporta al pulsar', () => {
    const props = montar('lista')
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titulos.indexOf('Exportar la letra')).toBe(titulos.indexOf('Exportar video') + 1)
    fireEvent.click(boton('Exportar la letra (.lrc)…')!)
    expect(props.exportarLetra).toHaveBeenCalledOnce()
  })

  it('sin líneas con inicio: aria-disabled, motivo visible y no exporta', () => {
    const props = montar('borrador', {
      motivoLetra: 'Esta canción aún no tiene ninguna línea sincronizada.'
    })
    const b = boton('Exportar la letra (.lrc)…')!
    expect(b).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Esta canción aún no tiene ninguna línea sincronizada.')).toBeVisible()
    fireEvent.click(b)
    expect(props.exportarLetra).not.toHaveBeenCalled()
  })
})
