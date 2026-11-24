import { detectarDudosas, type LineaDudosa, type OpcionesDudosas } from './dudosas'
import {
  evaluarEncaje,
  evaluarEncajeConPicos,
  type OpcionesEncaje,
  type ResultadoEncaje
} from './encaje'
import { finEfectivo, type ElementoLetra, type Letra } from './letra'
import {
  proponerAjusteSilencios,
  type OpcionesAjuste,
  type PicosVoz,
  type PropuestaSilencios,
  type VozDetectada
} from './silencios'

/*
 * Voces a la vez (ADR 0029 §7, tareas 0357 y 0358; preguntas 0367 y 0366). Una sola vista de «qué líneas se
 * pisan» y adaptadores finos alrededor de las funciones de 0.2.2, sin cambiar su código: la voz separada
 * mezcla a todos los cantantes, así que con líneas solapadas ni los silencios ni las dudosas ni el encaje
 * pueden mirarlas una a una. Una letra sin solapes (todas las de una sola parte, y las de varias partes que
 * no se pisan) no cambia nada: los adaptadores devuelven lo mismo que la función original.
 */

type LetraConPartes = Pick<Letra, 'lineas' | 'offset_ms'> & Partial<Pick<Letra, 'partes'>>

export interface Tramo {
  id: string
  /** Inicio y fin efectivo, en tiempo de letra. */
  a: number
  b: number
}

/** Tramos [inicio, fin efectivo) de las líneas con inicio, en el orden de la letra. */
export function tramosDeLetra(letra: LetraConPartes, duracionMs: number): Tramo[] {
  const salida: Tramo[] = []
  for (const e of letra.lineas) {
    if (e.tipo !== 'linea' || e.inicio_ms === null) continue
    const b = finEfectivo(letra, e.id, duracionMs)
    if (b !== null) salida.push({ id: e.id, a: e.inicio_ms, b: Math.max(b, e.inicio_ms + 1) })
  }
  return salida
}

/** Grupos de líneas encadenadas por solape (barrido por inicio; tocarse no es solaparse). */
export function gruposSolapados(tramos: readonly Tramo[]): Tramo[][] {
  const grupos: Tramo[][] = []
  let fin = -Infinity
  for (const t of [...tramos].sort((x, y) => x.a - y.a)) {
    if (grupos.length > 0 && t.a < fin) {
      grupos.at(-1)!.push(t)
      fin = Math.max(fin, t.b)
    } else {
      grupos.push([t])
      fin = t.b
    }
  }
  return grupos
}

/** Ids de las líneas que se pisan con alguna otra (vacío sin solapes). */
export function solapadas(letra: LetraConPartes, duracionMs: number): Set<string> {
  const ids = new Set<string>()
  for (const g of gruposSolapados(tramosDeLetra(letra, duracionMs))) {
    if (g.length > 1) for (const t of g) ids.add(t.id)
  }
  return ids
}

/**
 * Encaje y alineación miran la voz mezclada: cada grupo solapado es UNA línea (fusión de intervalos, con el
 * texto unido, sin palabras ni marcas de revisión). Las demás líneas quedan como están.
 */
export function aplanarSolapes<L extends LetraConPartes>(letra: L, duracionMs: number): L {
  const grupos = gruposSolapados(tramosDeLetra(letra, duracionMs)).filter((g) => g.length > 1)
  if (grupos.length === 0) return letra
  const porId = new Map(letra.lineas.map((e) => [e.id, e]))
  const enGrupo = new Map<string, Tramo[]>()
  for (const g of grupos) for (const t of g) enGrupo.set(t.id, g)
  const hechos = new Set<Tramo[]>()
  const lineas: ElementoLetra[] = []
  for (const e of letra.lineas) {
    const g = enGrupo.get(e.id)
    if (!g) {
      lineas.push({ ...e })
      continue
    }
    if (hechos.has(g)) continue
    hechos.add(g)
    const primera = porId.get(g[0]!.id)!
    const unida: ElementoLetra = {
      ...primera,
      texto: g.map((t) => porId.get(t.id)!.texto).join(' / '),
      inicio_ms: g[0]!.a,
      fin_ms: Math.max(...g.map((t) => t.b)),
      palabras: null
    }
    delete unida.origen_palabras
    delete unida.revisada
    delete unida.alineacion
    lineas.push(unida)
  }
  return { ...letra, lineas }
}

/** Una marca vacía por grupo en el `.lrc`: en qué línea (la última del grupo en orden) y a qué instante. */
export function gruposParaLrc(
  letra: LetraConPartes,
  duracionMs: number
): Map<string, { finMs: number }> {
  const salida = new Map<string, { finMs: number }>()
  const ordenId = new Map(letra.lineas.map((e, i) => [e.id, i]))
  for (const g of gruposSolapados(tramosDeLetra(letra, duracionMs))) {
    if (g.length < 2) continue
    const finMs = Math.max(...g.map((t) => t.b))
    const ultima = g.reduce((m, t) => (ordenId.get(t.id)! > ordenId.get(m.id)! ? t : m))
    for (const t of g) salida.set(t.id, { finMs: t.id === ultima.id ? finMs : -1 })
  }
  return salida
}

// ---------------------------------------------------------------------------
// Adaptadores
// ---------------------------------------------------------------------------

/**
 * «Ajustar los silencios», «Fin al final de la voz» y los fines prudentes (preparación y «Ajustar los
 * fines…»): la propuesta real, sin tocar las líneas solapadas. Las líneas excluidas se marcan como «con
 * palabras hechas a mano» solo para la función (que ya salta esas) y salen de la propuesta tal como estaban.
 */
export function proponerAjusteSilenciosSinSolapes(
  letra: Letra,
  voz: Pick<VozDetectada, 'intervalos'>,
  opciones: OpcionesAjuste
): PropuestaSilencios & { solapaExcluidas: number } {
  const excluidas = solapadas(letra, opciones.duracionMs)
  if (excluidas.size === 0)
    return { ...proponerAjusteSilencios(letra, voz, opciones), solapaExcluidas: 0 }
  const marcadas: Letra = {
    ...letra,
    lineas: letra.lineas.map((e) =>
      excluidas.has(e.id)
        ? {
            ...e,
            palabras: [{ texto: '·', inicio_ms: e.inicio_ms ?? 0, fin_ms: (e.inicio_ms ?? 0) + 1 }],
            origen_palabras: 'manual' as const
          }
        : e
    )
  }
  const soloIds = opciones.soloIds?.filter((id) => !excluidas.has(id))
  const propuesta = proponerAjusteSilencios(marcadas, voz, {
    ...opciones,
    ...(soloIds ? { soloIds } : {})
  })
  const lineas = propuesta.letra.lineas.map((e, i) => (excluidas.has(e.id) ? letra.lineas[i]! : e))
  return {
    ...propuesta,
    letra: { ...propuesta.letra, lineas },
    solapaExcluidas: opciones.soloIds
      ? opciones.soloIds.filter((id) => excluidas.has(id)).length
      : excluidas.size
  }
}

/** Líneas dudosas: las solapadas no se juzgan con la voz mezclada (salvo «sin inicio», que no depende de ella). */
export function detectarDudosasSinSolapes(
  letra: LetraConPartes,
  voz: Pick<VozDetectada, 'intervalos'> | null,
  opciones: OpcionesDudosas
): { dudosas: LineaDudosa[]; solapaExcluidas: number } {
  const excluidas = solapadas(letra, opciones.duracionMs)
  const todas = detectarDudosas(letra, voz, opciones)
  if (excluidas.size === 0) return { dudosas: todas, solapaExcluidas: 0 }
  return {
    dudosas: todas.filter((d) => !excluidas.has(d.id) || d.motivos.includes('sinInicio')),
    solapaExcluidas: excluidas.size
  }
}

/** Encaje («Comprobar la letra» y la preparación): fusiona los tramos solapados; `encaje.ts` no cambia. */
export function evaluarEncajeSinSolapes(
  letra: LetraConPartes,
  voz: Pick<VozDetectada, 'intervalos'>,
  opciones: OpcionesEncaje
): ResultadoEncaje {
  return evaluarEncaje(aplanarSolapes(letra, opciones.duracionMs), voz, opciones)
}

export function evaluarEncajeConPicosSinSolapes(
  letra: LetraConPartes,
  picos: PicosVoz,
  opciones: OpcionesEncaje
): ResultadoEncaje {
  return evaluarEncajeConPicos(aplanarSolapes(letra, opciones.duracionMs), picos, opciones)
}
