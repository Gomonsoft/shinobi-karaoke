import { parseDocument } from 'yaml'
import { z } from 'zod'
import type { ElementoLetra, Palabra } from '../../shared/letra'
import { normalizarLetra, type GeneradorId } from '../../shared/letras'

/** Tamaño máximo (en caracteres) de un Lyricsfile que se intenta leer. */
export const MAX_BYTES_LYRICSFILE = 2 * 1024 * 1024
const MAX_ALIAS = 50
/** Duración de la última palabra cuando no hay otro límite (ADR 0005). */
const DURACION_ULTIMA_PALABRA_MS = 1000

/** El Lyricsfile supera el tamaño máximo. El llamante pasa a `syncedLyrics`. */
export class ErrorLyricsfileDemasiadoGrande extends Error {
  constructor() {
    super(`El Lyricsfile ocupa más de ${MAX_BYTES_LYRICSFILE / (1024 * 1024)} MB`)
    this.name = 'ErrorLyricsfileDemasiadoGrande'
  }
}

const tiempo = z.number().min(0)

const lyricsfileSchema = z.object({
  version: z.union([z.string(), z.number()]).optional(),
  metadata: z
    .object({
      offset_ms: z.number().optional(),
      instrumental: z.boolean().optional()
    })
    .optional(),
  lines: z.array(
    z.object({
      text: z.string(),
      start_ms: tiempo,
      end_ms: tiempo.optional(),
      words: z
        .array(z.object({ text: z.string(), start_ms: tiempo, end_ms: tiempo.optional() }))
        .optional()
    })
  )
})

type Lyricsfile = z.infer<typeof lyricsfileSchema>

/** Lee y valida el YAML. `null` si no es YAML válido o no tiene la estructura esperada. */
function leerEstructura(texto: string): Lyricsfile | null {
  if (
    texto.length > MAX_BYTES_LYRICSFILE ||
    Buffer.byteLength(texto, 'utf8') > MAX_BYTES_LYRICSFILE
  ) {
    throw new ErrorLyricsfileDemasiadoGrande()
  }
  try {
    const doc = parseDocument(texto, {
      schema: 'core',
      prettyErrors: true
    })
    if (doc.errors.length > 0) return null
    const valor: unknown = doc.toJS({ maxAliasCount: MAX_ALIAS })
    const r = lyricsfileSchema.safeParse(valor)
    return r.success ? r.data : null
  } catch {
    return null
  }
}

const aEntero = (n: number): number => Math.round(n)

/**
 * Convierte el campo `lyricsfile` de LRCLIB en elementos de letra (ADR 0005, Revisión 2026-11-05).
 * Devuelve `null` si el YAML no es válido o no se reconoce (el llamante usa `syncedLyrics`) y `[]`
 * si no hay líneas o es instrumental (el llamante usa `plainLyrics`). Lanza
 * `ErrorLyricsfileDemasiadoGrande` si la entrada supera 2 MB.
 */
export function convertirLyricsfile(
  texto: string,
  generarId?: GeneradorId
): ElementoLetra[] | null {
  const lf = leerEstructura(texto)
  if (!lf) return null
  if (lf.metadata?.instrumental === true || lf.lines.length === 0) return []

  const offset = lf.metadata?.offset_ms ?? 0
  const t = (ms: number): number => Math.max(0, aEntero(ms - offset))
  const lineas = lf.lines

  const elementos = lineas.map((l, i): ElementoLetra => {
    const inicio = t(l.start_ms)
    if (l.text === '') {
      return { id: '', tipo: 'pausa', texto: '', inicio_ms: inicio, fin_ms: null, palabras: null }
    }
    const siguiente = i + 1 < lineas.length ? t(lineas[i + 1]!.start_ms) : null
    const finLinea = l.end_ms === undefined ? null : t(l.end_ms)
    const finFijado =
      finLinea !== null && finLinea > inicio && (siguiente === null || finLinea < siguiente)
        ? finLinea
        : null

    let palabras: Palabra[] | null = null
    if (l.words && l.words.length > 0) {
      const ws = l.words
      palabras = ws.map((p, k) => {
        const ini = t(p.start_ms)
        let fin: number
        if (p.end_ms !== undefined) fin = t(p.end_ms)
        else if (k + 1 < ws.length) fin = t(ws[k + 1]!.start_ms)
        else if (finLinea !== null) fin = finLinea
        else fin = Math.min(siguiente ?? Infinity, ini + DURACION_ULTIMA_PALABRA_MS)
        return { texto: p.text, inicio_ms: ini, fin_ms: fin }
      })
    }
    return { id: '', tipo: 'linea', texto: l.text, inicio_ms: inicio, fin_ms: finFijado, palabras }
  })

  return normalizarLetra(elementos, generarId)
}
