import { describe, expect, it } from 'vitest'
import { letraAleatoria, mulberry32 } from './__fixtures__/letrasAleatorias'
import { detectarDudosas } from './dudosas'
import { evaluarEncaje } from './encaje'
import { ESPERA_LEGADA } from './espera'
import { finEfectivo, type ElementoLetra, type Letra } from './letra'
import { exportarLrc, lrcALetra } from './letras'
import { proponerAjusteSilencios } from './silencios'
import {
  aplanarSolapes,
  detectarDudosasSinSolapes,
  evaluarEncajeSinSolapes,
  gruposParaLrc,
  gruposSolapados,
  proponerAjusteSilenciosSinSolapes,
  solapadas,
  tramosDeLetra
} from './solapes'

/** Voces a la vez en las funciones automáticas (0.2.3, tarea 0358; ADR 0029 §7, pregunta 0367). Letra inventada. */

const DUR = 120_000
const l = (
  id: string,
  inicio: number | null,
  fin: number | null = null,
  extra: Partial<ElementoLetra> = {}
): ElementoLetra => ({
  id,
  tipo: 'linea',
  texto: `Verso ${id}`,
  inicio_ms: inicio,
  fin_ms: fin,
  palabras: null,
  ...extra
})
const DUO = {
  cantantes: [
    { id: 'c1' as const, nombre: 'Ana' },
    { id: 'c2' as const, nombre: 'Luis' }
  ]
}
const letraDe = (lineas: ElementoLetra[], extra: Partial<Letra> = {}): Letra => ({
  origen: 'manual',
  lrclib_id: null,
  offset_ms: 0,
  partes: DUO,
  lineas,
  ...extra
})

/**
 * Un dúo con dos grupos solapados: (a, b) y (e, f, g); «c» y «d» suenan solas. Fines fijados a mano para
 * que las voces se pisen (con el fin automático no hay solapes).
 */
const duo = (): Letra =>
  letraDe([
    l('a', 2000, 8000),
    l('b', 4000, 6000, { parte: 'c2' }),
    l('c', 10_000, 13_000),
    l('d', 15_000, 18_000, { parte: 'c2' }),
    l('e', 20_000, 27_000),
    l('f', 22_000, 24_000, { parte: 'coro' }),
    l('g', 25_000, 30_000, { parte: 'c2' }),
    l('h', 32_000, 35_000)
  ])
/** La voz separada mezcla a todos: la unión de los intervalos de todas las líneas. */
const VOZ = {
  intervalos: [
    [2000, 8000],
    [10_000, 13_000],
    [15_000, 18_000],
    [20_000, 30_000],
    [32_000, 35_000]
  ] as [number, number][]
}

describe('solapadas', () => {
  it('encuentra los grupos de líneas que se pisan, encadenados', () => {
    const letra = duo()
    expect(tramosDeLetra(letra, DUR).map((t) => t.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h'
    ])
    expect(gruposSolapados(tramosDeLetra(letra, DUR)).map((g) => g.map((t) => t.id))).toEqual([
      ['a', 'b'],
      ['c'],
      ['d'],
      ['e', 'f', 'g'],
      ['h']
    ])
    expect([...solapadas(letra, DUR)].sort()).toEqual(['a', 'b', 'e', 'f', 'g'])
  })

  it('tocarse no es solaparse', () => {
    const letra = letraDe([l('a', 1000, 2000), l('b', 2000, 3000, { parte: 'c2' })])
    expect(solapadas(letra, DUR).size).toBe(0)
  })

  it('sin reparto no hay solapes (el fin automático llega a la siguiente de cualquier parte)', () => {
    expect(
      solapadas(letraDe([l('a', 1000), l('b', 2500, null, { parte: 'c2' }), l('c', 6000)]), DUR)
        .size
    ).toBe(0)
    const rng = mulberry32(1)
    for (let i = 0; i < 300; i++) {
      const sin = letraAleatoria(rng, false)
      expect(solapadas(sin, 60_000).size).toBe(0)
      expect(solapadas(letraAleatoria(rng, true), 60_000).size).toBe(0)
    }
  })
})

describe('aplanarSolapes (encaje)', () => {
  it('cada grupo es una sola línea: desde el primer inicio hasta el último fin', () => {
    const plana = aplanarSolapes(duo(), DUR)
    expect(plana.lineas.map((e) => [e.id, e.inicio_ms, e.fin_ms])).toEqual([
      ['a', 2000, 8000],
      ['c', 10_000, 13_000],
      ['d', 15_000, 18_000],
      ['e', 20_000, 30_000],
      ['h', 32_000, 35_000]
    ])
    expect(plana.lineas[0]!.texto).toBe('Verso a / Verso b')
  })

  it('una letra sin solapes es la misma', () => {
    const l0 = letraDe([l('a', 1000, 2000), l('b', 3000, 4000)])
    expect(aplanarSolapes(l0, DUR)).toBe(l0)
  })

  it('el encaje coincide con la voz mezclada, y sin fusionar, no', () => {
    const cinco = [...duo().lineas, l('i', 40_000, 44_000), l('j', 46_000, 50_000, { parte: 'c2' })]
    const letra = letraDe(cinco)
    const voz = {
      intervalos: [...VOZ.intervalos, [40_000, 44_000], [46_000, 50_000]] as [number, number][]
    }
    const opc = { duracionMs: DUR }
    const fusionado = evaluarEncajeSinSolapes(letra, voz, opc)
    const crudo = evaluarEncaje(letra, voz, opc)
    expect(fusionado.veredicto).toBe('coincide')
    expect(fusionado.desfaseMs).toBe(0)
    expect(crudo.f0 ?? 0).toBeLessThanOrEqual(fusionado.f0 ?? 1)
    // Con la voz desplazada 700 ms propone exactamente ese desfase.
    const tarde = {
      intervalos: voz.intervalos.map(([a, b]) => [a + 700, b + 700] as [number, number])
    }
    expect(evaluarEncajeSinSolapes(letra, tarde, opc).desfaseMs).toBe(700)
  })

  it('sin solapes, el resultado es el del encaje de siempre (el mismo objeto de entrada)', () => {
    const rng = mulberry32(5)
    for (let i = 0; i < 100; i++) {
      const letra = letraAleatoria(rng, i % 2 === 0)
      const voz = {
        intervalos: tramosDeLetra(letra, 60_000).map((t) => [t.a, t.b] as [number, number])
      }
      expect(evaluarEncajeSinSolapes(letra, voz, { duracionMs: 60_000 })).toEqual(
        evaluarEncaje(letra, voz, { duracionMs: 60_000 })
      )
    }
  })
})

describe('«Ajustar los silencios» y fines prudentes: excluyen las solapadas', () => {
  const opc = { duracionMs: DUR, espera: { ...ESPERA_LEGADA } }

  it('no toca las solapadas y lo cuenta; lo demás, igual que la función real', () => {
    // Con la voz mezclada, «Ajustar los silencios» recortaría o alargaría los fines fijados de los grupos.
    const letra = duo()
    const real = proponerAjusteSilencios(letra, VOZ, opc)
    const r = proponerAjusteSilenciosSinSolapes(letra, VOZ, opc)
    const solapadasIds = ['a', 'b', 'e', 'f', 'g']
    expect(r.solapaExcluidas).toBe(5)
    expect(real.cambios.some((c) => solapadasIds.includes(c.id))).toBe(true) // la función sola se equivocaría
    expect(r.cambios.every((c) => !solapadasIds.includes(c.id))).toBe(true)
    for (const id of solapadasIds) {
      expect(r.letra.lineas.find((e) => e.id === id)).toEqual(letra.lineas.find((e) => e.id === id))
    }
    expect(r.cambios).toEqual(real.cambios.filter((c) => !solapadasIds.includes(c.id)))
    expect(r.lineasCambiadas).toBe(r.cambios.length)
  })

  it('«Fin al final de la voz» sobre una línea solapada no hace nada', () => {
    const letra = duo()
    const r = proponerAjusteSilenciosSinSolapes(letra, VOZ, { ...opc, soloIds: ['e'] })
    expect(r.cambios).toEqual([])
    expect(r.solapaExcluidas).toBe(1)
    const libre = proponerAjusteSilenciosSinSolapes(letra, VOZ, { ...opc, soloIds: ['c'] })
    expect(libre.solapaExcluidas).toBe(0)
  })

  it('sin solapes es exactamente la función real (200 letras)', () => {
    const rng = mulberry32(11)
    for (let i = 0; i < 200; i++) {
      const letra = letraAleatoria(rng, i % 2 === 0) as Letra
      const voz = {
        intervalos: tramosDeLetra(letra, 60_000).map((t) => [t.a, t.b + 300] as [number, number])
      }
      const o = { duracionMs: 60_000, espera: { ...ESPERA_LEGADA }, soloFinesAutomaticos: true }
      const { solapaExcluidas, ...r } = proponerAjusteSilenciosSinSolapes(letra, voz, o)
      expect(solapaExcluidas).toBe(0)
      expect(r).toEqual(proponerAjusteSilencios(letra, voz, o))
    }
  })
})

describe('líneas dudosas: excluyen las solapadas (salvo sin inicio)', () => {
  it('«e» tiene voz de sobra que la voz mezclada explica: sin adaptador sale dudosa; con él, no', () => {
    const letra = letraDe([...duo().lineas.slice(0, 6), l('x', null), ...duo().lineas.slice(6)])
    const real = detectarDudosas(letra, VOZ, { duracionMs: DUR })
    const r = detectarDudosasSinSolapes(letra, VOZ, { duracionMs: DUR })
    expect(r.solapaExcluidas).toBe(5)
    const solapadasIds = ['a', 'b', 'e', 'f', 'g']
    expect(r.dudosas.some((d) => solapadasIds.includes(d.id))).toBe(false)
    expect(r.dudosas.find((d) => d.id === 'x')?.motivos).toEqual(['sinInicio'])
    expect(r.dudosas.length).toBeLessThanOrEqual(real.length)
  })

  it('sin solapes es la función real', () => {
    const rng = mulberry32(13)
    for (let i = 0; i < 200; i++) {
      const letra = letraAleatoria(rng, i % 2 === 0)
      const voz = { intervalos: [[0, 60_000]] as [number, number][] }
      const r = detectarDudosasSinSolapes(letra, voz, { duracionMs: 60_000 })
      expect(r.dudosas).toEqual(detectarDudosas(letra, voz, { duracionMs: 60_000 }))
      expect(r.solapaExcluidas).toBe(0)
    }
  })
})

describe('.lrc con voces a la vez: una sola marca vacía por grupo', () => {
  const datos = { titulo: 'Canción inventada', artista: 'Nadie', album: null, duracionMs: DUR }
  const marcas = (t: string) => t.split('\n').filter((x) => /^\[[\d:.]+\]$/.test(x))

  it('tras la última línea del grupo y en el fin que acaba la última, no dentro de otra línea', () => {
    const texto = exportarLrc(duo(), datos)
    // Marcas vacías: fin del grupo a-b (8 s, tras «b», no dentro de «a»), c (13 s), d (18 s), el grupo
    // e-f-g (30 s) y h (35 s); ninguna a los 6 s ni a los 24 s.
    expect(marcas(texto)).toEqual([
      '[00:08.00]',
      '[00:13.00]',
      '[00:18.00]',
      '[00:30.00]',
      '[00:35.00]'
    ])
    expect(texto.indexOf('[00:25.00]')).toBeLessThan(texto.indexOf('[00:30.00]'))
  })

  it('el grupo cuya primera línea acaba la última (a: 8 s) tampoco pone la marca dentro de «b»', () => {
    const grupos = gruposParaLrc(duo(), DUR)
    expect(grupos.get('a')).toEqual({ finMs: -1 })
    expect(grupos.get('b')).toEqual({ finMs: 8000 })
    expect(grupos.get('c')).toBeUndefined()
  })

  it('reimportar da las mismas líneas en orden temporal', () => {
    const l2 = lrcALetra(exportarLrc(duo(), datos))
    expect(l2.lineas.filter((e) => e.tipo === 'linea').map((e) => e.inicio_ms)).toEqual(
      duo().lineas.map((e) => e.inicio_ms)
    )
  })

  it('sin solapes el .lrc es el de siempre (200 letras, con y sin reparto)', () => {
    const rng = mulberry32(17)
    for (let i = 0; i < 200; i++) {
      const letra = letraAleatoria(rng, i % 2 === 0)
      const { partes: _p, ...sinPartes } = letra
      void _p
      expect(exportarLrc(letra, datos)).toBe(exportarLrc(sinPartes, datos))
    }
    expect(finEfectivo(letraDe([l('a', 1)]), 'a', 10)).toBeGreaterThan(1)
  })
})
