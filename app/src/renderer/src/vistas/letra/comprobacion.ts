import { finEfectivo, type Letra } from '@shared/letra'
import type { ResultadoEncaje, VeredictoEncaje } from '@shared/encaje'
import type { EstadoPicos } from '@shared/ipc'
import type { CandidatoLetra } from '@shared/letrasBusqueda'
import { CC } from './textosComprobacion'

/** Lo que se ve de la comprobación de una letra, ya resuelto contra el estado de los picos. */
export type Comprobacion =
  | { tipo: 'ninguna' }
  | { tipo: 'comprobando' }
  | { tipo: 'pendiente' }
  | { tipo: 'noDisponible' }
  | { tipo: 'coincide' }
  | { tipo: 'desfasada'; desfaseMs: number }
  | { tipo: 'dudosa' }
  | { tipo: 'noCoincide' }

/** Veredicto → comprobación; `no_comprobable` (menos de 5 líneas con inicio) no muestra nada. */
export function deVeredicto(veredicto: VeredictoEncaje, desfaseMs: number): Comprobacion {
  switch (veredicto) {
    case 'coincide':
      return { tipo: 'coincide' }
    case 'desfasada':
      return { tipo: 'desfasada', desfaseMs }
    case 'dudosa':
      return { tipo: 'dudosa' }
    case 'no_coincide':
      return { tipo: 'noCoincide' }
    case 'no_comprobable':
      return { tipo: 'ninguna' }
  }
}

/** Con picos que no están listos: pendiente de la separación, preparándose o error (spec 05, estados). */
export function sinPicos(
  picos: EstadoPicos['estado'] | null,
  separada: boolean
): Comprobacion | null {
  if (picos === 'lista') return null
  if (picos === null) return { tipo: 'comprobando' }
  if (picos === 'generando') return { tipo: 'pendiente' }
  if (picos === 'error') return { tipo: 'noDisponible' }
  return separada ? { tipo: 'noDisponible' } : { tipo: 'pendiente' }
}

/** Comprobación de un candidato: `encaje` ausente = sin picos al buscar; `null` = no comprobable. */
export function comprobacionDe(
  c: CandidatoLetra,
  picos: EstadoPicos['estado'] | null,
  separada: boolean
): Comprobacion {
  if (c.sincronia === 'texto') return { tipo: 'ninguna' }
  if (c.encaje) return deVeredicto(c.encaje.veredicto, c.encaje.desfaseMs)
  if (c.encaje === null) return { tipo: 'ninguna' }
  return sinPicos(picos, separada) ?? { tipo: 'comprobando' }
}

/** `coincide`, `desfasada` y `noCoincide` sustituyen a la línea de duración. */
export const esConcluyente = (c: Comprobacion): boolean =>
  c.tipo === 'coincide' || c.tipo === 'desfasada' || c.tipo === 'noCoincide'

export function textoComprobacion(
  c: Comprobacion,
  segundos: (ms: number) => string
): string | null {
  switch (c.tipo) {
    case 'ninguna':
      return null
    case 'comprobando':
      return CC.comprobando
    case 'pendiente':
      return CC.pendiente
    case 'noDisponible':
      return CC.noDisponible
    case 'coincide':
      return CC.coincide
    case 'dudosa':
      return CC.dudosa
    case 'noCoincide':
      return CC.noCoincide
    case 'desfasada':
      return c.desfaseMs > 0
        ? CC.adelantada(segundos(c.desfaseMs))
        : CC.atrasada(segundos(c.desfaseMs))
  }
}

/** Orden de los cuatro grupos de la spec: coincide/desfasada · con tiempos dudosos o sin comprobar · solo texto · no coincide. */
export function grupoDeOrden(c: CandidatoLetra): number {
  if (c.sincronia === 'texto') return 2
  const v = c.encaje?.veredicto
  if (v === 'coincide' || v === 'desfasada') return 0
  return v === 'no_coincide' ? 3 : 1
}

/** Posición (0-based) del candidato que mejor coincide: el primero del grupo 0 en la lista actual. */
export function indiceDelMejor(candidatos: readonly CandidatoLetra[]): number {
  return candidatos.findIndex((c) => grupoDeOrden(c) === 0)
}

export interface TramoEncaje {
  desdeMs: number
  hastaMs: number
  /** Primera línea del tramo (solo en los tramos de líneas sobre silencio). */
  lineaId?: string
}

export interface DetalleNoCoincide {
  /** Tramos de líneas que caen donde no hay voz, en tiempo de audio. */
  silencio: TramoEncaje[]
  lineasSinVoz: number
  totalLineas: number
  vozSinLetra: TramoEncaje[]
  variable: boolean
}

/** Los motivos de un `no_coincide` (spec 05, `let.comp.detalle.*`): sale de `evaluarEncaje`. */
export function detalleNoCoincide(
  letra: Pick<Letra, 'lineas' | 'offset_ms'>,
  encaje: ResultadoEncaje,
  duracionMs: number
): DetalleNoCoincide {
  const sinVoz = new Set(encaje.lineasSinVoz)
  const silencio: TramoEncaje[] = []
  let abierto: TramoEncaje | null = null
  for (const l of letra.lineas) {
    if (l.tipo !== 'linea' || l.inicio_ms === null) continue
    if (!sinVoz.has(l.id)) {
      abierto = null
      continue
    }
    const desde = l.inicio_ms + letra.offset_ms
    const fin = finEfectivo(letra as Letra, l.id, duracionMs)
    const hasta = (fin ?? l.inicio_ms) + letra.offset_ms
    if (abierto) abierto.hastaMs = Math.max(abierto.hastaMs, hasta)
    else {
      abierto = { desdeMs: desde, hastaMs: hasta, lineaId: l.id }
      silencio.push(abierto)
    }
  }
  return {
    silencio,
    lineasSinVoz: encaje.lineasSinVoz.length,
    totalLineas: encaje.lineasEvaluadas,
    vozSinLetra: encaje.tramosVozSinLetra.map(([desdeMs, hastaMs]) => ({ desdeMs, hastaMs })),
    variable: encaje.desfaseVariable
  }
}

/** Hasta tres motivos en texto (spec 05, bloque de la vista previa de un `no_coincide`). */
export function motivosNoCoincide(d: DetalleNoCoincide): string[] {
  const motivos: string[] = []
  if (d.lineasSinVoz > 0)
    motivos.push(
      CC.detalle.silencio(
        d.lineasSinVoz,
        d.totalLineas,
        d.silencio.map((t) => [t.desdeMs, t.hastaMs])
      )
    )
  if (d.vozSinLetra.length > 0)
    motivos.push(CC.detalle.vozSinLetra(d.vozSinLetra.map((t) => [t.desdeMs, t.hastaMs])))
  if (d.variable) motivos.push(CC.detalle.variable)
  return motivos.slice(0, 3)
}
