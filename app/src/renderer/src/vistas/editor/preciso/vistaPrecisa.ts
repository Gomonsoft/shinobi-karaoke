import type { VistaLineaTiempo } from '../lineaTiempo'

/** Mínimo a cada lado de la línea en la vista, para poder agarrar sus tiradores aunque el margen sea 0. */
export const MARGEN_MINIMO_VISTA_MS = 250
/** Distancia en px por debajo de la cual dos tiradores se escalonan. */
export const SEPARACION_TIRADORES_PX = 24

export type VistaPrecisa = VistaLineaTiempo

/** Vista fija de la ventana: de `inicio − máx(margen, 250)` a `fin + máx(margen, 250)`, dentro de `[0, duración]`. */
export function vistaPrecisa(
  inicioMs: number,
  finMs: number,
  margenMs: number,
  duracionMs: number
): VistaPrecisa {
  const m = Math.max(margenMs, MARGEN_MINIMO_VISTA_MS)
  return { inicioMs: Math.max(0, inicioMs - m), finMs: Math.min(duracionMs, finMs + m) }
}

const extension = (v: VistaPrecisa) => v.finMs - v.inicioMs

/** Fracción (0–100) de la vista; no acota. */
export function tiempoAPorcentaje(vista: VistaPrecisa, ms: number): number {
  return extension(vista) <= 0 ? 0 : ((ms - vista.inicioMs) / extension(vista)) * 100
}

export function pixelATiempo(vista: VistaPrecisa, anchoPx: number, px: number): number {
  return vista.inicioMs + (px / anchoPx) * extension(vista)
}

/** ¿Casi coinciden dos instantes en pantalla (hay que escalonar sus tiradores)? */
export function casiCoinciden(vista: VistaPrecisa, anchoPx: number, a: number, b: number): boolean {
  return (Math.abs(a - b) / Math.max(1, extension(vista))) * anchoPx < SEPARACION_TIRADORES_PX
}
