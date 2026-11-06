import type { Estilo, Fondo } from '@shared/estilo'
import { aHex, canalesRgb, SUGERIDOS_LETRA } from './colores'

function lineal(canal: number): number {
  const s = canal / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function luminancia(hex: string): number {
  const [r, g, b] = canalesRgb(hex)
  return 0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b)
}

export function ratio(a: string, b: string): number {
  const la = luminancia(a)
  const lb = luminancia(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export function muestrasFondo(fondo: Fondo): string[] {
  if (fondo.tipo === 'solido') return [fondo.color]
  const { paradas } = fondo
  return Array.from({ length: 11 }, (_, i) => {
    const posicion = i / 10
    const siguiente = paradas.findIndex((parada) => parada.posicion > posicion)
    if (siguiente === 0) return paradas[0]!.color
    if (siguiente === -1) return paradas.at(-1)!.color
    const izquierda = paradas[siguiente - 1]!
    const derecha = paradas[siguiente]!
    const t = (posicion - izquierda.posicion) / (derecha.posicion - izquierda.posicion)
    const a = canalesRgb(izquierda.color)
    const b = canalesRgb(derecha.color)
    return aHex(a.map((canal, k) => canal + (b[k]! - canal) * t))
  })
}

function peorEnMuestras(color: string, muestras: readonly string[]): number {
  return Math.min(...muestras.map((muestra) => ratio(color, muestra)))
}

export function peorRatio(color: string, fondo: Fondo): number {
  return peorEnMuestras(color, muestrasFondo(fondo))
}

function cielab(hex: string): [number, number, number] {
  const [rojo, verde, azul] = canalesRgb(hex)
  const r = lineal(rojo)
  const g = lineal(verde)
  const b = lineal(azul)
  // sRGB lineal a XYZ con blanco de referencia D65.
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883
  const delta = 6 / 29
  const f = (v: number) => (v > delta ** 3 ? Math.cbrt(v) : v / (3 * delta ** 2) + 4 / 29)
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))]
}

export function deltaE76(a: string, b: string): number {
  const [la, aa, ba] = cielab(a)
  const [lb, ab, bb] = cielab(b)
  return Math.hypot(la - lb, aa - ab, ba - bb)
}

export interface EvaluacionContraste {
  avisos: ('letra' | 'resaltado' | 'diferencia')[]
  nivel: 'ok' | 'justo' | 'aviso'
  ratioLetra: number
  ratioResaltado: number
  deltaE: number
  accionesLetra: ('blanca' | 'negra')[]
  sugerirFondo: boolean
}

export function evaluarContraste(estilo: Estilo): EvaluacionContraste {
  const muestras = muestrasFondo(estilo.fondo)
  const { color, color_resaltado } = estilo.letra
  const ratioLetra = peorEnMuestras(color, muestras)
  const ratioResaltado = peorEnMuestras(color_resaltado, muestras)
  const deltaE = deltaE76(color, color_resaltado)
  const avisos: EvaluacionContraste['avisos'] = []
  if (ratioLetra < 3) avisos.push('letra')
  if (ratioResaltado < 3) avisos.push('resaltado')
  if (deltaE < 25) avisos.push('diferencia')
  const nivel =
    avisos.length > 0 ? 'aviso' : Math.min(ratioLetra, ratioResaltado) < 4.5 ? 'justo' : 'ok'

  let accionesLetra: EvaluacionContraste['accionesLetra'] = []
  let sugerirFondo = false
  if (ratioLetra < 3) {
    const blanca = peorEnMuestras('#FFFFFF', muestras)
    const negra = peorEnMuestras('#111111', muestras)
    sugerirFondo = Math.max(blanca, negra) < 3
    accionesLetra = blanca >= negra ? ['blanca', 'negra'] : ['negra', 'blanca']
    if (!sugerirFondo && Math.min(blanca, negra) < 3) accionesLetra.pop()
  }

  return { avisos, nivel, ratioLetra, ratioResaltado, deltaE, accionesLetra, sugerirFondo }
}

export function sugerirResaltado(estilo: Estilo): string {
  const muestras = muestrasFondo(estilo.fondo)
  const candidatos = SUGERIDOS_LETRA.map((color) => ({
    color,
    distinguible: deltaE76(color, estilo.letra.color) >= 25,
    ratio: peorEnMuestras(color, muestras)
  }))
  candidatos.sort((a, b) => Number(b.distinguible) - Number(a.distinguible) || b.ratio - a.ratio)
  return candidatos[0]!.color
}
