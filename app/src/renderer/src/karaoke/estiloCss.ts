import type { Estilo } from '@shared/estilo'
import { buscarFuente, FUENTE_PREDETERMINADA } from '@shared/fuentes'

import { grisDeLetra } from './contraste'
import { geometriaFondoEn, type GeometriaFondo } from './fondo'

const pct = (n: number): number => Math.round(n * 1000) / 10

/**
 * Valor CSS de `background` para el fondo de un estilo (sólido o degradado). Sin `geometria`
 * usa la fase 0 (la configurada).
 */
export function fondoCss(fondo: Estilo['fondo'], geometria?: GeometriaFondo): string {
  if (fondo.tipo === 'solido') return fondo.color
  const g = geometria ?? geometriaFondoEn(fondo, 0, { estatico: true })
  const paradas = fondo.paradas.map((p) => `${p.color} ${pct(p.posicion)}%`).join(', ')
  const en = `${pct(g.centro.x)}% ${pct(g.centro.y)}%`
  switch (fondo.forma ?? 'lineal') {
    case 'radial':
      return `radial-gradient(circle farthest-corner at ${en}, ${paradas})`
    case 'conico':
      return `conic-gradient(from ${g.anguloGrados}deg at ${en}, ${paradas}, ${fondo.paradas[0]!.color} 100%)`
    default:
      return `linear-gradient(${g.anguloGrados}deg, ${paradas})`
  }
}

/** Fondo CSS en el instante `tAudioMs`, para el pintado por fotograma y la exportación. */
export function fondoCssEn(
  fondo: Estilo['fondo'],
  tAudioMs: number,
  opciones: { estatico?: boolean } = {}
): string {
  return fondoCss(fondo, geometriaFondoEn(fondo, tAudioMs, opciones))
}

/**
 * Color del barrido de una línea (preparación 0.2.3: por parte). En 0.2.2 es siempre el
 * `color_resaltado` del estilo; la línea se pasa ya para que el cambio no toque a los llamadores.
 */
export function colorDeLinea(_linea: { id: string } | null, estilo: Estilo): string {
  return estilo.letra.color_resaltado
}

export function variablesEstilo(estilo: Estilo): Record<string, string> {
  const fuente = buscarFuente(estilo.letra.fuente.familia) ?? buscarFuente(FUENTE_PREDETERMINADA)!
  return {
    '--k-color': estilo.letra.color,
    '--k-resaltado': estilo.letra.color_resaltado,
    '--k-color-gris': grisDeLetra(estilo.letra.color),
    '--k-fuente': `"${fuente.familia}"`,
    '--k-peso': String(fuente.peso),
    '--k-fondo': fondoCss(estilo.fondo)
  }
}
