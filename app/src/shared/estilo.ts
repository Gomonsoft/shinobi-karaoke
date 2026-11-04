import { z } from 'zod'

import { FUENTE_PREDETERMINADA, familiaValida } from './fuentes'

export const colorHex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Usa el formato #RRGGBB')

export const paradaSchema = z.object({
  color: colorHex,
  posicion: z.number().min(0).max(1)
})

const fondoSolido = z.object({
  tipo: z.literal('solido'),
  color: colorHex
})

const fondoDegradado = z.object({
  tipo: z.literal('degradado'),
  angulo_grados: z.number().int().min(0).max(359),
  paradas: z.array(paradaSchema).min(2).max(4)
})

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
  })
})

export type Estilo = z.infer<typeof estiloSchema>
export type Fondo = z.infer<typeof fondoSchema>

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
