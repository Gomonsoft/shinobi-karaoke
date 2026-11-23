import { describe, expect, it } from 'vitest'
import { cancionDosCantantes, cancionUnCantanteConCoros } from './__fixtures__/reparto'
import { envolvente, nivelEn, tramosCoro } from './coros'
import type { ElementoLetra } from './letra'

const coro = (id: string, inicio: number | null, fin: number | null): ElementoLetra => ({
  id,
  tipo: 'linea',
  texto: 'Eco inventado',
  inicio_ms: inicio,
  fin_ms: fin,
  palabras: null,
  parte: 'coro'
})
const letra = (lineas: ElementoLetra[], offset_ms = 0) => ({ lineas, offset_ms })

describe('tramosCoro', () => {
  it('de 150 ms antes del inicio a 300 ms después del fin, con el offset', () => {
    expect(tramosCoro(letra([coro('a', 5000, 6000)], 200), 30_000)).toEqual([
      { desdeMs: 5050, hastaMs: 6500 }
    ])
  })

  it('une los tramos separados por menos de 1 s (800 ms) y no los de 1,2 s', () => {
    // Tramos [850, 3300] y [x−150, …]: huecos entre tramos de 800 ms y de 1200 ms.
    const unidos = tramosCoro(letra([coro('a', 1000, 3000), coro('b', 4100, 5000)]), 30_000)
    expect(unidos).toEqual([{ desdeMs: 850, hastaMs: 5300 }])
    const separados = tramosCoro(letra([coro('a', 1000, 3000), coro('b', 4500, 5000)]), 30_000)
    expect(separados).toEqual([
      { desdeMs: 850, hastaMs: 3300 },
      { desdeMs: 4350, hastaMs: 5300 }
    ])
  })

  it('recorta a [0, duración] y se queda solo con las líneas de coro con inicio', () => {
    const l = letra([
      coro('a', 50, 500),
      coro('sin', null, null),
      { ...coro('c1', 2000, 3000), parte: undefined },
      coro('z', 29_900, 29_950)
    ])
    expect(tramosCoro(l, 30_000)).toEqual([
      { desdeMs: 0, hastaMs: 800 },
      { desdeMs: 29_750, hastaMs: 30_000 }
    ])
  })

  it('usa el fin efectivo cuando la línea no tiene fin', () => {
    const t = tramosCoro(
      letra([coro('a', 1000, null), { ...coro('b', 4000, 4500), parte: undefined }]),
      30_000
    )
    expect(t).toEqual([{ desdeMs: 850, hastaMs: 4300 }])
  })

  it('sin coros no hay tramos; con las canciones de ejemplo, uno o dos', () => {
    expect(tramosCoro(letra([]), 1000)).toEqual([])
    expect(tramosCoro(cancionDosCantantes().letra!, 30_000)).toHaveLength(2)
    expect(tramosCoro(cancionUnCantanteConCoros().letra!, 30_000)).toHaveLength(2)
  })
})

describe('envolvente y nivelEn', () => {
  const tramos = [{ desdeMs: 1000, hastaMs: 3000 }]

  it('rampas de 150 ms y meseta al nivel', () => {
    expect(envolvente(tramos, 0.5)).toEqual([
      [1000, 0],
      [1150, 0.5],
      [2850, 0.5],
      [3000, 0]
    ])
  })

  it('nivel 0 o sin tramos: vacía', () => {
    expect(envolvente(tramos, 0)).toEqual([])
    expect(envolvente([], 0.5)).toEqual([])
  })

  it('nivelEn interpola, vale 0 fuera y el nivel pleno en la meseta', () => {
    const p = envolvente(tramos, 0.6)
    expect(nivelEn(p, 500)).toBe(0)
    expect(nivelEn(p, 1000)).toBe(0)
    expect(nivelEn(p, 1075)).toBeCloseTo(0.3, 10)
    expect(nivelEn(p, 2000)).toBe(0.6)
    expect(nivelEn(p, 2925)).toBeCloseTo(0.3, 10)
    expect(nivelEn(p, 3500)).toBe(0)
    expect(nivelEn([], 100)).toBe(0)
  })

  it('un tramo de menos de 300 ms usa rampas de la mitad y los ms siguen creciendo', () => {
    const p = envolvente(
      [
        { desdeMs: 1000, hastaMs: 1200 },
        { desdeMs: 2200, hastaMs: 2201 }
      ],
      1
    )
    expect(p.slice(0, 3)).toEqual([
      [1000, 0],
      [1100, 1],
      [1200, 0]
    ])
    p.slice(1).forEach(([ms], i) => expect(ms).toBeGreaterThan(p[i]![0]))
  })

  it('entre dos tramos no unidos el nivel vuelve a 0', () => {
    const p = envolvente(
      [
        { desdeMs: 0, hastaMs: 1000 },
        { desdeMs: 2200, hastaMs: 3200 }
      ],
      0.4
    )
    expect(nivelEn(p, 1600)).toBe(0)
    expect(nivelEn(p, 2700)).toBe(0.4)
  })
})
