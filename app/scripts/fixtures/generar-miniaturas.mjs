// Genera las miniaturas de la semilla (tarea 0052): degradado + formas, 320x180, sin imágenes de terceros.
// Uso (solo macOS, usa `sips` para pasar PNG a JPEG): node scripts/fixtures/generar-miniaturas.mjs
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const W = 320
const H = 180
const aqui = dirname(fileURLToPath(import.meta.url))

function crc32(buf) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(tipo, datos) {
  const t = Buffer.from(tipo)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(datos.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, datos])))
  return Buffer.concat([len, t, datos, crc])
}
function png(pixel) {
  const raw = Buffer.alloc((W * 3 + 1) * H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const [r, g, b] = pixel(x, y)
      const o = y * (W * 3 + 1) + 1 + x * 3
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
    }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}
const mezcla = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))

const disenos = {
  'miniatura-a.jpg': (x, y) => {
    let c = mezcla([20, 30, 90], [220, 70, 120], (x + y) / (W + H))
    if ((x - 220) ** 2 + (y - 90) ** 2 < 50 ** 2) c = [255, 214, 102]
    if (y > 130 && Math.abs(((x % 40) - 20) / 20) < (y - 130) / 50) c = [15, 15, 40]
    return c
  },
  'miniatura-b.jpg': (x, y) => {
    let c = mezcla([10, 90, 70], [240, 200, 60], x / W)
    const d = Math.abs(x - 100) + Math.abs(y - 90)
    if (d < 60 && d > 40) c = [255, 255, 255]
    if (x > 190 && x < 290 && y > 50 && y < 130 && (x + y) % 24 < 10) c = [20, 40, 60]
    return c
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'miniaturas-'))
try {
  for (const [nombre, f] of Object.entries(disenos)) {
    const origen = join(tmp, nombre + '.png')
    writeFileSync(origen, png(f))
    execFileSync('sips', ['-s', 'format', 'jpeg', origen, '--out', join(aqui, nombre)])
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
