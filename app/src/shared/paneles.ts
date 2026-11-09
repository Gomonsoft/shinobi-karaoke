import type { PreferenciasPaneles } from './config'

/**
 * Límites y medidas de los paneles del editor (px CSS a zoom 100 %). Fuente única: la usan el
 * esquema de `config.json`, el esquema IPC y el modelo de distribución del renderer.
 */
export const LIMITES_PANELES = {
  lista: { defecto: 300, min: 256, max: 480 },
  panel: { defecto: 360, min: 300, max: 480 },
  /** `defecto: null` = 216 en normal y 204 en compacto (lo aplica el modelo). */
  linea_tiempo: { defecto: null, min: 176, max: 960 }
} as const

export const ALTO_MIN_ZONA_SUPERIOR = 136
export const ANCHO_MIN_PREVIA = 320
export const ANCHO_DIVISOR = 12
export const ANCHO_RIEL_LISTA = 72
export const ANCHO_RIEL_PANEL = 120
export const ALTO_TIMELINE_MINIMIZADA = { normal: 44, compacto: 40 } as const
export const ALTO_COMPACTO_DESDE = 800
export const ANCHO_MINIMO_DISENO = 1024
export const PASO_TECLADO = 16
export const PASO_TECLADO_GRANDE = 64

export function preferenciasPanelesPredeterminadas(): PreferenciasPaneles {
  return {
    lista: { ancho: LIMITES_PANELES.lista.defecto, minimizado: false },
    panel: { ancho: LIMITES_PANELES.panel.defecto, minimizado: false },
    linea_tiempo: { alto: null, minimizado: false }
  }
}
