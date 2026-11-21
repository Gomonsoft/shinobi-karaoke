/**
 * Animaciones CSS gobernadas por el fotograma (exportación, ADR 0019 §2). Una animación de
 * entrada no debe correr con el reloj del navegador: se pausa y se coloca en el instante que le
 * toca. Cada elemento animado anota en `data-nace-ms` el tiempo de audio en que empezó su
 * animación, así que el resultado no depende de haber pintado el fotograma anterior.
 */
export interface AnimacionLike {
  pause(): void
  currentTime: CSSNumberish | null
  effect: AnimationEffect | null
}

export interface DocumentoConAnimaciones {
  getAnimations?(): AnimacionLike[]
}

/** `currentTime` (ms) de una animación nacida en `naceMs` cuando el audio va por `tAudioMs`. */
export const tiempoDeAnimacion = (tAudioMs: number, naceMs: number): number =>
  Math.max(0, tAudioMs - naceMs)

/**
 * Pausa las animaciones del documento y fija su `currentTime` para el instante `tAudioMs`.
 * Devuelve cuántas colocó. Las que no anotan su nacimiento se pausan en 0 y no se tocan.
 */
export function fijarAnimaciones(
  tAudioMs: number,
  documento: DocumentoConAnimaciones = document
): number {
  let fijadas = 0
  for (const animacion of documento.getAnimations?.() ?? []) {
    animacion.pause()
    const nace = (animacion.effect as KeyframeEffect | null)?.target?.getAttribute('data-nace-ms')
    if (nace == null || nace === '' || !Number.isFinite(Number(nace))) continue
    animacion.currentTime = tiempoDeAnimacion(tAudioMs, Number(nace))
    fijadas += 1
  }
  return fijadas
}
