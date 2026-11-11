import { z } from 'zod'
import { CANALES } from './canales'
import type { AbrirCancionIpc, AvisoTrabajoIpc } from './avisos'
import { cancionSchema, ESTADOS_PASO, NOMBRES_PASO } from './cancion'
import { CODIGOS_ERROR } from './errores'
import { estiloSchema } from './estilo'
import { claveTexto } from './identidad'
import { nombreTemaSchema, type Procedencia } from './temas'
import { AGRUPACIONES_BIBLIOTECA, TRANSICION_S, configSchema, reproductorSchema } from './config'
import { LIMITES_PANELES } from './paneles'
import { MODELOS_SEPARACION, perfilSchema, plataformaSchema } from './manifiesto'
import {
  DISPOSITIVOS_SEPARACION,
  detalleDescargandoModeloSchema,
  detalleReintentandoSchema,
  detalleSeparandoSchema
} from './protocolo'
import { intentoSchema } from './separacion'
import {
  abrirSesionSchema,
  agregarColaResSchema,
  agregarColaSchema,
  confirmarCierreSesionSchema,
  detenerTransicionSchema,
  empezarSesionSchema,
  estadoDelRolSchema,
  estadoSesionIpcSchema,
  idCancionSchema,
  informeAplicadoSchema,
  informeSecundariaIpcSchema,
  listaPantallasIpcSchema,
  moverAPantallaSchema,
  moverColaSchema,
  quitarColaResSchema,
  quitarColaSchema,
  repetirSesionSchema,
  sesionInicialSchema,
  siguienteSesionSchema,
  transporteSesionSchema,
  vaciarColaSchema,
  type AbrirSesion,
  type ComandoSecundariaIpc,
  type DondeAgregar,
  type EstadoSecundariaIpc,
  type EstadoSesionIpc,
  type InformeSecundariaIpc,
  type ListaPantallasIpc,
  type PosicionSesionIpc,
  type SesionInicialIpc
} from './sesion'
import {
  preferenciasSecundariaSchema,
  type ConfigReproductor,
  type PreferenciasSecundaria
} from './config'
import {
  archivoLetraLeidoSchema,
  busquedaLetraSchema,
  editarTextoLetraSchema,
  guardarLetraSchema,
  guardarTiemposSchema,
  resultadoBusquedaLetraSchema,
  type ArchivoLetraLeido,
  type BusquedaLetra,
  type EditarTextoLetra,
  type GuardarLetra,
  type GuardarTiempos,
  type ResultadoBusquedaLetra
} from './letrasBusqueda'

export { CANALES } from './canales'

/**
 * Contrato único de la IPC (0011): canal, esquema de argumentos y de respuesta.
 * Main valida los argumentos con estos esquemas; preload y main importan los
 * nombres de aquí. El renderer solo ve `window.shinobi` (`ApiShinobi`).
 */

// --- Esquemas de datos ---------------------------------------------------

export { idCancionSchema }

const idSesionEdicionSchema = z.uuid()
const edicionLetraSchema = z.object({ cancion: cancionSchema, sesionId: idSesionEdicionSchema })
export type EdicionLetraIpc = z.infer<typeof edicionLetraSchema>

export const MAX_BLOQUES_PICOS = 4096
const idPicosSchema = z.uuid().toLowerCase()
const tiempoPicosSchema = z.number().finite().nonnegative().max(1e12)
const generacionPicosSchema = z.string().regex(/^[a-f0-9]{64}$/)
const estadoPicosSchema = z.union([
  z.strictObject({ estado: z.enum(['no_disponible', 'generando', 'error']) }),
  z.strictObject({ estado: z.literal('lista'), generacion: generacionPicosSchema })
])
const peticionPicosSchema = z
  .strictObject({
    cancionId: idPicosSchema,
    inicioMs: tiempoPicosSchema,
    finMs: tiempoPicosSchema,
    presupuesto: z.int().min(1).max(MAX_BLOQUES_PICOS)
  })
  .refine(({ inicioMs, finMs }) => inicioMs < finMs)
const lecturaPicosSchema = z.strictObject({
  generacion: generacionPicosSchema,
  primerBloque: z.int().nonnegative(),
  pasoMs: z.int().min(10),
  bytes: z
    .instanceof(Uint8Array)
    .refine((bytes) => bytes.length % 4 === 0 && bytes.length <= 4 * MAX_BLOQUES_PICOS)
})
export type EstadoPicos = z.infer<typeof estadoPicosSchema>
export type PeticionPicos = z.infer<typeof peticionPicosSchema>
export type LecturaPicos = z.infer<typeof lecturaPicosSchema>

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
  error: z
    .object({
      codigo: z.string(),
      mensaje: z.string(),
      modelo: z.enum(['calidad', 'rapido']).optional()
    })
    .nullable(),
  /** Duración real de la separación (0069); ausente si no se conoce. */
  segundos: z.number().nullable().optional()
})

// --- Temas y apariencia (ADR 0016 §7, §9, §11; 0164) -------------------------------

/** Las nueve procedencias de una apariencia resuelta (ADR 0016 §3). */
export const PROCEDENCIAS = [
  'propio',
  'cancion',
  'album',
  'artista',
  'aleatorio',
  'predeterminado_anterior',
  'predeterminado',
  'incluido',
  'respaldo'
] as const satisfies readonly Procedencia[]
export const procedenciaSchema = z.enum(PROCEDENCIAS)

const temaIdSchema = z.uuid()

/** Origen o destino de una apariencia en el impacto: `{ procedencia, temaId, temaNombre }`. */
export const origenAparienciaSchema = z.object({
  procedencia: procedenciaSchema,
  temaId: temaIdSchema.nullable(),
  temaNombre: z.string().nullable()
})
export type OrigenAparienciaIpc = z.infer<typeof origenAparienciaSchema>

/** Destino de «Volver a heredar»: nunca `propio` ni `cancion` (ADR 0016 §3, `alHeredar`). */
export const destinoHeredarSchema = z.object({
  procedencia: z.enum([
    'album',
    'artista',
    'aleatorio',
    'predeterminado_anterior',
    'predeterminado',
    'incluido',
    'respaldo'
  ]),
  temaId: temaIdSchema.nullable(),
  temaNombre: z.string().nullable()
})
export type DestinoHeredarIpc = z.infer<typeof destinoHeredarSchema>

/** Valor provisional de `alHeredar` hasta la resolución real (0168). */
export const DESTINO_HEREDAR_PROVISIONAL: DestinoHeredarIpc = {
  procedencia: 'incluido',
  temaId: null,
  temaNombre: null
}

export const aparienciaResumenSchema = z.object({
  modo: z.enum(['propio', 'tema', 'heredar']),
  procedencia: procedenciaSchema,
  temaId: temaIdSchema.nullable(),
  temaNombre: z.string().nullable(),
  neutra: z.boolean(),
  alHeredar: destinoHeredarSchema
})
export type AparienciaResumenIpc = z.infer<typeof aparienciaResumenSchema>

export const clavesCancionSchema = z.object({
  artista: z.string().nullable(),
  album: z.string().nullable()
})

export const resueltaSchema = z.object({
  estilo: estiloSchema,
  procedencia: procedenciaSchema,
  temaId: temaIdSchema.nullable(),
  temaNombre: z.string().nullable(),
  alHeredar: destinoHeredarSchema
})
export type ResueltaIpc = z.infer<typeof resueltaSchema>

/** Canción de `biblioteca.obtener`: tal como está en disco, más la apariencia resuelta (§9). */
export const cancionIpcSchema = cancionSchema.extend({ resuelta: resueltaSchema })
export type CancionIpc = z.infer<typeof cancionIpcSchema>

export const seleccionAparienciaSchema = z.discriminatedUnion('modo', [
  z.strictObject({ modo: z.literal('propio'), estilo: estiloSchema }),
  z.strictObject({ modo: z.literal('tema'), temaId: temaIdSchema }),
  z.strictObject({ modo: z.literal('heredar') })
])
export type SeleccionApariencia = z.infer<typeof seleccionAparienciaSchema>

const seleccionLoteSchema = z.discriminatedUnion('modo', [
  z.strictObject({ modo: z.literal('tema'), temaId: temaIdSchema }),
  z.strictObject({ modo: z.literal('heredar') })
])

export const MAX_CANCIONES_LOTE = 2000
export const MAX_TEXTO_GRUPO = 200

/** Artista o álbum visible: hasta 200 caracteres y con clave de identidad no vacía. */
const textoGrupoSchema = z
  .string()
  .max(MAX_TEXTO_GRUPO)
  .refine((t) => claveTexto(t) !== null, 'El nombre no puede estar vacío')

export const operacionTemaSchema = z.discriminatedUnion('tipo', [
  z.strictObject({
    tipo: z.literal('editar'),
    temaId: temaIdSchema,
    revisionTema: z.int().min(1),
    estilo: estiloSchema
  }),
  z.strictObject({ tipo: z.literal('borrar'), temaId: temaIdSchema }),
  z.strictObject({
    tipo: z.literal('aplicar'),
    cancionIds: z
      .array(idCancionSchema)
      .min(1)
      .max(MAX_CANCIONES_LOTE)
      .refine((ids) => new Set(ids).size === ids.length, 'Hay ids repetidos'),
    seleccion: seleccionLoteSchema
  }),
  z
    .strictObject({
      tipo: z.literal('asignarGrupo'),
      nivel: z.enum(['artista', 'album']),
      artista: textoGrupoSchema,
      album: textoGrupoSchema.optional(),
      temaId: temaIdSchema.nullable()
    })
    .refine((o) => (o.nivel === 'album') === (o.album !== undefined), {
      path: ['album'],
      message: 'El álbum es obligatorio solo con nivel "album"'
    }),
  z.strictObject({ tipo: z.literal('predeterminado'), temaId: temaIdSchema.nullable() })
])
export type OperacionTema = z.infer<typeof operacionTemaSchema>

const recuento = z.int().nonnegative()

export const impactoIpcSchema = z.object({
  ficha: z.uuid(),
  afectadas: z.array(
    z.object({
      id: idCancionSchema,
      titulo: z.string(),
      artista: z.string(),
      antes: origenAparienciaSchema,
      despues: origenAparienciaSchema,
      efecto: z.enum(['cambia', 'fija_base', 'sin_cambios'])
    })
  ),
  desglose: z.object({
    cancion: recuento,
    album: recuento,
    artista: recuento,
    predeterminado: recuento,
    aleatorio: recuento,
    predeterminadoAnterior: recuento,
    propio: recuento,
    respaldo: recuento,
    incluido: recuento
  }),
  excluidas: z.object({
    propio: recuento,
    cancion: recuento,
    album: recuento,
    /** Solo en `aplicar`. */
    danadas: recuento.optional(),
    noExisten: recuento.optional()
  }),
  /** Solo en `asignarGrupo`: canciones del grupo; `null` en las demás. */
  totalGrupo: recuento.nullable(),
  esPredeterminado: z.boolean(),
  asignacionesRetiradas: z.object({
    artistas: z.array(z.string()),
    albumes: z.array(z.object({ artista: z.string(), album: z.string() }))
  }),
  /** Revisión del tema afectado (`editar`, `borrar`); `null` en las demás. */
  revisionTema: z.int().min(1).nullable(),
  /** Siempre `false` en la fase 3; la fase 4 lo rellena. */
  sesionEnCurso: z.boolean()
})
export type ImpactoIpc = z.infer<typeof impactoIpcSchema>

export const ESTADOS_CANCION_OPERACION = [
  'aplicada',
  'sin_cambios',
  'omitida',
  'error',
  'pendiente'
] as const

export const resultadoOperacionIpcSchema = z.object({
  catalogoEscrito: z.boolean(),
  canciones: z.array(
    z
      .object({
        id: idCancionSchema,
        /** Cadena vacía si no hay dato (igual que `ImpactoIpc.afectadas`). */
        titulo: z.string(),
        artista: z.string(),
        estado: z.enum(ESTADOS_CANCION_OPERACION),
        motivo: z.enum(['cambio', 'no_existe', 'danada']).optional(),
        codigo: z.enum(CODIGOS_ERROR).optional()
      })
      .refine((c) => c.estado !== 'error' || c.codigo !== undefined, {
        path: ['codigo'],
        message: 'Una canción con error lleva siempre su código'
      })
  )
})
export type ResultadoOperacionIpc = z.infer<typeof resultadoOperacionIpcSchema>

export const temaIpcSchema = z.object({
  id: temaIdSchema,
  nombre: z.string(),
  revision: z.int().min(1),
  estilo: estiloSchema
})
export type TemaIpc = z.infer<typeof temaIpcSchema>

export const usosTemaSchema = z.object({
  total: recuento,
  cancion: recuento,
  album: recuento,
  artista: recuento,
  predeterminado: recuento,
  aleatorio: recuento,
  predeterminadoAnterior: recuento
})

export const catalogoIpcSchema = z.object({
  temas: z.array(
    temaIpcSchema.extend({
      enBorrado: z.boolean(),
      usos: usosTemaSchema,
      grupos: z.object({
        artistas: z.array(z.string()),
        albumes: z.array(z.object({ artista: z.string(), album: z.string() }))
      })
    })
  ),
  predeterminado: temaIdSchema.nullable(),
  predeterminadoUsos: recuento,
  asignaciones: z.object({
    artistas: z.array(z.object({ artista: z.string(), temaId: temaIdSchema })),
    albumes: z.array(z.object({ artista: z.string(), album: z.string(), temaId: temaIdSchema }))
  }),
  borradoPendiente: z
    .object({ temaId: temaIdSchema, nombre: z.string(), total: recuento, restantes: recuento })
    .nullable(),
  soloLectura: z.boolean(),
  apartado: z.string().nullable(),
  referenciasFaltantes: recuento
})
export type CatalogoIpc = z.infer<typeof catalogoIpcSchema>

export const OPERACIONES_PROGRESO = ['aplicar', 'borrar', 'predeterminado'] as const
/** `ficha: null` solo en `reanudarBorrado`, que no se previsualiza (ADR 0016 §7). */
export const progresoTemaSchema = z.object({
  ficha: z.uuid().nullable(),
  operacion: z.enum(OPERACIONES_PROGRESO),
  temaId: temaIdSchema.nullable(),
  hechas: recuento,
  total: recuento
})
export type ProgresoTemaIpc = z.infer<typeof progresoTemaSchema>

export const crearTemaSchema = z.strictObject({ nombre: nombreTemaSchema, estilo: estiloSchema })
export const renombrarTemaSchema = z.strictObject({
  temaId: temaIdSchema,
  revisionTema: z.int().min(1),
  nombre: nombreTemaSchema
})
export const duplicarTemaSchema = z.strictObject({ temaId: temaIdSchema, nombre: nombreTemaSchema })
export type CrearTema = z.infer<typeof crearTemaSchema>
export type RenombrarTema = z.infer<typeof renombrarTemaSchema>
export type DuplicarTema = z.infer<typeof duplicarTemaSchema>

/** Resumen de canción tal y como lo recibe el renderer: la miniatura es una URL shinobi-media://. */
export const resumenCancionSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  artista: z.string(),
  duracionMs: z.number().nullable(),
  estado: z.enum(['borrador', 'lista']),
  modificada: z.string(),
  /**
   * Estilo **resuelto** (ADR 0016 §9). Sigue siendo `nullable` solo para la canción dañada por
   * JSON, que no tiene estilo que resolver; en cualquier otra es siempre un estilo completo.
   */
  estilo: estiloSchema.nullable(),
  /** Álbum visible (`null` si no tiene) y claves de identidad para agrupar en el renderer. */
  album: z.string().nullable(),
  claves: clavesCancionSchema,
  apariencia: aparienciaResumenSchema,
  /** URL `shinobi-media://<id>/fuente/miniatura.jpg`, nunca una ruta del disco. */
  miniatura: z.string().nullable(),
  pasos: z.record(z.enum(NOMBRES_PASO), pasoResumenSchema).nullable(),
  incompleta: z.boolean(),
  lineasSinSincronizar: z.number(),
  danada: z.boolean(),
  motivo: z.enum(['json', 'pistas']).nullable(),
  /** Dañada por pistas y sin `fuente/mezcla.flac`: no se puede re-separar (0070). */
  sinMezcla: z.boolean().optional()
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
  /**
   * Según la fase: `descargando` y `descargando_modelo` → `{ bytes, total }` (`total` puede ser
   * desconocido); `separando` → `{ paso, total }`; `reintentando` → `{ motivo, espera_s? }`.
   */
  detalle: z
    .union([detalleDescargandoModeloSchema, detalleSeparandoSchema, detalleReintentandoSchema])
    .optional(),
  /** Intento de la separación (1, 2 o 3; 0063). Ausente en los demás trabajos. */
  intento: intentoSchema.optional()
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
  progreso: progresoTrabajoSchema.nullable(),
  /**
   * Solo en separación: el modelo y el dispositivo realmente usados ("Modelo Calidad · ⓘ", ux/04
   * criterio 13). Ausente equivale a `null`.
   */
  modo: z.enum(MODELOS_SEPARACION).nullable().optional(),
  dispositivo: z.enum(DISPOSITIVOS_SEPARACION).nullable().optional(),
  /** Intento en curso de la separación (1, 2 o 3). */
  intento: intentoSchema.nullable().optional()
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
      silenciado: z.boolean().optional(),
      voz_guia: z.number().min(0).max(1).optional(),
      voz_guia_silenciada: z.boolean().optional(),
      // Cuenta entre canciones (ADR 0006, rev. fase 4). `secundaria` solo lo escribe main.
      transicion_s: z.number().int().min(TRANSICION_S.min).max(TRANSICION_S.max).optional()
    })
    .optional(),
  // `separacion.modo` y `separacion.rapido_aceptado` no se editan desde el renderer: solo los
  // cambian `aceptarYUsarRapido` y `volverACalidad` (0057).
  // `estilo_predeterminado` (0.1.0) ya no lo escribe el renderer: el predeterminado es un tema (0170).
  // «Agrupar por» de la Biblioteca (ADR 0016 §9): enum estricto, sin `.catch`.
  biblioteca: z.strictObject({ agrupar: z.enum(AGRUPACIONES_BIBLIOTECA) }).optional(),
  aviso_youtube_aceptado: z.iso.datetime().nullable().optional(),
  // Preferencias de paneles del editor (0155): estrictas y sin `.catch`; un valor inválido se rechaza.
  editor: z
    .strictObject({
      paneles: z.strictObject({
        lista: z
          .strictObject({
            ancho: z
              .number()
              .int()
              .min(LIMITES_PANELES.lista.min)
              .max(LIMITES_PANELES.lista.max)
              .optional(),
            minimizado: z.boolean().optional()
          })
          .optional(),
        panel: z
          .strictObject({
            ancho: z
              .number()
              .int()
              .min(LIMITES_PANELES.panel.min)
              .max(LIMITES_PANELES.panel.max)
              .optional(),
            minimizado: z.boolean().optional()
          })
          .optional(),
        linea_tiempo: z
          .strictObject({
            alto: z
              .number()
              .int()
              .min(LIMITES_PANELES.linea_tiempo.min)
              .max(LIMITES_PANELES.linea_tiempo.max)
              .nullable()
              .optional(),
            minimizado: z.boolean().optional()
          })
          .optional()
      })
    })
    .optional()
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
  bytesRestantes: z.number().nonnegative().nullable(),
  /** Aceptó Rápido y la descarga no terminó (0057, preguntas/0021 §1). La oferta no se repite. */
  rapidoPendiente: z.boolean(),
  /** B4 puede ofrecer el modelo Rápido (0057): fallo definitivo de Calidad y sin `rapidoPendiente`. */
  ofrecerRapido: z.boolean(),
  /** "Volver a Calidad" en curso o fallida; operación del runtime, no un trabajo (0057). */
  volverACalidad: z
    .object({
      estado: z.enum(['descargando', 'error']),
      bytes: z.number().nonnegative(),
      total: z.number().nonnegative(),
      error: z.object({ codigo: z.string(), mensaje: z.string() }).nullable()
    })
    .nullable()
})
export type EstadoRuntimeIpc = z.infer<typeof estadoRuntimeSchema>

/** Origen del consentimiento de Rápido. No existe `ajustes`: Rápido no es elegible desde Ajustes. */
export const origenRapidoSchema = z.enum(['primer_arranque', 'separacion'])
export type OrigenRapido = z.infer<typeof origenRapidoSchema>

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
  /** Menor y mayor descarga de la plataforma (para el texto genérico sin perfil); `null` si no hay. */
  rangoDescarga: z
    .tuple([z.number().nonnegative(), z.number().nonnegative()])
    .nullable()
    .optional(),
  espacioRequerido: z.number().nonnegative(),
  espacioLibre: z.number().nonnegative(),
  modoPrevisto: modoRuntimeSchema.nullable(),
  /** Bytes del modelo Rápido del manifiesto, para el aviso de consentimiento (0057). */
  bytesRapido: z.number().nonnegative().nullable().optional(),
  /** Rápido ya está descargado y verificado: el aviso no repite el tamaño (0057). */
  rapidoDescargado: z.boolean().optional(),
  /** Bytes del modelo Calidad del manifiesto (`aj.sep.descarga`, 0074). */
  bytesCalidad: z.number().nonnegative().nullable().optional(),
  /** Calidad ya está descargado y verificado: el diálogo de Ajustes omite la descarga (0074). */
  calidadDescargado: z.boolean().optional()
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

export const ORIGENES_ESTIMACION = ['medido_equipo', 'referencia_medida', 'estimado'] as const
/**
 * Minutos de separación de una canción (incluido el coste de arranque, `shared/estimacion.ts`).
 * `origen` decide si la interfaz usa la variante `.aprox`: solo con `'estimado'`.
 */
export const estimacionCancionSchema = z
  .object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
    origen: z.enum(ORIGENES_ESTIMACION)
  })
  .nullable()
export const estimacionSeparacionSchema = estimacionCancionSchema
export type EstimacionSeparacion = z.infer<typeof estimacionSeparacionSchema>

export type EstimacionCancion = z.infer<typeof estimacionCancionSchema>

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
const unBooleano = z.tuple([z.boolean()])

/** Canal -> esquemas de argumentos (tupla) y de respuesta. */
export const CONTRATO = {
  [CANALES.ventana.modoReproductor]: { args: unBooleano, res: z.void() },
  [CANALES.ventana.fijarPantallaCompleta]: { args: unBooleano, res: z.void() },
  [CANALES.ventana.estaEnPantallaCompleta]: { args: vacio, res: z.boolean() },
  [CANALES.ventana.evitarReposo]: { args: unBooleano, res: z.void() },
  [CANALES.biblioteca.comprobarPistas]: { args: unId, res: resumenCancionSchema.nullable() },
  [CANALES.biblioteca.listar]: { args: vacio, res: z.array(resumenCancionSchema) },
  [CANALES.biblioteca.obtener]: { args: unId, res: cancionIpcSchema.nullable() },
  [CANALES.biblioteca.actualizarMetadatos]: {
    args: z.tuple([idCancionSchema, metadatosEditablesSchema]),
    res: resumenCancionSchema
  },
  [CANALES.biblioteca.guardarApariencia]: {
    args: z.tuple([idCancionSchema, seleccionAparienciaSchema]),
    res: resumenCancionSchema
  },
  [CANALES.temas.catalogo]: { args: vacio, res: catalogoIpcSchema },
  [CANALES.temas.previsualizar]: { args: z.tuple([operacionTemaSchema]), res: impactoIpcSchema },
  [CANALES.temas.ejecutar]: {
    args: z.tuple([operacionTemaSchema, z.uuid()]),
    res: resultadoOperacionIpcSchema
  },
  [CANALES.temas.crear]: { args: z.tuple([crearTemaSchema]), res: temaIpcSchema },
  [CANALES.temas.renombrar]: { args: z.tuple([renombrarTemaSchema]), res: temaIpcSchema },
  [CANALES.temas.duplicar]: { args: z.tuple([duplicarTemaSchema]), res: temaIpcSchema },
  [CANALES.temas.reanudarBorrado]: { args: vacio, res: resultadoOperacionIpcSchema },
  [CANALES.temas.cancelarBorrado]: { args: vacio, res: z.void() },
  [CANALES.temas.descartarAvisoApartado]: { args: vacio, res: z.void() },
  [CANALES.biblioteca.marcarLista]: { args: unId, res: resumenCancionSchema },
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
    args: z.tuple([
      z.number().finite().nonnegative().max(1e9),
      z.enum(MODELOS_SEPARACION).optional()
    ]),
    res: estimacionSeparacionSchema
  },
  // Mismo canal para "Separar ahora", "Reintentar" y "Re-separar pistas" (reglas en 0065).
  [CANALES.separacion.separar]: { args: unId, res: z.void() },
  [CANALES.separacion.estimar]: { args: unId, res: estimacionCancionSchema },
  [CANALES.picos.solicitar]: {
    args: z.tuple([idPicosSchema, z.boolean().optional()]),
    res: estadoPicosSchema
  },
  [CANALES.picos.leer]: {
    args: z.tuple([peticionPicosSchema]),
    res: lecturaPicosSchema.nullable()
  },
  // La llamada es el consentimiento (0057); responde al terminar la descarga.
  [CANALES.runtime.aceptarYUsarRapido]: { args: z.tuple([origenRapidoSchema]), res: z.void() },
  [CANALES.runtime.volverACalidad]: { args: vacio, res: z.void() },
  [CANALES.runtime.cancelarVolverACalidad]: { args: vacio, res: z.void() },
  [CANALES.letras.buscar]: {
    args: z.tuple([busquedaLetraSchema]),
    res: resultadoBusquedaLetraSchema
  },
  [CANALES.letras.guardar]: { args: z.tuple([guardarLetraSchema]), res: resumenCancionSchema },
  [CANALES.letras.editarTexto]: {
    args: z.tuple([editarTextoLetraSchema]),
    res: resumenCancionSchema
  },
  [CANALES.letras.guardarTiempos]: {
    args: z.tuple([guardarTiemposSchema, idSesionEdicionSchema]),
    res: resumenCancionSchema
  },
  [CANALES.letras.abrirEdicion]: { args: unId, res: edicionLetraSchema.nullable() },
  [CANALES.letras.cerrarEdicion]: { args: z.tuple([idSesionEdicionSchema]), res: z.void() },
  [CANALES.letras.leerArchivo]: { args: vacio, res: archivoLetraLeidoSchema },
  [CANALES.app.guardadoPendiente]: { args: z.tuple([z.boolean()]), res: z.void() },
  [CANALES.app.confirmarCierre]: { args: vacio, res: z.void() },
  [CANALES.app.salir]: { args: vacio, res: z.void() },
  // --- Fase 4 (ADR 0017 §11) ---
  [CANALES.pantallas.listar]: { args: vacio, res: listaPantallasIpcSchema },
  [CANALES.sesion.estado]: { args: vacio, res: estadoSesionIpcSchema },
  [CANALES.sesion.abrir]: { args: z.tuple([abrirSesionSchema]), res: estadoSesionIpcSchema },
  [CANALES.sesion.mostrar]: { args: vacio, res: z.void() },
  [CANALES.sesion.moverAPantalla]: {
    args: z.tuple([moverAPantallaSchema]),
    res: estadoSesionIpcSchema
  },
  [CANALES.sesion.fijarPantallaCompleta]: { args: unBooleano, res: z.void() },
  [CANALES.sesion.transporte]: {
    args: z.tuple([transporteSesionSchema]),
    res: estadoSesionIpcSchema
  },
  [CANALES.sesion.siguiente]: { args: z.tuple([siguienteSesionSchema]), res: estadoDelRolSchema },
  [CANALES.sesion.empezar]: { args: z.tuple([empezarSesionSchema]), res: estadoDelRolSchema },
  [CANALES.sesion.detenerTransicion]: {
    args: z.tuple([detenerTransicionSchema]),
    res: estadoDelRolSchema
  },
  [CANALES.sesion.repetir]: { args: z.tuple([repetirSesionSchema]), res: estadoDelRolSchema },
  [CANALES.sesion.forzarCierre]: { args: vacio, res: estadoSesionIpcSchema },
  [CANALES.sesion.solicitarCierre]: { args: vacio, res: estadoDelRolSchema },
  [CANALES.sesion.confirmarCierre]: {
    args: z.tuple([confirmarCierreSesionSchema]),
    res: z.void()
  },
  [CANALES.sesion.cancelarCierre]: { args: vacio, res: z.void() },
  [CANALES.sesion.inicial]: { args: vacio, res: sesionInicialSchema },
  [CANALES.sesion.informar]: {
    args: z.tuple([informeSecundariaIpcSchema]),
    res: informeAplicadoSchema
  },
  [CANALES.sesion.preferencias]: { args: vacio, res: reproductorSchema },
  [CANALES.sesion.guardarPreferencias]: {
    args: z.tuple([preferenciasSecundariaSchema]),
    res: reproductorSchema
  },
  [CANALES.cola.agregar]: { args: z.tuple([agregarColaSchema]), res: agregarColaResSchema },
  [CANALES.cola.mover]: { args: z.tuple([moverColaSchema]), res: estadoSesionIpcSchema },
  [CANALES.cola.quitar]: { args: z.tuple([quitarColaSchema]), res: quitarColaResSchema },
  [CANALES.cola.vaciar]: { args: z.tuple([vaciarColaSchema]), res: estadoSesionIpcSchema }
} as const

export type CanalInvocable = keyof typeof CONTRATO

// --- API expuesta al renderer ---------------------------------------------

type Config = z.infer<typeof configSchema>

export type AccionMenu = 'anadir' | 'ajustes'

export interface ApiShinobi {
  biblioteca: {
    listar(): Promise<ResumenCancionIpc[]>
    /** Canción en disco más su apariencia resuelta (`resuelta`, ADR 0016 §9). */
    obtener(id: string): Promise<CancionIpc | null>
    actualizarMetadatos(id: string, metadatos: MetadatosEditables): Promise<ResumenCancionIpc>
    /** Escribe al momento (propio, tema o heredar); el debounce lo hace el editor. */
    guardarApariencia(id: string, seleccion: SeleccionApariencia): Promise<ResumenCancionIpc>
    /** Pasa a lista si las pistas y la sincronía están completas. */
    marcarLista(id: string): Promise<ResumenCancionIpc>
    /** Vuelve a comprobar las pistas de la canción, que puede pasar a Dañada. */
    comprobarPistas(id: string): Promise<ResumenCancionIpc | null>
    volverABorrador(id: string): Promise<ResumenCancionIpc>
    eliminar(id: string): Promise<void>
    mostrarEnCarpeta(id: string): Promise<void>
  }
  /** Catálogo de temas y operaciones sobre la apariencia (ADR 0016 §11). */
  temas: {
    catalogo(): Promise<CatalogoIpc>
    /** Calcula el impacto de una operación sin escribir; devuelve la ficha de un solo uso. */
    previsualizar(op: OperacionTema): Promise<ImpactoIpc>
    /** Ejecuta la operación previsualizada; `CONFIRMACION_OBSOLETA` lleva el impacto nuevo en `detalles`. */
    ejecutar(op: OperacionTema, ficha: string): Promise<ResultadoOperacionIpc>
    crear(tema: CrearTema): Promise<TemaIpc>
    renombrar(cambio: RenombrarTema): Promise<TemaIpc>
    duplicar(peticion: DuplicarTema): Promise<TemaIpc>
    reanudarBorrado(): Promise<ResultadoOperacionIpc>
    cancelarBorrado(): Promise<void>
    descartarAvisoApartado(): Promise<void>
    /** Avance de `aplicar`, `borrar`/`reanudarBorrado` y `predeterminado` a `null`. */
    alProgreso(cb: (progreso: ProgresoTemaIpc) => void): () => void
  }
  ventana: {
    /** Activa la pantalla completa o restaura el estado previo al salir. */
    modoReproductor(activo: boolean): Promise<void>
    fijarPantallaCompleta(activa: boolean): Promise<void>
    estaEnPantallaCompleta(): Promise<boolean>
    /** Mantiene la pantalla encendida mientras suena. */
    evitarReposo(activo: boolean): Promise<void>
    /** Cambios reales de pantalla completa, incluidos los del sistema. */
    alCambiarPantallaCompleta(cb: (activa: boolean) => void): () => void
  }
  /** Pantallas del sistema (ADR 0017 §2). */
  pantallas: {
    listar(): Promise<ListaPantallasIpc>
  }
  /** Sesión en la ventana secundaria; solo la principal (ADR 0017 §11). */
  sesion: {
    estado(): Promise<EstadoSesionIpc>
    abrir(peticion: AbrirSesion): Promise<EstadoSesionIpc>
    /** Muestra la secundaria sin robar el foco ni cambiar de pantalla. */
    mostrar(): Promise<void>
    moverAPantalla(pantallaId: number): Promise<EstadoSesionIpc>
    fijarPantallaCompleta(activa: boolean): Promise<void>
    transporte(
      accion: 'pausar' | 'reanudar' | 'reiniciar',
      entradaId: string
    ): Promise<EstadoSesionIpc>
    siguiente(desdeEntradaId: string): Promise<EstadoSesionIpc>
    empezar(candidataId: string): Promise<EstadoSesionIpc>
    detenerTransicion(transicionId: string): Promise<EstadoSesionIpc>
    repetir(entradaId: string): Promise<EstadoSesionIpc>
    /** Destruye la secundaria que no responde, conservando la cola. */
    forzarCierre(): Promise<EstadoSesionIpc>
    solicitarCierre(): Promise<EstadoSesionIpc>
    /** `CONFIRMACION_OBSOLETA` si la revisión cambió. */
    confirmarCierre(cola: 'eliminar' | 'conservar', revision: number): Promise<void>
    cancelarCierre(): Promise<void>
  }
  /** Cola de reproducción; las entradas se refieren por id (ADR 0017 §6). */
  cola: {
    agregar(
      cancionId: string,
      donde: DondeAgregar
    ): Promise<{ estado: EstadoSesionIpc; entradaId: string }>
    mover(entradaId: string, antesDe: string | null): Promise<EstadoSesionIpc>
    quitar(entradaId: string): Promise<{ estado: EstadoSesionIpc; antesDe: string | null }>
    vaciar(contexto: boolean): Promise<EstadoSesionIpc>
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
  separacion: {
    /** Encola la separación de la canción (también Reintentar y Re-separar). */
    separar(cancionId: string): Promise<void>
    /** Minutos estimados según el equipo y el modo vigente; `null` sin datos. */
    estimar(cancionId: string): Promise<EstimacionCancion>
  }
  picos: {
    solicitar(cancionId: string, reintentar?: boolean): Promise<EstadoPicos>
    leer(peticion: PeticionPicos): Promise<LecturaPicos | null>
  }
  letras: {
    /** Busca en LRCLIB; una búsqueda nueva cancela la anterior (`CANCELADO`). */
    buscar(peticion: BusquedaLetra): Promise<ResultadoBusquedaLetra>
    /** Sustituye la letra entera de la canción. */
    guardar(letra: GuardarLetra): Promise<ResumenCancionIpc>
    /** Aplica el diff del texto sobre la letra guardada. */
    editarTexto(peticion: EditarTextoLetra): Promise<ResumenCancionIpc>
    /** Sustituye tiempos y desplazamiento sin tocar el texto; LETRA_DESACTUALIZADA si la letra cambió. */
    guardarTiempos(peticion: GuardarTiempos, sesionId: string): Promise<ResumenCancionIpc>
    /** Abre la visita y devuelve la canción que sirve como referencia del historial. */
    abrirEdicion(cancionId: string): Promise<EdicionLetraIpc | null>
    /** Libera la referencia de la visita si sigue siendo la activa. */
    cerrarEdicion(sesionId: string): Promise<void>
    /** Diálogo nativo `.lrc`/`.txt`; no guarda (ver `guardar` con `origen: 'archivo'`). */
    leerArchivo(): Promise<ArchivoLetraLeido>
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
    estimarSeparacion(
      duracionMs: number,
      /** Modelo a estimar; por defecto el vigente (Ajustes pide Calidad estando en Rápido). */
      modelo?: 'calidad' | 'rapido'
    ): Promise<EstimacionSeparacion>
    /**
     * Consentimiento explícito del modelo Rápido y su descarga (0057). Responde cuando termina;
     * el avance llega por `alProgreso` y `alCambiar`.
     */
    aceptarYUsarRapido(origen: OrigenRapido): Promise<void>
    /** Descarga Calidad si falta y la fija como modo (Ajustes, 0074). Estado en `volverACalidad`. */
    volverACalidad(): Promise<void>
    cancelarVolverACalidad(): Promise<void>
    alProgreso(cb: (progreso: ProgresoRuntimeIpc) => void): () => void
    alCambiar(cb: (estado: EstadoRuntimeIpc) => void): () => void
  }
  app: {
    /** Responde a `alSolicitudCierre`: main pausa la instalación y cierra. No responder = seguir. */
    /** Avisa de cambios del editor sin escribir antes de cerrar. */
    guardadoPendiente(pendiente: boolean): Promise<void>
    confirmarCierre(): Promise<void>
    /** Sale de la aplicación (en macOS, `window.close()` deja la app en el Dock). */
    salir(): Promise<void>
    /** Main pide confirmar el cierre mientras hay una instalación en curso. */
    alSolicitudCierre(cb: () => void): () => void
  }
  /** Avisos de trabajos terminados o fallidos y clic en la notificación del sistema (0072). */
  avisos: {
    alAviso(cb: (aviso: AvisoTrabajoIpc) => void): () => void
    alAbrirCancion(cb: (evento: AbrirCancionIpc) => void): () => void
  }
  /** Devuelve la función para darse de baja. */
  alCambiarCancion(cb: (evento: EventoCancionIpc) => void): () => void
  alCambiarConfig(cb: (config: Config) => void): () => void
  /** El catálogo de temas cambió (ADR 0016 §9); lleva el catálogo completo. */
  alCambiarTemas(cb: (catalogo: CatalogoIpc) => void): () => void
  /** Estado de la sesión y la cola; descarta las revisiones menores a la última recibida. */
  alCambiarSesion(cb: (estado: EstadoSesionIpc) => void): () => void
  /** Posición de la canción activa, como mucho 1 por segundo. */
  alPosicionSesion(cb: (posicion: PosicionSesionIpc) => void): () => void
  alCambiarPantallas(cb: (lista: ListaPantallasIpc) => void): () => void
  /** Estado de una consulta de YouTube que espera una actualización de yt-dlp (0050). */
  alCambiarEstadoInfo(cb: (evento: EventoEstadoInfoIpc) => void): () => void
  /** Acciones del menú nativo de la aplicación (0018): Ctrl/Cmd+N y Ctrl/Cmd+,. */
  alAccionMenu(cb: (accion: AccionMenu) => void): () => void
  /** Ruta en disco de un archivo arrastrado o elegido en la ventana (Electron no expone `File.path`). */
  rutaDeArchivo(archivo: File): string
}

/**
 * API de la ventana secundaria (`window.shinobiReproductor`, ADR 0017 §2 y §10). Solo lo que el
 * reproductor de la sesión necesita: sin biblioteca, temas, configuración ni cola.
 */
export interface ApiReproductor {
  sesion: {
    /** Al cargar el documento: sesión, último comando y estado reducido. */
    inicial(): Promise<SesionInicialIpc>
    informar(informe: InformeSecundariaIpc): Promise<{ aplicado: boolean }>
    siguiente(desdeEntradaId: string): Promise<EstadoDelRol>
    empezar(candidataId: string): Promise<EstadoDelRol>
    detenerTransicion(transicionId: string): Promise<EstadoDelRol>
    repetir(entradaId: string): Promise<EstadoDelRol>
    cierre: {
      solicitar(): Promise<EstadoDelRol>
      confirmar(cola: 'eliminar' | 'conservar', revision: number): Promise<void>
      cancelar(): Promise<void>
    }
    preferencias(): Promise<ConfigReproductor>
    guardarPreferencias(parcial: PreferenciasSecundaria): Promise<ConfigReproductor>
  }
  ventana: {
    fijarPantallaCompleta(activa: boolean): Promise<void>
    estaEnPantallaCompleta(): Promise<boolean>
    alCambiarPantallaCompleta(cb: (activa: boolean) => void): () => void
  }
  alComando(cb: (comando: ComandoSecundariaIpc) => void): () => void
  alEstado(cb: (estado: EstadoSecundariaIpc) => void): () => void
  alPreferencias(cb: (preferencias: ConfigReproductor) => void): () => void
}

/** Respuesta de los canales compartidos: el estado del rol que llama. */
export type EstadoDelRol = EstadoSesionIpc | EstadoSecundariaIpc
