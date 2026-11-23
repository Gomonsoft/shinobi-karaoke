import { describe, expect, it } from 'vitest'
import { linea } from './__fixtures__'
import { generarPicos } from './__fixtures__/picos'
import {
  corregirDesfase,
  evaluarEncaje,
  PARAMETROS_ENCAJE,
  quitarCorreccion,
  type ParametrosEncaje,
  type ResultadoEncaje
} from './encaje'
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

/** Letra con fines o sin ellos (como un LRC) desde inicios y duraciones [inicio, duración]. */
const desdePares = (pares: [number, number][]): [number, number][] =>
  pares.map(([a, d]) => [a, a + d])
const letraSinFines = (c: [number, number][], desfase = 0): Letra => ({
  ...letraDe(c, desfase),
  lineas: letraDe(c, desfase).lineas.map((e) => ({ ...e, fin_ms: null }))
})
const NUNCA_ACEPTA = (r: ResultadoEncaje): void => {
  expect(r.veredicto).not.toBe('coincide')
  expect(r.veredicto).not.toBe('desfasada')
}

describe('guardas de fiabilidad (ADR 0024, revisión 2026-11-22)', () => {
  /** Frases de 3 s con 120 ms de pausa: voz casi continua. */
  const continua: [number, number][] = Array.from({ length: 24 }, (_, i) => [
    3000 + i * 3120,
    6000 + i * 3120
  ])

  it('voz casi continua: la letra correcta es dudosa con vozContinua', () => {
    const r = evaluar(letraDe(continua), continua)
    expect(r).toMatchObject({
      veredicto: 'dudosa',
      veredictoBase: 'coincide',
      limitacion: 'vozContinua'
    })
    expect(r.densidadVoz).toBeGreaterThanOrEqual(0.95)
    // d = 0 para lo que se muestra.
    expect(r.lineasSinVoz).toStrictEqual([])
  })

  it('voz casi continua: una letra ajena nunca coincide ni se corrige', () => {
    const ajena: [number, number][] = Array.from({ length: 30 }, (_, i) => [
      3500 + i * 2300,
      5500 + i * 2300 + (i % 3) * 100
    ])
    NUNCA_ACEPTA(evaluar(letraDe(ajena), continua))
    NUNCA_ACEPTA(evaluar(letraSinFines(ajena), continua))
    for (const d of [800, -800, 3000, -3000]) NUNCA_ACEPTA(evaluar(letraDe(continua, d), continua))
  })

  /** Voz con pausas de 0,5 s y letra sin fines: F no cambia al mover la letra. */
  const rapida: [number, number][] = Array.from({ length: 30 }, (_, i) => {
    const a =
      3000 +
      [...Array(i).keys()].reduce(
        (t, k) => t + 2000 + ((k * 7919) % 6) * 300 + 500 + (k % 3) * 100,
        0
      )
    return [a, a + 2000 + ((i * 7919) % 6) * 300]
  })

  it('letra sin fines: sinContraste, y movida 0,8 o 3 s nunca coincide', () => {
    const r = evaluar(letraSinFines(rapida), rapida)
    expect(r).toMatchObject({
      veredicto: 'dudosa',
      veredictoBase: 'coincide',
      limitacion: 'sinContraste'
    })
    expect(r.contrasteF).toBeLessThan(0.02)
    expect(r.densidadVoz).toBeLessThan(0.9)
    for (const d of [800, -800, 3000, -3000])
      NUNCA_ACEPTA(evaluar(letraSinFines(rapida, d), rapida))
  })

  it('con los mismos datos y fines, la letra coincide y movida se corrige', () => {
    const r = evaluar(letraDe(rapida), rapida)
    expect(r).toMatchObject({ veredicto: 'coincide', limitacion: null })
    expect(r.contrasteF).toBeGreaterThanOrEqual(0.02)
    for (const d of [800, -800, 3000, -3000]) {
      const m = evaluar(letraDe(rapida, d), rapida)
      expect(m.veredicto).toBe('desfasada')
      expect(Math.abs(m.desfaseMs - d)).toBeLessThanOrEqual(20)
    }
  })

  it('curva plana con d* espurio: ya no es no_coincide si d = 0 coincide', () => {
    // 32 frases sin fines; tres inicios movidos. d* = −800 con ganancia 0,009 (curva plana).
    const voz = desdePares([
      [3000, 2400],
      [5700, 1800],
      [7800, 2400],
      [10600, 1800],
      [12800, 2100],
      [15200, 3000],
      [18700, 1800],
      [21000, 2700],
      [24200, 2700],
      [27300, 2400],
      [30200, 2100],
      [32700, 2100],
      [35300, 2700],
      [38400, 3300],
      [42100, 1800],
      [44200, 2700],
      [47400, 2700],
      [50500, 2100],
      [52900, 2400],
      [55600, 1800],
      [57700, 2100],
      [60200, 1800],
      [62500, 2700],
      [65700, 3000],
      [69100, 2700],
      [72100, 2400],
      [75000, 3300],
      [78800, 1800],
      [81100, 3000],
      [84500, 3300],
      [88300, 3000],
      [91700, 2100]
    ])
    const inicios = [
      3802, 5700, 7800, 10600, 12800, 15200, 18700, 21000, 24200, 27300, 30200, 32700, 35300, 38400,
      42100, 44200, 47400, 50500, 52900, 55600, 57857, 60200, 62500, 65700, 69100, 72100, 75000,
      78800, 81100, 84500, 87849, 91700
    ]
    const l = letraSinFines(inicios.map((a): [number, number] => [a, 1]))
    const dur = 150_000
    const ev = (p: ParametrosEncaje = PARAMETROS_ENCAJE) =>
      evaluarEncaje(
        l,
        detectarVoz(
          generarPicos({
            duracionMs: dur,
            tramos: voz.map(([a, b]) => ({ desdeMs: a, hastaMs: b, dbfs: -6 }))
          })
        ),
        { duracionMs: dur, p }
      )
    const r = ev()
    expect(Math.abs(r.desfaseMs)).toBeGreaterThanOrEqual(500)
    expect(r.fDesfase - r.f0).toBeLessThan(0.02)
    expect(r.veredictoBase).toBe('coincide')
    expect(r.veredicto).toBe('dudosa')
    expect(r.limitacion).toBe('sinContraste')
    // Sin la guarda de contraste, el veredicto sería el de d = 0.
    expect(ev({ ...PARAMETROS_ENCAJE, contrasteMinimoF: -1 }).veredicto).toBe('coincide')
  })

  it('curva plana en las dos mitades: no es desfase variable', () => {
    const voz = desdePares([
      [3000, 3000],
      [6500, 3300],
      [10400, 3000],
      [13900, 3000],
      [17600, 2400],
      [20700, 2700],
      [24100, 2100],
      [26700, 3000],
      [30300, 3300],
      [34200, 1800],
      [36500, 2700],
      [39800, 2100],
      [42500, 3000],
      [46100, 2100],
      [48900, 1800],
      [51300, 2700],
      [54600, 2100],
      [57200, 1800],
      [59600, 1800],
      [62000, 2700],
      [65200, 3300],
      [69100, 3000],
      [72800, 2400],
      [75800, 3000],
      [79300, 3300]
    ])
    const inicios = [
      4066, 7276, 11047, 14015, 17875, 20812, 24020, 26645, 30163, 34278, 36305, 39734, 42378,
      46241, 48649, 51995, 54797, 56936, 59419, 61061, 65264, 68962, 72622, 75723, 79271
    ]
    const dur = 150_000
    const picos = generarPicos({
      duracionMs: dur,
      tramos: voz.map(([a, b]) => ({ desdeMs: a, hastaMs: b, dbfs: -6 }))
    })
    const r = evaluarEncaje(
      letraSinFines(inicios.map((a): [number, number] => [a, 1])),
      detectarVoz(picos),
      { duracionMs: dur }
    )
    expect(r.desfaseVariable).toBe(false)
    expect(r.veredicto).not.toBe('no_coincide')
  })

  it('|d*| < 500 con I(d*) < 0,95 ≤ I(0): toma el veredicto de d = 0', () => {
    const voz = desdePares([
      [3000, 3000],
      [6400, 1800],
      [8700, 2400],
      [11600, 1800],
      [13900, 3000],
      [17200, 2700],
      [20400, 1800],
      [22500, 3000],
      [25900, 2400],
      [28800, 1800],
      [31100, 2100],
      [33600, 1800],
      [35700, 2700],
      [38900, 2700],
      [41900, 2700],
      [45000, 3300],
      [48800, 3300],
      [52400, 3300],
      [56200, 3000],
      [59500, 3000],
      [63000, 3300],
      [66600, 2100],
      [69200, 2400],
      [71900, 1800],
      [74000, 1800]
    ])
    const inicios = [
      3080, 6583, 8887, 11304, 13114, 17284, 20496, 22643, 27036, 28744, 31315, 33396, 35687, 38891,
      42072, 45355, 49597, 52366, 56167, 59626, 62887, 66859, 69338, 72086, 73714
    ]
    const dur = 150_000
    const picos = generarPicos({
      duracionMs: dur,
      tramos: voz.map(([a, b]) => ({ desdeMs: a, hastaMs: b, dbfs: -6 }))
    })
    const r = evaluarEncaje(
      letraSinFines(inicios.map((a): [number, number] => [a, 1])),
      detectarVoz(picos),
      { duracionMs: dur }
    )
    expect(Math.abs(r.desfaseMs)).toBeGreaterThan(0)
    expect(Math.abs(r.desfaseMs)).toBeLessThan(500)
    expect(r.iDesfase).toBeLessThan(0.95)
    expect(r.i0).toBeGreaterThanOrEqual(0.95)
    expect(r.veredictoBase).toBe('coincide')
  })

  it('desfase que crece de 0 a 3 s: no_coincide con desfaseVariable', () => {
    const c = cantos()
    const l = letraDe(c)
    l.lineas = l.lineas.map((e, i) => {
      const d = Math.round((i * 3000) / (c.length - 1))
      return { ...e, inicio_ms: e.inicio_ms! - d, fin_ms: e.fin_ms! - d }
    })
    const r = evaluar(l, c)
    expect(r.veredicto).toBe('no_coincide')
    expect(r.desfaseVariable).toBe(true)
  })

  it('un máximo en el borde de la búsqueda nunca da desfasada', () => {
    const l = letraDe(cantos(), 3000)
    expect(evaluar(l).veredicto).toBe('desfasada')
    // Con la búsqueda acotada a ±3 s, d* = 3000 es el borde.
    const r = evaluarEncaje(l, vozDe(cantos()), {
      duracionMs: DUR,
      p: { ...PARAMETROS_ENCAJE, desfaseMaxMs: 3000 }
    })
    expect(r.desfaseMs).toBe(3000)
    expect(r.veredicto).not.toBe('desfasada')
  })

  it('un fin más allá del audio no rompe nada ni cuenta bloques fuera', () => {
    const c = cantos()
    const l = letraDe(c)
    const ultima = l.lineas[l.lineas.length - 1]!
    ultima.fin_ms = DUR + 28_000
    const r = evaluar(l, c)
    expect(r.veredicto).not.toBe('no_comprobable')
    expect(r.f0).toBeLessThanOrEqual(1)
    expect(r.f0).toBeGreaterThan(0.5)
    expect(Number.isFinite(r.desfaseMs)).toBe(true)
    expect(r.densidadVoz).toBeLessThanOrEqual(1)
  })

  it('la letra con fines sobre voz con huecos coincide sin limitación', () => {
    const r = evaluar(letraDe(cantos()))
    expect(r).toMatchObject({ veredicto: 'coincide', veredictoBase: 'coincide', limitacion: null })
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
