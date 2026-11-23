/**
 * Estimaciones del lote (ADR 0026 §1, tarea 0375). Funciones puras: las usan el renderer (resumen y bloqueo de
 * «Añadir») y main (`fuente.lote` rechaza con `SIN_ESPACIO` como última defensa), así que calculan lo mismo.
 */

/** Espacio por canción de 4 minutos (spec 03 · Feature 7) y recargo del resumen. */
export const BYTES_CANCION_4_MIN = 100 * 1024 * 1024
export const DURACION_BASE_MS = 240_000
export const RECARGO_ESPACIO = 1.1
/** Margen que debe quedar libre tras el lote. */
export const MARGEN_ESPACIO_BYTES = 1024 ** 3

/** Bytes que ocupará un lote con esas duraciones (`null` = desconocida: una canción media), con el recargo. */
export function estimarEspacioLote(duracionesMs: (number | null)[]): number {
  const total = duracionesMs.reduce<number>(
    (suma, d) => suma + (d === null ? 1 : d / DURACION_BASE_MS) * BYTES_CANCION_4_MIN,
    0
  )
  return Math.ceil(total * RECARGO_ESPACIO)
}

/** Cuántas canciones (de las primeras) caben con el margen de 1 GB. */
export function cuantasCaben(duracionesMs: (number | null)[], libreBytes: number): number {
  let n = 0
  while (
    n < duracionesMs.length &&
    estimarEspacioLote(duracionesMs.slice(0, n + 1)) + MARGEN_ESPACIO_BYTES <= libreBytes
  ) {
    n++
  }
  return n
}

/**
 * Minutos que tardará el lote: duración total × `factorMinutos` (minutos de proceso por minuto de audio).
 * `null` sin factor. `conocida` es `false` si alguna duración se desconoce (la interfaz dice «al menos»).
 */
export function estimarTiempoLote(
  duracionesMs: (number | null)[],
  factorMinutos: number | null
): { minutos: number; conocida: boolean } | null {
  if (factorMinutos === null) return null
  const ms = duracionesMs.reduce<number>((s, d) => s + (d ?? 0), 0)
  return {
    minutos: (ms / 60_000) * factorMinutos,
    conocida: duracionesMs.every((d) => d !== null)
  }
}
