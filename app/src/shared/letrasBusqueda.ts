import { z } from 'zod'
import { VEREDICTOS_ENCAJE } from './encaje'
import {
  ORIGENES_FIN,
  elementoLetraSchema,
  palabraSchema,
  revisadaSchema,
  type ElementoLetra
} from './letra'

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
 * Defensa de los E2E (`SHINOBI_E2E=1`, `e2e`): sin empaquetar y sin una URL admitida, nunca la real:
 * `http://lrclib.invalid` (sin conexión). Empaquetada, `e2e` se ignora.
 */
export function urlBaseLrclib(
  valor: string | undefined,
  empaquetada: boolean,
  e2e = false
): string {
  const real = !empaquetada && e2e ? 'http://lrclib.invalid' : URL_BASE_LRCLIB
  if (empaquetada || !valor) return real
  const t = valor.trim().replace(/\/+$/, '')
  if (/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(t) || t === 'http://lrclib.invalid') return t
  return real
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

export const encajeCandidatoSchema = z.object({
  veredicto: z.enum(VEREDICTOS_ENCAJE),
  desfaseMs: z.number().int(),
  /** `dudosa` por un límite del método, no por coros (ADR 0024, revisión 2026-11-22); lectura tolerante. */
  limitacion: z.enum(['vozContinua', 'sinContraste']).nullable().optional().catch(undefined)
})
export type EncajeCandidato = z.infer<typeof encajeCandidatoSchema>

/** Evento `letras:encaje` (ADR 0024 §2): los encajes de la última búsqueda cuando los picos terminan. */
export const eventoEncajeLetrasSchema = z.object({
  cancionId: z.string(),
  encajes: z.array(
    z.object({ lrclib_id: z.number().int(), encaje: encajeCandidatoSchema.nullable() })
  )
})
export type EventoEncajeLetras = z.infer<typeof eventoEncajeLetrasSchema>

export const candidatoLetraSchema = z.object({
  lrclib_id: z.number().int(),
  titulo: z.string(),
  artista: z.string(),
  album: z.string().nullable(),
  duracion_ms: z.number().int().min(0),
  sincronia: sincroniaSchema,
  /** Duración del candidato menos la de la canción, con signo. */
  diferencia_ms: z.number().int(),
  lineas: z.array(elementoLetraSchema),
  /** Encaje con la voz (ADR 0024 §2); null o ausente si no hay picos o el candidato es solo texto. */
  encaje: encajeCandidatoSchema.nullable().optional()
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

export const OFFSET_MAXIMO_MS = 30_000

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
    lineas: z.array(elementoLetraSchema).max(MAX_ELEMENTOS_LETRA),
    /**
     * Corrección de desfase que se guarda con la letra nueva (ADR 0024 §1: `offset_ms = d` a 10 ms y
     * `desfase_corregido_ms = d`; los tiempos de las líneas no cambian). Ausente = sin corrección.
     */
    desfase_ms: z.number().int().min(-OFFSET_MAXIMO_MS).max(OFFSET_MAXIMO_MS).optional()
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

export const tiempoElementoSchema = z.strictObject({
  id: z.string().min(1).max(200),
  inicio_ms: z.number().int().min(0).nullable(),
  fin_ms: z.number().int().min(0).nullable(),
  palabras: z.array(palabraSchema).min(1).max(500).nullable(),
  /** `"manual"`: palabras hechas en el editor preciso (ADR 0021 §6); ausente = las de la referencia. */
  origen_palabras: z.literal('manual').optional(),
  /** Quién fijó el fin (ADR 0024 §4); ausente = a mano. Main lo retira si `fin_ms` es null. */
  origen_fin: z.enum(ORIGENES_FIN).optional(),
  /** Instantánea de «dada por buena»; ausente = sin revisar. Main la retira si deja de coincidir. */
  revisada: revisadaSchema.extend({ texto: z.string().max(1000) }).optional()
})

export const guardarTiemposSchema = z.strictObject({
  cancionId: z.string().min(1).max(200),
  offset_ms: z.number().int().min(-OFFSET_MAXIMO_MS).max(OFFSET_MAXIMO_MS),
  /**
   * Desfase que se corrigió en la letra (ADR 0024 §1): número = se anota; `null` = se borra (quitar la
   * corrección); ausente = no cambia. El editor lo envía siempre (estado completo).
   */
  desfase_corregido_ms: z
    .number()
    .int()
    .min(-OFFSET_MAXIMO_MS)
    .max(OFFSET_MAXIMO_MS)
    .nullable()
    .optional(),
  tiempos: z.array(tiempoElementoSchema).max(MAX_ELEMENTOS_LETRA)
})
export type GuardarTiempos = z.infer<typeof guardarTiemposSchema>

export const editarTextoLetraSchema = z.strictObject({
  cancionId: z.string().min(1).max(200),
  texto: z.string().refine((t) => new TextEncoder().encode(t).length <= MAX_BYTES_TEXTO_LETRA, {
    message: 'El texto supera 512 KB'
  })
})
export type EditarTextoLetra = z.infer<typeof editarTextoLetraSchema>

/**
 * Máximo de caracteres del texto de una línea (0283). La vista Letra no tenía tope propio (solo el de
 * 512 KB del texto entero): este es el de `letras.editarTextoLinea` y el que usa el editor preciso.
 */
export const MAX_CARACTERES_LINEA = 500

/** `letras.editarTextoLinea` (ADR 0021 §7): solo el texto de una línea; conserva `id`, inicio y fin. */
export const editarTextoLineaSchema = z.strictObject({
  cancionId: z.string().min(1).max(200),
  id: z.string().min(1).max(200),
  texto: z
    .string()
    .min(1)
    .max(MAX_CARACTERES_LINEA)
    .refine((t) => !/[\r\n]/.test(t), { message: 'El texto no puede tener saltos de línea' })
    .refine((t) => t === t.trim(), { message: 'El texto no puede tener espacios en los extremos' })
})
export type EditarTextoLinea = z.infer<typeof editarTextoLineaSchema>

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
