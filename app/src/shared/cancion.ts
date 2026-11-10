import { z } from 'zod'
import { estiloSchema } from './estilo'
import { letraSchema } from './letra'
import { aparienciaSchema } from './temas'

/** Versión actual del esquema de cancion.json. */
export const VERSION_ESQUEMA_CANCION = 1

const fechaIso = z.iso.datetime()

export const metadatosSchema = z.object({
  titulo: z.string(),
  artista: z.string(),
  album: z.string().nullable(),
  duracion_ms: z.number().int().positive()
})

export const fuenteSchema = z.object({
  tipo: z.enum(['archivo', 'youtube']),
  nombre_original: z.string().nullable(),
  url: z.string().nullable(),
  youtube_id: z.string().nullable(),
  /** Ruta relativa a la carpeta de la canción. */
  mezcla: z.string().min(1),
  miniatura: z.string().nullable(),
  ganancia_db: z.number()
})

export const pistasSchema = z.object({
  voz: z.string().min(1),
  instrumental: z.string().min(1),
  modelo: z.object({
    perfil: z.string(),
    nombre: z.string(),
    version: z.string()
  })
})

export const ESTADOS_PASO = [
  'pendiente',
  'en_curso',
  'completado',
  'error',
  'interrumpido'
] as const
export type EstadoPaso = (typeof ESTADOS_PASO)[number]

export const errorPasoSchema = z.object({
  /** Código estable (errores.ts); se toleran desconocidos. */
  codigo: z.string().min(1),
  mensaje: z.string(),
  /**
   * Solo `separacion` (0066): modelo con el que falló. La oferta del modelo Rápido exige
   * `calidad`. Ausente en canciones anteriores: sin oferta.
   */
  modelo: z.enum(['calidad', 'rapido']).optional()
})

export const pasoSchema = z.object({
  estado: z.enum(ESTADOS_PASO),
  actualizado: fechaIso.nullable(),
  error: errorPasoSchema.nullable(),
  /** 0–1; solo en pasos con trabajo en segundo plano. */
  progreso: z.number().min(0).max(1).nullable().optional(),
  /** Solo `separacion` completada: segundos reales que tardó (0069). Ausente en canciones antiguas. */
  segundos: z.number().nonnegative().nullable().optional()
})

export const NOMBRES_PASO = ['fuente', 'separacion', 'letra', 'edicion'] as const
export type NombrePaso = (typeof NOMBRES_PASO)[number]

export const pasosSchema = z.object({
  fuente: pasoSchema,
  separacion: pasoSchema,
  letra: pasoSchema,
  edicion: pasoSchema
})

export const cancionSchema = z.object({
  esquema: z.literal(VERSION_ESQUEMA_CANCION),
  id: z.string().min(1),
  creada: fechaIso,
  modificada: fechaIso,
  estado: z.enum(['borrador', 'lista']),
  metadatos: metadatosSchema,
  fuente: fuenteSchema,
  pistas: pistasSchema.nullable(),
  letra: letraSchema.nullable(),
  /** Selección de tema (ADR 0016 §2). Ausente equivale a propio; no se añade al leer. */
  apariencia: aparienciaSchema.optional(),
  /** Con `propio`, la autoridad; con `tema`/`heredar`, la instantánea de respaldo. */
  estilo: estiloSchema,
  pasos: pasosSchema
})

export type Cancion = z.infer<typeof cancionSchema>
export type PasoCancion = z.infer<typeof pasoSchema>
export type Pasos = z.infer<typeof pasosSchema>
export type EstadoCancion = Cancion['estado']

/** Resumen legible de los problemas de validación de un ZodError. */
export function resumirErroresZod(error: z.ZodError): string {
  return error.issues
    .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('\n')
}
