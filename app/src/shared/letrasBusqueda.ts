import { z } from 'zod'
import { elementoLetraSchema, type ElementoLetra } from './letra'

/**
 * Contratos de la búsqueda e importación de letras (Fase 4, 0077; ADR 0005 Revisión 2026-11-05).
 * Funciones puras y esquemas sin dependencias de Electron: los usan main, preload y renderer.
 */

/** Variable de entorno que sustituye la URL base de LRCLIB (solo sin empaquetar; 0081, ADR 0009 §8). */
export const ENTORNO_LRCLIB_URL = 'SHINOBI_LRCLIB_URL'

/** URL base real de LRCLIB. */
export const URL_BASE_LRCLIB = 'https://lrclib.net'

/**
 * URL base efectiva de LRCLIB. Empaquetada se ignora la variable. Sin empaquetar solo se admite
 * `http://127.0.0.1:<puerto>` y `http://lrclib.invalid` (para probar `SIN_CONEXION`); cualquier otro
 * valor se descarta y se usa la URL real. Devuelve la URL sin barra final.
 */
export function urlBaseLrclib(valor: string | undefined, empaquetada: boolean): string {
  if (empaquetada || !valor) return URL_BASE_LRCLIB
  const t = valor.trim().replace(/\/+$/, '')
  if (/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(t) || t === 'http://lrclib.invalid') return t
  return URL_BASE_LRCLIB
}

export const SINCRONIAS = ['palabra', 'linea', 'texto'] as const
/** Nivel de sincronía de una letra: por palabra, por línea o sin tiempos. */
export const sincroniaSchema = z.enum(SINCRONIAS)
export type Sincronia = z.infer<typeof sincroniaSchema>

/** Hay palabras → `palabra`; algún inicio → `linea`; ninguno → `texto`. */
export function sincroniaDe(lineas: readonly ElementoLetra[]): Sincronia {
  if (lineas.some((l) => l.palabras !== null && l.palabras.length > 0)) return 'palabra'
  if (lineas.some((l) => l.inicio_ms !== null)) return 'linea'
  return 'texto'
}

/** Máximo de elementos de una letra aceptada por `letras.guardar`. */
export const MAX_ELEMENTOS_LETRA = 5000
/** Máximo del texto de `letras.editarTexto`: 512 KB. */
export const MAX_BYTES_TEXTO_LETRA = 512 * 1024

export const candidatoLetraSchema = z.object({
  lrclib_id: z.number().int(),
  titulo: z.string(),
  artista: z.string(),
  album: z.string().nullable(),
  duracion_ms: z.number().int().min(0),
  sincronia: sincroniaSchema,
  /** Duración del candidato menos la de la canción, con signo. */
  diferencia_ms: z.number().int(),
  lineas: z.array(elementoLetraSchema)
})
export type CandidatoLetra = z.infer<typeof candidatoLetraSchema>

export const resultadoBusquedaLetraSchema = z.object({
  candidatos: z.array(candidatoLetraSchema),
  instrumental: z.boolean()
})
export type ResultadoBusquedaLetra = z.infer<typeof resultadoBusquedaLetraSchema>

export const origenLetraGuardarSchema = z.enum(['lrclib', 'manual', 'archivo'])

const tieneLinea = (lineas: readonly ElementoLetra[]): boolean =>
  lineas.some((l) => l.tipo === 'linea')

export const busquedaLetraSchema = z.strictObject({
  cancionId: z.string().min(1).max(200),
  titulo: z.string().trim().min(1).max(500),
  artista: z.string().max(500),
  usarCache: z.boolean().optional()
})
export type BusquedaLetra = z.infer<typeof busquedaLetraSchema>

export const guardarLetraSchema = z
  .strictObject({
    cancionId: z.string().min(1).max(200),
    origen: origenLetraGuardarSchema,
    lrclib_id: z.number().int().nullable(),
    lineas: z.array(elementoLetraSchema).max(MAX_ELEMENTOS_LETRA)
  })
  .refine((v) => v.lrclib_id === null || v.origen === 'lrclib', {
    message: 'lrclib_id solo puede ser no nulo con origen lrclib',
    path: ['lrclib_id']
  })
  .refine((v) => tieneLinea(v.lineas), {
    message: 'La letra necesita al menos una línea',
    path: ['lineas']
  })
export type GuardarLetra = z.infer<typeof guardarLetraSchema>

export const editarTextoLetraSchema = z.strictObject({
  cancionId: z.string().min(1).max(200),
  texto: z.string().refine((t) => new TextEncoder().encode(t).length <= MAX_BYTES_TEXTO_LETRA, {
    message: 'El texto supera 512 KB'
  })
})
export type EditarTextoLetra = z.infer<typeof editarTextoLetraSchema>

export const archivoLetraLeidoSchema = z.discriminatedUnion('cancelado', [
  z.object({ cancelado: z.literal(true) }),
  z.object({
    cancelado: z.literal(false),
    nombre: z.string(),
    lineas: z.array(elementoLetraSchema),
    sincronia: sincroniaSchema,
    /** Renglones de un LRC que no se pudieron leer y se ignoraron (0078, `lrcALetra`). */
    ignoradas: z.number().int().nonnegative()
  })
])
export type ArchivoLetraLeido = z.infer<typeof archivoLetraLeidoSchema>

// --- Comparación de duración (ux/05) -------------------------------------

export type ComparacionDuracion =
  | { tipo: 'igual' }
  | { tipo: 'diferente'; segundos: number; sentido: 'mas_larga' | 'mas_corta' }
  | { tipo: 'muy_distinta' }

/** `s = round(|dif|/1000)`: ≤ 2 igual; 3–10 diferente; > 10 muy distinta. */
export function compararDuracion(diferenciaMs: number): ComparacionDuracion {
  const s = Math.round(Math.abs(diferenciaMs) / 1000)
  if (s <= 2) return { tipo: 'igual' }
  if (s > 10) return { tipo: 'muy_distinta' }
  return { tipo: 'diferente', segundos: s, sentido: diferenciaMs > 0 ? 'mas_larga' : 'mas_corta' }
}
