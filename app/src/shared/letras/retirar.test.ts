import { describe, expect, it } from 'vitest'
import type { ElementoLetra, Letra } from '../letra'
import { retirarCamposObsoletos } from './retirar'

const lin = (
  id: string,
  texto: string,
  inicio: number | null,
  extra: Partial<ElementoLetra> = {}
) =>
  ({
    id,
    tipo: 'linea',
    texto,
    inicio_ms: inicio,
    fin_ms: null,
    palabras: null,
    ...extra
  }) as ElementoLetra
const letra = (lineas: ElementoLetra[], extra: Partial<Letra> = {}): Letra => ({
  origen: 'manual',
  lrclib_id: null,
  offset_ms: 0,
  lineas,
  ...extra
})
const D = 60_000

describe('retirarCamposObsoletos', () => {
  const previa = () =>
    letra([lin('a', 'Uno', 1000, { fin_ms: 2000 }), lin('b', 'Dos', 3000)], { intacta: true })

  it('intacta sobrevive a un cambio de texto, de offset o de reparto, pero no de tiempos', () => {
    const p = previa()
    expect(retirarCamposObsoletos(p, { ...p, offset_ms: 500 }, D).intacta).toBe(true)
    const texto = letra([lin('a', 'Uno!', 1000, { fin_ms: 2000 }), p.lineas[1]!], { intacta: true })
    expect(retirarCamposObsoletos(p, texto, D).intacta).toBe(true)
    const t = letra([lin('a', 'Uno', 1100, { fin_ms: 2000 }), p.lineas[1]!], { intacta: true })
    expect(retirarCamposObsoletos(p, t, D).intacta).toBeUndefined()
    const f = letra([lin('a', 'Uno', 1000, { fin_ms: 2200 }), p.lineas[1]!], { intacta: true })
    expect(retirarCamposObsoletos(p, f, D).intacta).toBeUndefined()
  })

  it('una letra nueva (sin previa) conserva intacta', () => {
    expect(retirarCamposObsoletos(null, previa(), D).intacta).toBe(true)
  })

  it('origen_fin se retira sin fin_ms', () => {
    const n = letra([lin('a', 'Uno', 1000, { origen_fin: 'letra' }), lin('b', 'Dos', 3000)])
    expect(retirarCamposObsoletos(null, n, D).lineas[0]).not.toHaveProperty('origen_fin')
    const ok = letra([lin('a', 'Uno', 1000, { fin_ms: 2000, origen_fin: 'letra' })])
    expect(retirarCamposObsoletos(null, ok, D).lineas[0]!.origen_fin).toBe('letra')
  })

  it('revisada se retira si cambian inicio, fin efectivo o texto', () => {
    const rev = { inicio_ms: 1000, fin_ms: 2000, texto: 'Uno' }
    const ok = letra([lin('a', 'Uno', 1000, { fin_ms: 2000, revisada: rev })])
    expect(retirarCamposObsoletos(null, ok, D).lineas[0]!.revisada).toEqual(rev)
    for (const cambio of [{ inicio_ms: 1010 }, { fin_ms: 2100 }, { texto: 'Uno más' }]) {
      const n = letra([lin('a', 'Uno', 1000, { fin_ms: 2000, revisada: rev, ...cambio })])
      expect(retirarCamposObsoletos(null, n, D).lineas[0]).not.toHaveProperty('revisada')
    }
  })

  it('revisada usa el fin efectivo si el fin es automático', () => {
    const rev = { inicio_ms: 1000, fin_ms: 3000, texto: 'Uno' }
    const n = letra([lin('a', 'Uno', 1000, { revisada: rev }), lin('b', 'Dos', 3000)])
    expect(retirarCamposObsoletos(null, n, D).lineas[0]!.revisada).toEqual(rev)
  })

  it('alineacion se retira si cambian los tiempos o el texto y no se renueva', () => {
    const al = { confianza: 0.9 }
    const p = letra([lin('a', 'Uno', 1000, { fin_ms: 2000, alineacion: al })])
    const igual = retirarCamposObsoletos(p, p, D)
    expect(igual.lineas[0]!.alineacion).toEqual(al)
    const mov = letra([lin('a', 'Uno', 1100, { fin_ms: 2000, alineacion: al })])
    expect(retirarCamposObsoletos(p, mov, D).lineas[0]).not.toHaveProperty('alineacion')
    const txt = letra([lin('a', 'Otro', 1000, { fin_ms: 2000, alineacion: al })])
    expect(retirarCamposObsoletos(p, txt, D).lineas[0]).not.toHaveProperty('alineacion')
    const nueva = letra([lin('a', 'Uno', 1000, { fin_ms: 2500, alineacion: { confianza: 0.7 } })])
    expect(retirarCamposObsoletos(p, nueva, D).lineas[0]!.alineacion).toEqual({ confianza: 0.7 })
  })

  it('no modifica las entradas', () => {
    const p = previa()
    const copia = structuredClone(p)
    retirarCamposObsoletos(p, letra([lin('a', 'X', 5)], { intacta: true }), D)
    expect(p).toEqual(copia)
  })
})
