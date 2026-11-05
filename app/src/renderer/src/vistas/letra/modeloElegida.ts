import type { ElementoLetra, Letra } from '@shared/letra'

export type SincroniaActual = 'palabra' | 'linea' | 'ninguna' | 'parte'

/** Sincronía de la letra actual, mirando solo las líneas (docs/ux/05, "Casos" §1). */
export function sincroniaActual(lineas: readonly ElementoLetra[]): SincroniaActual {
  const solo = lineas.filter((e) => e.tipo === 'linea')
  const con = solo.filter((e) => e.inicio_ms !== null).length
  if (con === 0) return 'ninguna'
  if (con < solo.length) return 'parte'
  return solo.some((e) => e.palabras !== null && e.palabras.length > 0) ? 'palabra' : 'linea'
}

/** Algún renglón empieza por una marca `[m:ss]` o `[mm:ss.xx]` (preguntas/0023 §3). */
const MARCA = /^\s*\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/m
export const hayMarcasDeTiempo = (texto: string): boolean => MARCA.test(texto)

/** Hay al menos un renglón con texto, es decir, al menos una línea. */
export const tieneLineas = (texto: string): boolean =>
  texto.split('\n').some((r) => r.trim() !== '')

/** Contenido de la letra sin ids, para saber si dos letras son la misma. */
export function huella(letra: Pick<Letra, 'origen' | 'lineas'> | null): string {
  if (!letra) return ''
  return JSON.stringify([
    letra.origen,
    letra.lineas.map((e) => [e.tipo, e.texto, e.inicio_ms, e.fin_ms, e.palabras])
  ])
}
