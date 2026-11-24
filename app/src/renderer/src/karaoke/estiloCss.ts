import type { Estilo } from '@shared/estilo'
import { colorDeParte, type Parte } from '@shared/reparto'
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

/** Parte de cada línea por id, solo en una canción con reparto (ADR 0029 §4). Sin ella todo es `c1`. */
export type PartesPorLinea = ReadonlyMap<string, Parte>

/**
 * Color del barrido, el subrayado y los indicadores de espera de una línea: el de su parte
 * (ADR 0029 §4). Sin reparto, o para el Cantante 1, es el `color_resaltado` del estilo.
 */
export function colorDeLinea(
  linea: { id: string } | null,
  estilo: Estilo,
  partes?: PartesPorLinea
): string {
  return colorDeParte(estilo, (linea && partes?.get(linea.id)) || 'c1')
}

/**
 * Color del texto entero en Letra lista (spec 07, «Reglas de color»): el de su parte con varios
 * cantantes y el del Coro en las líneas de coro; `undefined` = el de la letra.
 */
export function colorDeTextoListo(
  linea: { id: string } | null,
  estilo: Estilo,
  partes: PartesPorLinea | undefined,
  varios: boolean
): string | undefined {
  const parte = linea && partes?.get(linea.id)
  if (!parte || (!varios && parte !== 'coro')) return undefined
  return colorDeParte(estilo, parte)
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
