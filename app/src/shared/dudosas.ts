import { finEfectivo, type Letra } from './letra'
import type { VozDetectada } from './silencios'

/**
 * Líneas dudosas (ADR 0024 §3, feature 11): función pura que dice qué líneas conviene escuchar. Mira los
 * tiempos de la letra, los intervalos de voz (`detectarVoz`, si hay) y lo que dejó anotado la sincronía
 * automática. Las líneas dadas por buenas (`revisada` vigente) no se señalan.
 */
export const PARAMETROS_DUDOSAS = {
  // Provisionales (calibración de 2026-11-21).
  /** `vozTarde`: sin voz en [inicio, inicio + 500 ms) aunque la haya más adelante en la línea. */
  inicioVentanaMs: 500,
  /** `finCorta`: ≥ 90 % de voz en [fin, fin + 1000 ms) y la siguiente línea empieza ≥ 1 s después. */
  finVozMs: 1000,
  finVozFraccion: 0.9,
  /** `finTarde`: la última voz dentro de la línea acaba más de 1,2 s antes del fin. */
  finTardioMs: 1200,
  /** `sinVoz`: menos del 10 % de la línea con voz. */
  vozMinimaLinea: 0.1,
  /** `muyCorta`: dura menos de 250 ms. */
  duracionMinimaMs: 250,
  /** `muyCorta` por ritmo: más de 25 caracteres por segundo. `muyLarga`: menos de 2 en más de 6 s. */
  cpsMax: 25,
  cpsMin: 2,
  lentaMinMs: 6000,
  /** `reconocimiento`: confianza de la alineación forzada por debajo de esto (feature 10). */
  confianzaMinima: 0.5
} as const

export type ParametrosDudosas = { -readonly [K in keyof typeof PARAMETROS_DUDOSAS]: number }

/** En orden de prioridad (el primero es el principal). */
export const MOTIVOS_DUDOSA = [
  'sinInicio',
  'sinVoz',
  'reconocimiento',
  'vozTarde',
  'finCorta',
  'finTarde',
  'muyCorta',
  'muyLarga'
] as const
export type MotivoDudosa = (typeof MOTIVOS_DUDOSA)[number]

export interface LineaDudosa {
  id: string
  motivos: MotivoDudosa[]
  /** Cifra del motivo principal en ms (lo que sigue la voz, cuánto tarda…); ausente si no tiene. */
  detalleMs?: number
  /** Cifra de cada motivo que la tiene, para el texto de los motivos secundarios. */
  detalles: Partial<Record<MotivoDudosa, number>>
  /** `finTarde` con el fin automático (no fijado): el texto lo dice. */
  finAutomatico: boolean
  /** Número de motivos. */
  prioridad: number
}

export interface OpcionesDudosas {
  duracionMs: number
  p?: ParametrosDudosas
}

type Intervalos = readonly (readonly [number, number])[]

/** Milisegundos con voz dentro de [a, b). */
function vozEn(intervalos: Intervalos, a: number, b: number): number {
  let total = 0
  for (const [ini, fin] of intervalos) {
    if (ini >= b) break
    if (fin > a) total += Math.min(fin, b) - Math.max(ini, a)
  }
  return total
}

/** ¿Sigue vigente la marca «está bien» de la línea? (misma regla que la escritura de main, ADR 0024 §4). */
export function revisadaVigente(letra: Pick<Letra, 'lineas'>, id: string, duracionMs: number) {
  const el = letra.lineas.find((l) => l.id === id)
  const r = el?.revisada
  if (!el || !r || el.tipo !== 'linea') return false
  return (
    el.inicio_ms === r.inicio_ms &&
    finEfectivo(letra, id, duracionMs) === r.fin_ms &&
    el.texto === r.texto
  )
}

/**
 * Líneas dudosas pendientes, en orden de letra. Sin picos (`voz = null`) solo se aplican `sinInicio`,
 * `reconocimiento`, `muyCorta` y `muyLarga`.
 */
export function detectarDudosas(
  letra: Pick<Letra, 'lineas' | 'offset_ms'>,
  voz: Pick<VozDetectada, 'intervalos'> | null,
  { duracionMs, p = PARAMETROS_DUDOSAS }: OpcionesDudosas
): LineaDudosa[] {
  const resultado: LineaDudosa[] = []
  const offset = letra.offset_ms
  const lineas = letra.lineas
  const intervalos = voz?.intervalos ?? []

  lineas.forEach((el, i) => {
    if (el.tipo !== 'linea') return
    const detalles: Partial<Record<MotivoDudosa, number>> = {}
    const motivos = new Set<MotivoDudosa>()
    const marcar = (m: MotivoDudosa, ms?: number): void => {
      motivos.add(m)
      if (ms !== undefined) detalles[m] = ms
    }
    let finAutomatico = false

    if (el.inicio_ms === null) {
      marcar('sinInicio')
    } else {
      if (revisadaVigente(letra, el.id, duracionMs)) return
      const fin = finEfectivo(letra, el.id, duracionMs)
      if (fin === null) return
      finAutomatico = el.fin_ms === null
      const a = el.inicio_ms + offset
      const b = fin + offset
      const duracion = b - a
      const siguiente = lineas.slice(i + 1).find((e) => e.inicio_ms !== null)
      const limite = siguiente ? siguiente.inicio_ms! + offset : duracionMs

      if (el.alineacion && el.alineacion.confianza < p.confianzaMinima) marcar('reconocimiento')

      if (voz !== null && duracion > 0) {
        const conVoz = vozEn(intervalos, a, b)
        if (conVoz < duracion * p.vozMinimaLinea) {
          marcar('sinVoz')
        } else {
          // Primer momento con voz dentro de la línea.
          const primera = intervalos.find(([, f]) => f > a)
          const arranque = primera ? Math.max(primera[0], a) : a
          if (vozEn(intervalos, a, Math.min(b, a + p.inicioVentanaMs)) === 0) {
            marcar('vozTarde', arranque - a)
          }
          // La voz sigue después del fin y la siguiente línea tarda en empezar.
          if (
            limite - b >= p.finVozMs &&
            vozEn(intervalos, b, b + p.finVozMs) >= p.finVozMs * p.finVozFraccion
          ) {
            const actual = intervalos.find(([ini, f]) => f > b && ini < b + p.finVozMs)
            marcar('finCorta', actual ? Math.min(actual[1], limite) - b : p.finVozMs)
          }
          // La voz acaba mucho antes del fin.
          let ultima = a
          for (const [ini, f] of intervalos) {
            if (ini >= b) break
            if (f > a) ultima = Math.min(f, b)
          }
          if (b - ultima > p.finTardioMs) marcar('finTarde', b - ultima)
        }
      }

      const caracteres = el.texto.trim().length
      const cps = duracion > 0 ? caracteres / (duracion / 1000) : Infinity
      if (duracion < p.duracionMinimaMs || cps > p.cpsMax) marcar('muyCorta', duracion)
      else if (duracion > p.lentaMinMs && cps < p.cpsMin) marcar('muyLarga', duracion)
    }

    if (motivos.size === 0) return
    const ordenados = MOTIVOS_DUDOSA.filter((m) => motivos.has(m))
    const principal = ordenados[0]!
    const linea: LineaDudosa = {
      id: el.id,
      motivos: ordenados,
      detalles,
      finAutomatico,
      prioridad: ordenados.length
    }
    if (detalles[principal] !== undefined) linea.detalleMs = detalles[principal]
    resultado.push(linea)
  })
  return resultado
}

/** Cuántas líneas están dadas por buenas y siguen vigentes (para el resumen de la sección). */
export function contarRevisadas(letra: Pick<Letra, 'lineas'>, duracionMs: number): number {
  return letra.lineas.filter((l) => revisadaVigente(letra, l.id, duracionMs)).length
}

/**
 * Líneas importantes para «Marcar como lista» (spec 06 · F11-E12): las que tienen `sinVoz`, `vozTarde`,
 * `reconocimiento`, o `finCorta` / `finTarde` con el fin fijado (`fin_ms` no nulo). Los motivos de fin
 * con fin automático, `muyCorta` y `muyLarga` no cuentan; `sinInicio` ya lo avisa el popover de lo que falta.
 */
export function esImportante(d: Pick<LineaDudosa, 'motivos' | 'finAutomatico'>): boolean {
  return d.motivos.some(
    (m) =>
      m === 'sinVoz' ||
      m === 'vozTarde' ||
      m === 'reconocimiento' ||
      ((m === 'finCorta' || m === 'finTarde') && !d.finAutomatico)
  )
}

export function contarImportantes(dudosas: readonly LineaDudosa[]): number {
  return dudosas.filter(esImportante).length
}
