/** Generador de FLAC estéreo de 16 bits a 44,1 kHz para pruebas. */

const MUESTRAS_POR_BLOQUE = 4096
const FRECUENCIA = 44100

function crc8(bytes: Uint8Array): number {
  let crc = 0
  for (const b of bytes) {
    crc ^= b
    for (let i = 0; i < 8; i++) crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff
  }
  return crc
}

function crc16(bytes: Uint8Array): number {
  let crc = 0
  for (const b of bytes) {
    crc ^= b << 8
    for (let i = 0; i < 8; i++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x8005) & 0xffff : (crc << 1) & 0xffff
  }
  return crc
}

const MAX_BLOQUES = 65_535
const SILENCIO = Buffer.alloc(6)

function numeroTrama(n: number): number[] {
  if (n < 0x80) return [n]
  if (n < 0x800) return [0xc0 | (n >> 6), 0x80 | (n & 0x3f)]
  return [0xe0 | (n >> 12), 0x80 | ((n >> 6) & 0x3f), 0x80 | (n & 0x3f)]
}

function generarFlac(
  muestras: number,
  subtramas: (inicio: number, cantidad: number) => Buffer = () => SILENCIO
): Buffer {
  const bloques = Math.ceil(muestras / MUESTRAS_POR_BLOQUE)
  if (!Number.isSafeInteger(muestras) || muestras <= 0 || bloques > MAX_BLOQUES) {
    throw new RangeError('La duración debe ocupar entre 1 y 65535 bloques FLAC.')
  }
  const tramas: Buffer[] = []
  let minimo = Infinity
  let maximo = 0
  for (let n = 0; n < bloques; n++) {
    const inicio = n * MUESTRAS_POR_BLOQUE
    const cantidad = Math.min(muestras - inicio, MUESTRAS_POR_BLOQUE)
    const completa = cantidad === MUESTRAS_POR_BLOQUE
    const cabecera = Buffer.from([
      0xff,
      0xf8,
      completa ? 0xc9 : 0x79,
      0x18,
      ...numeroTrama(n),
      ...(completa ? [] : [(cantidad - 1) >> 8, (cantidad - 1) & 0xff])
    ])
    const trama = Buffer.concat([
      cabecera,
      Buffer.from([crc8(cabecera)]),
      subtramas(inicio, cantidad)
    ])
    const pie = Buffer.alloc(2)
    pie.writeUInt16BE(crc16(trama))
    const completaConCrc = Buffer.concat([trama, pie])
    minimo = Math.min(minimo, completaConCrc.length)
    maximo = Math.max(maximo, completaConCrc.length)
    tramas.push(completaConCrc)
  }

  const info = Buffer.alloc(34)
  info.writeUInt16BE(MUESTRAS_POR_BLOQUE, 0)
  info.writeUInt16BE(MUESTRAS_POR_BLOQUE, 2)
  info.writeUIntBE(minimo, 4, 3)
  info.writeUIntBE(maximo, 7, 3)
  // 20 bits de frecuencia, 3 de canales-1, 5 de bits-1 y 36 de muestras totales.
  const empaquetado = (BigInt(FRECUENCIA) << 44n) | (1n << 41n) | (15n << 36n) | BigInt(muestras)
  info.writeBigUInt64BE(empaquetado, 10)
  const bloqueInfo = Buffer.concat([Buffer.from([0x80, 0x00, 0x00, 0x22]), info])
  return Buffer.concat([Buffer.from('fLaC'), bloqueInfo, ...tramas])
}

/** Silencio de `bloques` bloques completos de 4096 muestras. */
export function silencioFlac(bloques = 11): Buffer {
  if (!Number.isInteger(bloques)) throw new RangeError('El número de bloques debe ser entero.')
  return generarFlac(MUESTRAS_POR_BLOQUE * bloques)
}

export function silencioFlacSegundos(segundos: number): Buffer {
  return generarFlac(Math.round(segundos * FRECUENCIA))
}

interface OpcionesPulsos {
  segundos: number
  periodoMs?: number
  duracionPulsoMs?: number
  amplitud?: number
  desfaseMs?: number
}

/** Ráfagas de onda cuadrada a 1 kHz. Los bloques sin ráfaga son silencio constante. */
export function pulsosFlac({
  segundos,
  periodoMs = 1000,
  duracionPulsoMs = 15,
  amplitud = 0.5,
  desfaseMs = 0
}: OpcionesPulsos): Buffer {
  if (
    ![periodoMs, duracionPulsoMs, amplitud, desfaseMs].every(Number.isFinite) ||
    periodoMs < 1000 / FRECUENCIA ||
    duracionPulsoMs <= 0 ||
    duracionPulsoMs > periodoMs ||
    amplitud < 0 ||
    amplitud > 1 ||
    desfaseMs < 0
  )
    throw new RangeError('Los parámetros de los pulsos no son válidos.')

  const muestrasPorMs = FRECUENCIA / 1000
  const duracionPulso = Math.max(1, Math.round(duracionPulsoMs * muestrasPorMs))
  const pico = Math.round(amplitud * 32767)
  const muestraPulso = (k: number) => Math.round((desfaseMs + k * periodoMs) * muestrasPorMs)
  let k = 0
  return generarFlac(Math.round(segundos * FRECUENCIA), (inicio, cantidad) => {
    const fin = inicio + cantidad
    let pulso = muestraPulso(k)
    if (pico === 0 || pulso >= fin) return SILENCIO

    // VERBATIM: cabecera 0x02 seguida de las muestras del primer canal, luego el segundo.
    const mono = Buffer.alloc(1 + 2 * cantidad)
    mono[0] = 0x02
    while (pulso < fin) {
      const ultimo = Math.min(fin, pulso + duracionPulso)
      for (let muestra = Math.max(inicio, pulso); muestra < ultimo; muestra++) {
        const fase = ((muestra - pulso) * 1000) % FRECUENCIA
        mono.writeInt16BE(fase * 2 < FRECUENCIA ? pico : -pico, 1 + 2 * (muestra - inicio))
      }
      if (pulso + duracionPulso > fin) break
      pulso = muestraPulso(++k)
    }
    return Buffer.concat([mono, mono])
  })
}
