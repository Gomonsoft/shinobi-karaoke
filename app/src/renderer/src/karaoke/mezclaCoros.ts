import type { PuntoEnvolvente } from '@shared/coros'

/** Pico máximo de la mezcla (el mismo de la exportación, ADR 0030 §4). */
export const PICO_MAXIMO = 0.999

/**
 * «Instrumental con coros» (ADR 0030 §4): `instrumental + voz × nivel(t)` muestra a muestra, con `nivel`
 * la interpolación lineal de `puntos` (`[ms, nivel]`, `ms` crecientes; 0 fuera). Si el pico pasa de 0,999
 * se escala todo, como en la exportación. Escribe sobre `instrumental` (el llamante entrega copias) y lo
 * devuelve; una voz de menos canales usa su primer canal. Pura: corre en un Web Worker.
 */
export function mezclarCoros(
  instrumental: Float32Array[],
  voz: Float32Array[],
  sampleRate: number,
  puntos: readonly PuntoEnvolvente[]
): Float32Array[] {
  if (puntos.length > 0 && voz.length > 0) {
    const primera = Math.max(0, Math.floor((puntos[0]![0] * sampleRate) / 1000))
    const ultima = Math.ceil((puntos[puntos.length - 1]![0] * sampleRate) / 1000)
    instrumental.forEach((canal, c) => {
      const origen = voz[c] ?? voz[0]!
      const fin = Math.min(canal.length, origen.length, ultima + 1)
      let k = 0 // puntos[k] es el último con ms <= el de la muestra
      for (let i = primera; i < fin; i++) {
        const ms = (i * 1000) / sampleRate
        while (k + 1 < puntos.length && puntos[k + 1]![0] <= ms) k++
        if (k + 1 >= puntos.length) break
        const [x0, y0] = puntos[k]!
        if (ms < x0) continue
        const [x1, y1] = puntos[k + 1]!
        canal[i] = canal[i]! + origen[i]! * (y0 + ((y1 - y0) * (ms - x0)) / (x1 - x0))
      }
    })
  }
  let pico = 0
  for (const canal of instrumental) {
    for (let i = 0; i < canal.length; i++) pico = Math.max(pico, Math.abs(canal[i]!))
  }
  if (pico > PICO_MAXIMO) {
    const escala = PICO_MAXIMO / pico
    for (const canal of instrumental) {
      for (let i = 0; i < canal.length; i++) canal[i] = canal[i]! * escala
    }
  }
  return instrumental
}
