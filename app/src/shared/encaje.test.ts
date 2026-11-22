import { describe, expect, it } from 'vitest'
import { linea } from './__fixtures__'
import { generarPicos } from './__fixtures__/picos'
import { corregirDesfase, evaluarEncaje, quitarCorreccion, type ResultadoEncaje } from './encaje'
import type { ElementoLetra, Letra } from './letra'
import { detectarVoz } from './silencios'

const DUR = 120_000

/** Cantos de duración irregular (determinista): [inicio, fin) en tiempo de audio. */
function cantos(n = 24): [number, number][] {
  const r: [number, number][] = []
  let t = 3000
  for (let i = 0; i < n; i++) {
    const dur = 1500 + ((i * 7919) % 5) * 500
    const hueco = 800 + ((i * 104729) % 4) * 400
    r.push([t, t + dur])
    t += dur + hueco
  }
  return r
}

const vozDe = (c: [number, number][]) =>
  detectarVoz(
    generarPicos({
      duracionMs: DUR,
      tramos: c.map(([a, b]) => ({ desdeMs: a, hastaMs: b, dbfs: -6 }))
    })
  )

const letraDe = (c: [number, number][], desfase = 0, extra: Partial<Letra> = {}): Letra => ({
  origen: 'lrclib',
  lrclib_id: null,
  offset_ms: 0,
  lineas: c.map(([a, b], i): ElementoLetra =>
    linea(`l${i}`, `texto ${i}`, a - desfase, { fin_ms: b - desfase })
  ),
  ...extra
})

const evaluar = (l: Letra, c = cantos()): ResultadoEncaje =>
  evaluarEncaje(l, vozDe(c), { duracionMs: DUR })

describe('evaluarEncaje', () => {
  it('coincide con la letra propia', () => {
    const r = evaluar(letraDe(cantos()))
    expect(r.veredicto).toBe('coincide')
    expect(r.f0).toBeGreaterThan(0.98)
    expect(r.lineasSinVoz).toStrictEqual([])
    expect(r.tramosVozSinLetra).toStrictEqual([])
  })

  it.each([800, -800, 3000, -3000])('letra desplazada %i ms: desfasada y recuperada', (d) => {
    const r = evaluar(letraDe(cantos(), d))
    expect(r.veredicto).toBe('desfasada')
    expect(Math.abs(r.desfaseMs - d)).toBeLessThanOrEqual(20)
  })

  it('por debajo de 0,5 s no propone corrección', () => {
    const r = evaluar(letraDe(cantos(), 300))
    expect(r.veredicto).not.toBe('desfasada')
  })

  it('una letra de otra canción no coincide', () => {
    const otra: [number, number][] = cantos().map(([a, b], i) => [a + 400 * (i % 7), b - 300])
    const mala = letraDe(cantos(30).map(([a, b], i) => [a * 0.7 + i * 313, b * 0.7 + i * 331]))
    expect(evaluar(mala, otra).veredicto).toBe('no_coincide')
  })

  it('un desfase que cambia a lo largo de la canción no se corrige', () => {
    const c = cantos()
    const l = letraDe(c)
    l.lineas = l.lineas.map((e, i) => {
      const d = i < 12 ? 1200 : -1200
      return { ...e, inicio_ms: e.inicio_ms! - d, fin_ms: e.fin_ms! - d }
    })
    const r = evaluar(l, c)
    expect(r.veredicto).not.toBe('desfasada')
    expect(r.veredicto).not.toBe('coincide')
  })

  it('con menos de 5 líneas con inicio o sin voz es no_comprobable', () => {
    expect(evaluar(letraDe(cantos(4)), cantos(4)).veredicto).toBe('no_comprobable')
    const sinTiempos = letraDe(cantos())
    sinTiempos.lineas = sinTiempos.lineas.map((e, i) => (i < 20 ? { ...e, inicio_ms: null } : e))
    expect(evaluar(sinTiempos).veredicto).toBe('no_comprobable')
    expect(
      evaluarEncaje(letraDe(cantos()), { intervalos: [] }, { duracionMs: DUR }).veredicto
    ).toBe('no_comprobable')
  })

  it('curva plana (voz continua): no se corrige', () => {
    const continua = detectarVoz(
      generarPicos({ duracionMs: DUR, tramos: [{ desdeMs: 0, hastaMs: DUR, dbfs: -6 }] })
    )
    const l = letraDe(cantos(), 0)
    expect(evaluarEncaje(l, continua, { duracionMs: DUR }).veredicto).not.toBe('desfasada')
  })

  it('nunca saca una línea del audio', () => {
    const c = cantos()
    // Desfase de +3 s con la última línea cerca del final: d* quedaría fuera de la duración.
    const l = letraDe(c, -3000)
    const ultima = l.lineas[l.lineas.length - 1]!
    ultima.inicio_ms = DUR - 500
    ultima.fin_ms = DUR - 100
    const r = evaluar(l, c)
    expect(r.desfaseMs).toBeLessThanOrEqual(500 - 1)
  })

  it('señala líneas sin voz y voz sin letra', () => {
    const c = cantos()
    const l = letraDe(c)
    l.lineas.push(linea('x', 'x', 100_000, { fin_ms: 101_500 }))
    const r = evaluar(l, [...c, [105_000, 108_000]])
    expect(r.lineasSinVoz).toStrictEqual(['x'])
    expect(r.tramosVozSinLetra).toStrictEqual([[105_000, 108_000]])
  })

  it('tiene en cuenta offset_ms y es determinista', () => {
    const c = cantos()
    const l = letraDe(c, 800, { offset_ms: 800 })
    const r = evaluar(l, c)
    expect(r.veredicto).toBe('coincide')
    expect(evaluar(l, c)).toStrictEqual(r)
  })

  it('4 min en menos de 10 ms (orden de magnitud)', () => {
    const c: [number, number][] = []
    for (let t = 2000; t < 238_000; t += 4000) c.push([t, t + 2500 + ((t / 4000) % 3) * 300])
    const dur = 240_000
    const picos = generarPicos({
      duracionMs: dur,
      tramos: c.map(([a, b]) => ({ desdeMs: a, hastaMs: b, dbfs: -6 }))
    })
    const voz = detectarVoz(picos)
    const l = letraDe(c, 1000)
    evaluarEncaje(l, voz, { duracionMs: dur })
    const t0 = performance.now()
    evaluarEncaje(l, voz, { duracionMs: dur })
    // Margen amplio para CI; el objetivo del ADR son 10 ms.
    expect(performance.now() - t0).toBeLessThan(100)
  })
})

describe('corregirDesfase y quitarCorreccion', () => {
  it('suma al offset, anota y se deshace', () => {
    const c = corregirDesfase({ offset_ms: 100 }, 804)
    expect(c).toStrictEqual({ offset_ms: 900, desfase_corregido_ms: 800 })
    expect(
      quitarCorreccion({
        offset_ms: c.offset_ms,
        ...(c.desfase_corregido_ms ? { desfase_corregido_ms: c.desfase_corregido_ms } : {})
      })
    ).toStrictEqual({ offset_ms: 100 })
  })

  it('respeta ±30 s y anota solo lo aplicado', () => {
    expect(corregirDesfase({ offset_ms: 29_500 }, 2000)).toStrictEqual({
      offset_ms: 30_000,
      desfase_corregido_ms: 500
    })
  })

  it('acumula correcciones sucesivas', () => {
    const a = corregirDesfase({ offset_ms: 0 }, 1000)
    const b = corregirDesfase({ offset_ms: a.offset_ms, desfase_corregido_ms: 1000 }, -400)
    expect(b).toStrictEqual({ offset_ms: 600, desfase_corregido_ms: 600 })
  })
})
