import { parseDocument } from 'yaml'
import { z } from 'zod'
import type { ElementoLetra } from '../../shared/letra'
import { normalizarLetra, type GeneradorId } from '../../shared/letras'

/** Tamaño máximo (en caracteres) de un Lyricsfile que se intenta leer. */
export const MAX_BYTES_LYRICSFILE = 2 * 1024 * 1024
const MAX_ALIAS = 50

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
 * Convierte el campo `lyricsfile` de LRCLIB en elementos de letra (ADR 0005, Revisión 2026-11-05; sin
 * tiempos por palabra desde 0.2.1, ADR 0021 §5).
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
    // Ya no se importan tiempos por palabra (ADR 0021 §5): el fin de la línea es su `end_ms` si cumple
    // la regla vigente (inicio < fin < inicio del siguiente) y, si no, el `end_ms` explícito de su
    // última palabra con la misma regla. Así la línea termina donde terminaba su última palabra.
    const valido = (fin: number | null): number | null =>
      fin !== null && fin > inicio && (siguiente === null || fin < siguiente) ? fin : null
    const ultima = l.words?.at(-1)
    const finFijado =
      valido(l.end_ms === undefined ? null : t(l.end_ms)) ??
      valido(ultima?.end_ms === undefined ? null : t(ultima.end_ms))
    return {
      id: '',
      tipo: 'linea',
      texto: l.text,
      inicio_ms: inicio,
      fin_ms: finFijado,
      palabras: null
    }
  })

  return normalizarLetra(elementos, generarId)
}
