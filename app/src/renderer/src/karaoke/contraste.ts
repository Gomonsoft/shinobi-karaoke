import { normalizarEstilo, type Estilo, type Fondo } from '@shared/estilo'
import { pasadasEfectivas, type Pantalla } from '@shared/pantalla'
import { aHex, canalesRgb, SUGERIDOS_LETRA } from './colores'
import { objetivoOpacidad } from './pantalla'

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

const MUESTRAS_POR_TRAMO = 9

function tramo(desde: string, hasta: string, ancho: number): string[] {
  if (ancho <= 0) return [desde, hasta]
  const a = canalesRgb(desde)
  const b = canalesRgb(hasta)
  return Array.from({ length: MUESTRAS_POR_TRAMO }, (_, i) => {
    const t = i / (MUESTRAS_POR_TRAMO - 1)
    return aHex(a.map((canal, k) => canal + (b[k]! - canal) * t))
  })
}

/** Colores que puede mostrar el fondo: 9 muestras por tramo entre paradas, más el cierre del cónico. */
export function muestrasFondo(fondo: Fondo): string[] {
  if (fondo.tipo === 'solido') return [fondo.color]
  const { paradas } = fondo
  const primera = paradas[0]!
  const ultima = paradas.at(-1)!
  const muestras: string[] = []
  for (let i = 1; i < paradas.length; i++) {
    const izquierda = paradas[i - 1]!
    const derecha = paradas[i]!
    muestras.push(...tramo(izquierda.color, derecha.color, derecha.posicion - izquierda.posicion))
  }
  if (fondo.forma === 'conico') muestras.push(...tramo(ultima.color, primera.color, 1))
  return [...new Set(muestras.map((color) => color.toUpperCase()))]
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

type Matriz = readonly [number, number, number, number, number, number, number, number, number]

/** Machado, Oliveira y Fernandes (2009), severidad 1,0, sobre RGB lineal (ADR 0022 §5). */
const PROTANOPIA: Matriz = [
  0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998
]
const DEUTERANOPIA: Matriz = [
  0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881
]
const UMBRAL_DALTONISMO = 25

function simular(hex: string, m: Matriz): string {
  const [r, g, b] = canalesRgb(hex).map(lineal) as [number, number, number]
  const lin = [
    m[0] * r + m[1] * g + m[2] * b,
    m[3] * r + m[4] * g + m[5] * b,
    m[6] * r + m[7] * g + m[8] * b
  ]
  const codificar = (v: number) => {
    const c = Math.min(1, Math.max(0, v))
    return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
  }
  return aHex(lin.map(codificar))
}

/** El menor ΔE76 entre dos colores tal como los ven una protanopía y una deuteranopía. */
export function deltaESimulado(a: string, b: string): number {
  return Math.min(...[PROTANOPIA, DEUTERANOPIA].map((m) => deltaE76(simular(a, m), simular(b, m))))
}

/**
 * Dos colores que se distinguen bien (ΔE ≥ 25) pero se confunden con daltonismo (el menor ΔE
 * simulado < 25). Si ya se parecen sin daltonismo no cuenta: lo dice `diferencia`.
 */
export function confusionDaltonismo(a: string, b: string): boolean {
  return deltaE76(a, b) >= UMBRAL_DALTONISMO && deltaESimulado(a, b) < UMBRAL_DALTONISMO
}

export interface EvaluacionContraste {
  avisos: ('letra' | 'resaltado' | 'diferencia' | 'daltonismo')[]
  /** Con el subrayado en el estilo, `diferencia` baja a informativo (el avance se ve por la forma). */
  informativos: 'diferencia'[]
  nivel: 'ok' | 'justo' | 'aviso'
  ratioLetra: number
  ratioResaltado: number
  deltaE: number
  accionesLetra: ('blanca' | 'negra')[]
  sugerirFondo: boolean
}

export function evaluarContraste(estilo: Estilo): EvaluacionContraste {
  const muestras = muestrasFondo(normalizarEstilo(estilo).fondo)
  const { color, color_resaltado } = estilo.letra
  const ratioLetra = peorEnMuestras(color, muestras)
  const ratioResaltado = peorEnMuestras(color_resaltado, muestras)
  const deltaE = deltaE76(color, color_resaltado)
  const avisos: EvaluacionContraste['avisos'] = []
  if (ratioLetra < 3) avisos.push('letra')
  if (ratioResaltado < 3) avisos.push('resaltado')
  const informativos: EvaluacionContraste['informativos'] = []
  const subrayado = !!estilo.letra.subrayar_cantado
  if (deltaE < 25) (subrayado ? informativos : avisos).push('diferencia')
  else if (!subrayado && confusionDaltonismo(color, color_resaltado)) avisos.push('daltonismo')
  const nivel =
    avisos.length > 0
      ? 'aviso'
      : informativos.length > 0 || Math.min(ratioLetra, ratioResaltado) < 4.5
        ? 'justo'
        : 'ok'

  let accionesLetra: EvaluacionContraste['accionesLetra'] = []
  let sugerirFondo = false
  if (ratioLetra < 3) {
    const blanca = peorEnMuestras('#FFFFFF', muestras)
    const negra = peorEnMuestras('#111111', muestras)
    sugerirFondo = Math.max(blanca, negra) < 3
    accionesLetra = blanca >= negra ? ['blanca', 'negra'] : ['negra', 'blanca']
    if (!sugerirFondo && Math.min(blanca, negra) < 3) accionesLetra.pop()
  }

  return {
    avisos,
    informativos,
    nivel,
    ratioLetra,
    ratioResaltado,
    deltaE,
    accionesLetra,
    sugerirFondo
  }
}

export function sugerirResaltado(estilo: Estilo): string {
  const muestras = muestrasFondo(normalizarEstilo(estilo).fondo)
  const candidatos = SUGERIDOS_LETRA.map((color) => ({
    color,
    distinguible: deltaE76(color, estilo.letra.color) >= 25,
    // Se prefieren los que tampoco se confunden con daltonismo (spec 06 · Feature 2).
    claro: deltaESimulado(color, estilo.letra.color) >= UMBRAL_DALTONISMO,
    ratio: peorEnMuestras(color, muestras)
  }))
  candidatos.sort(
    (a, b) =>
      Number(b.distinguible) - Number(a.distinguible) ||
      Number(b.distinguible && b.claro) - Number(a.distinguible && a.claro) ||
      b.ratio - a.ratio
  )
  return candidatos[0]!.color
}

/** Gris neutro con la misma luminancia relativa WCAG que `hex` (inversa de la curva sRGB; ADR 0022 §4). */
export function grisDeLetra(hex: string): string {
  const y = luminancia(hex)
  const codificado = y <= 0.0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - 0.055
  const canal = Math.min(255, Math.max(0, Math.round(codificado * 255)))
  return aHex([canal, canal, canal])
}

/** Opacidad mínima por puesto atenuado que da 3:1 contra cada muestra del fondo (puesto -> α, paso 0,01). */
export type SuelosOpacidad = Record<number, number>

function componer(color: string, alfa: number, fondo: string): string {
  const c = canalesRgb(color)
  const b = canalesRgb(fondo)
  return aHex(c.map((canal, i) => alfa * canal + (1 - alfa) * b[i]!))
}

function suelo(color: string, muestras: readonly string[]): number {
  for (let centesimas = 1; centesimas <= 100; centesimas++) {
    const alfa = centesimas / 100
    if (muestras.every((muestra) => ratio(componer(color, alfa, muestra), muestra) >= 3))
      return alfa
  }
  return 1
}

/**
 * Se calcula una vez por estilo resuelto, nunca por fotograma. `colorLetra` es el color con el que
 * se pintan las líneas (en 0.2.2, `estilo.letra.color`); es un parámetro para que 0.2.3 pueda pasar
 * el de una parte. Las ya cantadas usan el gris de ese color.
 */
export function suelosDeOpacidad(
  estilo: Estilo,
  pantalla: Pantalla,
  colorLetra: string = estilo.letra.color
): SuelosOpacidad {
  const muestras = muestrasFondo(normalizarEstilo(estilo).fondo)
  const pasadas = pasadasEfectivas(pantalla)
  const futuras = pantalla.lineas - 1 - pasadas
  const gris = grisDeLetra(colorLetra)
  const suelos: SuelosOpacidad = {}
  for (let puesto = -pasadas; puesto <= futuras; puesto++) {
    if (objetivoOpacidad(puesto, pasadas, futuras) >= 1) continue
    suelos[puesto] = suelo(puesto < 0 ? gris : colorLetra, muestras)
  }
  return suelos
}
