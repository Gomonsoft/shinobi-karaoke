import type { BorradorLinea } from '@shared/letras'

/** Una marca al vuelo de la pasada en curso (para Retroceso). */
export interface MarcaPasada {
  /** Palabra marcada. */
  k: number
  /** Borrador justo antes de marcar. */
  antes: BorradorLinea
  /** Instante de la marca, en tiempo de letra. */
  ms: number
}

export interface EstadoPreciso {
  /** Borrador con el que se abrió la línea: lo que «sin cambios» compara. */
  original: BorradorLinea
  actual: BorradorLinea
  pasado: BorradorLinea[]
  futuro: BorradorLinea[]
  seleccionada: number
  /** Palabra donde empezó la pasada (primera marca tras seleccionar o empezar el bucle). */
  inicioPasada: number | null
  pasada: MarcaPasada[]
}

export type AccionPreciso =
  | { tipo: 'cargar'; borrador: BorradorLinea; seleccionada: number }
  | { tipo: 'cambiar'; borrador: BorradorLinea; seleccionada?: number }
  | { tipo: 'marca'; borrador: BorradorLinea; marca: MarcaPasada; siguiente: number }
  | { tipo: 'seleccionar'; indice: number }
  | { tipo: 'retroceso' }
  | { tipo: 'reiniciarPasada' }
  | { tipo: 'deshacer' }
  | { tipo: 'rehacer' }

/** Primera palabra sin marcar (o la primera si todas lo están). */
export function primeraSinMarcar(borrador: BorradorLinea): number {
  const k = borrador.palabras.findIndex((p) => !p.marcada)
  return k < 0 ? 0 : k
}

export function estadoInicial(borrador: BorradorLinea): EstadoPreciso {
  return {
    original: borrador,
    actual: borrador,
    pasado: [],
    futuro: [],
    seleccionada: primeraSinMarcar(borrador),
    inicioPasada: null,
    pasada: []
  }
}

export const sonIguales = (a: BorradorLinea, b: BorradorLinea): boolean =>
  a === b || JSON.stringify(a) === JSON.stringify(b)

/** ¿El borrador difiere del que se cargó? */
export const hayCambios = (e: EstadoPreciso): boolean => !sonIguales(e.original, e.actual)

function empujar(e: EstadoPreciso, borrador: BorradorLinea): EstadoPreciso {
  if (sonIguales(e.actual, borrador)) return e
  return { ...e, actual: borrador, pasado: [...e.pasado, e.actual], futuro: [] }
}

const acotar = (e: EstadoPreciso, k: number) =>
  Math.max(0, Math.min(Math.max(0, e.actual.palabras.length - 1), k))

/** *Reducer* del borrador de la ventana con su historial (P15): cada operación es un paso. */
export function reducirPreciso(e: EstadoPreciso, a: AccionPreciso): EstadoPreciso {
  switch (a.tipo) {
    case 'cargar':
      return { ...estadoInicial(a.borrador), seleccionada: a.seleccionada }
    case 'cambiar': {
      const siguiente = empujar(e, a.borrador)
      const k = a.seleccionada ?? e.seleccionada
      return {
        ...siguiente,
        seleccionada: Math.max(0, Math.min(a.borrador.palabras.length - 1, k))
      }
    }
    case 'marca': {
      const siguiente = empujar(e, a.borrador)
      return {
        ...siguiente,
        seleccionada: a.siguiente,
        inicioPasada: e.inicioPasada ?? a.marca.k,
        pasada: [...e.pasada, a.marca]
      }
    }
    case 'seleccionar':
      return { ...e, seleccionada: acotar(e, a.indice), inicioPasada: null }
    case 'retroceso': {
      const ultima = e.pasada.at(-1)
      if (!ultima) return e
      const siguiente = empujar(e, ultima.antes)
      return {
        ...siguiente,
        seleccionada: ultima.k,
        pasada: e.pasada.slice(0, -1),
        inicioPasada: e.pasada.length > 1 ? e.inicioPasada : null
      }
    }
    case 'reiniciarPasada':
      return e.inicioPasada === null ? e : { ...e, seleccionada: acotar(e, e.inicioPasada) }
    case 'deshacer': {
      const anterior = e.pasado.at(-1)
      if (!anterior) return e
      return {
        ...e,
        actual: anterior,
        pasado: e.pasado.slice(0, -1),
        futuro: [e.actual, ...e.futuro],
        seleccionada: Math.min(e.seleccionada, Math.max(0, anterior.palabras.length - 1)),
        pasada: []
      }
    }
    case 'rehacer': {
      const [siguiente, ...resto] = e.futuro
      if (!siguiente) return e
      return {
        ...e,
        actual: siguiente,
        pasado: [...e.pasado, e.actual],
        futuro: resto,
        seleccionada: Math.min(e.seleccionada, Math.max(0, siguiente.palabras.length - 1)),
        pasada: []
      }
    }
  }
}
