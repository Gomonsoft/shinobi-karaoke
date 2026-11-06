import { z } from 'zod'
import { MODELOS_SEPARACION } from './manifiesto'

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
 * Las de la separación (Fase 3) están en `FASES_SEPARACION_WORKER` y `FASES_SEPARACION_MAIN`.
 * El campo es una cadena abierta: una fase desconocida se tolera.
 */
export const FASES_PROGRESO = [
  'diagnostico',
  'preparando',
  'descargando',
  'actualizando',
  'cargando_modelo',
  'separando',
  'guardando',
  'descargando_modelo',
  'reintentando'
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

// --- Comando `separar` (Fase 3, tarea 0059) ---

/** Ruta absoluta POSIX (`/…`), de Windows (`C:\…`, `C:/…`) o UNC (`\\servidor\…`). */
const RUTA_ABSOLUTA = /^(?:\/|[A-Za-z]:[\\/]|\\\\)/

export const rutaAbsolutaSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine((r) => RUTA_ABSOLUTA.test(r), 'La ruta debe ser absoluta')

export const DISPOSITIVOS_SEPARACION = ['cpu', 'cuda'] as const
export const BLOQUES_SEPARACION = ['normal', 'pequenos'] as const

export type DispositivoSeparacion = (typeof DISPOSITIVOS_SEPARACION)[number]
export type BloquesSeparacion = (typeof BLOQUES_SEPARACION)[number]

/**
 * Argumentos de `separar`. El worker los valida con las mismas reglas
 * (`worker/shinobi_worker/argumentos_separar.py`).
 * - `entrada`: `fuente/mezcla.flac` (FLAC PCM 16 bits, 44,1 kHz, estéreo).
 * - `salida_dir`: `biblioteca/<id>/pistas.tmp/`; el main la crea y la vacía.
 * - `modelo.dir`: carpeta `modelos/` del directorio de datos (siempre explícita: `model_file_dir`).
 */
export const argsSepararSchema = z.strictObject({
  entrada: rutaAbsolutaSchema,
  salida_dir: rutaAbsolutaSchema,
  modelo: z.strictObject({
    id: z.enum(MODELOS_SEPARACION),
    /** Nombre de archivo del checkpoint (sin carpetas). */
    archivo: z
      .string()
      .min(1)
      .max(255)
      .refine((a) => !/[\\/]/.test(a), 'Debe ser un nombre de archivo'),
    dir: rutaAbsolutaSchema
  }),
  dispositivo: z.enum(DISPOSITIVOS_SEPARACION),
  bloques: z.enum(BLOQUES_SEPARACION)
})

export type ArgsSeparar = z.infer<typeof argsSepararSchema>

/**
 * Fases de progreso que emite el worker en `separar`:
 * `preparando`, `cargando_modelo` y `guardando` indeterminadas; `separando` 0–1 con
 * `detalle: { paso, total }`. La lista debe coincidir con `FASES_SEPARACION` de
 * `worker/shinobi_worker/protocolo.py` (test de paridad).
 */
export const FASES_SEPARACION_WORKER = [
  'preparando',
  'cargando_modelo',
  'separando',
  'guardando'
] as const

/**
 * Fases que añade el proceso principal: `descargando_modelo` (0–1, `detalle: { bytes, total }`) y
 * `reintentando` (indeterminada, `detalle: { motivo, espera_s? }`).
 */
export const FASES_SEPARACION_MAIN = ['descargando_modelo', 'reintentando'] as const

export type FaseSeparacion =
  (typeof FASES_SEPARACION_WORKER)[number] | (typeof FASES_SEPARACION_MAIN)[number]

export const MOTIVOS_REINTENTO = ['memoria', 'memoria_cpu', 'red'] as const
export type MotivoReintento = (typeof MOTIVOS_REINTENTO)[number]

export const detalleSeparandoSchema = z.object({
  paso: z.number().int().nonnegative(),
  total: z.number().int().positive()
})
export const detalleDescargandoModeloSchema = z.object({
  bytes: z.number().nonnegative(),
  total: z.number().nonnegative().nullable()
})
export const detalleReintentandoSchema = z.object({
  motivo: z.enum(MOTIVOS_REINTENTO),
  espera_s: z.number().nonnegative().optional()
})

/** `datos` del resultado de `separar`; las rutas son relativas a `salida_dir`. */
export const resultadoSepararSchema = z.object({
  voz: z.literal('voz.flac'),
  instrumental: z.literal('instrumental.flac'),
  modelo: z.object({
    id: z.enum(MODELOS_SEPARACION),
    archivo: z.string().min(1),
    version_audio_separator: z.string().min(1)
  }),
  dispositivo: z.enum(DISPOSITIVOS_SEPARACION),
  segundos_separando: z.number().nonnegative(),
  segundos_total: z.number().nonnegative()
})

export type ResultadoSeparar = z.infer<typeof resultadoSepararSchema>

/** Códigos que puede emitir `separar` (sin códigos nuevos en el worker). */
export const ERRORES_SEPARAR = [
  'MEMORIA_INSUFICIENTE',
  'MODELO_NO_DISPONIBLE',
  'RUNTIME_NO_DISPONIBLE',
  'SIN_ESPACIO',
  'FORMATO_NO_SOPORTADO',
  'ARGUMENTOS_NO_VALIDOS',
  'ERROR_INTERNO'
] as const
