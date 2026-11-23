import { describe, expect, it } from 'vitest'
import { arranquesDe, medirInicios, type VentanaInicios } from './calibrar-inicios'

const V: VentanaInicios = { pausaMinimaMs: 250, antesMs: 300, despuesMs: 150 }
const DUR = 120_000

/** Cantos de duraciones y huecos irregulares: [inicio, fin]. */
function cantos(n: number, primero = 3000): [number, number][] {
  const salida: [number, number][] = []
  let t = primero
  for (let i = 0; i < n; i++) {
    const dur = 1500 + ((i * 7) % 5) * 400
    salida.push([t, t + dur])
    t += dur + 700 + ((i * 11) % 6) * 450
  }
  return salida
}

describe('señal por inicios (0385)', () => {
  const voz = cantos(24)
  const arranques = arranquesDe(voz, V.pausaMinimaMs)
  // Un LRC marca algo antes de cantar: 100 ms.
  const inicios = voz.map(([a]) => a - 100)

  it('una letra sin fines sobre voz con pausas: O* y contraste altos; movida 0,8 s, bajan', () => {
    const propia = medirInicios(inicios, arranques, DUR, V, true)!
    expect(propia.arranques).toBe(24)
    expect(propia.ostar0).toBeGreaterThan(0.9)
    expect(propia.contraste).toBeGreaterThan(0.8)
    expect(Math.abs(propia.dStar!)).toBeLessThanOrEqual(200)

    const movida = medirInicios(
      inicios.map((x) => x + 800),
      arranques,
      DUR,
      V,
      true
    )!
    expect(movida.ostar0).toBeLessThan(0.3)
    // La corrección estimada vuelve a la propia (meseta: ±200 ms).
    expect(Math.abs(movida.dStar! + 800)).toBeLessThanOrEqual(200)
    expect(movida.borde).toBe(false)
  })

  it('voz casi continua: casi no hay arranques', () => {
    const continua: [number, number][] = Array.from({ length: 30 }, (_, i) => [
      2000 + i * 3120,
      5000 + i * 3120
    ])
    const arr = arranquesDe(continua, V.pausaMinimaMs)
    expect(arr).toHaveLength(1)
    const m = medirInicios(
      continua.map(([a]) => a),
      arr,
      DUR,
      V,
      false
    )!
    expect(m.arranques).toBe(1)
    expect(Math.abs(m.ostar0)).toBeLessThan(0.1)
  })

  it('una letra ajena: O* cerca de 0', () => {
    // Otro ritmo: huecos y duraciones que no coinciden con los de la voz.
    const ajena = Array.from({ length: 30 }, (_, i) => 1234 + i * 2917 + ((i * 5) % 4) * 331)
    const m = medirInicios(ajena, arranques, DUR, V, false)!
    expect(Math.abs(m.ostar0)).toBeLessThan(0.25)
  })

  it('el azar analítico coincide con el contado sobre inicios repartidos a lo largo del tramo (±0,02)', () => {
    const largo = cantos(400)
    const arr = arranquesDe(largo, V.pausaMinimaMs)
    const fin = largo[largo.length - 1]![0]
    // Generador congruencial determinista: inicios repartidos al azar sobre todo el tramo.
    let s = 12345
    const azar = (): number => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648
    const random = Array.from({ length: 4000 }, () => 3000 + azar() * (fin - 3000))
    const m = medirInicios(random, arr, fin + 5000, V, false)!
    expect(Math.abs(m.o0 - m.azar0)).toBeLessThanOrEqual(0.02)
    expect(Math.abs(m.ostar0)).toBeLessThanOrEqual(0.03)
  })

  it('menos de 5 líneas: no medible', () => {
    expect(medirInicios([1000, 2000], arranques, DUR, V, true)).toBeNull()
  })
})
