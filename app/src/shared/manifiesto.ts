import { z } from 'zod'

/**
 * Manifiesto de runtime (ADR 0009 §2): `app/resources/runtime-manifest.json`.
 * Lo leen main (instalación) y renderer (tamaños y estimaciones de tiempo).
 */

export const PLATAFORMAS = ['darwin-arm64', 'darwin-x64', 'win32-x64', 'linux-x64'] as const
export const PERFILES = ['cpu', 'cuda', 'mps'] as const
export const MODELOS_SEPARACION = ['rapido', 'calidad'] as const

export const plataformaSchema = z.enum(PLATAFORMAS)
export const perfilSchema = z.enum(PERFILES)
export const modeloIdSchema = z.enum(MODELOS_SEPARACION)

export type Plataforma = z.infer<typeof plataformaSchema>
export type PerfilHardware = z.infer<typeof perfilSchema>
export type ModeloId = z.infer<typeof modeloIdSchema>

const bytes = z.number().int().nonnegative()
const sha256 = z.string().regex(/^[0-9a-f]{64}$/, 'SHA-256 en hexadecimal minúscula')
const rango = z.tuple([z.number().positive(), z.number().positive()])
const factorSchema = rango.nullable()

const requisitosPerfilSchema = z.object({
  /** Ruta relativa al archivo de requisitos bloqueados (worker/requisitos/…). */
  requisitos: z.string().min(1),
  sha256_requisitos: sha256,
  bytes_descarga: bytes,
  /** `null` mientras no esté medido. */
  bytes_disco: bytes.nullable(),
  espacio_requerido: bytes,
  medido: z.boolean()
})

const archivoExtraSchema = z.object({
  archivo: z.string().min(1),
  urls: z.array(z.url()).min(1),
  bytes,
  sha256
})

export const modeloManifiestoSchema = z.object({
  id: modeloIdSchema,
  archivo: z.string().min(1),
  /** Espejo de audio-separator primero, origen después. */
  urls: z.array(z.url()).min(1),
  bytes,
  sha256,
  extra: z.array(archivoExtraSchema).default([]),
  licencia: z.enum(['MIT', 'no declarada']),
  /** Modelo en espera de aclarar su licencia (preguntas/0012). */
  provisional: z.boolean().default(false)
})

const factoresPorPerfil = z.partialRecord(
  perfilSchema,
  z.partialRecord(modeloIdSchema, factorSchema)
)

export const manifiestoSchema = z.object({
  /** Entero; sube con cualquier cambio de requisitos o modelos. */
  version: z.number().int().positive(),
  python: z.object({
    version: z.string().min(1),
    bytes_descarga: z.partialRecord(plataformaSchema, bytes)
  }),
  runtime: z.partialRecord(plataformaSchema, z.partialRecord(perfilSchema, requisitosPerfilSchema)),
  modelos: z.array(modeloManifiestoSchema).min(1),
  /** Minutos de proceso por minuto de audio medidos: `[min, max]` o `null` (sin medir). */
  factores: factoresPorPerfil,
  /** Estimación (ADR 0004) para los factores sin medir. */
  estimacion: factoresPorPerfil.default({})
})

export type Manifiesto = z.infer<typeof manifiestoSchema>
export type ModeloManifiesto = z.infer<typeof modeloManifiestoSchema>
export type RequisitosPerfil = z.infer<typeof requisitosPerfilSchema>

/** Modelo inicial de cada perfil (ADR 0009 §2): GPU/Apple Silicon → Calidad; CPU → Rápido. */
export function modeloDelPerfil(perfil: PerfilHardware): ModeloId {
  return perfil === 'cpu' ? 'rapido' : 'calidad'
}

/** Requisitos de la plataforma y el perfil, o `null` si no están soportados. */
export function requisitosDe(
  manifiesto: Manifiesto,
  plataforma: string,
  perfil: PerfilHardware
): RequisitosPerfil | null {
  const p = plataformaSchema.safeParse(plataforma)
  if (!p.success) return null
  return manifiesto.runtime[p.data]?.[perfil] ?? null
}

/**
 * Bytes que se descargan en total: Python + dependencias + modelo del perfil
 * (con sus archivos extra). `null` si la plataforma/perfil no están soportados.
 */
export function bytesTotalesInstalacion(
  manifiesto: Manifiesto,
  plataforma: string,
  perfil: PerfilHardware
): number | null {
  const req = requisitosDe(manifiesto, plataforma, perfil)
  if (req === null) return null
  const p = plataformaSchema.parse(plataforma)
  const modelo = manifiesto.modelos.find((m) => m.id === modeloDelPerfil(perfil))
  const python = manifiesto.python.bytes_descarga[p] ?? 0
  const bytesModelo = modelo ? modelo.bytes + modelo.extra.reduce((a, e) => a + e.bytes, 0) : 0
  return python + req.bytes_descarga + bytesModelo
}

/**
 * Estimación del tiempo de separación en minutos (`{ min, max }`).
 * Factor medido en este equipo si existe (`config.separacion.factores_medidos`);
 * si no, el de referencia del manifiesto; si es `null`, la estimación (ADR 0004).
 * `null` si no hay ningún dato para ese perfil y modo.
 */
export function estimarMinutosSeparacion(
  duracionMs: number,
  perfil: PerfilHardware,
  modo: ModeloId,
  factoresMedidos: Partial<Record<ModeloId, number>>,
  manifiesto: Manifiesto
): { min: number; max: number } | null {
  const minutosAudio = Math.max(0, duracionMs) / 60000
  const medido = factoresMedidos[modo]
  if (medido !== undefined && medido > 0) {
    const m = minutosAudio * medido
    return { min: m, max: m }
  }
  const factor = manifiesto.factores[perfil]?.[modo] ?? manifiesto.estimacion[perfil]?.[modo]
  if (!factor) return null
  return { min: minutosAudio * factor[0], max: minutosAudio * factor[1] }
}
