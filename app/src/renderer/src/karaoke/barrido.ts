export function anchosPintados(anchos: readonly number[], progreso: number): number[] {
  let restante = anchos.reduce((total, ancho) => total + ancho, 0) * progreso
  return anchos.map((ancho) => {
    const pintado = Math.max(0, Math.min(ancho, restante))
    restante -= ancho
    return pintado
  })
}

export function recorteBarrido(cajas: readonly DOMRectReadOnly[], progreso: number): string {
  const anchos = anchosPintados(
    cajas.map((caja) => caja.width),
    progreso
  )
  const origen = cajas[0]
  if (!origen) return 'inset(100%)'
  const ancla = `${origen.left}px ${origen.top}px`
  const contornos = cajas.flatMap(({ left, top, right, bottom }, i) => {
    const ancho = anchos[i]!
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
