import { z } from 'zod'

/** Pantalla de espera: qué se muestra en los silencios largos y antes de la primera línea (ADR 0018 §2). */
export const esperaSchema = z.object({
  puntos: z.boolean(),
  barra: z.boolean(),
  cuenta: z.boolean(),
  primera_entrada: z.boolean(),
  umbral_ms: z.number().int().min(1000).max(60000)
})

export type Espera = z.infer<typeof esperaSchema>

/** Comportamiento de 0.1.0: solo puntos, también en la primera entrada. */
export const ESPERA_LEGADA: Espera = {
  puntos: true,
  barra: false,
  cuenta: false,
  primera_entrada: true,
  umbral_ms: 4000
}

/** Duración de la cuenta atrás de 3-2-1. */
export const CUENTA_MS = 3000

/** Instante en que desaparece el título; antes de él no hay espera en la primera entrada. */
export const UMBRAL_PRIMERA_ENTRADA_MS = 4000
