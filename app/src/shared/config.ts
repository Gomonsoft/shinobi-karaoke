import { z } from 'zod'
import { estiloPredeterminado, estiloSchema } from './estilo'

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

const reproductorSchema = z
  .object({
    volumen: z.number().min(0).max(1).default(0.8),
    silenciado: z.boolean().default(false),
    /** Volumen propio de la voz guía, aplicado antes del volumen general. */
    voz_guia: z.number().min(0).max(1).default(VOLUMEN_VOZ_PREDETERMINADO),
    voz_guia_silenciada: z.boolean().default(VOZ_SILENCIADA_PREDETERMINADA)
  })
  .prefault({})

export const configSchema = z.object({
  esquema: z.literal(VERSION_ESQUEMA_CONFIG).default(VERSION_ESQUEMA_CONFIG),
  instalacion: instalacionSchema,
  separacion: separacionSchema,
  reproductor: reproductorSchema,
  aviso_youtube_aceptado: z.iso.datetime().nullable().default(null),
  ultima_comprobacion_ytdlp: z.iso.datetime().nullable().default(null),
  estilo_predeterminado: estiloSchema.default(() => estiloPredeterminado())
})

export type Config = z.infer<typeof configSchema>

/** Configuración por defecto (la de una instalación nueva). */
export function configPredeterminada(): Config {
  return configSchema.parse({})
}
