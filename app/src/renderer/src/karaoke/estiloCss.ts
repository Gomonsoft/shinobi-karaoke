import type { Estilo } from '@shared/estilo'

/** Valor CSS de `background` para el fondo de un estilo de karaoke (sólido o degradado). */
export function fondoCss(fondo: Estilo['fondo']): string {
  if (fondo.tipo === 'solido') return fondo.color
  const paradas = fondo.paradas
    .map((p) => `${p.color} ${Math.round(p.posicion * 1000) / 10}%`)
    .join(', ')
  return `linear-gradient(${fondo.angulo_grados}deg, ${paradas})`
}
