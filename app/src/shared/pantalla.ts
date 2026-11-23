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
  /** Zonas por parte (ADR 0029 §4 bis); ausente = `ZONAS_PREDETERMINADAS`. Solo actúa con reparto. */
  zonas?: ZonasPantalla
}

/** Valor de `zonas` cuando falta. */
export const ZONAS_PREDETERMINADAS: ZonasPantalla = 'por_parte'

/** `zonas` efectivo (ausente = `"por_parte"`). */
export function zonasEfectivas(p: Pick<Pantalla, 'zonas'>): ZonasPantalla {
  return p.zonas ?? ZONAS_PREDETERMINADAS
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

// Zonas por parte (ADR 0029 §4 bis; valores de la spec 07 y del sistema visual, confirmados en 0171 §4).
/** Área de las zonas: del 12 % al 86 % del alto de la pantalla. */
export const ZONAS_AREA_INICIO = 0.12
export const ZONAS_AREA_FIN = 0.86
/** Separación entre zonas, en múltiplos de `S` (el tamaño de letra). */
export const ZONAS_SEPARACION_S = 0.3
/** Alto de la zona del coro respecto al de una zona de cantante. */
export const ZONA_CORO_FRACCION_ALTO = 0.5
/** Líneas visibles por zona (valor fijo; no se reparte `pantalla.lineas`). */
export const ZONA_LINEAS_CANTANTE = 2
export const ZONA_LINEAS_CORO = 1
/** Escala de la segunda línea de una zona. */
export const ZONA_ESCALA_SIGUIENTE = 0.7
/** Mínimos de `S_zona` en múltiplos de `S`: cantantes y coro. */
export const ZONA_ESCALA_MIN = 0.75
export const ZONA_CORO_ESCALA_MIN = 0.5
/** Opacidad de una zona en la que no suena nada. */
export const ZONA_OPACIDAD_INACTIVA = 0.55
