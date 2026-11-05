/**
 * Validación local (sin red) de enlaces de YouTube (ux/03 §"Campo de enlace").
 * El worker vuelve a validar con las mismas reglas (tabla de casos compartida:
 * `__fixtures__/youtube-urls.json`).
 */

export type CodigoUrlYoutube = 'URL_NO_VALIDA' | 'URL_NO_SOPORTADA'

export type ResultadoUrlYoutube =
  { ok: true; idVideo: string; urlCanonica: string } | { ok: false; codigo: CodigoUrlYoutube }

export const MAX_LONGITUD_URL_YOUTUBE = 2048

const ID_VIDEO = /^[A-Za-z0-9_-]{11}$/
const HOSTS_YOUTUBE = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com'
])
const HOSTS_CORTOS = new Set(['youtu.be', 'www.youtu.be'])

const NO_VALIDA: ResultadoUrlYoutube = { ok: false, codigo: 'URL_NO_VALIDA' }
const NO_SOPORTADA: ResultadoUrlYoutube = { ok: false, codigo: 'URL_NO_SOPORTADA' }

function resultadoDeId(id: string | undefined): ResultadoUrlYoutube {
  if (id === undefined || !ID_VIDEO.test(id)) return NO_VALIDA
  return { ok: true, idVideo: id, urlCanonica: `https://www.youtube.com/watch?v=${id}` }
}

/** Primer segmento no vacío del camino y el resto, o null si no hay camino. */
function segmentos(pathname: string): string[] {
  return pathname.split('/').filter((s) => s !== '')
}

export function analizarUrlYoutube(texto: string): ResultadoUrlYoutube {
  const t = typeof texto === 'string' ? texto.trim() : ''
  if (t === '' || t.length > MAX_LONGITUD_URL_YOUTUBE || /\s/.test(t)) return NO_VALIDA

  let candidata = t
  if (!/^https?:\/\//i.test(t)) {
    // Otro esquema (javascript:, data:, ftp://…) → no válido. `host:puerto` no es un esquema.
    if (/^[a-z][a-z0-9+.-]*:(?!\d+(\/|$))/i.test(t) || t.startsWith('//')) return NO_VALIDA
    candidata = `https://${t}`
  }

  let url: URL
  try {
    url = new URL(candidata)
  } catch {
    return NO_VALIDA
  }
  // Sin credenciales ni puerto (ni siquiera el predeterminado, que `URL` normaliza).
  const autoridad = candidata.replace(/^https?:\/\//i, '').split(/[/?#]/)[0] ?? ''
  if (/[@:]/.test(autoridad) || url.username !== '' || url.password !== '') return NO_VALIDA

  const host = url.hostname.toLowerCase()
  const partes = segmentos(url.pathname)

  if (HOSTS_CORTOS.has(host)) {
    if (partes.length !== 1) return NO_VALIDA
    return resultadoDeId(partes[0])
  }
  if (!HOSTS_YOUTUBE.has(host)) return NO_VALIDA

  const primero = partes[0]
  if (primero === 'playlist') return NO_SOPORTADA
  if (primero === 'live') return partes.length === 2 ? NO_SOPORTADA : NO_VALIDA
  if (primero === 'shorts') return partes.length === 2 ? resultadoDeId(partes[1]) : NO_VALIDA
  if (primero === 'watch' && partes.length === 1) {
    const v = url.searchParams.get('v')
    if (v === null || v === '') return url.searchParams.has('list') ? NO_SOPORTADA : NO_VALIDA
    // `watch?v=…&list=…` se acepta como vídeo (se ignora la lista: noplaylist).
    return resultadoDeId(v)
  }
  return NO_VALIDA
}
