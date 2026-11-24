import { z } from 'zod'
import { estiloSchema } from './estilo'
import { letraSchema } from './letra'
import { aparienciaSchema } from './temas'

/** Versión actual del esquema de cancion.json. */
export const VERSION_ESQUEMA_CANCION = 1

const fechaIso = z.iso.datetime()

/** Fecha que se asigna al leer una canción sin `creada` válida (0.2.1, ADR 0006). No se reescribe. */
export const CREADA_POR_DEFECTO = '1970-01-01T00:00:00.000Z'

/** Procedencia de un dato de la canción (ADR 0025 §6). Ausente = desconocido (canciones de 0.2.1). */
export const ORIGENES_DATO = ['fuente', 'nombre', 'lrclib', 'usuario'] as const
export type OrigenDato = (typeof ORIGENES_DATO)[number]
const origenDatoSchema = z.enum(ORIGENES_DATO).optional().catch(undefined)

export const origenMetadatosSchema = z.object({
  titulo: origenDatoSchema,
  artista: origenDatoSchema,
  album: origenDatoSchema
})
export type OrigenMetadatos = z.infer<typeof origenMetadatosSchema>

export const metadatosSchema = z.object({
  titulo: z.string(),
  artista: z.string(),
  album: z.string().nullable(),
  duracion_ms: z.number().int().positive(),
  /** Lectura tolerante: un valor ilegible se ignora, nunca daña la canción. */
  origen: origenMetadatosSchema.optional().catch(undefined)
})

export const fuenteSchema = z.object({
  tipo: z.enum(['archivo', 'youtube']),
  nombre_original: z.string().nullable(),
  url: z.string().nullable(),
  youtube_id: z.string().nullable(),
  /** Ruta relativa a la carpeta de la canción. */
  mezcla: z.string().min(1),
  miniatura: z.string().nullable(),
  ganancia_db: z.number(),
  /**
   * Importación por lotes (ADR 0026 §2): ruta absoluta del archivo original mientras la fuente no esté
   * completada; main la borra al completarla. Lectura tolerante (0.2.1 la descarta).
   */
  ruta_pendiente: z.string().min(1).optional().catch(undefined)
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

// --- Preparación desatendida (ADR 0025 §1, 0.2.2) ---

export const ESTADOS_PREPARACION = [
  'en_curso',
  'lista_para_revisar',
  'elige_letra',
  'sin_letra',
  'detenida',
  'error'
] as const
export type EstadoPreparacion = (typeof ESTADOS_PREPARACION)[number]
export const PASOS_PREPARACION = [
  'buscando_letra',
  'esperando_separacion',
  'comprobando',
  'ajustando_fines'
] as const
export type PasoPreparacion = (typeof PASOS_PREPARACION)[number]
/** Por qué la elección automática no eligió (ADR 0025 §3, revisión de 0235): mismo catálogo que `let.prep.motivo.*`. */
export const MOTIVOS_NO_ELIGE = [
  'varias',
  'sinExacta',
  'duda',
  'noCoincide',
  'soloTexto',
  'sinComprobar'
] as const
export type MotivoNoElige = (typeof MOTIVOS_NO_ELIGE)[number]
export const RESULTADOS_BUSQUEDA = [
  'elegida',
  'elige',
  'sin_letra',
  'instrumental',
  'pendiente'
] as const
/** Tope de ids de LRCLIB guardados para volver a pedir los textos (ADR 0025 §1). */
export const MAX_IDS_BUSQUEDA = 10

/**
 * Registro de la preparación. Solo lo escribe `ServicioPreparacion`; los candidatos no se guardan como
 * texto, solo sus ids. Lectura tolerante: lo ilegible se ignora y nunca daña la canción.
 */
export const preparacionSchema = z.object({
  estado: z.enum(ESTADOS_PREPARACION),
  paso: z.enum(PASOS_PREPARACION).nullable().catch(null),
  origen: z.enum(['automatica', 'manual']).catch('automatica'),
  actualizado: fechaIso.catch(CREADA_POR_DEFECTO),
  busqueda: z
    .object({
      resultado: z.enum(RESULTADOS_BUSQUEDA),
      candidatas: z.number().int().nonnegative().catch(0),
      motivo: z.string().nullable().catch(null),
      /** Motivo de «Elige la letra»; con un fallo de búsqueda, `null` (el código va en `motivo`). */
      no_elige: z.enum(MOTIVOS_NO_ELIGE).nullable().catch(null).optional(),
      ids: z.array(z.number().int()).max(MAX_IDS_BUSQUEDA).catch([])
    })
    .nullable()
    .optional()
    .catch(undefined),
  eleccion: z
    .object({
      por: z.enum(['app', 'usuario']),
      fecha: fechaIso.catch(CREADA_POR_DEFECTO),
      lrclib_id: z.number().int().nullable().catch(null),
      /** La app la eligió sin poder comprobarla con la voz (0.2.3; 0.2.2 ignora el campo). */
      sin_comprobar: z.literal(true).optional().catch(undefined)
    })
    .nullable()
    .optional()
    .catch(undefined),
  desfase_ms: z.number().int().optional().catch(undefined),
  fines: z
    .object({
      metodo: z.enum(['silencios', 'alineacion']).nullable().catch(null),
      lineas: z.number().int().nonnegative().catch(0)
    })
    .nullable()
    .optional()
    .catch(undefined),
  dudosas: z.number().int().nonnegative().catch(0),
  /** Las que hacen preguntar al marcar como lista (F11-E12); ausente en lo preparado antes: se usa `dudosas`. */
  dudosas_importantes: z.number().int().nonnegative().optional().catch(undefined),
  revisada: z.boolean().catch(false),
  /** `{ codigo: "CIERRE" }` con `detenida` por cierre de la app. */
  error: z
    .object({ codigo: z.string().min(1), mensaje: z.string().catch('') })
    .nullable()
    .optional()
    .catch(undefined)
})
export type Preparacion = z.infer<typeof preparacionSchema>

export const NOMBRES_PASO = ['fuente', 'separacion', 'letra', 'edicion'] as const
export type NombrePaso = (typeof NOMBRES_PASO)[number]

export const pasosSchema = z.object({
  fuente: pasoSchema,
  separacion: pasoSchema,
  letra: pasoSchema,
  edicion: pasoSchema
})

/** Modalidad de una canción lista (ADR 0018 §5): con barrido (`karaoke`) o solo letra. */
export const MODALIDADES = ['karaoke', 'letra_lista'] as const
export type Modalidad = (typeof MODALIDADES)[number]

export const cancionSchema = z.object({
  esquema: z.literal(VERSION_ESQUEMA_CANCION),
  id: z.string().min(1),
  creada: fechaIso.catch(CREADA_POR_DEFECTO),
  modificada: fechaIso,
  estado: z.enum(['borrador', 'lista']),
  /** Solo con `lista`; ausente vale `karaoke`. Con `borrador` se ignora al leer. */
  modalidad: z.enum(MODALIDADES).optional(),
  metadatos: metadatosSchema,
  fuente: fuenteSchema,
  pistas: pistasSchema.nullable(),
  letra: letraSchema.nullable(),
  /** Registro de la preparación desatendida (0.2.2). 0.2.1 lo descarta al leer. */
  preparacion: preparacionSchema.optional().catch(undefined),
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

/** `letra_lista` solo si la canción está lista y lo declara; en cualquier otro caso, `karaoke`. */
export function modalidadEfectiva(cancion: Pick<Cancion, 'estado' | 'modalidad'>): Modalidad {
  return cancion.estado === 'lista' && cancion.modalidad === 'letra_lista'
    ? 'letra_lista'
    : 'karaoke'
}

/** Resumen legible de los problemas de validación de un ZodError. */
export function resumirErroresZod(error: z.ZodError): string {
  return error.issues
    .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join('\n')
}
