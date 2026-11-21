// Regenera `build/icon.png` y `build/icon.ico` a partir de `build/icon.svg` (48 px o más) y
// `build/icon-mini.svg` (16, 20 y 24 px). Uso: `node scripts/icono.mjs` desde `app/`.
// Rasteriza con el navegador de Playwright; `ICONO_CANAL=msedge` usa el Edge instalado.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const BUILD = join(dirname(fileURLToPath(import.meta.url)), '..', 'build')

/** Tamaños del `.ico` y dibujo que usa cada uno. A 24 px o menos, dos letras no se leen. */
export const TAMANOS_ICO = [
  [16, 'icon-mini.svg'],
  [20, 'icon-mini.svg'],
  [24, 'icon-mini.svg'],
  [32, 'icon.svg'],
  [40, 'icon.svg'],
  [48, 'icon.svg'],
  [64, 'icon.svg'],
  [128, 'icon.svg'],
  [256, 'icon.svg']
]

/** Empaqueta PNG en un `.ico` (entradas PNG, válidas desde Windows Vista). */
export function componerIco(entradas) {
  const cabecera = Buffer.alloc(6 + 16 * entradas.length)
  cabecera.writeUInt16LE(0, 0)
  cabecera.writeUInt16LE(1, 2)
  cabecera.writeUInt16LE(entradas.length, 4)
  let desplazamiento = cabecera.length
  entradas.forEach(({ tamano, png }, i) => {
    const base = 6 + 16 * i
    const lado = tamano >= 256 ? 0 : tamano
    cabecera.writeUInt8(lado, base)
    cabecera.writeUInt8(lado, base + 1)
    cabecera.writeUInt16LE(1, base + 4)
    cabecera.writeUInt16LE(32, base + 6)
    cabecera.writeUInt32LE(png.length, base + 8)
    cabecera.writeUInt32LE(desplazamiento, base + 12)
    desplazamiento += png.length
  })
  return Buffer.concat([cabecera, ...entradas.map((e) => e.png)])
}

async function principal() {
  const navegador = await chromium.launch(
    process.env.ICONO_CANAL ? { channel: process.env.ICONO_CANAL } : {}
  )
  const rasterizar = async (archivo, tamano) => {
    const svg = readFileSync(join(BUILD, archivo), 'utf8')
    const pagina = await navegador.newPage({
      viewport: { width: tamano, height: tamano },
      deviceScaleFactor: 1
    })
    await pagina.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${tamano}px;height:${tamano}px}</style>${svg}`
    )
    const png = await pagina.screenshot({ omitBackground: true })
    await pagina.close()
    return png
  }
  try {
    writeFileSync(join(BUILD, 'icon.png'), await rasterizar('icon.svg', 1024))
    const entradas = []
    for (const [tamano, archivo] of TAMANOS_ICO) {
      entradas.push({ tamano, png: await rasterizar(archivo, tamano) })
    }
    writeFileSync(join(BUILD, 'icon.ico'), componerIco(entradas))
    console.log(`icon.png (1024) e icon.ico (${TAMANOS_ICO.map(([t]) => t).join(', ')})`)
  } finally {
    await navegador.close()
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await principal()
