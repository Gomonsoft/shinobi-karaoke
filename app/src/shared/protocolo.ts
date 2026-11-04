import { z } from 'zod'

/** Mensajes JSON Lines del worker (arquitectura.md, "Protocolo JSON Lines"). */
export const mensajeProgresoSchema = z.object({
  tipo: z.literal('progreso'),
  fase: z.string().min(1),
  /** 0–1, o null si es indeterminado. */
  valor: z.number().min(0).max(1).nullable(),
  detalle: z.record(z.string(), z.unknown()).optional()
})

export const mensajeLogSchema = z.object({
  tipo: z.literal('log'),
  nivel: z.enum(['debug', 'info', 'warning', 'error']),
  mensaje: z.string()
})

export const mensajeResultadoSchema = z.object({
  tipo: z.literal('resultado'),
  datos: z.record(z.string(), z.unknown())
})

export const mensajeErrorSchema = z.object({
  tipo: z.literal('error'),
  /** Código estable (ver errores.ts); un código desconocido se tolera y la UX lo trata como genérico. */
  codigo: z.string().min(1),
  mensaje: z.string(),
  reintentable: z.boolean().default(false)
})

export const mensajeWorkerSchema = z.discriminatedUnion('tipo', [
  mensajeProgresoSchema,
  mensajeLogSchema,
  mensajeResultadoSchema,
  mensajeErrorSchema
])

export type MensajeWorker = z.infer<typeof mensajeWorkerSchema>

export type ResultadoParseoLinea =
  { ok: true; mensaje: MensajeWorker } | { ok: false; error: string }

/** Parsea una línea de stdout del worker. Nunca lanza. */
export function parsearLineaWorker(linea: string): ResultadoParseoLinea {
  let json: unknown
  try {
    json = JSON.parse(linea)
  } catch {
    return { ok: false, error: 'La línea no es JSON válido' }
  }
  const r = mensajeWorkerSchema.safeParse(json)
  if (!r.success) return { ok: false, error: r.error.issues.map((i) => i.message).join('; ') }
  return { ok: true, mensaje: r.data }
}
