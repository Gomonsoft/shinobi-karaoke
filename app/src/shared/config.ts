import { z } from 'zod'
import { estiloPredeterminado, estiloSchema } from './estilo'
import {
  AUDIOS_EXPORTACION,
  AUDIO_PREDETERMINADO,
  FORMATOS_ID,
  FORMATO_PREDETERMINADO,
  FPS,
  FPS_PREDETERMINADO,
  PROPORCION_PREDETERMINADA,
  RESOLUCION_PREDETERMINADA,
  acotarFactorCorrector,
  FACTOR_CORRECTOR,
  proporcionDe
} from './exportacion'
import {
  LIMITES_PANELES,
  LIMITES_PRECISO,
  LIMITE_GEOMETRIA_PRECISO,
  PRECISO_POR_DEFECTO
} from './paneles'

export const VERSION_ESQUEMA_CONFIG = 1

const faseSchema = z.enum(['pendiente', 'en_curso', 'completada', 'error'])
const modeloSeparacion = z.enum(['calidad', 'rapido'])

// Lectura tolerante (ADR 0006): los campos ausentes toman su valor por defecto.
// `prefault({})` aplica los valores por defecto de los campos internos.
const instalacionSchema = z
  .object({
    estado: z.enum(['pendiente', 'en_curso', 'completa', 'dañada']).default('pendiente'),
    reinstalar_componentes: z.boolean().default(false),
    fases: z
      .object({
        motor: faseSchema.default('pendiente'),
        componentes: faseSchema.default('pendiente'),
        modelo: faseSchema.default('pendiente')
      })
      .prefault({}),
    perfil_hardware: z.enum(['cpu', 'cuda', 'mps']).nullable().default(null),
    /** Perfil detectado antes de instalar (0031); el definitivo es `perfil_hardware`. */
    perfil_previsto: z.enum(['cpu', 'cuda', 'mps']).nullable().default(null),
    motivo_rebaja: z.enum(['memoria', 'generico']).nullable().default(null),
    error: z
      .object({
        codigo: z.string().min(1),
        mensaje: z.string(),
        fase: z.string().min(1)
      })
      .nullable()
      .default(null),
    version_manifiesto: z.number().int().nullable().default(null),
    hardware: z
      .object({
        gpu: z.string().nullable().default(null),
        vram_mb: z.number().int().nonnegative().nullable().default(null)
      })
      .prefault({})
  })
  .prefault({})

const separacionSchema = z
  .object({
    /**
     * Modelo vigente. Calidad por defecto en todos los perfiles; Rápido solo con
     * `rapido_aceptado`. Un `automatico` guardado por versiones anteriores se lee como Calidad.
     */
    modo: z
      .preprocess((v) => (v === 'automatico' ? 'calidad' : v), modeloSeparacion)
      .default('calidad'),
    /** Fecha del consentimiento para usar el modelo Rápido (sus autores no declaran licencia). */
    rapido_aceptado: z.iso.datetime().nullable().default(null),
    modelos_descargados: z.array(modeloSeparacion).default([]),
    /** Minutos de proceso por minuto de audio (media móvil). */
    factores_medidos: z.partialRecord(modeloSeparacion, z.number().positive()).default({})
  })
  .prefault({})

export const VOLUMEN_VOZ_PREDETERMINADO = 0.3
export const VOZ_SILENCIADA_PREDETERMINADA = true

/** Duración de la cuenta entre canciones (ADR 0006, rev. fase 4): entero de 1 a 30 s, 4 por defecto. */
export const TRANSICION_S = { min: 1, max: 30, defecto: 4 } as const

/** Última pantalla elegida para la ventana secundaria (ADR 0006, rev. fase 4); solo la escribe main. */
export const pantallaSecundariaGuardadaSchema = z.object({
  id: z.number().int(),
  etiqueta: z.string().max(200),
  ancho: z.number().int().positive(),
  alto: z.number().int().positive()
})

const secundariaSchema = z
  .object({
    pantalla: pantallaSecundariaGuardadaSchema,
    pantalla_completa: z.boolean()
  })
  .nullable()
  .catch(null)

/** Campos de volumen y voz guía: los únicos que escribe la secundaria (`sesion.guardarPreferencias`). */
const camposPreferenciasSecundaria = {
  volumen: z.number().min(0).max(1),
  silenciado: z.boolean(),
  voz_guia: z.number().min(0).max(1),
  voz_guia_silenciada: z.boolean()
}

/** Parcial estricto de la secundaria: sin `transicion_s` ni `secundaria` (ADR 0017 §10). */
export const preferenciasSecundariaSchema = z.strictObject({
  volumen: camposPreferenciasSecundaria.volumen.optional(),
  silenciado: camposPreferenciasSecundaria.silenciado.optional(),
  voz_guia: camposPreferenciasSecundaria.voz_guia.optional(),
  voz_guia_silenciada: camposPreferenciasSecundaria.voz_guia_silenciada.optional()
})
export type PreferenciasSecundaria = z.infer<typeof preferenciasSecundariaSchema>

export const reproductorSchema = z
  .object({
    volumen: camposPreferenciasSecundaria.volumen.default(0.8),
    silenciado: camposPreferenciasSecundaria.silenciado.default(false),
    /** Volumen propio de la voz guía, aplicado antes del volumen general. */
    voz_guia: camposPreferenciasSecundaria.voz_guia.default(VOLUMEN_VOZ_PREDETERMINADO),
    voz_guia_silenciada: camposPreferenciasSecundaria.voz_guia_silenciada.default(
      VOZ_SILENCIADA_PREDETERMINADA
    ),
    /** Cuenta entre canciones de la cola, en segundos; lectura tolerante. */
    transicion_s: z
      .number()
      .int()
      .min(TRANSICION_S.min)
      .max(TRANSICION_S.max)
      .catch(TRANSICION_S.defecto),
    secundaria: secundariaSchema
  })
  .prefault(() => ({ transicion_s: TRANSICION_S.defecto, secundaria: null }))
export type ConfigReproductor = z.infer<typeof reproductorSchema>

/** Objeto cuyo valor, si no es un objeto, se lee como `{}` (cada hoja toma su defecto). */
function objetoTolerante<T extends z.ZodRawShape>(forma: T) {
  return z.preprocess(
    (v) => (typeof v === 'object' && v !== null && !Array.isArray(v) ? v : {}),
    z.object(forma)
  )
}

const enteroEnRango = (min: number, max: number) => z.number().int().min(min).max(max)

/**
 * Preferencias de paneles del editor (ADR 0006, rev. 0.2.0). Lectura tolerante campo a campo:
 * un valor inválido se sustituye por el defecto de ese campo sin apartar el config.
 */
const geometriaPrecisoSchema = z.object({
  x: z.number().int().min(-LIMITE_GEOMETRIA_PRECISO).max(LIMITE_GEOMETRIA_PRECISO),
  y: z.number().int().min(-LIMITE_GEOMETRIA_PRECISO).max(LIMITE_GEOMETRIA_PRECISO),
  ancho: z.number().int().min(LIMITES_PRECISO.ancho.min).max(LIMITE_GEOMETRIA_PRECISO),
  alto: z.number().int().min(LIMITES_PRECISO.alto.min).max(LIMITE_GEOMETRIA_PRECISO)
})

/**
 * Parcial estricto que puede escribir el renderer (sin `.catch`): lo enchufa `configParcialRendererSchema`
 * en `editor.paneles.preciso`.
 */
export const precisoParcialSchema = z.strictObject({
  geometria: geometriaPrecisoSchema.nullable().optional(),
  margen_ms: z.union([z.literal(0), z.literal(500), z.literal(1000)]).optional()
})

/** Ventana del editor preciso (0.2.1): ausente en el archivo = sin preferencia; cada campo es tolerante. */
const precisoSchema = objetoTolerante({
  geometria: geometriaPrecisoSchema.nullable().catch(null),
  margen_ms: precisoParcialSchema.shape.margen_ms.unwrap().catch(PRECISO_POR_DEFECTO.margen_ms)
})

const panelesSchema = objetoTolerante({
  lista: objetoTolerante({
    ancho: enteroEnRango(LIMITES_PANELES.lista.min, LIMITES_PANELES.lista.max).catch(
      LIMITES_PANELES.lista.defecto
    ),
    minimizado: z.boolean().catch(false)
  }),
  panel: objetoTolerante({
    ancho: enteroEnRango(LIMITES_PANELES.panel.min, LIMITES_PANELES.panel.max).catch(
      LIMITES_PANELES.panel.defecto
    ),
    minimizado: z.boolean().catch(false)
  }),
  linea_tiempo: objetoTolerante({
    alto: enteroEnRango(LIMITES_PANELES.linea_tiempo.min, LIMITES_PANELES.linea_tiempo.max)
      .nullable()
      .catch(null),
    minimizado: z.boolean().catch(false)
  }),
  preciso: precisoSchema
})

const editorSchema = objetoTolerante({
  paneles: panelesSchema,
  /** No volver a avisar al activar «Letra lista» (ADR 0018 §5). */
  omitir_aviso_letra_lista: z.boolean().catch(false)
})

export const AGRUPACIONES_BIBLIOTECA = ['ninguno', 'artista', 'album', 'fecha'] as const
export type AgruparBiblioteca = (typeof AGRUPACIONES_BIBLIOTECA)[number]

/** Preferencias de la Biblioteca (ADR 0016 §9): lectura tolerante, como `editor.paneles`. */
const bibliotecaSchema = objetoTolerante({
  agrupar: z.enum(AGRUPACIONES_BIBLIOTECA).catch('ninguno')
})

/**
 * Preferencias de exportación (ADR 0019 §6 y §11; ADR 0006, rev. fase 6). Solo las escribe main.
 * Lectura tolerante por campo; si `ancho × alto` no es una resolución del catálogo, se vuelve a la
 * resolución y la proporción por defecto (la proporción siempre se deduce de la resolución).
 */
const exportacionSchema = z.preprocess(
  (v) => {
    const o = typeof v === 'object' && v !== null && !Array.isArray(v) ? { ...v } : {}
    const { ancho, alto } = o as { ancho?: unknown; alto?: unknown }
    const valida =
      typeof ancho === 'number' && typeof alto === 'number' && proporcionDe(ancho, alto) !== null
    return valida ? o : { ...o, ancho: undefined, alto: undefined }
  },
  z
    .object({
      formato: z.enum(FORMATOS_ID).catch(FORMATO_PREDETERMINADO),
      audio: z.enum(AUDIOS_EXPORTACION).catch(AUDIO_PREDETERMINADO),
      ancho: z.number().int().catch(RESOLUCION_PREDETERMINADA.ancho),
      alto: z.number().int().catch(RESOLUCION_PREDETERMINADA.alto),
      fps: z
        .number()
        .refine((n): n is (typeof FPS)[number] => (FPS as readonly number[]).includes(n))
        .catch(FPS_PREDETERMINADO),
      /** Última carpeta usada; `null` = la de vídeos del sistema. */
      carpeta: z.string().min(1).max(4096).nullable().catch(null),
      factor_corrector: z
        .number()
        .finite()
        .transform(acotarFactorCorrector)
        .catch(FACTOR_CORRECTOR.defecto)
    })
    .transform((c) => ({
      ...c,
      proporcion: proporcionDe(c.ancho, c.alto) ?? PROPORCION_PREDETERMINADA
    }))
)
export type ConfigExportacion = z.infer<typeof exportacionSchema>

export const configSchema = z.object({
  esquema: z.literal(VERSION_ESQUEMA_CONFIG).default(VERSION_ESQUEMA_CONFIG),
  instalacion: instalacionSchema,
  separacion: separacionSchema,
  reproductor: reproductorSchema,
  editor: editorSchema,
  biblioteca: bibliotecaSchema,
  exportacion: exportacionSchema,
  aviso_youtube_aceptado: z.iso.datetime().nullable().default(null),
  ultima_comprobacion_ytdlp: z.iso.datetime().nullable().default(null),
  estilo_predeterminado: estiloSchema.default(() => estiloPredeterminado())
})

export type Config = z.infer<typeof configSchema>
type PanelesLeidos = Config['editor']['paneles']
/** Lo que lee `config.json` siempre trae `preciso`; el modelo del editor puede no llevarlo (0.2.0). */
export type PreferenciasPaneles = Omit<PanelesLeidos, 'preciso'> & {
  preciso?: PanelesLeidos['preciso']
}

/** Configuración por defecto (la de una instalación nueva). */
export function configPredeterminada(): Config {
  return configSchema.parse({})
}
