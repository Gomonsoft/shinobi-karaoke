// Entrada de `npm run calibrar:silencios -- <carpeta> [--ids a,b,c]` (tarea 0210). Solo lectura.
// Node 24 ejecuta TypeScript (--experimental-transform-types); el hook añade la resolución sin extensión.
import { register } from 'node:module'
import { realpath } from 'node:fs/promises'
import { resolve } from 'node:path'

register('./resolver-ts.mjs', import.meta.url)

const argumentos = process.argv.slice(2)
const iIds = argumentos.indexOf('--ids')
const ids = iIds === -1 ? undefined : (argumentos[iIds + 1] ?? '').split(',').filter(Boolean)
const carpeta = argumentos.find((a, i) => !a.startsWith('--') && (iIds === -1 || i !== iIds + 1))
if (!carpeta) {
  console.error('Uso: npm run calibrar:silencios -- <carpeta-de-biblioteca> [--ids a,b,c]')
  process.exit(1)
}

const { calibrar, formatearTabla } = await import('./calibrar-silencios.ts')
const resultado = await calibrar(await realpath(resolve(carpeta)), { ids })
console.log(formatearTabla(resultado))
