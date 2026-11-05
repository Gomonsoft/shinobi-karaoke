import {
  estimarMinutosSeparacion,
  type Manifiesto,
  type ModeloId,
  type PerfilHardware
} from './manifiesto'

/** De dónde sale el factor de la estimación (preguntas/0021 §3, ADR 0004). */
export type OrigenEstimacion = 'medido_equipo' | 'referencia_medida' | 'estimado'

export interface EstimacionSegundos {
  min: number
  max: number
  origen: OrigenEstimacion
}

/**
 * Coste fijo de arrancar el worker, que no depende de la duración (0005 §5 y §7): importar torch
 * (~2 s), preparar la canción (3–15 s) y cargar el modelo (1–3 s). Se suma al mínimo y al máximo.
 */
export const ARRANQUE_MIN_S = 10
export const ARRANQUE_MAX_S = 20

/**
 * Segundos que tardará separar una canción con el perfil y el modo dados, incluido el coste fijo de
 * arranque. `null` si no hay ningún dato para ese perfil y modo (la interfaz no muestra nada).
 * `origen` decide si la interfaz usa la variante `.aprox` (solo con `'estimado'`).
 */
export function estimarSegundosSeparacion(
  duracionMs: number,
  perfil: PerfilHardware,
  modo: ModeloId,
  factoresMedidos: Partial<Record<ModeloId, number>>,
  manifiesto: Manifiesto
): EstimacionSegundos | null {
  const r = estimarMinutosSeparacion(duracionMs, perfil, modo, factoresMedidos, manifiesto)
  if (r === null) return null
  const medido = (factoresMedidos[modo] ?? 0) > 0
  const origen: OrigenEstimacion = medido
    ? 'medido_equipo'
    : manifiesto.factores[perfil]?.[modo] != null
      ? 'referencia_medida'
      : 'estimado'
  return { min: r.min * 60 + ARRANQUE_MIN_S, max: r.max * 60 + ARRANQUE_MAX_S, origen }
}

/** Punto medio de la estimación, en minutos (ritmo esperado de 0064/0065). */
export function minutosMedios(e: { min: number; max: number }): number {
  return (e.min + e.max) / 2 / 60
}

/**
 * "Tardará unos N minutos" (`prog.eta.previa`), con `{min, max}` en segundos. Por debajo de 2
 * minutos usa las mismas reglas que `prog.eta`. `null` -> `null`: no se muestra nada.
 */
export function textoEstimacionPrevia(e: { min: number; max: number } | null): string | null {
  if (e === null) return null
  const medio = (e.min + e.max) / 2
  if (medio < 60) return 'Tardará menos de 1 minuto'
  if (medio < 120) return 'Tardará 1 minuto aprox.'
  return `Tardará unos ${String(Math.ceil(medio / 60))} minutos`
}
