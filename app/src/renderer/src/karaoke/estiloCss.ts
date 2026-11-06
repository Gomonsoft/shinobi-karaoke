import type { Estilo } from '@shared/estilo'
import { buscarFuente, FUENTE_PREDETERMINADA } from '@shared/fuentes'

/** Valor CSS de `background` para el fondo de un estilo de karaoke (sólido o degradado). */
export function fondoCss(fondo: Estilo['fondo']): string {
  if (fondo.tipo === 'solido') return fondo.color
  const paradas = fondo.paradas
    .map((p) => `${p.color} ${Math.round(p.posicion * 1000) / 10}%`)
    .join(', ')
  return `linear-gradient(${fondo.angulo_grados}deg, ${paradas})`
}

export function variablesEstilo(estilo: Estilo): Record<string, string> {
  const fuente = buscarFuente(estilo.letra.fuente.familia) ?? buscarFuente(FUENTE_PREDETERMINADA)!
  return {
    '--k-color': estilo.letra.color,
    '--k-resaltado': estilo.letra.color_resaltado,
    '--k-fuente': `"${fuente.familia}"`,
    '--k-peso': String(fuente.peso),
    '--k-fondo': fondoCss(estilo.fondo)
  }
}
