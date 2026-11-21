import type { Espera } from './espera'
import { finEfectivo, type ElementoLetra, type Letra } from './letra'

/**
 * Parámetros de «Ajustar los silencios» (ADR 0018 §6.1 y §6.4). Valores provisionales:
 * los definitivos salen de la calibración con canciones reales (tarea 0210).
 */
export const PARAMETROS_SILENCIOS = {
  /** Nivel de la canción: percentil del pico de bloque. */
  percentilReferencia: 0.95,
  /** Solo cuentan para el percentil los bloques por encima de este nivel. */
  pisoReferenciaDbfs: -60,
  /** Hay voz si el pico alcanza la referencia más esto (negativo, en dB). */
  umbralRelativoDb: -30,
  /** El umbral nunca baja de este nivel. */
  umbralMinimoDbfs: -60,
  /** Un silencio dura al menos esto. */
  silencioMinimoMs: 400,
  /** Ráfagas de voz más cortas se tratan como silencio (clics, restos). */
  vozMinimaMs: 50,
  /** fin = último bloque con voz + margen (cola, reverberación). */
  margenColaMs: 100
} as const

export type ParametrosSilencios = { -readonly [K in keyof typeof PARAMETROS_SILENCIOS]: number }

export interface PicosVoz {
  pasoMs: number
  /** Pares [min, max] int16 por bloque. */
  pares: Int16Array
}

export interface VozDetectada {
  /** Tiempo de audio, semiabiertos [inicioMs, finMs). */
  intervalos: [number, number][]
  referenciaDbfs: number
  umbralDbfs: number
}

const ESCALA = 32768

const aDbfs = (amplitud: number): number => 20 * Math.log10(Math.max(amplitud, 1) / ESCALA)
const aAmplitud = (dbfs: number): number => ESCALA * Math.pow(10, dbfs / 20)

/** Detecta los intervalos con voz con aritmética entera sobre los bloques. */
export function detectarVoz(
  picos: PicosVoz,
  p: ParametrosSilencios = PARAMETROS_SILENCIOS
): VozDetectada {
  const { pasoMs, pares } = picos
  const bloques = pares.length >> 1
  const amplitudes = new Int32Array(bloques)
  const piso = Math.round(aAmplitud(p.pisoReferenciaDbfs))
  const histograma = new Uint32Array(ESCALA)
  let sobrePiso = 0
  for (let i = 0; i < bloques; i++) {
    const a = Math.max(Math.abs(pares[2 * i]!), Math.abs(pares[2 * i + 1]!))
    amplitudes[i] = a
    if (a >= piso) {
      histograma[Math.min(a, ESCALA - 1)]!++
      sobrePiso++
    }
  }
  const umbralMinimo = Math.round(aAmplitud(p.umbralMinimoDbfs))
  if (sobrePiso === 0) {
    return { intervalos: [], referenciaDbfs: p.pisoReferenciaDbfs, umbralDbfs: aDbfs(umbralMinimo) }
  }

  const rango = Math.max(1, Math.ceil(p.percentilReferencia * sobrePiso))
  let acumulado = 0
  let referencia = 0
  for (let a = 0; a < ESCALA; a++) {
    acumulado += histograma[a]!
    if (acumulado >= rango) {
      referencia = a
      break
    }
  }
  const umbral = Math.max(
    Math.round(referencia * Math.pow(10, p.umbralRelativoDb / 20)),
    umbralMinimo
  )

  const minimoBloques = Math.max(1, Math.ceil(p.vozMinimaMs / pasoMs))
  const intervalos: [number, number][] = []
  let i = 0
  while (i < bloques) {
    if (amplitudes[i]! < umbral) {
      i++
      continue
    }
    let j = i
    while (j < bloques && amplitudes[j]! >= umbral) j++
    if (j - i >= minimoBloques) intervalos.push([i * pasoMs, j * pasoMs])
    i = j
  }
  return { intervalos, referenciaDbfs: aDbfs(referencia), umbralDbfs: aDbfs(umbral) }
}

export interface CambioSilencio {
  id: string
  finAntes: number | null
  finDespues: number
  eraFijado: boolean
  /** Hasta el siguiente elemento con inicio; null en la última línea. */
  huecoMs: number | null
}

export interface PropuestaSilencios {
  letra: Letra
  cambios: CambioSilencio[]
  lineasCambiadas: number
  /** Cambios sobre fines que ya estaban fijados a mano (para el aviso). */
  finesFijadosCambiados: number
  /** Huecos ≥ umbral de espera entre las líneas con un silencio detectado. */
  huecosLargos: number
  /** Ids de líneas sin voz en su ventana (no cambian). */
  sinVoz: string[]
  /** Espera con la casilla activada; null si no hay que cambiarla. */
  espera: Espera | null
}

export interface OpcionesAjuste {
  duracionMs: number
  /** Espera efectiva de la canción. */
  espera: Espera
  comodin?: 'puntos' | 'barra' | 'cuenta'
  p?: ParametrosSilencios
}

/** Fin de la voz previa al primer silencio de la ventana [a, b) (tiempo de audio), o null. */
function buscarFinVoz(
  intervalos: readonly [number, number][],
  a: number,
  b: number,
  silencioMinimoMs: number
): number | null {
  let k = intervalos.findIndex(([, fin]) => fin > a)
  if (k === -1 || intervalos[k]![0] >= b) return null
  for (; k < intervalos.length; k++) {
    const finVoz = intervalos[k]![1]
    if (finVoz >= b) return null
    const siguiente = intervalos[k + 1]
    const finSilencio = siguiente ? Math.min(siguiente[0], b) : b
    if (finSilencio - finVoz >= silencioMinimoMs) return finVoz
    if (!siguiente || siguiente[0] >= b) return null
  }
  return null
}

function hayVoz(intervalos: readonly [number, number][], a: number, b: number): boolean {
  return intervalos.some(([ini, fin]) => fin > a && ini < b)
}

/** Propone nuevos fines para las líneas sin palabras (ADR 0018 §6.1). Pura: no muta la entrada. */
export function proponerAjusteSilencios(
  letra: Letra,
  voz: Pick<VozDetectada, 'intervalos'>,
  { duracionMs, espera, comodin = 'cuenta', p = PARAMETROS_SILENCIOS }: OpcionesAjuste
): PropuestaSilencios {
  const offset = letra.offset_ms
  const lineas: ElementoLetra[] = letra.lineas.map((e) => ({ ...e }))
  const cambios: CambioSilencio[] = []
  const sinVoz: string[] = []
  let finesFijadosCambiados = 0
  let huecosLargos = 0

  lineas.forEach((el, i) => {
    if (el.tipo !== 'linea' || el.inicio_ms === null || el.palabras !== null) return
    const inicio = el.inicio_ms
    const siguiente = letra.lineas.slice(i + 1).find((e) => e.inicio_ms !== null)
    const limiteLetra = siguiente ? siguiente.inicio_ms! : duracionMs - offset

    const a = inicio + offset
    const b = limiteLetra + offset
    const finVoz = buscarFinVoz(voz.intervalos, a, b, p.silencioMinimoMs)
    if (finVoz === null) {
      if (!hayVoz(voz.intervalos, a, b)) sinVoz.push(el.id)
      return
    }
    const fin = Math.max(
      inicio + 1,
      Math.min(Math.round(finVoz + p.margenColaMs - offset), limiteLetra)
    )
    if (fin > limiteLetra) return
    const huecoMs = siguiente ? limiteLetra - fin : null
    if (huecoMs !== null && huecoMs >= espera.umbral_ms) huecosLargos++

    if (fin === finEfectivo(letra, el.id, duracionMs)) return
    const eraFijado = el.fin_ms !== null
    if (eraFijado) finesFijadosCambiados++
    cambios.push({ id: el.id, finAntes: el.fin_ms, finDespues: fin, eraFijado, huecoMs })
    el.fin_ms = fin
  })

  return {
    letra: { ...letra, lineas },
    cambios,
    lineasCambiadas: cambios.length,
    finesFijadosCambiados,
    huecosLargos,
    sinVoz,
    espera: huecosLargos > 0 && !espera[comodin] ? { ...espera, [comodin]: true } : null
  }
}
