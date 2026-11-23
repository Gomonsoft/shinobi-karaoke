import { z } from 'zod'
import type { CodigoError } from '../../shared/errores'

/**
 * Formato `.shinobi` (ADR 0027 §1): un ZIP con `manifiesto.json`, una carpeta por canción, `temas.json`
 * y, solo en una copia con ajustes, `ajustes.json`. Sin Electron ni disco: solo nombres, límites y el
 * esquema del manifiesto.
 */

export const VERSION_FORMATO = 1
export const EXTENSION_PAQUETE = 'shinobi'

export const ENTRADA_MANIFIESTO = 'manifiesto.json'
export const ENTRADA_TEMAS = 'temas.json'
export const ENTRADA_AJUSTES = 'ajustes.json'

/** Los únicos nombres que se extraen bajo `canciones/<id>/` (ADR 0027 §3). */
export const ARCHIVOS_CANCION = [
  'cancion.json',
  'fuente/mezcla.flac',
  'fuente/miniatura.jpg',
  'pistas/voz.flac',
  'pistas/instrumental.flac'
] as const
export type ArchivoCancion = (typeof ARCHIVOS_CANCION)[number]
export const ARCHIVOS_AUDIO: readonly ArchivoCancion[] = [
  'fuente/mezcla.flac',
  'pistas/voz.flac',
  'pistas/instrumental.flac'
]

/** Los ids de canción de la app son UUID, pero se admite cualquier nombre de carpeta seguro. */
export const ID_CANCION_PAQUETE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

export const rutaEnPaquete = (id: string, archivo: ArchivoCancion): string =>
  `canciones/${id}/${archivo}`

/**
 * Límites contra paquetes hostiles o corruptos (bombas de compresión): se comprueban con lo que el
 * índice central declara y, al extraer, con los bytes realmente leídos.
 */
export const LIMITES = {
  /** 5 archivos por canción como mucho, hasta 5 000 canciones, más manifiesto, temas y ajustes. */
  maxCanciones: 5000,
  maxEntradas: 5000 * ARCHIVOS_CANCION.length + 3,
  maxManifiesto: 16 * 1024 * 1024,
  maxTemas: 8 * 1024 * 1024,
  maxAjustes: 1024 * 1024,
  maxCancionJson: 32 * 1024 * 1024,
  maxMiniatura: 20 * 1024 * 1024,
  /** Una mezcla de varias horas en FLAC cabe de sobra. */
  maxAudio: 16 * 1024 ** 3,
  /** Suma de lo declarado por todas las entradas. */
  maxTotal: 1024 ** 4
} as const

export function limiteDe(archivo: ArchivoCancion): number {
  if (archivo === 'cancion.json') return LIMITES.maxCancionJson
  if (archivo === 'fuente/miniatura.jpg') return LIMITES.maxMiniatura
  return LIMITES.maxAudio
}

/** Error de un paquete con el código estable que la interfaz traduce. */
export class ErrorPaquete extends Error {
  constructor(
    readonly codigo: CodigoError,
    mensaje: string
  ) {
    super(mensaje)
    this.name = 'ErrorPaquete'
  }
}

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/)
const isoSchema = z.iso.datetime()

const archivoManifiestoSchema = z.object({
  ruta: z.string().min(1).max(300),
  bytes: z.number().int().nonnegative(),
  sha256: sha256Schema
})

const cancionManifiestoSchema = z.object({
  id: z.string().regex(ID_CANCION_PAQUETE),
  titulo: z.string().max(1000),
  artista: z.string().max(1000),
  esquema_cancion: z.number().int().min(1),
  /** Añadidos de 0.2.2 (aditivos): permiten decidir «Ya la tienes igual» sin leer cada canción. */
  modificada: isoSchema.optional().catch(undefined),
  creada: isoSchema.optional().catch(undefined),
  album: z.string().max(1000).nullable().optional().catch(undefined),
  duracion_ms: z.number().int().positive().optional().catch(undefined),
  estado: z.enum(['borrador', 'lista']).optional().catch(undefined),
  archivos: z.array(archivoManifiestoSchema).max(ARCHIVOS_CANCION.length)
})

export const manifiestoSchema = z.object({
  formato: z.literal('shinobi'),
  version_formato: z.number().int().min(1),
  tipo: z.enum(['cancion', 'copia']),
  creado: isoSchema,
  app: z.string().max(64),
  con_audio: z.boolean(),
  canciones: z.array(cancionManifiestoSchema).max(LIMITES.maxCanciones),
  temas: z.array(z.string().max(64)).max(10_000),
  /** `temas.json` y `ajustes.json`, con su comprobación como los archivos de las canciones. */
  extras: z.array(archivoManifiestoSchema).max(2).default([])
})

export type Manifiesto = z.infer<typeof manifiestoSchema>
export type CancionManifiesto = Manifiesto['canciones'][number]
export type ArchivoManifiesto = z.infer<typeof archivoManifiestoSchema>

/**
 * Valida el JSON del manifiesto: lo que no es un manifiesto de Shinobi es `PAQUETE_NO_VALIDO`; un
 * `version_formato` mayor que el que entiende la app, `PAQUETE_VERSION_NUEVA` (antes de mirar el resto).
 * Cada archivo declarado debe estar bajo `canciones/<id>/` con uno de los nombres permitidos.
 */
export function validarManifiesto(json: unknown): Manifiesto {
  if (
    typeof json !== 'object' ||
    json === null ||
    (json as { formato?: unknown }).formato !== 'shinobi'
  ) {
    throw new ErrorPaquete('PAQUETE_NO_VALIDO', 'No es un manifiesto de Shinobi Karaoke.')
  }
  const version = (json as { version_formato?: unknown }).version_formato
  if (typeof version === 'number' && Number.isInteger(version) && version > VERSION_FORMATO) {
    throw new ErrorPaquete('PAQUETE_VERSION_NUEVA', 'El paquete es de una versión más nueva.')
  }
  const r = manifiestoSchema.safeParse(json)
  if (!r.success) throw new ErrorPaquete('PAQUETE_NO_VALIDO', 'El manifiesto no es válido.')
  const m = r.data
  const ids = new Set<string>()
  for (const c of m.canciones) {
    if (ids.has(c.id)) throw new ErrorPaquete('PAQUETE_NO_VALIDO', 'Canción repetida.')
    ids.add(c.id)
    const vistos = new Set<string>()
    for (const a of c.archivos) {
      const nombre = ARCHIVOS_CANCION.find((n) => a.ruta === rutaEnPaquete(c.id, n))
      if (!nombre || vistos.has(nombre)) {
        throw new ErrorPaquete(
          'PAQUETE_NO_VALIDO',
          'El manifiesto declara un archivo no permitido.'
        )
      }
      if (a.bytes > limiteDe(nombre)) {
        throw new ErrorPaquete('PAQUETE_NO_VALIDO', 'Un archivo declara un tamaño excesivo.')
      }
      vistos.add(nombre)
    }
  }
  for (const e of m.extras) {
    const limite = e.ruta === ENTRADA_TEMAS ? LIMITES.maxTemas : LIMITES.maxAjustes
    if ((e.ruta !== ENTRADA_TEMAS && e.ruta !== ENTRADA_AJUSTES) || e.bytes > limite) {
      throw new ErrorPaquete('PAQUETE_NO_VALIDO', 'El manifiesto declara un archivo no permitido.')
    }
  }
  return m
}
