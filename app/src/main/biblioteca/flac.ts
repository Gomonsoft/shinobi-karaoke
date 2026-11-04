/** Generador mínimo de FLAC válido: silencio estéreo de 16 bits a 44,1 kHz. */

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

/**
 * Silencio de `bloques` × 4096 muestras (≈ 0,09 s por bloque). Cada bloque son
 * dos subtramas constantes de valor 0, así que ocupa pocos bytes.
 */
export function silencioFlac(bloques = 11): Buffer {
  const tramas: Buffer[] = []
  for (let n = 0; n < bloques; n++) {
    // Número de trama en UTF-8 (n < 128 con 11 bloques; se admite hasta 127).
    const cabecera = Buffer.from([0xff, 0xf8, 0xc9, 0x18, n & 0x7f])
    const sinCrc = Buffer.concat([cabecera, Buffer.from([crc8(cabecera)])])
    // Subtrama constante: byte de cabecera 0x00 + valor de 16 bits.
    const cuerpo = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    const trama = Buffer.concat([sinCrc, cuerpo])
    const pie = Buffer.alloc(2)
    pie.writeUInt16BE(crc16(trama))
    tramas.push(Buffer.concat([trama, pie]))
  }
  const tamanoTrama = tramas[0]!.length

  const info = Buffer.alloc(34)
  info.writeUInt16BE(MUESTRAS_POR_BLOQUE, 0)
  info.writeUInt16BE(MUESTRAS_POR_BLOQUE, 2)
  info.writeUIntBE(tamanoTrama, 4, 3)
  info.writeUIntBE(tamanoTrama, 7, 3)
  // 20 bits de frecuencia, 3 de canales-1, 5 de bits-1 y 36 de muestras totales.
  const empaquetado =
    (BigInt(FRECUENCIA) << 44n) | (1n << 41n) | (15n << 36n) | BigInt(MUESTRAS_POR_BLOQUE * bloques)
  info.writeBigUInt64BE(empaquetado, 10)
  // MD5 desconocido (16 bytes a cero).

  const bloqueInfo = Buffer.concat([Buffer.from([0x80, 0x00, 0x00, 0x22]), info])
  return Buffer.concat([Buffer.from('fLaC'), bloqueInfo, ...tramas])
}
