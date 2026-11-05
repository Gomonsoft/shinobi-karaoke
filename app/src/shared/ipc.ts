import { z } from 'zod'
import { CANALES } from './canales'
import { cancionSchema, ESTADOS_PASO, NOMBRES_PASO } from './cancion'
import { CODIGOS_ERROR } from './errores'
import { estiloSchema } from './estilo'
import { configSchema } from './config'
import { perfilSchema, plataformaSchema } from './manifiesto'

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

/** `fuente.estadoInfo`: la consulta `consultaId` está esperando o provocando una actualización. */
export interface EventoEstadoInfoIpc {
  consultaId: string
  fase: 'actualizando'
}

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
  etaSegundos: z.number().min(0).nullable(),
  /** Bytes descargados y totales (solo en la fase `descargando`; `total` puede ser desconocido). */
  detalle: z.object({ bytes: z.number().min(0), total: z.number().min(0).nullable() }).optional()
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
  /** `mantenimiento`: espera en la cola a que termine una actualización de yt-dlp (0050). */
  motivo: z.literal('mantenimiento').nullable().optional(),
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
  plataforma: z.string(),
  /** Módulo de YouTube compilado (ADR 0003, mitigación 5). */
  youtube: z.boolean(),
  /** Versión del SO (`process.getSystemVersion()`: `14.5` en macOS, no la del núcleo; 0054). */
  versionSo: z.string().optional(),
  /** Arquitectura real del equipo: `arm64` aunque la app vaya emulada (0031). */
  arquitectura: z.string().optional(),
  emulada: z.boolean().optional(),
  /** yt-dlp instalado y fecha de su última comprobación; `null` si no existe todavía. */
  ytdlp: z
    .object({ version: z.string().nullable(), ultimaComprobacion: z.string().nullable() })
    .optional()
})
export type InfoSistema = z.infer<typeof infoSistemaSchema>

/** Textos legales que main lee de los recursos de la app (0038): GPL-3.0 y avisos de terceros. */
export const TEXTOS_LEGALES = ['gpl', 'terceros'] as const
export type TextoLegal = (typeof TEXTOS_LEGALES)[number]
export const textoLegalSchema = z.enum(TEXTOS_LEGALES)

// --- Enlaces externos ------------------------------------------------------

/** Lista blanca: host exacto y, si se indica, prefijo de ruta. Solo `https:`. */
export const ENLACES_PERMITIDOS: readonly { host: string; prefijoRuta: string }[] = [
  { host: 'github.com', prefijoRuta: '/Gomonsoft/shinobi-karaoke' },
  { host: 'lrclib.net', prefijoRuta: '/' },
  // "Actualizar macOS en el Mac" (Apple, en español, comprobada el 2026-11-04); solo esa ruta (B6b, 0037).
  { host: 'support.apple.com', prefijoRuta: '/es-es/108382' }
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

// --- Fuente: importación de archivo local (0042) ---------------------------------

/** Datos que main devuelve tras leer el audio; ganancia y rutas se quedan asociadas al id en main. */
export const importacionLeidaSchema = z.object({
  importacionId: z.string(),
  nombre: z.string(),
  duracionMs: z.number().int().nonnegative(),
  metadatos: z.object({ titulo: z.string(), artista: z.string(), album: z.string() }),
  gananciaDb: z.number(),
  /** Más de 10 min: la UI muestra el aviso (no es un error). */
  larga: z.boolean()
})
export type ImportacionLeidaIpc = z.infer<typeof importacionLeidaSchema>

// --- Fuente: YouTube (0049) -----------------------------------------------------

/** Vista previa de un enlace; la URL canónica y los bytes de la miniatura se quedan en main. */
export const infoYoutubeSchema = z.object({
  consultaId: z.string(),
  idVideo: z.string(),
  tituloOriginal: z.string(),
  canal: z.string(),
  duracionS: z.number().nonnegative(),
  metadatos: z.object({ titulo: z.string(), artista: z.string(), album: z.string() }),
  /** `data:image/jpeg;base64,…` o `null` si no hay miniatura. */
  miniaturaDataUrl: z.string().nullable()
})
export type InfoYoutubeIpc = z.infer<typeof infoYoutubeSchema>

// --- Runtime (0036) -----------------------------------------------------------

const faseRuntimeSchema = z.enum(['pendiente', 'en_curso', 'completada', 'error'])
const modoRuntimeSchema = z.enum(['calidad', 'rapido'])

export const FASES_RUNTIME = ['motor', 'componentes', 'modelo'] as const
export type FaseRuntime = (typeof FASES_RUNTIME)[number]

export const estadoRuntimeSchema = z.object({
  estado: z.enum(['verificando', 'pendiente', 'en_curso', 'completa', 'dañada']),
  fases: z.object({
    motor: faseRuntimeSchema,
    componentes: faseRuntimeSchema,
    modelo: faseRuntimeSchema
  }),
  error: z.object({ codigo: z.string(), mensaje: z.string(), fase: z.string() }).nullable(),
  perfilPrevisto: perfilSchema.nullable(),
  perfil: perfilSchema.nullable(),
  motivoRebaja: z.enum(['memoria', 'generico']).nullable(),
  modo: modoRuntimeSchema.nullable(),
  /** Bytes que faltan por descargar (fases no completadas); `null` sin perfil. */
  bytesRestantes: z.number().nonnegative().nullable()
})
export type EstadoRuntimeIpc = z.infer<typeof estadoRuntimeSchema>

export const requisitosRuntimeSchema = z.object({
  plataforma: plataformaSchema.nullable(),
  /** Por qué no hay plataforma (B6 `arquitectura` o B6b `so_antiguo`); `null` si la hay. */
  motivo: z.enum(['arquitectura', 'so_antiguo']).nullable(),
  /** Solo con `motivo === 'so_antiguo'`. */
  versionMinimaSo: z.object({ version: z.string(), nombre: z.string().nullable() }).nullable(),
  equipo: z.object({
    so: z.enum(['windows', 'macos', 'linux', 'otro']),
    versionSo: z.string(),
    arquitectura: z.enum(['x64', 'arm64', 'ia32', 'otra'])
  }),
  emulada: z.boolean(),
  perfil: perfilSchema.nullable(),
  gpu: z.object({ nombre: z.string(), vramMb: z.number() }).nullable(),
  bytesDescarga: z.number().nonnegative().nullable(),
  espacioRequerido: z.number().nonnegative(),
  espacioLibre: z.number().nonnegative(),
  modoPrevisto: modoRuntimeSchema.nullable()
})
export type RequisitosRuntimeIpc = z.infer<typeof requisitosRuntimeSchema>

export const progresoRuntimeSchema = z.object({
  faseVisible: z.enum(FASES_RUNTIME).nullable(),
  estados: z.object({
    motor: faseRuntimeSchema,
    componentes: faseRuntimeSchema,
    modelo: faseRuntimeSchema
  }),
  bytes: z.number().nonnegative(),
  total: z.number().nonnegative(),
  totalGlobal: z.number().nonnegative(),
  porcentajeGlobal: z.number().min(0).max(100),
  etaSegundos: z.number().nonnegative().nullable(),
  modo: modoRuntimeSchema.nullable(),
  motivoRebaja: z.enum(['memoria', 'generico']).nullable(),
  comprobando: z.boolean()
})
export type ProgresoRuntimeIpc = z.infer<typeof progresoRuntimeSchema>

export const estimacionSeparacionSchema = z
  .object({ min: z.number().nonnegative(), max: z.number().nonnegative() })
  .nullable()
export type EstimacionSeparacion = z.infer<typeof estimacionSeparacionSchema>

// --- Errores y contrato ----------------------------------------------------

export const errorIpcSchema = z.object({
  codigo: z.enum(CODIGOS_ERROR),
  mensaje: z.string(),
  /** Últimas líneas de salida del worker, para "Copiar detalles" (0042). */
  detalles: z.string().optional()
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
  [CANALES.sistema.abrirEnlace]: { args: z.tuple([enlaceSchema]), res: z.void() },
  [CANALES.sistema.textoLegal]: { args: z.tuple([textoLegalSchema]), res: z.string() },
  [CANALES.sistema.abrirCarpetaDatos]: { args: vacio, res: z.void() },
  [CANALES.sistema.elegirArchivoAudio]: { args: vacio, res: z.string().nullable() },
  [CANALES.fuente.importarArchivo]: {
    args: z.tuple([z.string().min(1).max(4096)]),
    res: importacionLeidaSchema
  },
  // Sin id cancela la lectura en curso (el renderer aún no conoce el id mientras lee).
  [CANALES.fuente.cancelarImportacion]: {
    args: z.union([vacio, unId]),
    res: z.void()
  },
  [CANALES.fuente.confirmarArchivo]: {
    // Tercer argumento opcional: sustituye la fuente de esa canción en lugar de crear otra (0042).
    args: z.union([
      z.tuple([idCancionSchema, metadatosEditablesSchema]),
      z.tuple([
        idCancionSchema,
        metadatosEditablesSchema,
        z.strictObject({ cancionId: idCancionSchema })
      ])
    ]),
    res: resumenCancionSchema
  },
  [CANALES.fuente.descartarImportacion]: { args: unId, res: z.void() },
  [CANALES.fuente.infoYoutube]: { args: z.tuple([z.string().max(4096)]), res: infoYoutubeSchema },
  // Sin id cancela la consulta en curso; con id descarta la consulta guardada.
  [CANALES.fuente.cancelarInfo]: { args: z.union([vacio, unId]), res: z.void() },
  [CANALES.fuente.confirmarYoutube]: {
    args: z.union([
      z.tuple([z.string().min(1).max(200), metadatosEditablesSchema]),
      z.tuple([
        z.string().min(1).max(200),
        metadatosEditablesSchema,
        z.strictObject({ cancionId: idCancionSchema })
      ])
    ]),
    res: resumenCancionSchema
  },
  [CANALES.fuente.reintentar]: { args: unId, res: z.void() },
  [CANALES.runtime.estado]: { args: vacio, res: estadoRuntimeSchema },
  [CANALES.runtime.requisitos]: {
    args: z.tuple([z.strictObject({ recalcularEspacio: z.boolean() })]),
    res: requisitosRuntimeSchema
  },
  // Arranca (o continúa) la instalación y responde al momento; el resultado llega por `alCambiar`.
  [CANALES.runtime.instalar]: { args: vacio, res: z.void() },
  [CANALES.runtime.pausar]: { args: vacio, res: z.void() },
  [CANALES.runtime.detalles]: { args: vacio, res: z.string() },
  [CANALES.runtime.estimarSeparacion]: {
    args: z.tuple([z.number().finite().nonnegative().max(1e9)]),
    res: estimacionSeparacionSchema
  },
  [CANALES.app.confirmarCierre]: { args: vacio, res: z.void() },
  [CANALES.app.salir]: { args: vacio, res: z.void() }
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
    /** Texto completo de `LICENSE` (`gpl`) o `THIRD_PARTY_NOTICES.md` (`terceros`), sin conexión. */
    textoLegal(tipo: TextoLegal): Promise<string>
    abrirCarpetaDatos(): Promise<void>
    /** Diálogo nativo "Audio y vídeo" / "Todos los archivos"; `null` si se cancela. */
    elegirArchivoAudio(): Promise<string | null>
  }
  fuente: {
    /** Lee el archivo en `.importando/` (cancelable). Una nueva importación cancela la anterior. */
    importarArchivo(ruta: string): Promise<ImportacionLeidaIpc>
    /** Sin id, cancela la lectura en curso; con id, descarta esa importación. */
    cancelarImportacion(importacionId?: string): Promise<void>
    /** Crea la canción (`borrador`, fuente completada) con los metadatos revisados. */
    confirmarArchivo(
      importacionId: string,
      metadatos: MetadatosEditables,
      /** Con `cancionId`, sustituye la fuente de esa canción (sin audio) en vez de crear otra. */
      opciones?: { cancionId: string }
    ): Promise<ResumenCancionIpc>
    /** Abandona la importación (Cancelar, ‹ Biblioteca, Esc) y borra su carpeta. */
    descartarImportacion(importacionId: string): Promise<void>
    /** Consulta los datos del vídeo sin descargarlo (exige el aviso legal aceptado). */
    infoYoutube(url: string): Promise<InfoYoutubeIpc>
    /** Sin id cancela la consulta en curso; con id descarta la consulta guardada. */
    cancelarInfo(consultaId?: string): Promise<void>
    /** Crea el borrador y encola la descarga; con `cancionId` sustituye la fuente de esa canción. */
    confirmarYoutube(
      consultaId: string,
      metadatos: MetadatosEditables,
      opciones?: { cancionId: string }
    ): Promise<ResumenCancionIpc>
    /** Vuelve a encolar la descarga de una canción de YouTube con el paso `fuente` sin completar. */
    reintentar(cancionId: string): Promise<void>
  }
  runtime: {
    estado(): Promise<EstadoRuntimeIpc>
    /** Requisitos previos (0031); `recalcularEspacio` fuerza una nueva lectura del espacio libre. */
    requisitos(opciones: { recalcularEspacio: boolean }): Promise<RequisitosRuntimeIpc>
    /** Instala o continúa (también Reintentar, Continuar y Reparar); no espera al final. */
    instalar(): Promise<void>
    pausar(): Promise<void>
    /** Texto de "Copiar detalles" (ux/01 criterio 8). */
    detalles(): Promise<string>
    /** Minutos de separación `{ min, max }` según el perfil y modo vigentes; `null` sin datos. */
    estimarSeparacion(duracionMs: number): Promise<EstimacionSeparacion>
    alProgreso(cb: (progreso: ProgresoRuntimeIpc) => void): () => void
    alCambiar(cb: (estado: EstadoRuntimeIpc) => void): () => void
  }
  app: {
    /** Responde a `alSolicitudCierre`: main pausa la instalación y cierra. No responder = seguir. */
    confirmarCierre(): Promise<void>
    /** Sale de la aplicación (en macOS, `window.close()` deja la app en el Dock). */
    salir(): Promise<void>
    /** Main pide confirmar el cierre mientras hay una instalación en curso. */
    alSolicitudCierre(cb: () => void): () => void
  }
  /** Devuelve la función para darse de baja. */
  alCambiarCancion(cb: (evento: EventoCancionIpc) => void): () => void
  alCambiarConfig(cb: (config: Config) => void): () => void
  /** Estado de una consulta de YouTube que espera una actualización de yt-dlp (0050). */
  alCambiarEstadoInfo(cb: (evento: EventoEstadoInfoIpc) => void): () => void
  /** Acciones del menú nativo de la aplicación (0018): Ctrl/Cmd+N y Ctrl/Cmd+,. */
  alAccionMenu(cb: (accion: AccionMenu) => void): () => void
  /** Ruta en disco de un archivo arrastrado o elegido en la ventana (Electron no expone `File.path`). */
  rutaDeArchivo(archivo: File): string
}
