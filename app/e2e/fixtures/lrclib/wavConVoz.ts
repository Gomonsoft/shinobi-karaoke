import { writeFileSync } from 'node:fs'
import { VOZ_SINTETICA } from './servidor'

/** WAV PCM 16 bit estéreo, con un tono de 440 Hz en los cantos de la voz sintética (L = −R). */
export function escribirWavConVoz(ruta: string, tasa = 22050): void {
  const { segundos, periodoMs, duracionPulsoMs, desfaseMs } = VOZ_SINTETICA
  const n = segundos * tasa
  const b = Buffer.alloc(44 + n * 4)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 4, 4)
  b.write('WAVEfmt ', 8)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(2, 22)
  b.writeUInt32LE(tasa, 24)
  b.writeUInt32LE(tasa * 4, 28)
  b.writeUInt16LE(4, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(n * 4, 40)
  for (let i = 0; i < n; i++) {
    const ms = (i / tasa) * 1000
    const canta = ms >= desfaseMs && (ms - desfaseMs) % periodoMs < duracionPulsoMs
    const v = canta ? Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / tasa)) : 0
    b.writeInt16LE(v, 44 + i * 4)
    b.writeInt16LE(-v, 46 + i * 4)
  }
  writeFileSync(ruta, b)
}
