import { z } from 'zod'

/** Mensajes JSON Lines del worker (arquitectura.md, "Protocolo JSON Lines"). */
export const mensajeProgresoSchema = z.object({
  tipo: z.literal('progreso'),
  fase: z.string().min(1),
  /** 0–1, o null si es indeterminado. */
  valor: z.number().min(0).max(1).nullable(),
  detalle: z.record(z.string(), z.unknown()).optional()
})

export const mensajeLogSchema = z.object({
  tipo: z.literal('log'),
  nivel: z.enum(['debug', 'info', 'warning', 'error']),
  mensaje: z.string()
})

export const mensajeResultadoSchema = z.object({
  tipo: z.literal('resultado'),
  datos: z.record(z.string(), z.unknown())
})

export const mensajeErrorSchema = z.object({
  tipo: z.literal('error'),
  /** Código estable (ver errores.ts); un código desconocido se tolera y la UX lo trata como genérico. */
  codigo: z.string().min(1),
  mensaje: z.string(),
  reintentable: z.boolean().default(false)
})

export const mensajeWorkerSchema = z.discriminatedUnion('tipo', [
  mensajeProgresoSchema,
  mensajeLogSchema,
  mensajeResultadoSchema,
  mensajeErrorSchema
])

export type MensajeWorker = z.infer<typeof mensajeWorkerSchema>

export type ResultadoParseoLinea =
  { ok: true; mensaje: MensajeWorker } | { ok: false; error: string }

/** Parsea una línea de stdout del worker. Nunca lanza. */
export function parsearLineaWorker(linea: string): ResultadoParseoLinea {
  let json: unknown
  try {
    json = JSON.parse(linea)
  } catch {
    return { ok: false, error: 'La línea no es JSON válido' }
  }
  const r = mensajeWorkerSchema.safeParse(json)
  if (!r.success) return { ok: false, error: r.error.issues.map((i) => i.message).join('; ') }
  return { ok: true, mensaje: r.data }
}

/**
 * Fases de progreso (campo `fase` de los mensajes `progreso`). Las de la Fase 2:
 * - `preparando`: lectura/normalización del audio (indeterminada o 0–1).
 * - `descargando`: descarga del audio de YouTube (`detalle.bytes`/`detalle.total`).
 * - `actualizando`: actualización de yt-dlp.
 * Las anteriores (`diagnostico`, `cargando_modelo`, `separando`, `guardando`) siguen igual.
 * El campo es una cadena abierta: una fase desconocida se tolera.
 */
export const FASES_PROGRESO = [
  'diagnostico',
  'preparando',
  'descargando',
  'actualizando',
  'cargando_modelo',
  'separando',
  'guardando'
] as const

export type FaseProgreso = (typeof FASES_PROGRESO)[number]

// --- Esquemas de `datos` del mensaje `resultado` (Fase 2) ---

export const metadatosCancionSchema = z.object({
  titulo: z.string().default(''),
  artista: z.string().default(''),
  album: z.string().default('')
})

export type MetadatosWorker = z.infer<typeof metadatosCancionSchema>

/** `importar-archivo`: datos que necesita el formulario "Revisar datos". */
export const resultadoImportarArchivoSchema = z.object({
  duracion_ms: z.number().int().nonnegative(),
  metadatos: metadatosCancionSchema,
  /** dB a aplicar para llegar a −16 LUFS (limitada a [−20, +20]). */
  ganancia_db: z.number().min(-20).max(20),
  /** Sonoridad integrada; `null` si el audio es silencio. */
  lufs: z.number().nullable(),
  nombre_original: z.string(),
  /** Ruta de la mezcla escrita, relativa al directorio de la canción. */
  mezcla: z.string().min(1)
})

export type ResultadoImportarArchivo = z.infer<typeof resultadoImportarArchivoSchema>

/** `info-youtube`: vista previa sin descargar el audio. */
export const resultadoInfoYoutubeSchema = z.object({
  id_video: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  titulo_original: z.string(),
  canal: z.string(),
  duracion_s: z.number().nonnegative(),
  /** Metadatos sugeridos por la heurística del worker (ADR 0003). */
  metadatos: metadatosCancionSchema,
  /** JPEG (≤ 320 px de ancho) en base64; ausente si no se pudo obtener. */
  miniatura_jpeg_base64: z.string().optional()
})

export type ResultadoInfoYoutube = z.infer<typeof resultadoInfoYoutubeSchema>

/** `descargar-youtube`: como `importar-archivo` más los bytes descargados. */
export const resultadoDescargarYoutubeSchema = resultadoImportarArchivoSchema.extend({
  bytes_descargados: z.number().int().nonnegative()
})

export type ResultadoDescargarYoutube = z.infer<typeof resultadoDescargarYoutubeSchema>

export const motivoRebajaSchema = z.enum(['memoria', 'generico'])
export type MotivoRebaja = z.infer<typeof motivoRebajaSchema>

/** `diagnostico`: perfil confirmado tras instalar las dependencias. */
export const resultadoDiagnosticoSchema = z.object({
  perfil: z.enum(['cpu', 'cuda', 'mps']),
  dispositivo: z.enum(['cuda', 'cpu']),
  gpu: z.string().nullable(),
  vram_mb: z.number().int().nonnegative().nullable(),
  motivo_rebaja: motivoRebajaSchema.nullable(),
  torch: z.string().nullable(),
  onnxruntime: z.string().nullable()
})

export type ResultadoDiagnostico = z.infer<typeof resultadoDiagnosticoSchema>
