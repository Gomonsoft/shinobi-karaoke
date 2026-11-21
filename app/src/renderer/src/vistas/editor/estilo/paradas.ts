export type FormaFondo = 'lineal' | 'radial' | 'conico'

/** Posiciones de `n` paradas: i/n en el cónico (cierre del mismo tamaño) y de 0 a 1 en el resto. */
export function repartirParadas(n: number, forma: FormaFondo): number[] {
  const hueco = forma === 'conico' ? n : Math.max(1, n - 1)
  return Array.from({ length: n }, (_, i) => i / hueco)
}

/** Colores con las paradas repartidas según la forma. */
export function paradasRepartidas(
  colores: readonly string[],
  forma: FormaFondo
): { color: string; posicion: number }[] {
  const posiciones = repartirParadas(colores.length, forma)
  return colores.map((color, i) => ({ color, posicion: posiciones[i]! }))
}
