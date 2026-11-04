// Crea una biblioteca de desarrollo (ver tarea 0009). Uso: npm run semilla [-- --limpiar]
// Node 24 ejecuta TypeScript (--experimental-transform-types); el hook añade la resolución sin extensión.
import { register } from 'node:module'
import { resolve } from 'node:path'

register('./resolver-ts.mjs', import.meta.url)

const { sembrar } = await import('../src/main/biblioteca/semilla.ts')
const datos = resolve(process.env.SHINOBI_DATOS || '.datos-dev')
const limpiar = process.argv.includes('--limpiar')
const r = await sembrar(datos, { limpiar })
console.log(`Datos: ${datos}`)
console.log(`Creadas: ${r.creadas.length}; ya existían: ${r.existentes.length}`)
