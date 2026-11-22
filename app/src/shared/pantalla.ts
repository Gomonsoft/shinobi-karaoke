import { z } from 'zod'

/*
 * Letra en pantalla: cuántas líneas se ven a la vez y cómo cambian (ADR 0022 §1). Sin E/S.
 * Lectura tolerante por campo (como `editor.paneles`): un valor fuera de rango cae a su valor por
 * defecto y no deja la canción ni el tema como dañados.
 */

export const LINEAS_MIN = 2
export const LINEAS_MAX = 7
export const PASADAS_MAX = 2
export const TRANSICIONES_PANTALLA = ['desplazamiento', 'fundido', 'ninguna'] as const
export type TransicionPantalla = (typeof TRANSICIONES_PANTALLA)[number]

export const ZONAS_PANTALLA = ['por_parte', 'una'] as const
export type ZonasPantalla = (typeof ZONAS_PANTALLA)[number]

export interface Pantalla {
  lineas: number
  /** Lo ELEGIDO; el efectivo es `pasadasEfectivas`. */
  pasadas: number
  transicion: TransicionPantalla
  /** Reservado para 0.2.3 (ADR 0029 §4 bis): sin uso ni control en 0.2.2; se conserva al escribir. */
  zonas?: ZonasPantalla
}

/** Predeterminado nuevo: también lo que se lee de un estilo sin `pantalla` (ADR 0022 §1). */
export const PANTALLA_PREDETERMINADA: Pantalla = {
  lineas: 5,
  pasadas: 1,
  transicion: 'desplazamiento'
}

export const pantallaSchema = z.object({
  lineas: z.number().int().min(LINEAS_MIN).max(LINEAS_MAX).catch(PANTALLA_PREDETERMINADA.lineas),
  pasadas: z.number().int().min(0).max(PASADAS_MAX).catch(PANTALLA_PREDETERMINADA.pasadas),
  transicion: z.enum(TRANSICIONES_PANTALLA).catch(PANTALLA_PREDETERMINADA.transicion),
  zonas: z.enum(ZONAS_PANTALLA).optional().catch(undefined)
})

/** Escritura estricta (IPC): un valor fuera de rango se rechaza. */
export const pantallaEstrictaSchema = z.strictObject({
  lineas: z.number().int().min(LINEAS_MIN).max(LINEAS_MAX),
  pasadas: z.number().int().min(0).max(PASADAS_MAX),
  transicion: z.enum(TRANSICIONES_PANTALLA),
  zonas: z.enum(ZONAS_PANTALLA).optional()
})

/** Máximo de pasadas que admite el número de líneas: 0 con 2–3, 1 con 4–5 y 2 con 6–7. */
export function pasadasMaximas(lineas: number): number {
  return Math.min(PASADAS_MAX, Math.max(0, Math.floor((lineas - 2) / 2)))
}

/** Pasadas que se muestran de verdad: `mín(pasadas, máximo de lineas)`. */
export function pasadasEfectivas(p: Pantalla): number {
  return Math.min(p.pasadas, pasadasMaximas(p.lineas))
}

export const DURACION_CAMBIO_MS: Record<TransicionPantalla, number> = {
  desplazamiento: 350,
  fundido: 250,
  ninguna: 0
}
export const RETIRADA_MS = 2000
export const FUNDIDO_RETIRADA_MS = 400
export const APARICION_BLOQUE_MS = 250
export const MINIMO_ANIMADO_MS = 120
export const FRACCION_ENTRADA = 0.6
