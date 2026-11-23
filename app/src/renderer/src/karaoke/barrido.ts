export function anchosPintados(anchos: readonly number[], progreso: number): number[] {
  let restante = anchos.reduce((total, ancho) => total + ancho, 0) * progreso
  return anchos.map((ancho) => {
    const pintado = Math.max(0, Math.min(ancho, restante))
    restante -= ancho
    return pintado
  })
}

/**
 * `margenInferior` (px sin transformar) amplía hacia abajo cada renglón lo que ocupan la separación
 * y el grosor del subrayado, sin pasar del renglón siguiente; la medida horizontal no cambia.
 */
export function recorteBarrido(
  cajas: readonly DOMRectReadOnly[],
  progreso: number,
  { margenInferior = 0 }: { margenInferior?: number } = {}
): string {
  const anchos = anchosPintados(
    cajas.map((caja) => caja.width),
    progreso
  )
  const origen = cajas[0]
  if (!origen) return 'inset(100%)'
  const ancla = `${origen.left}px ${origen.top}px`
  const contornos = cajas.flatMap(({ left, top, right, bottom: base }, i) => {
    const ancho = anchos[i]!
    const hueco = cajas[i + 1] ? Math.max(0, cajas[i + 1]!.top - base) : Infinity
    const bottom = base + Math.max(0, Math.min(margenInferior, hueco))
    if (ancho === 0) return []
    const limite = ancho >= right - left ? right : left + ancho
    const inicio = `${left}px ${top}px`
    return [
      inicio,
      `${limite}px ${top}px`,
      `${limite}px ${bottom}px`,
      `${left}px ${bottom}px`,
      inicio,
      ancla
    ]
  })
  // Cada rectángulo vuelve al origen. Los segmentos entre rectángulos se recorren en ambos sentidos.
  return contornos.length ? `polygon(${contornos.join(', ')})` : 'inset(100%)'
}
