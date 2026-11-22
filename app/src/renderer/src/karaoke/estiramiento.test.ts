import { describe, expect, it } from 'vitest'
import { estirarTramo, type VelocidadEstiramiento } from './estiramiento'

const SR = 48000
const VELOCIDADES: VelocidadEstiramiento[] = [0.5, 0.75]

function seno(segundos: number, hz: number, amplitud = 0.5): Float32Array {
  const x = new Float32Array(Math.round(segundos * SR))
  for (let i = 0; i < x.length; i++) x[i] = amplitud * Math.sin((2 * Math.PI * hz * i) / SR)
  return x
}

/** Frecuencia por cruces ascendentes por cero con interpolación, en la parte central. */
function frecuencia(x: Float32Array): number {
  const desde = Math.floor(x.length * 0.1)
  const hasta = Math.floor(x.length * 0.9)
  let primero = -1
  let ultimo = -1
  let cruces = 0
  for (let i = desde + 1; i < hasta; i++) {
    if (x[i - 1]! < 0 && x[i]! >= 0) {
      const t = i - 1 + -x[i - 1]! / (x[i]! - x[i - 1]!)
      if (primero < 0) primero = t
      ultimo = t
      cruces++
    }
  }
  return ((cruces - 1) * SR) / (ultimo - primero)
}

describe('estirarTramo', () => {
  it.each(VELOCIDADES)('conserva el tono de un seno de 440 Hz a %s×', (v) => {
    const [salida] = estirarTramo([seno(3, 440)], SR, v)
    expect(Math.abs(frecuencia(salida!) / 440 - 1)).toBeLessThan(0.02)
  })

  it.each(VELOCIDADES)('da la duración esperada y no crea clics en las juntas a %s×', (v) => {
    const entrada = seno(3, 440)
    const [salida] = estirarTramo([entrada], SR, v)
    expect(Math.abs(salida!.length - Math.round(entrada.length / v))).toBeLessThanOrEqual(1)
    // La pendiente máxima de un seno de 440 Hz y 0,5 es 2π·440·0,5/SR; con margen 2×.
    const limite = (2 * (2 * Math.PI * 440 * 0.5)) / SR
    let salto = 0
    for (let i = 1; i < salida!.length; i++) {
      salto = Math.max(salto, Math.abs(salida![i]! - salida![i - 1]!))
    }
    expect(salto).toBeLessThan(limite)
    expect(Math.max(...salida!.slice(1000, 90_000))).toBeLessThan(0.55)
  })

  it.each(VELOCIDADES)('mantiene la posición de cada clic dentro de 10 ms a %s×', (v) => {
    const entrada = new Float32Array(10 * SR)
    const clics: number[] = []
    for (let t = 0.25; t < 9.9; t += 0.25) {
      const i = Math.round(t * SR)
      clics.push(i)
      for (let j = 0; j < 24; j++) entrada[i + j] = j % 2 ? -0.8 : 0.8
    }
    const [salida] = estirarTramo([entrada], SR, v)
    // Cada clic puede salir repetido (WSOLA a 0,5×); se mide el grupo más cercano a lo esperado.
    let peor = 0
    for (const i of clics) {
      const esperado = i / v
      const margen = Math.round(0.03 * SR)
      let mejor = Infinity
      for (let j = Math.round(esperado) - margen; j < esperado + margen; j++) {
        if (Math.abs(salida![j]!) > 0.3) mejor = Math.min(mejor, Math.abs(j - esperado))
      }
      peor = Math.max(peor, (mejor / SR) * 1000)
    }
    console.info(`error máximo de clic a ${v}×: ${peor.toFixed(2)} ms`)
    expect(peor).toBeLessThanOrEqual(10)
  })

  it('trata silencio, mono y estéreo con el mismo desplazamiento', () => {
    const silencio = estirarTramo([new Float32Array(SR)], SR, 0.5)
    expect(silencio[0]!.length).toBe(2 * SR)
    expect(Math.max(...silencio[0]!.map(Math.abs))).toBe(0)

    const izq = seno(2, 300)
    const der = seno(2, 300, 0.25)
    const [l, r] = estirarTramo([izq, der], SR, 0.75)
    expect(l!.length).toBe(r!.length)
    for (let i = 0; i < l!.length; i += 997) expect(r![i]!).toBeCloseTo(l![i]! / 2, 5)
    expect(estirarTramo([], SR, 0.5)).toEqual([])
    expect(estirarTramo([new Float32Array(100)], SR, 0.5)[0]!.length).toBe(200)
  })

  it('procesa 10 s estéreo a 48 kHz en un tiempo razonable', () => {
    const entrada = [seno(10, 220), seno(10, 330)]
    for (const v of VELOCIDADES) {
      const t0 = performance.now()
      estirarTramo(entrada, SR, v)
      const ms = performance.now() - t0
      console.info(`estirarTramo 10 s estéreo a ${v}×: ${ms.toFixed(0)} ms`)
      expect(ms).toBeLessThan(5000)
    }
  })
})
