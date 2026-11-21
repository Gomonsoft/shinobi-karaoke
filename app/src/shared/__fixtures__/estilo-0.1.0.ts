// Copia congelada de `estiloSchema` de 0.1.0 (shared/estilo.ts sin cambios desde la tarea 0006;
// la etiqueta v0.1.0 no existe en este clon). NO editar: prueba que un estilo con campos
// nuevos sigue validando con el esquema antiguo (ADR 0018 §1).
import { z } from 'zod'

import { familiaValida } from '../fuentes'

const colorHex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Usa el formato #RRGGBB')

const paradaSchema = z.object({
  color: colorHex,
  posicion: z.number().min(0).max(1)
})

const fondoSolido = z.object({
  tipo: z.literal('solido'),
  color: colorHex
})

const fondoDegradado = z
  .object({
    tipo: z.literal('degradado'),
    angulo_grados: z.number().int().min(0).max(359),
    paradas: z.array(paradaSchema).min(2).max(4)
  })
  .refine(
    ({ paradas }) =>
      paradas.every((parada, i) => parada.posicion >= (paradas[i - 1]?.posicion ?? 0)),
    { message: 'Las paradas del degradado deben ir en orden de posición', path: ['paradas'] }
  )

const fondoSchema = z.discriminatedUnion('tipo', [fondoSolido, fondoDegradado])

const fuenteLetraSchema = z.object({
  familia: z.string().transform(familiaValida),
  origen: z.literal('incluida')
})

export const estiloSchema010 = z.object({
  version: z.literal(1),
  fondo: fondoSchema,
  letra: z.object({
    fuente: fuenteLetraSchema,
    color: colorHex,
    color_resaltado: colorHex
  })
})
