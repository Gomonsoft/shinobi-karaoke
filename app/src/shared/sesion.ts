import { z } from 'zod'
import { preferenciasSecundariaSchema } from './config'
import { estiloSchema } from './estilo'
import { letraSchema } from './letra'

/**
 * Contratos de la sesión en vivo, la cola y las pantallas (ADR 0017 §5, §7, §10 y §11).
 * Sin rutas de archivo ni detalles internos: todo lo que cruza la IPC está aquí.
 */

// --- Límites -------------------------------------------------------------

/** Tope de memoria y de tamaño de mensaje, no de producto (`COLA_LLENA`). */
export const MAXIMO_PENDIENTES = 500
export const POSICION_MS_MIN = -60_000
export const POSICION_MS_MAX = 86_400_000

/** Identificador de canción (mismo límite que el resto de la IPC; `ipc.ts` lo reexporta). */
export const idCancionSchema = z.string().min(1).max(200)

const uuidSchema = z.uuid()
const revisionSchema = z.int().min(0)
const posicionMsSchema = z.int().min(POSICION_MS_MIN).max(POSICION_MS_MAX)
const duracionMsSchema = z.int().min(0).max(POSICION_MS_MAX)
const textoSchema = z.string().max(500)

// --- Entradas y motivos --------------------------------------------------

export const MOTIVOS_NO_DISPONIBLE = [
  'no_encontrada',
  'no_lista',
  'sin_pistas',
  'ilegible'
] as const
export const motivoNoDisponibleSchema = z.enum(MOTIVOS_NO_DISPONIBLE)
export type MotivoNoDisponible = z.infer<typeof motivoNoDisponibleSchema>

export const MOTIVOS_FALLO = [
  ...MOTIVOS_NO_DISPONIBLE,
  'lectura',
  'decodificacion',
  'otro'
] as const
export const motivoFalloSchema = z.enum(MOTIVOS_FALLO)
export type MotivoFallo = z.infer<typeof motivoFalloSchema>

export const entradaIpcSchema = z.strictObject({
  entradaId: uuidSchema,
  cancionId: idCancionSchema,
  titulo: textoSchema,
  artista: textoSchema,
  disponibilidad: z.union([z.literal('ok'), motivoNoDisponibleSchema])
})
export type EntradaIpc = z.infer<typeof entradaIpcSchema>

// --- Pantallas -----------------------------------------------------------

export const pantallaIpcSchema = z.strictObject({
  id: z.int(),
  etiqueta: z.string().max(200),
  ancho: z.int().positive(),
  alto: z.int().positive(),
  escala: z.number().positive(),
  /** `getPrimaryDisplay()`. */
  principal: z.boolean(),
  /** La pantalla donde está la ventana principal. */
  conVentanaPrincipal: z.boolean()
})
export type PantallaIpc = z.infer<typeof pantallaIpcSchema>

/** `sistema`: el compositor decide dónde se abre la ventana (Wayland, ADR 0017 §3 y 0061). */
export const listaPantallasIpcSchema = z.strictObject({
  pantallas: z.array(pantallaIpcSchema).max(64),
  colocacion: z.enum(['libre', 'sistema'])
})
export type ListaPantallasIpc = z.infer<typeof listaPantallasIpcSchema>

// --- Estado de la sesión (solo para la principal) -------------------------

export const FASES_SESION = [
  'abriendo',
  'cargando',
  'reproduciendo',
  'pausada',
  'transicion',
  'espera',
  'error',
  'fin_de_cola'
] as const
export const faseSesionSchema = z.enum(FASES_SESION)
export type FaseSesion = z.infer<typeof faseSesionSchema>

export const rolOrigenSchema = z.enum(['principal', 'secundaria'])

const transicionIpcSchema = z.strictObject({
  transicionId: uuidSchema,
  candidataId: uuidSchema,
  restanteMs: duracionMsSchema,
  duracionMs: duracionMsSchema,
  congelada: z.boolean()
})
export type TransicionIpc = z.infer<typeof transicionIpcSchema>

const errorSesionSchema = z.strictObject({
  entradaId: uuidSchema,
  motivo: motivoFalloSchema,
  /** Para «Copiar detalles». */
  codigo: z.string().max(100)
})

/** Incidencias con la sesión abierta (ADR 0017 §3). */
export const incidenciaSesionSchema = z.discriminatedUnion('tipo', [
  z.strictObject({
    tipo: z.literal('pantalla_perdida'),
    etiqueta: z.string().max(200),
    estabaEnPantallaCompleta: z.boolean()
  }),
  z.strictObject({
    tipo: z.literal('pantalla_reconectada'),
    etiqueta: z.string().max(200),
    pantallaId: z.int()
  }),
  z.strictObject({ tipo: z.literal('secundaria_no_responde') })
])
export type IncidenciaSesion = z.infer<typeof incidenciaSesionSchema>

/** Incidencias fuera de sesión (ADR 0017 §3 y §8). */
export const incidenciaFueraSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('secundaria_caida') }),
  z.strictObject({ tipo: z.literal('reanudacion_fallida'), motivo: motivoFalloSchema })
])
export type IncidenciaFueraDeSesion = z.infer<typeof incidenciaFueraSchema>

const sesionActivaSchema = z.strictObject({
  /** Uno por apertura de la secundaria. */
  sesionId: uuidSchema,
  fase: faseSesionSchema,
  /** `null` si no se conoce (Wayland). */
  pantalla: pantallaIpcSchema.nullable(),
  pantallaCompleta: z.boolean(),
  /** Confirmación de cierre abierta, con la ventana donde se pidió; la transición queda congelada. */
  cierrePendiente: z.strictObject({ origen: rolOrigenSchema }).nullable(),
  transicion: transicionIpcSchema.nullable(),
  error: errorSesionSchema.nullable(),
  incidencia: incidenciaSesionSchema.nullable()
})

export const estadoSesionIpcSchema = z.strictObject({
  /** Sube con cada cambio; el renderer descarta revisiones menores. */
  revision: revisionSchema,
  sesion: sesionActivaSchema.nullable(),
  activa: entradaIpcSchema
    .extend({ posicionMs: posicionMsSchema, duracionMs: duracionMsSchema })
    .nullable(),
  /** En orden de reproducción. */
  pendientes: z.array(entradaIpcSchema).max(MAXIMO_PENDIENTES),
  /** Última reproducida. */
  contexto: z
    .strictObject({
      entrada: entradaIpcSchema,
      posicionMs: posicionMsSchema.nullable(),
      pausada: z.boolean(),
      terminada: z.boolean()
    })
    .nullable(),
  incidencia: incidenciaFueraSchema.nullable()
})
export type EstadoSesionIpc = z.infer<typeof estadoSesionIpcSchema>
export type SesionActivaIpc = NonNullable<EstadoSesionIpc['sesion']>

/** Estado reducido de la secundaria: sin lista de pendientes ni detalles técnicos (ADR 0017 §10). */
export const estadoSecundariaIpcSchema = z.strictObject({
  revision: revisionSchema,
  sesionId: uuidSchema,
  fase: faseSesionSchema,
  candidata: z
    .strictObject({ titulo: textoSchema, artista: textoSchema, estilo: estiloSchema })
    .nullable(),
  /** Cuenta en curso (S1); su `restanteMs` se pinta con un reloj local. */
  transicion: z
    .strictObject({
      transicionId: uuidSchema,
      restanteMs: duracionMsSchema,
      duracionMs: duracionMsSchema,
      congelada: z.boolean()
    })
    .nullable(),
  hayPendientes: z.boolean(),
  cierrePendiente: z.strictObject({ origen: rolOrigenSchema }).nullable(),
  /** Fallo genérico para el público (S4); `null` si no hay. */
  motivoFallo: motivoFalloSchema.nullable()
})
export type EstadoSecundariaIpc = z.infer<typeof estadoSecundariaIpcSchema>

// --- Comandos a la secundaria (§7, §10) ------------------------------------

/** Lo que la secundaria necesita para cargar una canción: instantánea sin rutas de archivo. */
export const entradaCargarIpcSchema = z.strictObject({
  entradaId: uuidSchema,
  cancionId: idCancionSchema,
  titulo: textoSchema,
  artista: textoSchema,
  duracionMs: duracionMsSchema,
  gananciaDb: z.number().finite().min(-60).max(60),
  letra: letraSchema,
  estilo: estiloSchema,
  lineasSinSincronizar: z.int().min(0),
  silencioPrevio: z.boolean()
})
export type EntradaCargarIpc = z.infer<typeof entradaCargarIpcSchema>

const baseComando = { sesionId: uuidSchema, revision: revisionSchema }

export const comandoSecundariaIpcSchema = z.discriminatedUnion('tipo', [
  z.strictObject({
    tipo: z.literal('cargar'),
    ...baseComando,
    entrada: entradaCargarIpcSchema,
    desdeMs: posicionMsSchema,
    pausada: z.boolean(),
    anuncio: z.enum(['inicio', 'reanudacion'])
  }),
  z.strictObject({
    tipo: z.literal('pausar'),
    ...baseComando,
    entradaId: uuidSchema,
    /** Quién o qué pide la pausa (texto corto; informativo). */
    causa: z.string().max(50)
  }),
  z.strictObject({ tipo: z.literal('reanudar'), ...baseComando, entradaId: uuidSchema }),
  z.strictObject({ tipo: z.literal('reiniciar'), ...baseComando, entradaId: uuidSchema }),
  z.strictObject({
    tipo: z.literal('transicion'),
    ...baseComando,
    /** `null` cancela la cuenta. */
    transicion: z
      .strictObject({
        candidata: z.strictObject({ titulo: textoSchema, artista: textoSchema }),
        restanteMs: duracionMsSchema,
        duracionMs: duracionMsSchema
      })
      .nullable()
  }),
  z.strictObject({ tipo: z.literal('fin_de_cola'), ...baseComando }),
  z.strictObject({ tipo: z.literal('error'), ...baseComando, motivo: motivoFalloSchema })
])
export type ComandoSecundariaIpc = z.infer<typeof comandoSecundariaIpcSchema>

// --- Informes de la secundaria (§7) ------------------------------------------

const baseInforme = { sesionId: uuidSchema, entradaId: uuidSchema }
const posicionOpcional = { posicionMs: posicionMsSchema.optional() }

export const TIPOS_INFORME = [
  'lista',
  'reproduciendo',
  'pausada',
  'posicion',
  'fin',
  'error'
] as const

export const informeSecundariaIpcSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('lista'), ...baseInforme }),
  z.strictObject({ tipo: z.literal('reproduciendo'), ...baseInforme, ...posicionOpcional }),
  z.strictObject({ tipo: z.literal('pausada'), ...baseInforme, ...posicionOpcional }),
  z.strictObject({ tipo: z.literal('posicion'), ...baseInforme, posicionMs: posicionMsSchema }),
  z.strictObject({ tipo: z.literal('fin'), ...baseInforme, ...posicionOpcional }),
  z.strictObject({
    tipo: z.literal('error'),
    ...baseInforme,
    error: z.strictObject({
      motivo: z.enum(['no_encontrada', 'lectura', 'decodificacion']),
      pista: z.enum(['instrumental', 'voz'])
    })
  })
])
export type InformeSecundariaIpc = z.infer<typeof informeSecundariaIpcSchema>

// --- Argumentos de los canales ---------------------------------------------

export const dondeAgregarSchema = z.union([
  z.enum(['siguiente', 'final']),
  z.strictObject({ antesDe: uuidSchema.nullable(), siRevision: revisionSchema })
])
export type DondeAgregar = z.infer<typeof dondeAgregarSchema>

export const agregarColaSchema = z.strictObject({
  cancionId: idCancionSchema,
  donde: dondeAgregarSchema
})
export const moverColaSchema = z.strictObject({
  entradaId: uuidSchema,
  /** `null`: al final. */
  antesDe: uuidSchema.nullable()
})
export const quitarColaSchema = z.strictObject({ entradaId: uuidSchema })
export const vaciarColaSchema = z.strictObject({ contexto: z.boolean() })

export const inicioSesionSchema = z.discriminatedUnion('tipo', [
  z.strictObject({
    tipo: z.literal('cancion'),
    cancionId: idCancionSchema,
    donde: z.literal('ahora')
  }),
  z.strictObject({ tipo: z.literal('cola') }),
  z.strictObject({ tipo: z.literal('reanudar') })
])
export const abrirSesionSchema = z.strictObject({
  pantallaId: z.int(),
  pantallaCompleta: z.boolean(),
  inicio: inicioSesionSchema
})
export type AbrirSesion = z.infer<typeof abrirSesionSchema>

export const transporteSesionSchema = z.strictObject({
  accion: z.enum(['pausar', 'reanudar', 'reiniciar']),
  entradaId: uuidSchema
})
export const moverAPantallaSchema = z.strictObject({ pantallaId: z.int() })
export const siguienteSesionSchema = z.strictObject({ desdeEntradaId: uuidSchema })
export const empezarSesionSchema = z.strictObject({ candidataId: uuidSchema })
export const detenerTransicionSchema = z.strictObject({ transicionId: uuidSchema })
export const repetirSesionSchema = z.strictObject({ entradaId: uuidSchema })
export const confirmarCierreSesionSchema = z.strictObject({
  cola: z.enum(['eliminar', 'conservar']),
  revision: revisionSchema
})

// --- Respuestas -------------------------------------------------------------

export const agregarColaResSchema = z.strictObject({
  estado: estadoSesionIpcSchema,
  entradaId: uuidSchema
})
export const quitarColaResSchema = z.strictObject({
  estado: estadoSesionIpcSchema,
  /** Entrada que seguía a la quitada, para «Deshacer». */
  antesDe: uuidSchema.nullable()
})
/** Respuesta de los canales compartidos: el estado del rol que llama. */
export const estadoDelRolSchema = z.union([estadoSesionIpcSchema, estadoSecundariaIpcSchema])
export const sesionInicialSchema = z.strictObject({
  sesionId: uuidSchema,
  comandoActual: comandoSecundariaIpcSchema.nullable(),
  estado: estadoSecundariaIpcSchema
})
export type SesionInicialIpc = z.infer<typeof sesionInicialSchema>
export const informeAplicadoSchema = z.strictObject({ aplicado: z.boolean() })

/** Carga del evento `sesion:posicion` (≤ 1 por segundo). */
export const posicionSesionIpcSchema = z.strictObject({
  sesionId: uuidSchema,
  entradaId: uuidSchema,
  posicionMs: posicionMsSchema,
  duracionMs: duracionMsSchema
})
export type PosicionSesionIpc = z.infer<typeof posicionSesionIpcSchema>

export { preferenciasSecundariaSchema }
