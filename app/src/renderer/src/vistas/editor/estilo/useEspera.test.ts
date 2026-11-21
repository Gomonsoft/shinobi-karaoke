import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ESPERA_LEGADA, type Espera } from '@shared/espera'
import { ESTILO_PREDETERMINADO } from '@shared/estilo'
import type { ResumenCancionIpc } from '@shared/ipc'
import type { VistaTema } from '../aparienciaVista'
import type { AparienciaEditor } from '../estado'
import { esperaVisible, useControlEspera } from './useEspera'

const propia: Espera = { ...ESPERA_LEGADA, barra: true, umbral_ms: 6000 }
const delTema: Espera = { ...ESPERA_LEGADA, cuenta: true }

const vista = (estado: VistaTema['estado']): VistaTema =>
  ({ estado, procedencia: 'cancion', temaNombre: 'Neón' }) as VistaTema
const ap = (modo: 'propio' | 'tema', reemplazo?: Espera): AparienciaEditor => ({
  seleccion: modo === 'propio' ? { modo } : { modo, temaId: 't' },
  estilo: ESTILO_PREDETERMINADO,
  reemplazos: reemplazo ? { espera: reemplazo } : null
})
const estiloTema = { ...ESTILO_PREDETERMINADO, espera: delTema }

function montar(estado: VistaTema['estado'], apariencia: AparienciaEditor) {
  const despachar = vi.fn()
  const anunciar = vi.fn()
  const { result } = renderHook(() =>
    useControlEspera({
      vista: vista(estado),
      resumen: {} as ResumenCancionIpc,
      apariencia,
      estilo: estado === 'd1' ? estiloTema : ESTILO_PREDETERMINADO,
      despachar,
      anunciar,
      ejemploActivo: false,
      alternarEjemplo: vi.fn()
    })
  )
  return { c: result.current, despachar, anunciar }
}

describe('esperaVisible', () => {
  it('el reemplazo de la canción manda sobre el tema y este sobre la espera legada', () => {
    expect(esperaVisible(vista('d1'), ap('tema', propia), estiloTema)).toBe(propia)
    expect(esperaVisible(vista('d1'), ap('tema'), estiloTema)).toBe(delTema)
    expect(esperaVisible(vista('d2'), ap('propio'), ESTILO_PREDETERMINADO)).toEqual(ESPERA_LEGADA)
  })
})

describe('useControlEspera', () => {
  it('D1 sin reemplazo es un resumen y «Cambiar solo en esta canción» copia la efectiva', () => {
    const { c, despachar, anunciar } = montar('d1', ap('tema'))
    expect(c.resumen).toBe(true)
    c.cambiarSoloCancion()
    expect(despachar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'espera', espera: delTema })
    )
    expect(anunciar).toHaveBeenCalledOnce()
  })

  it('D1 con reemplazo edita el reemplazo y «Usar los del tema» lo retira', () => {
    const { c, despachar } = montar('d1', ap('tema', propia))
    expect(c.resumen).toBe(false)
    expect(c.propios).toBe(true)
    c.cambiar({ ...propia, puntos: false }, 'x')
    expect(despachar).toHaveBeenLastCalledWith(
      expect.objectContaining({ tipo: 'espera', espera: { ...propia, puntos: false } })
    )
    c.usarLosDelTema()
    expect(despachar).toHaveBeenLastCalledWith(
      expect.objectContaining({ tipo: 'espera', espera: null })
    )
  })

  it('D3 edita el borrador del tema y avisa si la canción tiene propios', () => {
    const { c, despachar } = montar('d3', ap('tema', propia))
    expect(c.d3Propios).toBe(true)
    c.cambiar(delTema, 'espera.cuenta.1')
    expect(despachar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'estilo_borrador',
        estilo: { ...ESTILO_PREDETERMINADO, espera: delTema }
      })
    )
  })

  it('D2 edita la espera del estilo propio', () => {
    const { c, despachar } = montar('d2', ap('propio'))
    expect(c.resumen).toBe(false)
    c.cambiar(propia, 'x')
    expect(despachar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'espera', espera: propia })
    )
  })
})
