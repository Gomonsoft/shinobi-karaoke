// Entrada de `npm run calibrar:dudosas -- <carpeta> [--ids a,b,c] [--json]` (tarea 0334). Solo lectura.
// Node 24 ejecuta TypeScript (--experimental-transform-types); el hook añade la resolución sin extensión.
import { register } from 'node:module'
import { realpath } from 'node:fs/promises'
import { resolve } from 'node:path'

register('./resolver-ts.mjs', import.meta.url)

const argumentos = process.argv.slice(2)
const iIds = argumentos.indexOf('--ids')
const ids = iIds === -1 ? undefined : (argumentos[iIds + 1] ?? '').split(',').filter(Boolean)
const json = argumentos.includes('--json')
const carpeta = argumentos.find((a, i) => !a.startsWith('--') && (iIds === -1 || i !== iIds + 1))
if (!carpeta) {
  console.error('Uso: npm run calibrar:dudosas -- <carpeta-de-biblioteca> [--ids a,b,c] [--json]')
  process.exit(1)
}

const { calibrarDudosas, formatearDudosas } = await import('./calibrar-dudosas.ts')
const resultado = await calibrarDudosas(await realpath(resolve(carpeta)), { ids })
console.log(json ? JSON.stringify(resultado, null, 2) : formatearDudosas(resultado))
