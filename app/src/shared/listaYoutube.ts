/**
 * Reconocimiento local (sin red) de enlaces de lista o álbum de YouTube (ADR 0026 §1). Lo usan main y el
 * renderer (la tabla del lote decide qué enlaces son listas); el worker vuelve a validar con las mismas reglas.
 */
import { MAX_LONGITUD_URL_YOUTUBE, type CodigoUrlYoutube } from './youtube'

export type TipoLista = 'lista' | 'album'

export type ResultadoUrlLista =
  | { ok: true; idLista: string; tipo: TipoLista; urlCanonica: string }
  | { ok: false; codigo: CodigoUrlYoutube }

const HOSTS_YOUTUBE = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com'
])
const HOSTS_CORTOS = new Set(['youtu.be', 'www.youtu.be'])
const ID_LISTA = /^[A-Za-z0-9_-]{10,64}$/
const NO_VALIDA: ResultadoUrlLista = { ok: false, codigo: 'URL_NO_VALIDA' }
const NO_SOPORTADA: ResultadoUrlLista = { ok: false, codigo: 'URL_NO_SOPORTADA' }

/** `album` (`OLAK5uy_…`), `lista` (`PL…`, `UU…`, …) o `null` si no se admite (mezcla automática `RD…`). */
export function tipoDeLista(idLista: string): TipoLista | null {
  if (idLista.startsWith('RD')) return null
  return idLista.startsWith('OLAK5uy_') ? 'album' : 'lista'
}

/**
 * Reconoce un enlace de lista o álbum (ADR 0026 §1); el worker vuelve a validar con las mismas reglas.
 * Admite `/playlist?list=`, `/watch?v=…&list=` y `youtu.be/<id>?list=`. Las mezclas automáticas (`RD…`) y los
 * canales (`/@…`, `/channel/…`, `/c/…`, `/user/…`) son `URL_NO_SOPORTADA`.
 */
export function analizarUrlLista(texto: string): ResultadoUrlLista {
  const t = typeof texto === 'string' ? texto.trim() : ''
  if (t === '' || t.length > MAX_LONGITUD_URL_YOUTUBE || /\s/.test(t)) return NO_VALIDA
  let candidata = t
  if (!/^https?:\/\//i.test(t)) {
    if (/^[a-z][a-z0-9+.-]*:(?!\d+(\/|$))/i.test(t) || t.startsWith('//')) return NO_VALIDA
    candidata = `https://${t}`
  }
  const autoridad = candidata.replace(/^https?:\/\//i, '').split(/[/?#]/)[0] ?? ''
  if (/[@:]/.test(autoridad)) return NO_VALIDA
  let url: URL
  try {
    url = new URL(candidata)
  } catch {
    return NO_VALIDA
  }
  const host = url.hostname.toLowerCase()
  const partes = url.pathname.split('/').filter((s) => s !== '')
  const primero = partes[0] ?? ''
  if (
    HOSTS_YOUTUBE.has(host) &&
    (primero.startsWith('@') || ['channel', 'c', 'user'].includes(primero))
  ) {
    return NO_SOPORTADA
  }
  const esLista =
    (HOSTS_YOUTUBE.has(host) && (primero === 'playlist' || primero === 'watch')) ||
    (HOSTS_CORTOS.has(host) && partes.length === 1)
  if (!esLista) return NO_VALIDA
  const idLista = url.searchParams.get('list') ?? ''
  if (!ID_LISTA.test(idLista)) return NO_VALIDA
  const tipo = tipoDeLista(idLista)
  if (tipo === null) return NO_SOPORTADA
  return {
    ok: true,
    idLista,
    tipo,
    urlCanonica: `https://www.youtube.com/playlist?list=${idLista}`
  }
}
