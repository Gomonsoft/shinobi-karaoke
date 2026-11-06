import {
  borrarTiemposLinea,
  contarLineas,
  finEfectivo,
  moverInicioLinea,
  numerosLineasSinInicio,
  type ElementoLetra,
  type Letra
} from '../letra'
import { OFFSET_MAXIMO_MS, type GuardarTiempos } from '../letrasBusqueda'

type TipoElemento = ElementoLetra['tipo']

export type Limite =
  | { tipo: 'inicio_anterior' | 'inicio_siguiente'; vecino: TipoElemento }
  | { tipo: 'fin_antes_del_inicio' | 'fin_siguiente' }
  | { tipo: 'desplazamiento' }
  | { tipo: 'demasiado_pronto' }

export interface ResultadoTiempos {
  letra: Letra
  cambiado: boolean
  limite: Limite | null
  palabrasDescartadas: string[]
  finesAutomaticos: string[]
}

export const tiempoMostrado = (inicioMs: number, offsetMs: number): number =>
  Math.max(0, inicioMs + offsetMs)

export const tiempoGuardado = (msAudio: number, offsetMs: number): number =>
  Math.max(0, Math.round(msAudio - offsetMs))

function resultado(letra: Letra, cambiado = false, limite: Limite | null = null): ResultadoTiempos {
  return { letra, cambiado, limite, palabrasDescartadas: [], finesAutomaticos: [] }
}

function buscarLinea(letra: Letra, id: string): { indice: number; linea: ElementoLetra } {
  const indice = letra.lineas.findIndex((e) => e.id === id)
  const linea = letra.lineas[indice]
  if (linea?.tipo !== 'linea') throw new RangeError(`No existe la línea «${id}»`)
  return { indice, linea }
}

function vecinoConInicio(letra: Letra, indice: number, sentido: -1 | 1): ElementoLetra | null {
  for (let i = indice + sentido; i >= 0 && i < letra.lineas.length; i += sentido) {
    const elemento = letra.lineas[i]!
    if (elemento.inicio_ms !== null) return elemento
  }
  return null
}

export function limitesInicio(
  letra: Letra,
  id: string
): {
  min: number
  max: number | null
  vecinoAnterior: TipoElemento | null
  vecinoSiguiente: TipoElemento | null
} {
  const { indice } = buscarLinea(letra, id)
  const anterior = vecinoConInicio(letra, indice, -1)
  const siguiente = vecinoConInicio(letra, indice, 1)
  return {
    min: anterior ? anterior.inicio_ms! + 1 : 0,
    max: siguiente ? siguiente.inicio_ms! - 1 : null,
    vecinoAnterior: anterior?.tipo ?? null,
    vecinoSiguiente: siguiente?.tipo ?? null
  }
}

function limitarInicio(letra: Letra, id: string, ms: number, acotar: boolean): ResultadoTiempos {
  const { linea } = buscarLinea(letra, id)
  const { min, max, vecinoAnterior, vecinoSiguiente } = limitesInicio(letra, id)
  let limite: Limite | null = null
  if (ms < min) limite = { tipo: 'inicio_anterior', vecino: vecinoAnterior ?? 'linea' }
  else if (max !== null && ms > max) {
    limite = { tipo: 'inicio_siguiente', vecino: vecinoSiguiente! }
  }
  if ((!acotar && limite) || (max !== null && min > max)) return resultado(letra, false, limite)
  const nuevo = Math.min(Math.max(ms, min), max ?? Infinity)
  if (nuevo === linea.inicio_ms) return resultado(letra, false, limite)
  return { ...moverInicioLinea(letra, id, nuevo), cambiado: true, limite }
}

export function ajustarInicio(letra: Letra, id: string, deltaMs: number): ResultadoTiempos {
  const { linea } = buscarLinea(letra, id)
  if (linea.inicio_ms === null) return resultado(letra)
  return limitarInicio(letra, id, linea.inicio_ms + deltaMs, true)
}

export function fijarInicio(letra: Letra, id: string, msGuardado: number): ResultadoTiempos {
  return limitarInicio(letra, id, msGuardado, false)
}

function cambiarFin(letra: Letra, indice: number, fin: number | null, limite: Limite | null) {
  const linea = letra.lineas[indice]!
  if (linea.fin_ms === fin) return resultado(letra, false, limite)
  const lineas = letra.lineas.slice()
  lineas[indice] = { ...linea, fin_ms: fin }
  return resultado({ ...letra, lineas }, true, limite)
}

function limitarFin(
  letra: Letra,
  id: string,
  ms: number,
  duracionMs: number,
  acotar: boolean
): ResultadoTiempos {
  const { indice, linea } = buscarLinea(letra, id)
  if (linea.inicio_ms === null) return resultado(letra)
  const min = linea.inicio_ms + 1
  const max = vecinoConInicio(letra, indice, 1)?.inicio_ms ?? duracionMs
  let limite: Limite | null = null
  if (ms < min) limite = { tipo: 'fin_antes_del_inicio' }
  else if (ms > max) limite = { tipo: 'fin_siguiente' }
  if (max < min || (!acotar && limite)) return resultado(letra, false, limite)
  return cambiarFin(letra, indice, Math.min(Math.max(ms, min), max), limite)
}

export function ajustarFin(
  letra: Letra,
  id: string,
  deltaMs: number,
  duracionMs: number
): ResultadoTiempos {
  const base = finEfectivo(letra, id, duracionMs)
  if (base === null) return resultado(letra)
  return limitarFin(letra, id, base + deltaMs, duracionMs, true)
}

export function fijarFin(
  letra: Letra,
  id: string,
  msGuardado: number,
  duracionMs: number
): ResultadoTiempos {
  return limitarFin(letra, id, msGuardado, duracionMs, false)
}

export function usarFinAutomatico(letra: Letra, id: string): ResultadoTiempos {
  const { indice } = buscarLinea(letra, id)
  return cambiarFin(letra, indice, null, null)
}

export function borrarTiempos(letra: Letra, id: string): ResultadoTiempos {
  const { linea } = buscarLinea(letra, id)
  return linea.inicio_ms === null
    ? resultado(letra)
    : resultado(borrarTiemposLinea(letra, id), true)
}

export function marcarInicioLinea(
  letra: Letra,
  id: string,
  msGuardado: number
): ResultadoTiempos & { borrados: string[] } {
  const { indice, linea } = buscarLinea(letra, id)
  const anterior = vecinoConInicio(letra, indice, -1)
  const borrados: string[] = []
  if (anterior && msGuardado <= anterior.inicio_ms!) {
    return { ...resultado(letra, false, { tipo: 'demasiado_pronto' }), borrados }
  }
  if (msGuardado === linea.inicio_ms) return { ...resultado(letra), borrados }

  const lineas = letra.lineas.map((elemento, i) => {
    if (i <= indice || elemento.inicio_ms === null || elemento.inicio_ms > msGuardado)
      return elemento
    borrados.push(elemento.id)
    return { ...elemento, inicio_ms: null, fin_ms: null, palabras: null }
  })
  return {
    ...moverInicioLinea({ ...letra, lineas }, id, msGuardado),
    cambiado: true,
    limite: null,
    borrados
  }
}

export function fijarDesplazamiento(letra: Letra, offsetMs: number): ResultadoTiempos {
  const offset_ms = Math.max(-OFFSET_MAXIMO_MS, Math.min(OFFSET_MAXIMO_MS, offsetMs))
  const cambiado = offset_ms !== letra.offset_ms
  return resultado(
    cambiado ? { ...letra, offset_ms } : letra,
    cambiado,
    offset_ms === offsetMs ? null : { tipo: 'desplazamiento' }
  )
}

export function desplazar(letra: Letra, deltaMs: number): ResultadoTiempos {
  return fijarDesplazamiento(letra, letra.offset_ms + deltaMs)
}

export function indiceLineaActual(letra: Letra, tAudioMs: number): number {
  return letra.lineas.findLastIndex(
    ({ tipo, inicio_ms }) =>
      tipo === 'linea' &&
      inicio_ms !== null &&
      tiempoMostrado(inicio_ms, letra.offset_ms) <= tAudioMs
  )
}

export function lineaVecina(letra: Letra, id: string | null, sentido: -1 | 1): string | null {
  const desde =
    id === null
      ? sentido === 1
        ? -1
        : letra.lineas.length
      : letra.lineas.findIndex((e) => e.id === id)
  for (let i = desde + sentido; i >= 0 && i < letra.lineas.length; i += sentido) {
    const elemento = letra.lineas[i]!
    if (elemento.tipo === 'linea') return elemento.id
  }
  return null
}

export function primeraSinInicio(letra: Letra): string | null {
  return letra.lineas.find((e) => e.tipo === 'linea' && e.inicio_ms === null)?.id ?? null
}

export function contador(letra: Letra): { sincronizadas: number; total: number } {
  const total = contarLineas(letra)
  return { sincronizadas: total - numerosLineasSinInicio(letra).length, total }
}

export function numeroDeLinea(letra: Letra, id: string): number {
  const { indice } = buscarLinea(letra, id)
  return contarLineas({ lineas: letra.lineas.slice(0, indice + 1) })
}

export function aPeticionTiempos(cancionId: string, letra: Letra): GuardarTiempos {
  return {
    cancionId,
    offset_ms: letra.offset_ms,
    tiempos: letra.lineas.map(({ id, inicio_ms, fin_ms, palabras }) => ({
      id,
      inicio_ms,
      fin_ms,
      palabras
    }))
  }
}

const dosCifras = (n: number): string => String(n).padStart(2, '0')

export function formatearTiempo(ms: number | null): string {
  if (ms === null) return '--:--.--'
  return `${dosCifras(Math.floor(ms / 60_000))}:${dosCifras(Math.floor(ms / 1000) % 60)}.${dosCifras(Math.floor(ms / 10) % 100)}`
}

export function interpretarTiempo(texto: string): number | null {
  const partes = /^(\d{1,2}):([0-5]\d)(?:\.(\d{1,2}))?$/.exec(texto.trim())
  if (!partes) return null
  const [, minutos, segundos, centesimas = ''] = partes
  return Number(minutos) * 60_000 + Number(segundos) * 1000 + Number(centesimas.padEnd(2, '0')) * 10
}

export function formatearDesplazamiento(ms: number): string {
  return `${ms < 0 ? '−' : '+'}${(Math.abs(ms) / 1000).toFixed(2).replace('.', ',')} s`
}

export function interpretarDesplazamiento(texto: string): number | null {
  const valor = texto.trim().replace('−', '-').replace(',', '.')
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(valor)) return null
  const ms = Math.round(Number(valor) * 1000)
  return Number.isFinite(ms) ? ms : null
}
