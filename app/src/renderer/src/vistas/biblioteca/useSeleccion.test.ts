import { act, renderHook } from '@testing-library/react'
import { resumenPrueba } from './resumenPrueba'
import {
  esSeleccionable,
  estadoCasilla,
  idsDelRango,
  reiniciarSeleccionDeSesion,
  useSeleccion
} from './useSeleccion'

beforeEach(() => reiniciarSeleccionDeSesion())

describe('helpers puros', () => {
  it('solo las Dañadas con cancion.json ilegible no son seleccionables', () => {
    expect(esSeleccionable(resumenPrueba())).toBe(true)
    expect(esSeleccionable(resumenPrueba({ danada: true, motivo: 'pistas' }))).toBe(true)
    expect(esSeleccionable(resumenPrueba({ danada: true, motivo: 'json' }))).toBe(false)
  })

  it('el rango incluye ambos extremos, en cualquier sentido', () => {
    const orden = ['a', 'b', 'c', 'd', 'e']
    expect(idsDelRango(orden, 'b', 'd')).toEqual(['b', 'c', 'd'])
    expect(idsDelRango(orden, 'd', 'b')).toEqual(['b', 'c', 'd'])
    expect(idsDelRango(orden, 'c', 'c')).toEqual(['c'])
    expect(idsDelRango(orden, 'x', 'c')).toEqual([])
  })

  it('la casilla de grupo es ninguna, algunas o todas', () => {
    expect(estadoCasilla(['a', 'b'], new Set())).toBe('ninguna')
    expect(estadoCasilla(['a', 'b'], new Set(['a', 'z']))).toBe('algunas')
    expect(estadoCasilla(['a', 'b'], new Set(['a', 'b']))).toBe('todas')
    expect(estadoCasilla([], new Set(['a']))).toBe('ninguna')
  })
})

describe('useSeleccion', () => {
  it('entra, alterna, hace rango desde la última alternada y sale vaciando', () => {
    const { result } = renderHook(() => useSeleccion())
    expect(result.current.activo).toBe(false)
    act(() => result.current.entrar())
    act(() => result.current.alternar('b'))
    act(() => result.current.rango('d', ['a', 'b', 'c', 'd', 'e'], (id) => id !== 'c'))
    expect([...result.current.ids].sort()).toEqual(['b', 'd'])
    act(() => result.current.alternar('b'))
    expect([...result.current.ids]).toEqual(['d'])
    act(() => result.current.salir())
    expect(result.current.activo).toBe(false)
    expect(result.current.ids.size).toBe(0)
  })

  it('vaciar sigue en el modo; fijar sustituye; entrar con ids los añade', () => {
    const { result } = renderHook(() => useSeleccion())
    act(() => result.current.entrar(['a', 'b']))
    expect(result.current.activo).toBe(true)
    act(() => result.current.vaciar())
    expect(result.current.activo).toBe(true)
    expect(result.current.ids.size).toBe(0)
    act(() => result.current.fijar(['x']))
    expect([...result.current.ids]).toEqual(['x'])
    act(() => result.current.quitar(['x']))
    expect(result.current.ids.size).toBe(0)
  })

  it('se conserva al volver a montar la vista (modo selección de sesión)', () => {
    const primera = renderHook(() => useSeleccion())
    act(() => primera.result.current.entrar(['a']))
    primera.unmount()
    const segunda = renderHook(() => useSeleccion())
    expect(segunda.result.current.activo).toBe(true)
    expect([...segunda.result.current.ids]).toEqual(['a'])
  })
})
