import { beforeEach, describe, expect, it } from 'vitest'
import { letra, linea } from '@shared/__fixtures__'
import { apiPicosFalsa, cantosDeEjemplo, lineasSobreCantos } from '../../letra/fixturesPicos'
import { olvidarPicosBase } from '../picosBase'
import { calcularEncajeEditor, mismaPropuesta, motivosComprobar } from './calcular'

beforeEach(() => olvidarPicosBase())
const cantos = cantosDeEjemplo()

describe('motivosComprobar', () => {
  const cinco = letra(Array.from({ length: 5 }, (_, i) => linea(`${i}`, `L${i}`, i * 1000)))
  it('con menos de 5 líneas con inicio falta «lineas»; los picos dan su motivo en orden', () => {
    expect(
      motivosComprobar({
        letra: letra([linea('a', 'A', 0)]),
        separacionDisponible: true,
        picos: 'lista'
      })
    ).toEqual([{ tipo: 'lineas' }])
    expect(motivosComprobar({ letra: cinco, separacionDisponible: false, picos: null })).toEqual([
      { tipo: 'separacion' }
    ])
    for (const tipo of ['generando', 'error', 'no_disponible'] as const) {
      const esperado = { generando: 'preparando', error: 'error', no_disponible: 'noDisponible' }[
        tipo
      ]
      expect(motivosComprobar({ letra: cinco, separacionDisponible: true, picos: tipo })).toEqual([
        { tipo: esperado }
      ])
    }
    expect(motivosComprobar({ letra: cinco, separacionDisponible: true, picos: 'lista' })).toEqual(
      []
    )
  })
})

describe('calcularEncajeEditor', () => {
  const duracionMs = 60_000
  it('lee los picos y evalúa la letra en memoria (con su offset)', async () => {
    const api = { picos: apiPicosFalsa(cantos) }
    const base = { api, cancionId: 'c1', duracionMs }
    const desplazada = {
      origen: 'lrclib',
      lrclib_id: null,
      offset_ms: 0,
      lineas: lineasSobreCantos(cantos, 800)
    } as const
    const r = await calcularEncajeEditor({ ...base, letra: desplazada })
    expect(r.ok && r.encaje.veredicto).toBe('desfasada')
    // Con la corrección ya aplicada en `offset_ms`, coincide.
    const corregida = { ...desplazada, offset_ms: 800, desfase_corregido_ms: 800 }
    const c = await calcularEncajeEditor({ ...base, letra: corregida })
    expect(c.ok && c.encaje.veredicto).toBe('coincide')
  })

  it('sin picos listos devuelve el motivo', async () => {
    const l = {
      origen: 'lrclib',
      lrclib_id: null,
      offset_ms: 0,
      lineas: lineasSobreCantos(cantos)
    } as const
    for (const [estado, motivo] of [
      ['generando', 'preparando'],
      ['error', 'error'],
      ['no_disponible', 'noDisponible']
    ] as const) {
      const r = await calcularEncajeEditor({
        api: { picos: apiPicosFalsa(cantos, estado) },
        cancionId: 'c1',
        letra: l,
        duracionMs
      })
      expect(r).toEqual({ ok: false, motivo })
    }
  })
})

describe('mismaPropuesta', () => {
  const r = (veredicto: 'desfasada' | 'coincide', desfaseMs: number) =>
    ({ veredicto, desfaseMs }) as Parameters<typeof mismaPropuesta>[0]
  it('vale con el mismo veredicto y un desfase a ≤ 50 ms', () => {
    expect(mismaPropuesta(r('desfasada', 800), r('desfasada', 840))).toBe(true)
    expect(mismaPropuesta(r('desfasada', 800), r('desfasada', 900))).toBe(false)
    expect(mismaPropuesta(r('desfasada', 800), r('coincide', 0))).toBe(false)
  })
})
