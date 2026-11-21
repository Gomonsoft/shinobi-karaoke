import { z } from 'zod'
import { estiloPredeterminado, estiloSchema } from './estilo'
import { LIMITES_PANELES } from './paneles'

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
  })
})

const editorSchema = objetoTolerante({ paneles: panelesSchema })

export const AGRUPACIONES_BIBLIOTECA = ['ninguno', 'artista', 'album'] as const
export type AgruparBiblioteca = (typeof AGRUPACIONES_BIBLIOTECA)[number]

/** Preferencias de la Biblioteca (ADR 0016 §9): lectura tolerante, como `editor.paneles`. */
const bibliotecaSchema = objetoTolerante({
  agrupar: z.enum(AGRUPACIONES_BIBLIOTECA).catch('ninguno')
})

export const configSchema = z.object({
  esquema: z.literal(VERSION_ESQUEMA_CONFIG).default(VERSION_ESQUEMA_CONFIG),
  instalacion: instalacionSchema,
  separacion: separacionSchema,
  reproductor: reproductorSchema,
  editor: editorSchema,
  biblioteca: bibliotecaSchema,
  aviso_youtube_aceptado: z.iso.datetime().nullable().default(null),
  ultima_comprobacion_ytdlp: z.iso.datetime().nullable().default(null),
  estilo_predeterminado: estiloSchema.default(() => estiloPredeterminado())
})

export type Config = z.infer<typeof configSchema>
export type PreferenciasPaneles = Config['editor']['paneles']

/** Configuración por defecto (la de una instalación nueva). */
export function configPredeterminada(): Config {
  return configSchema.parse({})
}
