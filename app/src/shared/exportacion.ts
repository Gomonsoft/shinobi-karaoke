import type { Modalidad } from './cancion'
import type { CodigoError } from './errores'
import type { Estilo } from './estilo'
import type { Letra } from './letra'

/**
 * Catálogo, estimaciones y utilidades puras de la exportación de video (ADR 0019 §5, §6 y §11;
 * spec ux/10). Sin dependencias de Electron: lo usan main, el renderer y la ventana de exportación.
 */

// --- Formatos --------------------------------------------------------------

export const FORMATOS_ID = ['mkv_av1', 'webm_vp9'] as const
export type FormatoId = (typeof FORMATOS_ID)[number]

export interface FormatoExportacion {
  id: FormatoId
  contenedor: 'matroska' | 'webm'
  /** Sin punto. */
  extension: 'mkv' | 'webm'
  video: 'AV1' | 'VP9'
  /** Nombre para el control segmentado (`exp.formato`). */
  nombre: string
  /** «MKV» o «WebM» (`exp.resumen`, muestra). */
  nombreCorto: string
}

export const FORMATOS: Readonly<Record<FormatoId, FormatoExportacion>> = {
  mkv_av1: {
    id: 'mkv_av1',
    contenedor: 'matroska',
    extension: 'mkv',
    video: 'AV1',
    nombre: 'MKV (AV1 + Opus)',
    nombreCorto: 'MKV'
  },
  webm_vp9: {
    id: 'webm_vp9',
    contenedor: 'webm',
    extension: 'webm',
    video: 'VP9',
    nombre: 'WebM (VP9 + Opus)',
    nombreCorto: 'WebM'
  }
}

export const FORMATO_PREDETERMINADO: FormatoId = 'mkv_av1'

// --- Audio, proporciones, resoluciones y FPS ---------------------------------

export const AUDIOS_EXPORTACION = ['instrumental', 'instrumental_voz'] as const
export type AudioExportacion = (typeof AUDIOS_EXPORTACION)[number]
export const AUDIO_PREDETERMINADO: AudioExportacion = 'instrumental'

export const PROPORCIONES = ['16:9', '4:3'] as const
export type Proporcion = (typeof PROPORCIONES)[number]
export const PROPORCION_PREDETERMINADA: Proporcion = '16:9'

export interface Resolucion {
  proporcion: Proporcion
  ancho: number
  alto: number
}

/** De menor a mayor dentro de cada proporción. Todas las dimensiones son pares (YUV 4:2:0). */
export const RESOLUCIONES: readonly Resolucion[] = [
  { proporcion: '16:9', ancho: 1280, alto: 720 },
  { proporcion: '16:9', ancho: 1920, alto: 1080 },
  { proporcion: '16:9', ancho: 2560, alto: 1440 },
  { proporcion: '16:9', ancho: 3840, alto: 2160 },
  { proporcion: '4:3', ancho: 640, alto: 480 },
  { proporcion: '4:3', ancho: 1024, alto: 768 },
  { proporcion: '4:3', ancho: 1600, alto: 1200 },
  { proporcion: '4:3', ancho: 2880, alto: 2160 }
]

export const FPS = [24, 30, 60] as const
export type Fps = (typeof FPS)[number]

export const RESOLUCION_PREDETERMINADA = { ancho: 1920, alto: 1080 } as const
export const FPS_PREDETERMINADO: Fps = 30

export interface PerfilExportacion {
  formato: FormatoId
  ancho: number
  alto: number
  fps: number
}

export interface CombinacionExportacion extends PerfilExportacion {
  proporcion: Proporcion
  fps: Fps
}

/** Las 48 combinaciones: formato × resolución × FPS. */
export function combinaciones(): CombinacionExportacion[] {
  return FORMATOS_ID.flatMap((formato) =>
    RESOLUCIONES.flatMap((r) => FPS.map((fps) => ({ formato, ...r, fps })))
  )
}

export function esResolucionValida(ancho: number, alto: number): boolean {
  return RESOLUCIONES.some((r) => r.ancho === ancho && r.alto === alto)
}

export function proporcionDe(ancho: number, alto: number): Proporcion | null {
  return RESOLUCIONES.find((r) => r.ancho === ancho && r.alto === alto)?.proporcion ?? null
}

export function esCombinacionValida(perfil: PerfilExportacion): boolean {
  return (
    (FORMATOS_ID as readonly string[]).includes(perfil.formato) &&
    (FPS as readonly number[]).includes(perfil.fps) &&
    esResolucionValida(perfil.ancho, perfil.alto)
  )
}

// --- Parámetros de codificación y memoria (ADR 0019 §5) ------------------------

export interface ParametrosAv1 {
  preset: number
  crf: number
}
export interface ParametrosVp9 {
  cpu_used: number
  crf: number
}

/** Los usa el worker con estas mismas claves (`parametros` de `exportar`). */
export type ParametrosCodificacion = ParametrosAv1 | ParametrosVp9

type LineasCodificacion = 'hasta1200' | '1440' | '2160'

const TABLA_CODIFICACION: {
  mkv_av1: Record<LineasCodificacion, ParametrosAv1>
  webm_vp9: Record<LineasCodificacion, ParametrosVp9>
} = {
  mkv_av1: {
    hasta1200: { preset: 8, crf: 32 },
    '1440': { preset: 8, crf: 34 },
    '2160': { preset: 10, crf: 35 }
  },
  webm_vp9: {
    hasta1200: { cpu_used: 8, crf: 32 },
    '1440': { cpu_used: 8, crf: 33 },
    '2160': { cpu_used: 8, crf: 34 }
  }
}

function tramoDeLineas(alto: number): LineasCodificacion {
  if (alto >= 2160) return '2160'
  if (alto >= 1440) return '1440'
  return 'hasta1200'
}

/** Preset/CRF por formato y resolución (480–1200, 1440 y 2160 líneas). */
export const PARAMETROS_CODIFICACION = {
  mkv_av1: (alto: number): ParametrosAv1 => TABLA_CODIFICACION.mkv_av1[tramoDeLineas(alto)],
  webm_vp9: (alto: number): ParametrosVp9 => TABLA_CODIFICACION.webm_vp9[tramoDeLineas(alto)]
} as const

export function parametrosDe(formato: FormatoId, alto: number): ParametrosCodificacion {
  return PARAMETROS_CODIFICACION[formato](alto)
}

const GIB = 1024 ** 3

/**
 * Memoria total mínima del equipo por resolución (clave `{ancho}x{alto}`); `null` = sin mínimo.
 * Solo las de 2160 líneas piden 7 GiB (equipos de «8 GB» que informan menos; `motivo: memoria`,
 * ADR 0019 §5, revisión del 2026-11-20).
 */
export const MEMORIA_MINIMA: Readonly<Record<string, number | null>> = Object.fromEntries(
  RESOLUCIONES.map((r) => [`${r.ancho}x${r.alto}`, r.alto >= 2160 ? 7 * GIB : null])
)

export function memoriaMinimaDe(ancho: number, alto: number): number | null {
  return MEMORIA_MINIMA[`${ancho}x${alto}`] ?? null
}

// --- Estimaciones (ADR 0019 §11) ------------------------------------------------

const MB = 1_000_000
const OPUS_MB_MIN = 1.44
const MARGEN_TAMANO = 1.15

export const FACTOR_CORRECTOR = { min: 0.25, max: 8, defecto: 1 } as const

export interface EntradaEstimacion {
  formato: FormatoId
  alto: number
  fps: number
  duracionMs: number
  /** El estilo resuelto tiene degradado en movimiento. */
  fondoMovil?: boolean
}

/** Recalibrada con las medidas de QA de 0.2.0 (ADR 0019, revisión para 0.2.1 §3). */
function videoMbPorMinuto(alto: number): number {
  if (alto <= 768) return 1
  if (alto <= 1200) return 1.3
  if (alto <= 1440) return 2
  return 4
}

export function estimarBytes(e: EntradaEstimacion): number {
  const minutos = e.duracionMs / 60_000
  const video =
    videoMbPorMinuto(e.alto) *
    (e.fps >= 60 ? 1.3 : 1) *
    (e.fondoMovil ? 1.5 : 1) *
    (e.formato === 'webm_vp9' ? 1.3 : 1)
  return Math.round((video + OPUS_MB_MIN) * minutos * MARGEN_TAMANO * MB)
}

function factorTiempo(alto: number): number {
  if (alto <= 768) return 0.6
  if (alto <= 1200) return 1.2
  if (alto <= 1440) return 2
  return 6
}

/** Acota el factor aprendido al rango permitido (`config.exportacion.factor_corrector`). */
export function acotarFactorCorrector(factor: number): number {
  if (!Number.isFinite(factor)) return FACTOR_CORRECTOR.defecto
  return Math.min(FACTOR_CORRECTOR.max, Math.max(FACTOR_CORRECTOR.min, factor))
}

export function estimarSegundos(e: EntradaEstimacion & { factorCorrector?: number }): number {
  const base =
    factorTiempo(e.alto) *
    (e.fps >= 60 ? 2 : 1) *
    (e.formato === 'webm_vp9' ? 1.2 : 1) *
    (e.duracionMs / 1000)
  return Math.round(base * acotarFactorCorrector(e.factorCorrector ?? FACTOR_CORRECTOR.defecto))
}

// --- Nombre propuesto (`exp.nombre`) ------------------------------------------

export const MAX_NOMBRE_ARCHIVO = 120

function esControl(caracter: string): boolean {
  const c = caracter.charCodeAt(0)
  return c < 0x20 || (c >= 0x7f && c <= 0x9f)
}

/** Sustituye `/ \ : * ? " < > |` y controles por «-»; recorta espacios y puntos finales. */
export function sanearNombre(texto: string): string {
  const limpio = [...texto].map((c) => (/[/\\:*?"<>|]/.test(c) || esControl(c) ? '-' : c)).join('')
  return limpio.replace(/^\s+/, '').replace(/[\s.]+$/, '')
}

/**
 * «{título} — {artista} (karaoke).{ext}»; sin artista, «{título} (karaoke).{ext}». El nombre sin
 * extensión se limita a 120 caracteres. `extension` admite «mkv» o «.mkv».
 */
export function nombrePropuesto(titulo: string, artista: string, extension: string): string {
  const t = titulo.trim() || 'Sin título'
  const a = artista.trim()
  const base = a ? `${t} — ${a} (karaoke)` : `${t} (karaoke)`
  const saneado = sanearNombre(base)
  const recortado = sanearNombre([...saneado].slice(0, MAX_NOMBRE_ARCHIVO).join(''))
  return `${recortado || 'karaoke'}.${extension.replace(/^\./, '')}`
}

// --- Convivencia con la sesión (ADR 0019 §9) -----------------------------------

export type PlataformaExportacion = 'win32' | 'darwin' | 'linux'

export interface BloqueoConSesion {
  plataforma: PlataformaExportacion
  ancho: number
  alto: number
  fps: number
  motivo: string
}

/** Vacía: ningún perfil corta el audio de una sesión (ADR 0019 §9). Se rellena si la guía manual lo demuestra. */
export const BLOQUEOS_CON_SESION: readonly BloqueoConSesion[] = []

export function perfilCompatibleConSesion(
  perfil: Pick<PerfilExportacion, 'ancho' | 'alto' | 'fps'>,
  plataforma: string
): boolean {
  return !BLOQUEOS_CON_SESION.some(
    (b) =>
      b.plataforma === plataforma &&
      b.ancho === perfil.ancho &&
      b.alto === perfil.alto &&
      b.fps === perfil.fps
  )
}

// --- Fotogramas -----------------------------------------------------------------

/** `N = ceil(duracionMs × fps / 1000)`. */
export function totalFotogramas(duracionMs: number, fps: number): number {
  return Math.ceil((duracionMs * fps) / 1000)
}

/** Instante de audio del fotograma `n`, en milisegundos: `n × 1000 / fps`. */
export function tiempoDeFotograma(n: number, fps: number): number {
  return (n * 1000) / fps
}

// --- Tipos de la IPC (los esquemas están en `ipc.ts`) -------------------------------

export const MOTIVOS_PERFIL_NO_SOPORTADO = [
  'codificador',
  'memoria',
  'captura',
  'no_comprobado'
] as const
export type MotivoPerfilNoSoportado = (typeof MOTIVOS_PERFIL_NO_SOPORTADO)[number]

export interface FormatoIpc {
  id: FormatoId
  extension: 'mkv' | 'webm'
}

export interface PerfilIpc {
  formato: FormatoId
  proporcion: Proporcion
  ancho: number
  alto: number
  fps: Fps
  soportado: boolean
  motivo: MotivoPerfilNoSoportado | null
}

export interface PerfilesIpc {
  formatos: FormatoIpc[]
  perfiles: PerfilIpc[]
}

export interface EstimacionExportacionIpc {
  bytes: number | null
  segundos: number | null
}

export interface DestinoIpc {
  /** UUID de un solo uso (caduca a los 30 min); main lo asocia a la ruta absoluta. */
  destinoId: string
  ruta: string
  existe: boolean
  libreBytes: number | null
  carpetaRecordadaNoDisponible: boolean
}

/**
 * Lo guardado de la canción al aceptar `iniciar` (ADR 0019 §3). Vive en memoria de main y se
 * entrega a la ventana de exportación por `exportacion.inicial()`.
 */
export interface InstantaneaExportacion {
  titulo: string
  artista: string
  duracionMs: number
  letra: Letra
  /** Estilo resuelto con su procedencia ya aplicada. */
  estilo: Estilo
  /** Una canción en borrador se exporta siempre como `karaoke`. */
  modalidad: Modalidad
  /** `fuente.ganancia_db`. */
  gananciaDb: number
  /** Existe y se puede leer `voz.flac`. */
  vozDisponible: boolean
}

export const FASES_EXPORTACION = ['preparando', 'codificando', 'finalizando'] as const
export type FaseExportacion = (typeof FASES_EXPORTACION)[number]

export interface ProgresoExportacionIpc {
  trabajoId: string
  fase: FaseExportacion
  /** 0–1 en `codificando`; `null` si la fase es indeterminada. */
  valor: number | null
  fotograma: number
  total: number
  posicionMs: number
  duracionMs: number
  etaSegundos: number | null
}

export const ESTADOS_EXPORTACION = ['en_cola', 'en_curso', 'terminada'] as const
export type EstadoExportacion = (typeof ESTADOS_EXPORTACION)[number]
export const RESULTADOS_EXPORTACION = ['completada', 'error', 'cancelada'] as const
export type ResultadoExportacion = (typeof RESULTADOS_EXPORTACION)[number]

/** 0.2.1 (0283): `captura` = fallo de captura (¿reintentable?); `destino` = error del campo destino; `trabajoId` = trabajo existente de `CANCION_EXPORTANDOSE`. */
export type DetalleErrorExportacion =
  { causa: 'captura'; reintentable: boolean } | { campo: 'destino' } | { trabajoId: string }

export interface ErrorExportacionIpc {
  codigo: CodigoError
  mensaje: string
  /** Fotograma alcanzado × 1000 / FPS; `null` si falló antes del primer fotograma. */
  posicionMs: number | null
  /** Para «Copiar detalles». */
  detalles?: string
  detalle?: DetalleErrorExportacion
}

export interface ExportacionIpc {
  trabajoId: string
  cancionId: string
  titulo: string
  artista: string
  formato: FormatoId
  ancho: number
  alto: number
  fps: Fps
  audio: AudioExportacion
  estado: EstadoExportacion
  /** 1 = la siguiente de la cola; `null` si no está en cola. */
  posicion: number | null
  resultado: ResultadoExportacion | null
  error: ErrorExportacionIpc | null
  progreso: ProgresoExportacionIpc | null
  /** Nombre del archivo de destino (sin carpeta). */
  archivo: string
  /** Carpeta del destino, para mostrarla; el renderer nunca envía rutas. */
  carpeta: string
  /** Solo si `resultado` es `completada`. */
  bytes: number | null
  fotogramas: number | null
  duracionMs: number
  /** Había un archivo con ese nombre al iniciar (`exp.error.conservado`, B3; 0132). */
  destinoExistia: boolean
  /** ISO; `null` mientras no haya empezado (en cola). «Tardó…» es `terminadaEn − iniciadaEn`. */
  iniciadaEn: string | null
  /** ISO; `null` mientras no haya terminado. */
  terminadaEn: string | null
  /** El temporal no se pudo borrar tras cancelar o fallar; `resultado` y `error` siguen siendo los reales. */
  limpiezaFallida: boolean
}

export const TIPOS_AVISO_EXPORTACION = ['interrumpida', 'limpieza_fallida'] as const
export type TipoAvisoExportacion = (typeof TIPOS_AVISO_EXPORTACION)[number]

/**
 * Aviso que no nace de un trabajo en marcha (ADR 0019 §10, revisión 0132): se detectó al arrancar.
 * Main lo guarda hasta `avisosPendientes()` y lo emite con `exportacion:aviso`; cada uno se entrega una vez.
 */
export interface AvisoExportacionIpc {
  avisoId: string
  tipo: TipoAvisoExportacion
  cancionId: string
  titulo: string
}

export interface InicialExportacionIpc {
  trabajoId: string
  instantanea: InstantaneaExportacion
  ancho: number
  alto: number
  fps: Fps
  total: number
}

export interface FotogramaExportacionIpc {
  trabajoId: string
  n: number
}
