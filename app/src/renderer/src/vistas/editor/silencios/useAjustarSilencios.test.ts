import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ESPERA_LEGADA } from '@shared/espera'
import { generarPicos } from '@shared/__fixtures__/picos'
import { linea } from '@shared/__fixtures__'
import type { Letra } from '@shared/letra'
import { cerrarTodosLosToasts } from '../../../componentes/gestorToasts'
import type { AccionEditor } from '../estado'
import { motivosSilencios, useAjustarSilencios } from './useAjustarSilencios'

const DUR = 15000
const mockPicos = vi.hoisted(() => ({ resultado: null as unknown }))
vi.mock('../picosBase', () => ({ leerPicosBase: async () => mockPicos.resultado }))

const letra = (fin: number | null = null): Letra => ({
  origen: 'manual',
  lrclib_id: null,
  offset_ms: 0,
  lineas: [{ ...linea('a', 'A', 1000), fin_ms: fin }, linea('b', 'B', 3700), linea('c', 'C', 11000)]
})

const lista = (tramos: { desdeMs: number; hastaMs: number; dbfs: number }[]) => ({
  estado: 'lista',
  generacion: 'g',
  ...generarPicos({ duracionMs: DUR, tramos })
})
const CON_SILENCIOS = [
  { desdeMs: 1000, hastaMs: 3200, dbfs: -6 },
  { desdeMs: 3700, hastaMs: 6000, dbfs: -6 },
  { desdeMs: 11000, hastaMs: 13000, dbfs: -6 }
]

beforeEach(() => {
  mockPicos.resultado = lista(CON_SILENCIOS)
})
afterEach(() => cerrarTodosLosToasts())

function montar(l: Letra = letra(), version = 4) {
  const despachar = vi.fn<(a: AccionEditor) => void>()
  const anunciar = vi.fn()
  const r = renderHook(
    (props: { letra: Letra; version: number }) =>
      useAjustarSilencios({
        cancionId: 'x',
        letra: props.letra,
        duracionMs: DUR,
        espera: { ...ESPERA_LEGADA },
        version: props.version,
        despachar,
        anunciar,
        api: {} as never
      }),
    { initialProps: { letra: l, version } }
  )
  return { ...r, despachar, anunciar }
}

describe('motivosSilencios', () => {
  const base = {
    letra: letra(),
    separacionDisponible: true,
    picos: 'lista' as const,
    borradorTema: false
  }
  it('sin motivos cuando todo está listo', () => {
    expect(motivosSilencios({ ...base, picos: null })).toStrictEqual([])
  })
  it('lista los motivos en orden', () => {
    const sinInicio = { ...letra(), lineas: [linea('a', 'A', null), linea('b', 'B', 3700)] }
    expect(
      motivosSilencios({ ...base, letra: sinInicio, picos: 'generando', borradorTema: true })
    ).toStrictEqual([{ tipo: 'lineas', pendientes: 1 }, { tipo: 'preparando' }, { tipo: 'tema' }])
    expect(motivosSilencios({ ...base, picos: 'error' })).toStrictEqual([{ tipo: 'error' }])
    expect(motivosSilencios({ ...base, picos: 'no_disponible' })).toStrictEqual([
      { tipo: 'noDisponible' }
    ])
  })
  it('sin separación solo se cita la separación', () => {
    expect(
      motivosSilencios({ ...base, separacionDisponible: false, picos: 'no_disponible' })
    ).toStrictEqual([{ tipo: 'separacion' }])
  })
})

describe('useAjustarSilencios', () => {
  it('propone sin aplicar y confirma con un solo despacho', async () => {
    const { result, despachar } = montar()
    await act(() => result.current.pedir())
    expect(result.current.abierta?.propuesta.lineasCambiadas).toBe(3)
    expect(despachar).not.toHaveBeenCalled()

    await act(() => result.current.confirmar())
    expect(despachar).toHaveBeenCalledTimes(1)
    const accion = despachar.mock.calls[0]![0]
    expect(accion).toMatchObject({ tipo: 'ajustar_silencios', versionCalculo: 4 })
    expect(result.current.abierta).toBeNull()
    expect([...result.current.resaltadas]).toStrictEqual(['a', 'b', 'c'])
  })

  it('sin cambios no abre el diálogo y lo anuncia', async () => {
    mockPicos.resultado = lista([])
    const { result, despachar, anunciar } = montar()
    await act(() => result.current.pedir())
    expect(result.current.abierta).toBeNull()
    expect(anunciar).toHaveBeenCalledOnce()
    expect(despachar).not.toHaveBeenCalled()
  })

  it('si los recuentos cambian al confirmar no aplica y avisa de obsoleto', async () => {
    const { result, rerender, despachar } = montar()
    await act(() => result.current.pedir())
    // Otra edición fijó el fin de la línea a mano mientras el diálogo estaba abierto.
    rerender({ letra: letra(3300), version: 5 })
    await act(() => result.current.confirmar())
    expect(despachar).not.toHaveBeenCalled()
    expect(result.current.abierta?.obsoleto).toBe(true)
    expect(result.current.abierta?.propuesta.lineasCambiadas).toBe(2)

    await act(() => result.current.confirmar())
    expect(despachar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'ajustar_silencios', versionCalculo: 5 })
    )
  })

  it('con los picos sin preparar avisa y no abre nada', async () => {
    mockPicos.resultado = { estado: 'generando' }
    const { result } = montar()
    await act(() => result.current.pedir())
    expect(result.current.abierta).toBeNull()
  })
})
