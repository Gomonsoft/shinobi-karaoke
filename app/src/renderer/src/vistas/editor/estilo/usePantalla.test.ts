import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ESTILO_PREDETERMINADO } from '@shared/estilo'
import type { ResumenCancionIpc } from '@shared/ipc'
import { PANTALLA_PREDETERMINADA, type Pantalla } from '@shared/pantalla'
import type { VistaTema } from '../aparienciaVista'
import type { AparienciaEditor } from '../estado'
import { pantallaVisible } from './pantallaEfectiva'
import { useControlPantalla } from './usePantalla'

const propia: Pantalla = { lineas: 3, pasadas: 0, transicion: 'fundido' }
const delTema: Pantalla = { lineas: 7, pasadas: 2, transicion: 'ninguna' }
const vista = (estado: VistaTema['estado']): VistaTema =>
  ({ estado, procedencia: 'cancion', temaNombre: 'Neón' }) as VistaTema
const ap = (modo: 'propio' | 'tema', reemplazo?: Pantalla): AparienciaEditor => ({
  seleccion: modo === 'propio' ? { modo } : { modo, temaId: 't' },
  estilo: ESTILO_PREDETERMINADO,
  reemplazos: reemplazo ? { pantalla: reemplazo } : null
})
const estiloTema = { ...ESTILO_PREDETERMINADO, pantalla: delTema }

function montar(estado: VistaTema['estado'], apariencia: AparienciaEditor, sonando = false) {
  const despachar = vi.fn()
  const alternarEjemplo = vi.fn()
  const { result } = renderHook(() =>
    useControlPantalla({
      vista: vista(estado),
      resumen: {} as ResumenCancionIpc,
      apariencia,
      estilo: estado === 'd1' ? estiloTema : ESTILO_PREDETERMINADO,
      despachar,
      anunciar: vi.fn(),
      ejemploActivo: false,
      alternarEjemplo,
      sonando,
      movimientoReducido: false
    })
  )
  return { c: result.current, despachar, alternarEjemplo }
}

describe('pantallaVisible', () => {
  it('el reemplazo manda sobre el tema y este sobre la predeterminada (5 · 1 · desplazamiento)', () => {
    expect(pantallaVisible(vista('d1'), ap('tema', propia), estiloTema)).toBe(propia)
    expect(pantallaVisible(vista('d1'), ap('tema'), estiloTema)).toEqual(delTema)
    expect(pantallaVisible(vista('d2'), ap('propio'), ESTILO_PREDETERMINADO)).toEqual(
      PANTALLA_PREDETERMINADA
    )
  })
})

describe('useControlPantalla', () => {
  it('D1 sin reemplazo es un resumen y «Cambiar solo en esta canción» copia la efectiva', () => {
    const { c, despachar } = montar('d1', ap('tema'))
    expect(c.resumen).toBe(true)
    c.cambiarSoloCancion()
    expect(despachar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'pantalla', pantalla: delTema })
    )
  })

  it('D1 con reemplazo edita el reemplazo y «Usar la del tema» lo retira', () => {
    const { c, despachar } = montar('d1', ap('tema', propia))
    expect(c.propia).toBe(true)
    c.usarLaDelTema()
    expect(despachar).toHaveBeenLastCalledWith(
      expect.objectContaining({ tipo: 'pantalla', pantalla: null })
    )
  })

  it('D3 edita el borrador del tema y avisa si la canción tiene bloque propio', () => {
    const { c, despachar } = montar('d3', ap('tema', propia))
    expect(c.d3Propia).toBe(true)
    c.cambiar(delTema, 'lineas.7')
    expect(despachar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'estilo_borrador',
        estilo: { ...ESTILO_PREDETERMINADO, pantalla: delTema }
      })
    )
  })

  it('elegir un cambio de línea con el audio en pausa enseña el ejemplo; sonando, no', () => {
    const pausa = montar('d2', ap('propio'))
    pausa.c.cambiar(propia, 'cambio.fundido')
    expect(pausa.alternarEjemplo).toHaveBeenCalledOnce()
    const suena = montar('d2', ap('propio'), true)
    suena.c.cambiar(propia, 'cambio.fundido')
    expect(suena.alternarEjemplo).not.toHaveBeenCalled()
    const lineas = montar('d2', ap('propio'))
    lineas.c.cambiar(propia, 'lineas.3')
    expect(lineas.alternarEjemplo).not.toHaveBeenCalled()
  })
})

describe('«Varias voces» en el control (0363)', () => {
  it('se muestra con reparto y siempre en D3; no en D2 sin reparto', () => {
    const con = (estado: VistaTema['estado'], reparto?: boolean) =>
      renderHook(() =>
        useControlPantalla({
          vista: vista(estado),
          resumen: {} as ResumenCancionIpc,
          apariencia: ap('propio'),
          estilo: ESTILO_PREDETERMINADO,
          despachar: vi.fn(),
          anunciar: vi.fn(),
          ejemploActivo: false,
          alternarEjemplo: vi.fn(),
          sonando: false,
          movimientoReducido: false,
          reparto
        })
      ).result.current.varias
    expect(con('d2')).toBe(false)
    expect(con('d2', true)).toBe(true)
    expect(con('d3')).toBe(true)
  })
})
