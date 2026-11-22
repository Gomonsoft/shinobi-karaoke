import { finEfectivo, type Letra } from './letra'
import { detectarVoz, type PicosVoz, type VozDetectada } from './silencios'

/**
 * Encaje de la letra con la voz (ADR 0024 §1): función pura y determinista. Compara los tiempos de las
 * líneas con los intervalos de voz (`detectarVoz`) y busca el desfase global que mejor los alinea.
 */
export const PARAMETROS_ENCAJE = {
  // Provisionales (calibración de 2026-11-21).
  desfaseMaxMs: 5000,
  pasoMs: 20,
  ventanaInicioMs: 400,
  vozMinimaInicio: 0.25,
  coincideF: 0.88,
  coincideI: 0.95,
  noCoincideF: 0.85,
  noCoincideI: 0.9,
  desfaseMinimoMs: 500,
  gananciaMinimaF: 0.02
} as const

export type ParametrosEncaje = { -readonly [K in keyof typeof PARAMETROS_ENCAJE]: number }

export const VEREDICTOS_ENCAJE = [
  'coincide',
  'desfasada',
  'dudosa',
  'no_coincide',
  'no_comprobable'
] as const
export type VeredictoEncaje = (typeof VEREDICTOS_ENCAJE)[number]

export interface ResultadoEncaje {
  veredicto: VeredictoEncaje
  /** d*: solo con `desfasada` es una corrección propuesta. */
  desfaseMs: number
  f0: number
  i0: number
  fDesfase: number
  iDesfase: number
  lineasEvaluadas: number
  /** Ids con menos del 10 % de voz en su intervalo (con el desfase que se aplicaría). */
  lineasSinVoz: string[]
  /** Voz de 2 s o más seguidos fuera de toda línea (tiempo de audio). */
  tramosVozSinLetra: [number, number][]
  desfaseVariable: boolean
}

export interface OpcionesEncaje {
  duracionMs: number
  p?: ParametrosEncaje
}

/** Mínimo de líneas con inicio para poder comprobar (ADR 0024 §1). */
export const MIN_LINEAS_ENCAJE = 5
const BLOQUE_MS = 10
const SIN_VOZ_FRACCION = 0.1
const TRAMO_SIN_LETRA_MS = 2000
export const OFFSET_MAXIMO_ENCAJE_MS = 30_000

interface Tramo {
  id: string
  a: number
  b: number
}

const nulo = (): ResultadoEncaje => ({
  veredicto: 'no_comprobable',
  desfaseMs: 0,
  f0: 0,
  i0: 0,
  fDesfase: 0,
  iDesfase: 0,
  lineasEvaluadas: 0,
  lineasSinVoz: [],
  tramosVozSinLetra: [],
  desfaseVariable: false
})

/** Tramos [inicio, fin) de las líneas con inicio en tiempo de audio, sin solaparse entre sí. */
function tramosDe(letra: Pick<Letra, 'lineas' | 'offset_ms'>, duracionMs: number): Tramo[] {
  const tramos: Tramo[] = []
  for (const el of letra.lineas) {
    if (el.tipo !== 'linea' || el.inicio_ms === null) continue
    const fin = finEfectivo(letra, el.id, duracionMs)
    if (fin === null) continue
    tramos.push({ id: el.id, a: el.inicio_ms + letra.offset_ms, b: fin + letra.offset_ms })
  }
  tramos.sort((x, y) => x.a - y.a)
  for (let i = 0; i + 1 < tramos.length; i++) {
    tramos[i]!.b = Math.min(tramos[i]!.b, tramos[i + 1]!.a)
  }
  return tramos.filter((t) => t.b > t.a)
}

const redondear = (x: number): number => Math.round(x * 1e6) / 1e6

function veredictoDe(f: number, i: number, p: ParametrosEncaje): VeredictoEncaje {
  if (f >= p.coincideF && i >= p.coincideI) return 'coincide'
  if (f < p.noCoincideF || i < p.noCoincideI) return 'no_coincide'
  return 'dudosa'
}

export function evaluarEncaje(
  letra: Pick<Letra, 'lineas' | 'offset_ms'>,
  voz: Pick<VozDetectada, 'intervalos'>,
  { duracionMs, p = PARAMETROS_ENCAJE }: OpcionesEncaje
): ResultadoEncaje {
  const tramos = tramosDe(letra, duracionMs)
  const bloques = Math.ceil(duracionMs / BLOQUE_MS)
  if (tramos.length < MIN_LINEAS_ENCAJE || bloques < 1 || voz.intervalos.length === 0) {
    return { ...nulo(), lineasEvaluadas: tramos.length }
  }

  // Sumas prefijas de bloques con voz: s[k] = bloques con voz entre 0 y k.
  const suma = new Int32Array(bloques + 1)
  for (const [a, b] of voz.intervalos) {
    const desde = Math.max(0, Math.floor(a / BLOQUE_MS))
    const hasta = Math.min(bloques, Math.ceil(b / BLOQUE_MS))
    for (let k = desde; k < hasta; k++) suma[k + 1] = 1
  }
  for (let k = 0; k < bloques; k++) suma[k + 1]! += suma[k]!
  // Bloques con voz en [a, b) de tiempo (ms), recortado al audio.
  const vozEn = (a: number, b: number): number => {
    const x = Math.min(bloques, Math.max(0, Math.round(a / BLOQUE_MS)))
    const y = Math.min(bloques, Math.max(0, Math.round(b / BLOQUE_MS)))
    return y > x ? suma[y]! - suma[x]! : 0
  }

  /** F(d) e I(d) con las líneas `lineas` y la voz restringida a la ventana [va, vb). */
  const medir = (lineas: Tramo[], d: number, va: number, vb: number): [number, number] => {
    let cubiertos = 0
    let aciertos = 0
    let conVoz = 0
    for (const t of lineas) {
      const a = Math.max(va, t.a + d)
      const b = Math.min(vb, t.b + d)
      if (b > a) {
        cubiertos += Math.round((b - a) / BLOQUE_MS)
        aciertos += vozEn(a, b)
      }
      const ini = t.a + d
      if (vozEn(ini, ini + p.ventanaInicioMs) > (p.ventanaInicioMs / BLOQUE_MS) * p.vozMinimaInicio)
        conVoz++
    }
    const total = vozEn(va, vb)
    if (cubiertos === 0 || total === 0 || aciertos === 0) return [0, conVoz / lineas.length]
    const precision = aciertos / cubiertos
    const exhaustividad = aciertos / total
    return [(2 * precision * exhaustividad) / (precision + exhaustividad), conVoz / lineas.length]
  }

  // Rango de desfases: nunca saca una línea del audio.
  const minimo = Math.max(-p.desfaseMaxMs, -tramos[0]!.a)
  const maximo = Math.min(p.desfaseMaxMs, duracionMs - 1 - tramos[tramos.length - 1]!.a)
  const desfases: number[] = [0]
  for (let d = Math.ceil(minimo / p.pasoMs) * p.pasoMs; d <= maximo; d += p.pasoMs) {
    if (d !== 0) desfases.push(d)
  }
  const mejor = (lineas: Tramo[], va: number, vb: number): number => {
    let dMejor = 0
    let fMejor = -1
    for (const d of desfases) {
      const [f] = medir(lineas, d, va, vb)
      // Empate: el desfase más pequeño (determinista).
      if (f > fMejor + 1e-12 || (Math.abs(f - fMejor) <= 1e-12 && Math.abs(d) < Math.abs(dMejor))) {
        fMejor = f
        dMejor = d
      }
    }
    return dMejor
  }

  const total = bloques * BLOQUE_MS
  const [f0, i0] = medir(tramos, 0, 0, total)
  const dMejor = mejor(tramos, 0, total)
  const [fMejor, iMejor] = medir(tramos, dMejor, 0, total)

  const mitad = Math.floor(tramos.length / 2)
  const corte = tramos[mitad]!.a
  const d1 = mejor(tramos.slice(0, mitad), 0, corte)
  const d2 = mejor(tramos.slice(mitad), corte, total)
  const desfaseVariable = Math.abs(d1 - d2) > p.desfaseMinimoMs

  const vMejor = veredictoDe(fMejor, iMejor, p)
  const v0 = veredictoDe(f0, i0, p)
  let veredicto: VeredictoEncaje
  if (Math.abs(dMejor) < p.desfaseMinimoMs) {
    veredicto = vMejor
  } else if (vMejor === 'coincide') {
    if (desfaseVariable) veredicto = 'no_coincide'
    else if (fMejor - f0 >= p.gananciaMinimaF && iMejor >= i0) veredicto = 'desfasada'
    else veredicto = v0
  } else {
    veredicto = v0 === 'coincide' ? v0 : vMejor
  }

  // Lo que se muestra va con el desfase que se aplicaría.
  const d = veredicto === 'desfasada' ? dMejor : 0
  const lineasSinVoz = tramos
    .filter((t) => vozEn(t.a + d, t.b + d) < (t.b - t.a) * (SIN_VOZ_FRACCION / BLOQUE_MS))
    .map((t) => t.id)
  const tramosVozSinLetra: [number, number][] = []
  for (const [va, vb] of voz.intervalos) {
    let cursor = va
    const cierra = (hasta: number): void => {
      if (hasta - cursor >= TRAMO_SIN_LETRA_MS) tramosVozSinLetra.push([cursor, hasta])
    }
    for (const t of tramos) {
      const a = t.a + d
      const b = t.b + d
      if (b <= cursor) continue
      if (a >= vb) break
      cierra(Math.min(a, vb))
      cursor = Math.max(cursor, b)
      if (cursor >= vb) break
    }
    if (cursor < vb) cierra(vb)
  }

  return {
    veredicto,
    desfaseMs: dMejor,
    f0: redondear(f0),
    i0: redondear(i0),
    fDesfase: redondear(fMejor),
    iDesfase: redondear(iMejor),
    lineasEvaluadas: tramos.length,
    lineasSinVoz,
    tramosVozSinLetra,
    desfaseVariable
  }
}

/** Atajo para quien parte de los picos (main). */
export function evaluarEncajeConPicos(
  letra: Pick<Letra, 'lineas' | 'offset_ms'>,
  picos: PicosVoz,
  opciones: OpcionesEncaje
): ResultadoEncaje {
  return evaluarEncaje(letra, detectarVoz(picos), opciones)
}

// --- Corrección y «Quitar la corrección» (ADR 0024 §1, opción 2A) ---------------------------------

export interface CorreccionDesfase {
  offset_ms: number
  /** Total corregido (suma de las correcciones); ausente si no queda ninguna. */
  desfase_corregido_ms?: number
}

const limitar = (ms: number): number =>
  Math.max(-OFFSET_MAXIMO_ENCAJE_MS, Math.min(OFFSET_MAXIMO_ENCAJE_MS, ms))
const aDiezMs = (ms: number): number => Math.round(ms / 10) * 10
const conDesfase = (offset_ms: number, total: number): CorreccionDesfase =>
  total === 0 ? { offset_ms } : { offset_ms, desfase_corregido_ms: total }

/** `offset_ms ← offset_ms + d`, a 10 ms y dentro de ±30 s; anota lo realmente aplicado. */
export function corregirDesfase(
  letra: Pick<Letra, 'offset_ms' | 'desfase_corregido_ms'>,
  desfaseMs: number
): CorreccionDesfase {
  const offset = limitar(aDiezMs(letra.offset_ms + desfaseMs))
  const aplicado = offset - letra.offset_ms
  return conDesfase(offset, (letra.desfase_corregido_ms ?? 0) + aplicado)
}

/** «Quitar la corrección»: `offset_ms −= desfase_corregido_ms` y se borra el campo. */
export function quitarCorreccion(
  letra: Pick<Letra, 'offset_ms' | 'desfase_corregido_ms'>
): CorreccionDesfase {
  return { offset_ms: limitar(letra.offset_ms - (letra.desfase_corregido_ms ?? 0)) }
}
