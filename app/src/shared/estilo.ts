import { z } from 'zod'

import { ESPERA_LEGADA, esperaSchema, type Espera } from './espera'
import { FUENTE_PREDETERMINADA, familiaValida } from './fuentes'

export const colorHex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Usa el formato #RRGGBB')

export const paradaSchema = z.object({
  color: colorHex,
  posicion: z.number().min(0).max(1)
})

// Estricto: un sólido no admite `movimiento` (ni otros campos del degradado).
const fondoSolido = z.strictObject({
  tipo: z.literal('solido'),
  color: colorHex
})

export const PERIODO_MIN_S = 10
export const PERIODO_MAX_S = 120
/** Radio de la órbita del centro del degradado, como fracción del lado (ADR 0018 §1). */
export const AMPLITUD_ORBITA = 0.1

const unidad = z.number().min(0).max(1)

const fondoDegradado = z
  .object({
    tipo: z.literal('degradado'),
    forma: z.enum(['lineal', 'radial', 'conico']).optional(),
    centro: z.object({ x: unidad, y: unidad }).optional(),
    movimiento: z
      .object({
        periodo_s: z.number().int().min(PERIODO_MIN_S).max(PERIODO_MAX_S),
        sentido: z.enum(['horario', 'antihorario'])
      })
      .nullable()
      .optional(),
    angulo_grados: z.number().int().min(0).max(359),
    paradas: z.array(paradaSchema).min(2).max(4)
  })
  .refine(
    ({ paradas }) =>
      paradas.every((parada, i) => parada.posicion >= (paradas[i - 1]?.posicion ?? 0)),
    { message: 'Las paradas del degradado deben ir en orden de posición', path: ['paradas'] }
  )

export const fondoSchema = z.discriminatedUnion('tipo', [fondoSolido, fondoDegradado])

export const fuenteLetraSchema = z.object({
  // Una familia incluida desconocida cae a la predeterminada (ADR 0006).
  familia: z.string().transform(familiaValida),
  // "sistema" está reservado: el validador lo rechaza en el MVP.
  origen: z.literal('incluida')
})

export const estiloSchema = z.object({
  version: z.literal(1),
  fondo: fondoSchema,
  letra: z.object({
    fuente: fuenteLetraSchema,
    color: colorHex,
    color_resaltado: colorHex
  }),
  espera: esperaSchema.optional()
})

export type Estilo = z.infer<typeof estiloSchema>
export type Fondo = z.infer<typeof fondoSchema>

type FondoDegradado = Extract<Fondo, { tipo: 'degradado' }>
type FondoNormalizado =
  | Extract<Fondo, { tipo: 'solido' }>
  | (FondoDegradado & Required<Pick<FondoDegradado, 'forma' | 'centro' | 'movimiento'>>)

export type EstiloNormalizado = Omit<Estilo, 'fondo' | 'espera'> & {
  fondo: FondoNormalizado
  espera: Espera
}

/** Rellena los campos opcionales con sus valores por defecto. Pura; no usar para escribir. */
export function normalizarEstilo(estilo: Estilo): EstiloNormalizado {
  const copia = structuredClone(estilo)
  const fondo: FondoNormalizado =
    copia.fondo.tipo === 'solido'
      ? copia.fondo
      : {
          ...copia.fondo,
          forma: copia.fondo.forma ?? 'lineal',
          centro: copia.fondo.centro ?? { x: 0.5, y: 0.5 },
          movimiento: copia.fondo.movimiento ?? null
        }
  return { ...copia, fondo, espera: copia.espera ?? { ...ESPERA_LEGADA } }
}

/** Estilo de karaoke predeterminado (ux/sistema-visual.md §8). */
export const ESTILO_PREDETERMINADO: Estilo = {
  version: 1,
  fondo: {
    tipo: 'degradado',
    angulo_grados: 135,
    paradas: [
      { color: '#1B1033', posicion: 0 },
      { color: '#5A1E6E', posicion: 1 }
    ]
  },
  letra: {
    fuente: { familia: FUENTE_PREDETERMINADA, origen: 'incluida' },
    color: '#FFFFFF',
    color_resaltado: '#FFD400'
  }
}

/** Copia profunda del estilo predeterminado (para no compartir referencias). */
export function estiloPredeterminado(): Estilo {
  return structuredClone(ESTILO_PREDETERMINADO)
}
