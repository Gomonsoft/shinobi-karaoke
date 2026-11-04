import { createReadStream } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { Readable } from 'node:stream'

/** Esquema del protocolo de medios (0012). */
export const ESQUEMA_MEDIOS = 'shinobi-media'

/** Única lista blanca de rutas servibles (relativas a `biblioteca/<id>/`) y su tipo MIME. */
const PERMITIDOS: Readonly<Record<string, string>> = {
  'fuente/mezcla.flac': 'audio/flac',
  'fuente/miniatura.jpg': 'image/jpeg',
  'pistas/voz.flac': 'audio/flac',
  'pistas/instrumental.flac': 'audio/flac'
}

/** Los ids son UUID; el host de un esquema `standard` llega en minúsculas. */
const ID_VALIDO = /^[a-z0-9][a-z0-9-]{0,63}$/

/** Cabeceras comunes (las de CORS se añaden aparte, según el origen: ADR 0008). */
const CABECERAS_BASE = {
  'Accept-Ranges': 'bytes',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
}

/** Origen del renderer vigente y `Origin` de la petición (`null` si no lo trae). */
export interface CorsMedios {
  origenRenderer: string
  origenPeticion: string | null
}

/** CORS exacto (ADR 0008): nunca `*`; con `Origin` distinto no se sirve nada. */
function cabecerasCors(cors: CorsMedios | undefined): Record<string, string> {
  if (!cors) return {}
  return { 'Access-Control-Allow-Origin': cors.origenRenderer, Vary: 'Origin' }
}

function noEncontrado(cors?: CorsMedios): Response {
  return new Response('No encontrado', { status: 404, headers: cabecerasCors(cors) })
}

function rangoNoSatisfacible(tam: number, cors?: CorsMedios): Response {
  return new Response(null, {
    status: 416,
    headers: { ...CABECERAS_BASE, ...cabecerasCors(cors), 'Content-Range': `bytes */${tam}` }
  })
}

/** Extrae `{ id, ruta }` de la URL o `null` si no es válida / no está en la lista blanca. */
export function interpretarUrlMedios(url: string): { id: string; ruta: string } | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== `${ESQUEMA_MEDIOS}:`) return null
  if (u.username || u.password || u.port || u.search || u.hash) return null
  const id = u.hostname
  if (!ID_VALIDO.test(id)) return null
  // Se compara el pathname tal cual (sin decodificar): `%2e%2e`, `\`, etc. no están en la lista blanca.
  const ruta = u.pathname.replace(/^\//, '')
  if (!Object.hasOwn(PERMITIDOS, ruta)) return null
  return { id, ruta }
}

type Rango = { inicio: number; fin: number } | 'invalido' | null

/** Interpreta `Range: bytes=a-b` (un solo rango; varios o sintaxis rara se ignoran como petición completa). */
export function interpretarRango(cabecera: string | null, tam: number): Rango {
  if (!cabecera) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(cabecera.trim())
  if (!m) return null
  const [, a = '', b = ''] = m
  if (a === '' && b === '') return null
  let inicio: number
  let fin: number
  if (a === '') {
    const sufijo = Number(b)
    if (sufijo === 0) return 'invalido'
    inicio = Math.max(0, tam - sufijo)
    fin = tam - 1
  } else {
    inicio = Number(a)
    fin = b === '' ? tam - 1 : Math.min(Number(b), tam - 1)
  }
  if (!Number.isSafeInteger(inicio) || !Number.isSafeInteger(fin)) return 'invalido'
  if (inicio >= tam || inicio > fin) return 'invalido'
  return { inicio, fin }
}

/**
 * Atiende una petición `shinobi-media://<id>/<ruta>` con archivos de `<dirBiblioteca>/<id>/`.
 * Cualquier fallo (id/ruta no permitidos, inexistente, enlace simbólico que escapa) devuelve 404
 * sin detalles.
 */
export async function servirMedio(
  dirBiblioteca: string,
  url: string,
  metodo: string,
  cabeceraRango: string | null,
  cors?: CorsMedios
): Promise<Response> {
  // Otro origen: 404 sin cabeceras CORS. Sin `Origin` (p. ej. `<audio src>`) se sirve igual.
  if (cors && cors.origenPeticion !== null && cors.origenPeticion !== cors.origenRenderer)
    return noEncontrado()
  const conCors = cors
  if (metodo !== 'GET' && metodo !== 'HEAD') return noEncontrado(conCors)
  const pedido = interpretarUrlMedios(url)
  if (!pedido) return noEncontrado(conCors)

  let rutaReal: string
  let tam: number
  try {
    const raiz = await realpath(join(dirBiblioteca, pedido.id))
    const raizBiblioteca = await realpath(dirBiblioteca)
    // La carpeta de la canción debe ser hija directa de la biblioteca (no un enlace hacia fuera).
    if (raiz !== join(raizBiblioteca, pedido.id)) return noEncontrado(conCors)
    rutaReal = await realpath(join(raiz, ...pedido.ruta.split('/')))
    if (!rutaReal.startsWith(raiz + sep)) return noEncontrado(conCors)
    const info = await stat(rutaReal)
    if (!info.isFile()) return noEncontrado(conCors)
    tam = info.size
  } catch {
    return noEncontrado(conCors)
  }

  const tipo = PERMITIDOS[pedido.ruta] as string
  const rango = interpretarRango(cabeceraRango, tam)
  if (rango === 'invalido') return rangoNoSatisfacible(tam, conCors)

  const inicio = rango ? rango.inicio : 0
  const fin = rango ? rango.fin : tam - 1
  const longitud = tam === 0 ? 0 : fin - inicio + 1
  const cabeceras: Record<string, string> = {
    ...CABECERAS_BASE,
    ...cabecerasCors(conCors),
    'Content-Type': tipo,
    'Content-Length': String(longitud)
  }
  if (rango) cabeceras['Content-Range'] = `bytes ${inicio}-${fin}/${tam}`
  const status = rango ? 206 : 200
  if (metodo === 'HEAD' || longitud === 0) return new Response(null, { status, headers: cabeceras })

  const flujo = Readable.toWeb(createReadStream(rutaReal, { start: inicio, end: fin }))
  return new Response(flujo as unknown as ReadableStream, { status, headers: cabeceras })
}
