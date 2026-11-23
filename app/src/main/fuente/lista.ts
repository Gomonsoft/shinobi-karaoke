import { z } from 'zod'
import { MAX_LONGITUD_URL_YOUTUBE, type CodigoUrlYoutube } from '../../shared'

/** Tope de entradas de una lista que se devuelven (como las filas de un lote, ADR 0026 §1). */
export const MAX_ENTRADAS_LISTA = 500

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

/** `info-lista-youtube` (worker, tarea 0313). */
export const resultadoInfoListaSchema = z.object({
  titulo: z.string(),
  tipo: z.enum(['lista', 'album']),
  entradas: z.array(
    z.object({
      id: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
      titulo: z.string(),
      canal: z.string(),
      duracion_s: z.number().nonnegative().nullable(),
      disponible: z.boolean(),
      problema: z.enum(['no_disponible', 'directo']).nullable().default(null)
    })
  ),
  recortada: z.boolean()
})
export type ResultadoInfoLista = z.infer<typeof resultadoInfoListaSchema>

/** `leer-etiquetas` (worker, tarea 0313): un archivo ilegible sale con `ok: false`, no hace fallar el comando. */
export const resultadoLeerEtiquetasSchema = z.object({
  archivos: z.array(
    z.discriminatedUnion('ok', [
      z.object({
        ruta: z.string(),
        ok: z.literal(true),
        duracion_ms: z.number().int().nonnegative().nullable(),
        etiquetas: z.object({
          title: z.string().default(''),
          artist: z.string().default(''),
          album: z.string().default(''),
          album_artist: z.string().default(''),
          track: z.string().default(''),
          date: z.string().default('')
        })
      }),
      z.object({ ruta: z.string(), ok: z.literal(false), codigo: z.string() })
    ])
  )
})
export type ResultadoLeerEtiquetas = z.infer<typeof resultadoLeerEtiquetasSchema>
