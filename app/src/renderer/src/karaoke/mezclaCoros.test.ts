import { describe, expect, it } from 'vitest'
import { envolvente } from '@shared/coros'
import { mezclarCoros } from './mezclaCoros'

const SR = 8000
const tono = (segundos: number, hz: number, amp: number): Float32Array =>
  Float32Array.from(
    { length: segundos * SR },
    (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / SR)
  )
const rmsDb = (x: Float32Array, desdeS: number, hastaS: number): number => {
  const parte = x.slice(Math.floor(desdeS * SR), Math.floor(hastaS * SR))
  return 20 * Math.log10(Math.sqrt(parte.reduce((s, v) => s + v * v, 0) / parte.length) + 1e-12)
}

describe('mezclarCoros (instrumental + voz × envolvente)', () => {
  const puntos = envolvente([{ desdeMs: 2000, hastaMs: 5000 }], 0.5)

  it('C2-E3: en el coro suena la voz al 50 % (± 1 dB) sobre el instrumental; fuera, solo el instrumental', () => {
    const inst = tono(8, 220, 0.3)
    const voz = tono(8, 330, 0.4)
    const solo = rmsDb(inst, 3, 4)
    const [m] = mezclarCoros([inst.slice()], [voz], SR, puntos)
    // Esperado: potencia del instrumental + (0,5 × voz)² (tonos distintos: se suman las potencias).
    const esperado = 10 * Math.log10(0.3 ** 2 / 2 + (0.5 * 0.4) ** 2 / 2)
    expect(Math.abs(rmsDb(m!, 3, 4) - esperado)).toBeLessThan(1)
    expect(rmsDb(m!, 3, 4)).toBeGreaterThan(solo)
    // A más de 450 ms de los tramos: idéntico al instrumental.
    for (const i of [0, Math.floor(1.5 * SR), Math.floor(5.5 * SR), 8 * SR - 1]) {
      expect(m![i]).toBe(inst[i])
    }
  })

  it('las rampas son lineales: a media subida, la mitad del nivel', () => {
    const inst = new Float32Array(8 * SR)
    const voz = new Float32Array(8 * SR).fill(0.8)
    const [m] = mezclarCoros([inst], [voz], SR, puntos)
    expect(m![Math.round(2.075 * SR)]).toBeCloseTo(0.8 * 0.25, 2)
    expect(m![Math.round(3.5 * SR)]).toBeCloseTo(0.4, 5)
  })

  it('sin puntos devuelve el instrumental tal cual', () => {
    const inst = tono(2, 220, 0.3)
    const [m] = mezclarCoros([inst.slice()], [tono(2, 330, 0.4)], SR, [])
    expect(Array.from(m!)).toEqual(Array.from(inst))
  })

  it('escala todo si el pico pasa de 0,999, sin recortar', () => {
    const inst = new Float32Array(2 * SR).fill(0.9)
    const voz = new Float32Array(2 * SR).fill(0.9)
    const [m] = mezclarCoros([inst], [voz], SR, envolvente([{ desdeMs: 0, hastaMs: 2000 }], 1))
    const pico = Math.max(...Array.from(m!).map(Math.abs))
    expect(pico).toBeCloseTo(0.999, 6)
  })

  it('una voz mono se usa en los dos canales', () => {
    const inst = [new Float32Array(SR), new Float32Array(SR)]
    const voz = [new Float32Array(SR).fill(0.2)]
    const [a, b] = mezclarCoros(inst, voz, SR, envolvente([{ desdeMs: 0, hastaMs: 1000 }], 1))
    expect(a![SR / 2]).toBeCloseTo(0.2)
    expect(b![SR / 2]).toBeCloseTo(0.2)
  })
})
