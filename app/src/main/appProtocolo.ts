/**
 * Protocolo `shinobi-app://app/` que sirve el renderer compilado (ADR 0008, tarea 0022).
 * Lógica sobre `fs` sin Electron para poder probarla.
 */
import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { extname, join, sep } from 'node:path'
import { Readable } from 'node:stream'

export const ESQUEMA_APP = 'shinobi-app'
export const HOST_APP = 'app'
/** Origen del renderer en producción. */
export const ORIGEN_APP = `${ESQUEMA_APP}://${HOST_APP}`

const TIPOS: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8'
}

const CABECERAS = { 'X-Content-Type-Options': 'nosniff' }

function noEncontrado(): Response {
  return new Response('No encontrado', { status: 404, headers: CABECERAS })
}

/** Ruta relativa segura dentro de la carpeta del renderer, o `null`. */
export function rutaRelativaApp(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== `${ESQUEMA_APP}:` || u.hostname !== HOST_APP) return null
  if (u.username || u.password || u.port) return null
  // Sin decodificar: `%2e%2e`, `%2f`, `\` y similares no son nombres válidos.
  if (/%|\\/.test(u.pathname)) return null
  const partes = u.pathname.split('/').filter((p) => p !== '')
  if (partes.some((p) => p === '.' || p === '..')) return null
  return partes.length === 0 ? 'index.html' : partes.join('/')
}

/** Atiende `shinobi-app://app/<ruta>` con archivos de `dirRenderer` (confinados con `realpath`). */
export async function servirRenderer(
  dirRenderer: string,
  url: string,
  metodo: string
): Promise<Response> {
  if (metodo !== 'GET' && metodo !== 'HEAD') return noEncontrado()
  const rel = rutaRelativaApp(url)
  if (!rel) return noEncontrado()
  const tipo = TIPOS[extname(rel).toLowerCase()]
  if (!tipo) return noEncontrado()
  try {
    const raiz = await realpath(dirRenderer)
    const real = await realpath(join(raiz, ...rel.split('/')))
    if (!real.startsWith(raiz + sep)) return noEncontrado()
    const info = await stat(real)
    if (!info.isFile()) return noEncontrado()
    const cabeceras = { ...CABECERAS, 'Content-Type': tipo, 'Content-Length': String(info.size) }
    if (metodo === 'HEAD' || info.size === 0) return new Response(null, { headers: cabeceras })
    const flujo = Readable.toWeb(createReadStream(real))
    return new Response(flujo as unknown as ReadableStream, { headers: cabeceras })
  } catch {
    return noEncontrado()
  }
}
