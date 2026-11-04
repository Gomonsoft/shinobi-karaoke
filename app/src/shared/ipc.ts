import { z } from 'zod'
import { CANALES } from './canales'
import { cancionSchema, ESTADOS_PASO, NOMBRES_PASO } from './cancion'
import { CODIGOS_ERROR } from './errores'
import { estiloSchema } from './estilo'
import { configSchema } from './config'

export { CANALES } from './canales'

/**
 * Contrato único de la IPC (0011): canal, esquema de argumentos y de respuesta.
 * Main valida los argumentos con estos esquemas; preload y main importan los
 * nombres de aquí. El renderer solo ve `window.shinobi` (`ApiShinobi`).
 */

// --- Esquemas de datos ---------------------------------------------------

export const idCancionSchema = z.string().min(1).max(200)

const textoCorto = z.string().max(500)

export const metadatosEditablesSchema = z.strictObject({
  titulo: textoCorto.refine((t) => t.trim().length > 0, 'El título no puede estar vacío'),
  artista: textoCorto,
  album: textoCorto.nullable()
})
export type MetadatosEditables = z.infer<typeof metadatosEditablesSchema>

const pasoResumenSchema = z.object({
  estado: z.enum(ESTADOS_PASO),
  progreso: z.number().nullable(),
  error: z.object({ codigo: z.string(), mensaje: z.string() }).nullable()
})

/** Resumen de canción tal y como lo recibe el renderer: la miniatura es una URL shinobi-media://. */
export const resumenCancionSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  artista: z.string(),
  duracionMs: z.number().nullable(),
  estado: z.enum(['borrador', 'lista']),
  modificada: z.string(),
  estilo: estiloSchema.nullable(),
  /** URL `shinobi-media://<id>/fuente/miniatura.jpg`, nunca una ruta del disco. */
  miniatura: z.string().nullable(),
  pasos: z.record(z.enum(NOMBRES_PASO), pasoResumenSchema).nullable(),
  incompleta: z.boolean(),
  lineasSinSincronizar: z.number(),
  danada: z.boolean(),
  motivo: z.enum(['json', 'pistas']).nullable()
})
export type ResumenCancionIpc = z.infer<typeof resumenCancionSchema>

export const eventoCancionSchema = z.union([
  z.object({
    id: z.string(),
    resumen: resumenCancionSchema,
    eliminada: z.literal(false).optional()
  }),
  z.object({ id: z.string(), eliminada: z.literal(true) })
])
export type EventoCancionIpc = z.infer<typeof eventoCancionSchema>

// --- Trabajos en segundo plano (0014) -----------------------------------------

export const COLAS_TRABAJO = ['pesada', 'ligera'] as const
export type ColaTrabajo = (typeof COLAS_TRABAJO)[number]
export const PASOS_TRABAJO = ['fuente', 'separacion'] as const
export type PasoTrabajo = (typeof PASOS_TRABAJO)[number]
export const ESTADOS_TRABAJO = ['en_cola', 'en_curso', 'terminado'] as const
export const RESULTADOS_TRABAJO = ['completado', 'error', 'cancelado', 'interrumpido'] as const

export const progresoTrabajoSchema = z.object({
  fase: z.string(),
  /** 0–1 suavizado, o null si la fase es indeterminada. */
  valor: z.number().min(0).max(1).nullable(),
  /** Segundos restantes; null si no hay estimación (ver ux/04). */
  etaSegundos: z.number().min(0).nullable()
})
export type ProgresoTrabajo = z.infer<typeof progresoTrabajoSchema>

/** Trabajo tal y como lo ve el renderer (sin `args`, que pueden contener rutas o URLs). */
export const trabajoSchema = z.object({
  id: z.string(),
  cancionId: z.string(),
  paso: z.enum(PASOS_TRABAJO),
  cola: z.enum(COLAS_TRABAJO),
  comando: z.string(),
  estado: z.enum(ESTADOS_TRABAJO),
  /** 1 = el siguiente de su cola; null si no está en cola. */
  posicion: z.number().int().min(1).nullable(),
  /** Solo cuando `estado` es `terminado`. */
  resultado: z.enum(RESULTADOS_TRABAJO).nullable(),
  error: z.object({ codigo: z.string(), mensaje: z.string() }).nullable(),
  progreso: progresoTrabajoSchema.nullable()
})
export type TrabajoIpc = z.infer<typeof trabajoSchema>

export const eventoProgresoSchema = progresoTrabajoSchema.extend({
  id: z.string(),
  cancionId: z.string(),
  paso: z.enum(PASOS_TRABAJO)
})
export type EventoProgresoIpc = z.infer<typeof eventoProgresoSchema>

/** Campos de configuración que el renderer puede modificar. */
export const configParcialRendererSchema = z.strictObject({
  reproductor: z
    .strictObject({
      volumen: z.number().min(0).max(1).optional(),
      silenciado: z.boolean().optional()
    })
    .optional(),
  separacion: z
    .strictObject({ modo: z.enum(['automatico', 'calidad', 'rapido']).optional() })
    .optional(),
  estilo_predeterminado: estiloSchema.optional(),
  aviso_youtube_aceptado: z.iso.datetime().nullable().optional()
})
export type ConfigParcialRenderer = z.infer<typeof configParcialRendererSchema>

export const infoSistemaSchema = z.object({
  version: z.string(),
  so: z.string(),
  plataforma: z.string()
})
export type InfoSistema = z.infer<typeof infoSistemaSchema>

// --- Enlaces externos ------------------------------------------------------

/** Lista blanca: host exacto y, si se indica, prefijo de ruta. Solo `https:`. */
export const ENLACES_PERMITIDOS: readonly { host: string; prefijoRuta: string }[] = [
  { host: 'github.com', prefijoRuta: '/Gomonsoft/shinobi-karaoke' },
  { host: 'lrclib.net', prefijoRuta: '/' }
]

export function enlacePermitido(texto: string): boolean {
  let url: URL
  try {
    url = new URL(texto)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false
  return ENLACES_PERMITIDOS.some(({ host, prefijoRuta }) => {
    if (url.hostname !== host) return false
    if (prefijoRuta === '/') return true
    return url.pathname === prefijoRuta || url.pathname.startsWith(`${prefijoRuta}/`)
  })
}

export const enlaceSchema = z.string().max(2048).refine(enlacePermitido, 'Enlace no permitido')

// --- Errores y contrato ----------------------------------------------------

export const errorIpcSchema = z.object({
  codigo: z.enum(CODIGOS_ERROR),
  mensaje: z.string()
})
export type ErrorIpc = z.infer<typeof errorIpcSchema>

export type RespuestaIpc<T> = { ok: true; valor: T } | { ok: false; error: ErrorIpc }

const vacio = z.tuple([])
const unId = z.tuple([idCancionSchema])

/** Canal -> esquemas de argumentos (tupla) y de respuesta. */
export const CONTRATO = {
  [CANALES.biblioteca.listar]: { args: vacio, res: z.array(resumenCancionSchema) },
  [CANALES.biblioteca.obtener]: { args: unId, res: cancionSchema.nullable() },
  [CANALES.biblioteca.actualizarMetadatos]: {
    args: z.tuple([idCancionSchema, metadatosEditablesSchema]),
    res: resumenCancionSchema
  },
  [CANALES.biblioteca.volverABorrador]: { args: unId, res: resumenCancionSchema },
  [CANALES.biblioteca.eliminar]: { args: unId, res: z.void() },
  [CANALES.biblioteca.mostrarEnCarpeta]: { args: unId, res: z.void() },
  [CANALES.trabajos.listar]: { args: vacio, res: z.array(trabajoSchema) },
  [CANALES.trabajos.cancelar]: { args: unId, res: z.boolean() },
  [CANALES.trabajos.hayPendientes]: { args: vacio, res: z.boolean() },
  [CANALES.config.obtener]: { args: vacio, res: configSchema },
  [CANALES.config.actualizar]: { args: z.tuple([configParcialRendererSchema]), res: configSchema },
  [CANALES.sistema.info]: { args: vacio, res: infoSistemaSchema },
  [CANALES.sistema.abrirEnlace]: { args: z.tuple([enlaceSchema]), res: z.void() }
} as const

export type CanalInvocable = keyof typeof CONTRATO

// --- API expuesta al renderer ---------------------------------------------

type Config = z.infer<typeof configSchema>
type Cancion = z.infer<typeof cancionSchema>

export type AccionMenu = 'anadir' | 'ajustes'

export interface ApiShinobi {
  biblioteca: {
    listar(): Promise<ResumenCancionIpc[]>
    obtener(id: string): Promise<Cancion | null>
    actualizarMetadatos(id: string, metadatos: MetadatosEditables): Promise<ResumenCancionIpc>
    volverABorrador(id: string): Promise<ResumenCancionIpc>
    eliminar(id: string): Promise<void>
    mostrarEnCarpeta(id: string): Promise<void>
  }
  trabajos: {
    /** Trabajos en curso y en cola (los terminados solo llegan por `alCambiar`). */
    listar(): Promise<TrabajoIpc[]>
    /** Cancela el trabajo; `false` si ya no existe. */
    cancelar(id: string): Promise<boolean>
    hayPendientes(): Promise<boolean>
    /** Cambios de estado y de posición en la cola. Devuelve la función para darse de baja. */
    alCambiar(cb: (trabajo: TrabajoIpc) => void): () => void
    alProgreso(cb: (progreso: EventoProgresoIpc) => void): () => void
  }
  config: {
    obtener(): Promise<Config>
    actualizar(parcial: ConfigParcialRenderer): Promise<Config>
  }
  sistema: {
    info(): Promise<InfoSistema>
    abrirEnlace(url: string): Promise<void>
  }
  /** Devuelve la función para darse de baja. */
  alCambiarCancion(cb: (evento: EventoCancionIpc) => void): () => void
  alCambiarConfig(cb: (config: Config) => void): () => void
  /** Acciones del menú nativo de la aplicación (0018): Ctrl/Cmd+N y Ctrl/Cmd+,. */
  alAccionMenu(cb: (accion: AccionMenu) => void): () => void
  /** Ruta en disco de un archivo arrastrado o elegido en la ventana (Electron no expone `File.path`). */
  rutaDeArchivo(archivo: File): string
}
