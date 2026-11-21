import { describe, expect, it } from 'vitest'
import { ESPERA_LEGADA, type Espera } from './espera'
import { generarPicos } from './__fixtures__/picos'
import { linea, pausa } from './__fixtures__'
import { validarInvariantesLetra, type ElementoLetra, type Letra } from './letra'
import { detectarVoz, proponerAjusteSilencios } from './silencios'

const letraDe = (lineas: ElementoLetra[], offset_ms = 0): Letra => ({
  origen: 'manual',
  lrclib_id: null,
  offset_ms,
  lineas
})
const ESPERA: Espera = { ...ESPERA_LEGADA }
const DUR = 15000

const picosBase = () =>
  generarPicos({
    duracionMs: DUR,
    tramos: [
      { desdeMs: 1000, hastaMs: 3200, dbfs: -6 },
      { desdeMs: 3700, hastaMs: 6000, dbfs: -6 },
      { desdeMs: 11000, hastaMs: 13000, dbfs: -6 }
    ]
  })

const ajustar = (letra: Letra, picos = picosBase(), espera = ESPERA) =>
  proponerAjusteSilencios(letra, detectarVoz(picos), { duracionMs: DUR, espera })

const tres = () => letraDe([linea('a', 'A', 1000), linea('b', 'B', 3700), linea('c', 'C', 11000)])
const fin = (l: Letra, id: string) => l.lineas.find((e) => e.id === id)!.fin_ms

describe('detectarVoz', () => {
  it('encuentra los tramos de voz y descarta el ruido', () => {
    const v = detectarVoz(picosBase())
    expect(v.intervalos).toStrictEqual([
      [1000, 3200],
      [3700, 6000],
      [11000, 13000]
    ])
    expect(v.referenciaDbfs).toBeCloseTo(-6, 0)
  })

  it('sin bloques sobre el piso no hay voz', () => {
    expect(detectarVoz(generarPicos({ duracionMs: 2000 })).intervalos).toStrictEqual([])
  })
})

describe('proponerAjusteSilencios', () => {
  it('fija los fines al final de la voz más el margen y cuenta el hueco largo', () => {
    const r = ajustar(tres())
    expect([fin(r.letra, 'a'), fin(r.letra, 'b'), fin(r.letra, 'c')]).toStrictEqual([
      3300, 6100, 13100
    ])
    expect(r.lineasCambiadas).toBe(3)
    expect(r.huecosLargos).toBe(1)
    expect(r.cambios[1]!.huecoMs).toBe(4900)
    expect(r.cambios[2]!.huecoMs).toBeNull()
    expect(validarInvariantesLetra(r.letra.lineas)).toStrictEqual([])
  })

  it('un silencio de 300 ms no cambia la línea', () => {
    const picos = generarPicos({
      duracionMs: DUR,
      tramos: [
        { desdeMs: 1000, hastaMs: 3200, dbfs: -6 },
        { desdeMs: 3500, hastaMs: 5000, dbfs: -6 }
      ]
    })
    const r = ajustar(letraDe([linea('a', 'A', 1000), linea('b', 'B', 3500)]), picos)
    expect(fin(r.letra, 'a')).toBeNull()
    expect(r.cambios.map((c) => c.id)).toStrictEqual(['b'])
  })

  it('una ráfaga de 30 ms dentro de un silencio no lo parte', () => {
    const picos = generarPicos({
      duracionMs: DUR,
      tramos: [{ desdeMs: 1000, hastaMs: 3000, dbfs: -6 }],
      rafagas: [{ desdeMs: 4000, duracionMs: 30, dbfs: -6 }]
    })
    const r = ajustar(letraDe([linea('a', 'A', 1000), linea('b', 'B', 8000)]), picos)
    expect(fin(r.letra, 'a')).toBe(3100)
  })

  it('una cola que decae queda dentro de un bloque más el margen', () => {
    const picos = generarPicos({
      duracionMs: DUR,
      tramos: [{ desdeMs: 1000, hastaMs: 3200, dbfs: -6 }],
      colas: [{ desdeMs: 3200, duracionMs: 160, dbfsInicial: -6, dbfsFinal: -66 }]
    })
    const r = ajustar(letraDe([linea('a', 'A', 1000), linea('b', 'B', 8000)]), picos)
    expect(Math.abs(fin(r.letra, 'a')! - (3200 + 80 + 100))).toBeLessThanOrEqual(20)
  })

  it('una ventana que empieza en silencio toma el fin tras la voz', () => {
    const r = ajustar(letraDe([linea('a', 'A', 500), linea('b', 'B', 8000)]))
    expect(fin(r.letra, 'a')).toBe(3300)
  })

  it('sustituye un fin fijado y lo cuenta; si es igual no cambia', () => {
    const letra = tres()
    letra.lineas[0]!.fin_ms = 2500
    letra.lineas[1]!.fin_ms = 6100
    const r = ajustar(letra)
    expect(fin(r.letra, 'a')).toBe(3300)
    expect(r.finesFijadosCambiados).toBe(1)
    expect(r.cambios.map((c) => c.id)).toStrictEqual(['a', 'c'])
  })

  it('no toca líneas con palabras ni pausas, y la pausa limita la ventana', () => {
    const palabras = [{ texto: 'A', inicio_ms: 1000, fin_ms: 2000 }]
    const conPalabras = letraDe([linea('a', 'A', 1000, { palabras }), linea('b', 'B', 3700)])
    const r1 = ajustar(conPalabras)
    expect(r1.letra.lineas[0]).toStrictEqual(conPalabras.lineas[0])

    const r2 = ajustar(letraDe([linea('a', 'A', 3700), pausa('p', 5000), linea('b', 'B', 11000)]))
    // La voz llega hasta la pausa: la ventana acaba ahí y no hay silencio.
    expect(fin(r2.letra, 'a')).toBeNull()
    expect(r2.letra.lineas[1]).toStrictEqual(pausa('p', 5000))
    expect(validarInvariantesLetra(r2.letra.lineas)).toStrictEqual([])
  })

  it('con offset_ms los fines se expresan en tiempo de letra', () => {
    const r = ajustar(letraDe([linea('a', 'A', 750), linea('b', 'B', 3450)], 250))
    expect(fin(r.letra, 'a')).toBe(3050)
    expect(fin(r.letra, 'b')).toBe(5850)
  })

  it('la última línea llega hasta la duración', () => {
    const picos = generarPicos({
      duracionMs: DUR,
      tramos: [{ desdeMs: 1000, hastaMs: 14950, dbfs: -6 }]
    })
    const r = ajustar(letraDe([linea('a', 'A', 1000)]), picos)
    expect(r.lineasCambiadas).toBe(0)
  })

  it('las líneas sin voz en su ventana se anotan en sinVoz', () => {
    const r = ajustar(letraDe([linea('a', 'A', 7000), linea('b', 'B', 10500)]))
    expect(r.sinVoz).toStrictEqual(['a'])
  })

  it('activa la cuenta con un hueco largo; con la cuenta activa devuelve null', () => {
    const r = ajustar(tres())
    expect(r.espera).toStrictEqual({ ...ESPERA, cuenta: true })
    expect(ajustar(tres(), picosBase(), { ...ESPERA, cuenta: true }).espera).toBeNull()
    const sinHuecos = ajustar(letraDe([linea('a', 'A', 1000), linea('b', 'B', 3700)]))
    expect(sinHuecos.espera).toBeNull()
  })

  it('es determinista y no muta la entrada', () => {
    const letra = tres()
    const copia = structuredClone(letra)
    expect(ajustar(letra)).toStrictEqual(ajustar(letra))
    expect(letra).toStrictEqual(copia)
  })
})
