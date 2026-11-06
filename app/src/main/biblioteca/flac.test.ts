import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pulsosFlac, silencioFlac, silencioFlacSegundos } from './flac'

function crc(bytes: Uint8Array, bits: number, polinomio: number): number {
  const alto = 1 << (bits - 1)
  const mascara = (alto << 1) - 1
  let acumulado = 0
  for (const byte of bytes) {
    acumulado ^= byte << (bits - 8)
    for (let bit = 0; bit < 8; bit++) {
      const reducir = (acumulado & alto) !== 0
      acumulado = (acumulado << 1) & mascara
      if (reducir) acumulado ^= polinomio
    }
  }
  return acumulado
}

function leerFlac(flac: Buffer): { tramas: number; muestras: number; iniciosPulsos: number[] } {
  expect(flac.subarray(0, 8)).toEqual(Buffer.from([0x66, 0x4c, 0x61, 0x43, 0x80, 0, 0, 34]))
  const declaradas = Number(flac.readBigUInt64BE(18) & 0xfffffffffn)
  let posicion = 42
  let tramas = 0
  let muestras = 0
  let pulsoActivo = false
  const iniciosPulsos: number[] = []
  while (posicion < flac.length) {
    const inicio = posicion
    expect(flac.readUInt16BE(posicion)).toBe(0xfff8)
    const codigoBloque = flac[posicion + 2]! >> 4
    posicion += 4
    const primero = flac[posicion++]!
    const continuaciones = primero < 0x80 ? 0 : primero < 0xe0 ? 1 : 2
    let numero = primero & (0x7f >> continuaciones)
    for (let i = 0; i < continuaciones; i++) {
      const byte = flac[posicion++]!
      expect(byte & 0xc0).toBe(0x80)
      numero = (numero << 6) | (byte & 0x3f)
    }
    expect(numero).toBe(tramas)
    let cantidad = 4096
    if (codigoBloque === 7) {
      cantidad = flac.readUInt16BE(posicion) + 1
      posicion += 2
    } else {
      expect(codigoBloque).toBe(12)
    }
    expect(crc(flac.subarray(inicio, ++posicion), 8, 0x07)).toBe(0)

    const tipo = flac[posicion]
    if (tipo === 0x00) {
      expect(flac.subarray(posicion, posicion + 6)).toEqual(Buffer.alloc(6))
      posicion += 6
      pulsoActivo = false
    } else {
      expect(tipo).toBe(0x02)
      const ancho = 1 + cantidad * 2
      const izquierda = flac.subarray(posicion, posicion + ancho)
      expect(flac.subarray(posicion + ancho, posicion + 2 * ancho)).toEqual(izquierda)
      for (let i = 0; i < cantidad; i++) {
        const activo = izquierda.readInt16BE(1 + 2 * i) !== 0
        if (activo && !pulsoActivo) iniciosPulsos.push(muestras + i)
        pulsoActivo = activo
      }
      posicion += 2 * ancho
    }
    posicion += 2
    expect(crc(flac.subarray(inicio, posicion), 16, 0x8005)).toBe(0)
    tramas++
    muestras += cantidad
  }
  expect(posicion).toBe(flac.length)
  expect(declaradas).toBe(muestras)
  return { tramas, muestras, iniciosPulsos }
}

describe('FLAC de prueba', () => {
  it('conserva el tamaño por defecto y permite 30 s exactos', () => {
    expect(leerFlac(silencioFlac())).toEqual({ tramas: 11, muestras: 11 * 4096, iniciosPulsos: [] })
    expect(leerFlac(silencioFlacSegundos(30))).toEqual({
      tramas: 323,
      muestras: 30 * 44_100,
      iniciosPulsos: []
    })
  })

  it('codifica números de trama de tres bytes y admite hasta 65535 bloques', () => {
    const flac = silencioFlac(65_535)
    expect(Number(flac.readBigUInt64BE(18) & 0xfffffffffn)).toBe(65_535 * 4096)
    // Comprueba la transición 2047 → 2048 sin crear miles de aserciones para todo el máximo.
    expect(leerFlac(silencioFlac(2050)).tramas).toBe(2050)
    expect(() => silencioFlac(65_536)).toThrow(RangeError)
  })

  it('pone los clics en las muestras previstas incluso si cruzan bloques', () => {
    const flac = pulsosFlac({ segundos: 30, periodoMs: 2000, desfaseMs: 2000 })
    expect(leerFlac(flac)).toEqual({
      tramas: 323,
      muestras: 30 * 44_100,
      iniciosPulsos: Array.from({ length: 14 }, (_, i) => (i + 1) * 88_200)
    })
  })
})

const uv = process.env.SHINOBI_UV ?? 'uv'
const python = ['run', '--offline', '--no-sync', 'python', '-c']
const worker = resolve(__dirname, '../../../..', 'worker')
const hayPyAv = spawnSync(uv, [...python, 'import av'], { cwd: worker, timeout: 5000 }).status === 0

it.skipIf(!hayPyAv)('PyAV decodifica todas las muestras del FLAC de clics', () => {
  const resultado = spawnSync(
    uv,
    [
      ...python,
      'import av, sys, io; print(sum(f.samples for f in av.open(io.BytesIO(sys.stdin.buffer.read()), format="flac").decode(audio=0)))'
    ],
    {
      cwd: worker,
      input: pulsosFlac({ segundos: 30, periodoMs: 2000, desfaseMs: 2000 }),
      timeout: 5000
    }
  )
  expect(resultado.status, resultado.stderr?.toString()).toBe(0)
  expect(resultado.stdout.toString().trim()).toBe(String(30 * 44_100))
})
