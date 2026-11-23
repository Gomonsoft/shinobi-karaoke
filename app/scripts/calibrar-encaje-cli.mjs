// Entrada de `npm run calibrar:encaje -- <carpeta> [--ids a,b,c] [--json] [--variantes]` (tareas 0368 y 0371). Solo lectura.
// Con --variantes compara tal cual / sin fines / sin fines + prudentes (pregunta 0222).
// Node 24 ejecuta TypeScript (--experimental-transform-types); el hook añade la resolución sin extensión.
import { register } from 'node:module'
import { realpath } from 'node:fs/promises'
import { resolve } from 'node:path'

register('./resolver-ts.mjs', import.meta.url)

const argumentos = process.argv.slice(2)
const iIds = argumentos.indexOf('--ids')
const ids = iIds === -1 ? undefined : (argumentos[iIds + 1] ?? '').split(',').filter(Boolean)
const variantes = argumentos.includes('--variantes')
const json = argumentos.includes('--json')
const carpeta = argumentos.find((a, i) => !a.startsWith('--') && (iIds === -1 || i !== iIds + 1))
if (!carpeta) {
  console.error(
    'Uso: npm run calibrar:encaje -- <carpeta-de-biblioteca> [--ids a,b,c] [--json] [--variantes]'
  )
  process.exit(1)
}

const { calibrarEncaje, formatearEncaje } = await import('./calibrar-encaje.ts')
const resultado = await calibrarEncaje(await realpath(resolve(carpeta)), { ids, variantes })
console.log(json ? JSON.stringify(resultado, null, 2) : formatearEncaje(resultado))
