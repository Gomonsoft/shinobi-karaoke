import { z } from 'zod'

const tiempoMs = z.number().int().min(0)

export const palabraSchema = z.object({
  texto: z.string().min(1),
  inicio_ms: tiempoMs,
  fin_ms: tiempoMs
})

export const elementoLetraSchema = z.object({
  id: z.string().min(1),
  tipo: z.enum(['linea', 'pausa']),
  texto: z.string(),
  /** null = sin sincronizar. */
  inicio_ms: tiempoMs.nullable(),
  /** null = fin automático (ver finEfectivo); número = fin fijado. */
  fin_ms: tiempoMs.nullable(),
  /** null si no hay sincronía por palabra. */
  palabras: z.array(palabraSchema).nullable()
})

export type Palabra = z.infer<typeof palabraSchema>
export type ElementoLetra = z.infer<typeof elementoLetraSchema>

// ---------------------------------------------------------------------------
// Invariantes (ADR 0006)
// ---------------------------------------------------------------------------

function resumen(texto: string): string {
  const t = texto.trim()
  return t.length > 30 ? `${t.slice(0, 30)}…` : t
}

/** Descripción comprensible de un elemento: "la línea 3 («Hola…»)" o "la pausa tras la línea 2". */
export function describirElemento(lineas: readonly ElementoLetra[], indice: number): string {
  let numero = 0
  for (let i = 0; i <= indice; i++) if (lineas[i]?.tipo === 'linea') numero++
  const el = lineas[indice]
  if (el?.tipo === 'pausa') {
    return numero === 0 ? 'la pausa del principio' : `la pausa tras la línea ${numero}`
  }
  return `la línea ${numero} («${resumen(el?.texto ?? '')}»)`
}

/** Índice del siguiente elemento (posterior a `desde`) que tiene inicio, o -1. */
function siguienteConInicio(lineas: readonly ElementoLetra[], desde: number): number {
  for (let i = desde + 1; i < lineas.length; i++) if (lineas[i]?.inicio_ms != null) return i
  return -1
}

/** Índice del elemento anterior (previo a `desde`) que tiene inicio, o -1. */
function anteriorConInicio(lineas: readonly ElementoLetra[], desde: number): number {
  for (let i = desde - 1; i >= 0; i--) if (lineas[i]?.inicio_ms != null) return i
  return -1
}

/**
 * Comprueba todos los invariantes de la letra (ADR 0006) y devuelve los
 * problemas encontrados como mensajes comprensibles (vacío si es válida).
 */
export function validarInvariantesLetra(lineas: readonly ElementoLetra[]): string[] {
  const problemas: string[] = []
  const ids = new Set<string>()
  let inicioPrevio: number | null = null
  let nombrePrevio = ''

  lineas.forEach((el, i) => {
    const nombre = describirElemento(lineas, i)

    if (ids.has(el.id)) problemas.push(`El identificador «${el.id}» está repetido (${nombre})`)
    ids.add(el.id)

    if (el.tipo === 'pausa') {
      if (el.texto !== '') problemas.push(`${cap(nombre)} no puede tener texto`)
      if (el.palabras !== null) problemas.push(`${cap(nombre)} no puede tener palabras`)
      if (i === 0) problemas.push('La letra no puede empezar con una pausa')
      if (i === lineas.length - 1) problemas.push('La letra no puede terminar con una pausa')
      if (lineas[i - 1]?.tipo === 'pausa') problemas.push(`Hay dos pausas seguidas (${nombre})`)
    }

    if (el.inicio_ms !== null) {
      if (inicioPrevio !== null && el.inicio_ms <= inicioPrevio) {
        problemas.push(
          `${cap(nombre)} empieza en ${el.inicio_ms} ms, pero ${nombrePrevio} empieza en ${inicioPrevio} ms: los inicios deben ir en orden creciente`
        )
      }
      inicioPrevio = el.inicio_ms
      nombrePrevio = nombre
    }

    const sig = siguienteConInicio(lineas, i)
    const limite = sig === -1 ? null : (lineas[sig]?.inicio_ms ?? null)

    if (el.fin_ms !== null) {
      if (el.inicio_ms === null) {
        problemas.push(`${cap(nombre)} tiene fin fijado pero no tiene inicio`)
      } else if (el.fin_ms <= el.inicio_ms) {
        problemas.push(
          `${cap(nombre)} termina (${el.fin_ms} ms) antes de empezar (${el.inicio_ms} ms)`
        )
      } else if (limite !== null && el.fin_ms > limite) {
        problemas.push(
          `${cap(nombre)} termina en ${el.fin_ms} ms, después del inicio de la siguiente (${limite} ms)`
        )
      }
    }

    if (el.palabras !== null) {
      if (el.inicio_ms === null) {
        problemas.push(`${cap(nombre)} tiene palabras sincronizadas pero no tiene inicio`)
      } else {
        problemas.push(...validarPalabras(nombre, el.inicio_ms, limite, el.palabras))
      }
    }
  })

  return problemas
}

function validarPalabras(
  nombre: string,
  inicioLinea: number,
  limite: number | null,
  palabras: readonly Palabra[]
): string[] {
  const problemas: string[] = []
  if (palabras.length === 0) {
    problemas.push(`${cap(nombre)} tiene una lista de palabras vacía (usa «sin palabras»)`)
    return problemas
  }
  palabras.forEach((p, k) => {
    if (p.fin_ms <= p.inicio_ms) {
      problemas.push(`En ${nombre}, la palabra «${p.texto}» termina antes de empezar`)
    }
    const previa = palabras[k - 1]
    if (previa && p.inicio_ms <= previa.inicio_ms) {
      problemas.push(`En ${nombre}, las palabras deben ir en orden creciente («${p.texto}»)`)
    }
  })
  const primera = palabras[0]
  if (primera && primera.inicio_ms < inicioLinea) {
    problemas.push(`En ${nombre}, la primera palabra empieza antes que la línea`)
  }
  const ultima = palabras[palabras.length - 1]
  if (ultima && limite !== null && ultima.fin_ms > limite) {
    problemas.push(
      `En ${nombre}, la última palabra termina después del inicio de la siguiente (${limite} ms)`
    )
  }
  return problemas
}

function cap(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export const letraSchema = z
  .object({
    origen: z.enum(['lrclib', 'manual', 'archivo']),
    lrclib_id: z.number().int().nullable(),
    offset_ms: z.number().int(),
    lineas: z.array(elementoLetraSchema)
  })
  .superRefine((letra, ctx) => {
    for (const mensaje of validarInvariantesLetra(letra.lineas)) {
      ctx.addIssue({ code: 'custom', message: mensaje, path: ['lineas'] })
    }
  })

export type Letra = z.infer<typeof letraSchema>

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** Número de elementos de tipo línea (las pausas no cuentan). */
export function contarLineas(letra: Pick<Letra, 'lineas'> | null | undefined): number {
  return letra ? letra.lineas.filter((e) => e.tipo === 'linea').length : 0
}

/** Números (base 1, contando solo líneas) de las líneas sin inicio. */
export function numerosLineasSinInicio(letra: Pick<Letra, 'lineas'> | null | undefined): number[] {
  const numeros: number[] = []
  let n = 0
  for (const e of letra?.lineas ?? []) {
    if (e.tipo !== 'linea') continue
    n++
    if (e.inicio_ms === null) numeros.push(n)
  }
  return numeros
}

/** Pausa más allá de este hueco (ms) se trata como instrumental: el fin automático se acota. */
export const HUECO_MAXIMO_FIN_AUTOMATICO_MS = 8000
const DURACION_MINIMA_AUTOMATICA_MS = 2000
const MS_POR_PALABRA = 400
const DURACION_ULTIMA_LINEA_MS = 5000

function contarPalabrasTexto(texto: string): number {
  const t = texto.trim()
  return t === '' ? 0 : t.split(/\s+/).length
}

/**
 * Fin efectivo de un elemento (ADR 0005; preguntas/0005 §6). No se guarda: se
 * calcula al renderizar. Devuelve null si el elemento no existe o no tiene inicio.
 *
 * Orden: fin fijado → fin de la última palabra → inicio de la pausa siguiente
 * si tiene tiempo → inicio de la línea siguiente si el hueco es ≤ 8 s y no hay
 * pausa → inicio + min(hueco, máx(2000, 400 × nº de palabras)) → última línea:
 * min(inicio + 5000, duración).
 */
export function finEfectivo(
  letra: Pick<Letra, 'lineas'>,
  id: string,
  duracionMs: number
): number | null {
  const lineas = letra.lineas
  const i = lineas.findIndex((e) => e.id === id)
  const el = lineas[i]
  if (!el || el.inicio_ms === null) return null
  const inicio = el.inicio_ms

  if (el.fin_ms !== null) return el.fin_ms
  if (el.palabras && el.palabras.length > 0) {
    return el.palabras[el.palabras.length - 1]!.fin_ms
  }

  const siguiente = lineas[i + 1]
  if (siguiente?.tipo === 'pausa' && siguiente.inicio_ms !== null) return siguiente.inicio_ms

  const idxSig = siguienteConInicio(lineas, i)
  if (idxSig === -1) {
    return Math.max(inicio + 1, Math.min(inicio + DURACION_ULTIMA_LINEA_MS, duracionMs))
  }
  const inicioSig = lineas[idxSig]!.inicio_ms!
  const hueco = inicioSig - inicio

  const contiguaYCercana =
    siguiente?.tipo === 'linea' && idxSig === i + 1 && hueco <= HUECO_MAXIMO_FIN_AUTOMATICO_MS
  if (contiguaYCercana) return inicioSig

  const tope = Math.max(
    DURACION_MINIMA_AUTOMATICA_MS,
    MS_POR_PALABRA * contarPalabrasTexto(el.texto)
  )
  return inicio + Math.min(hueco, tope)
}

// ---------------------------------------------------------------------------
// Operaciones puras (ux/06 criterio 7d)
// ---------------------------------------------------------------------------

export interface ResultadoMoverInicio {
  letra: Letra
  /** Ids de líneas cuyas palabras se descartaron (pasan a barrido progresivo). */
  palabrasDescartadas: string[]
  /** Ids de elementos cuyo fin fijado se pasó a automático (null). */
  finesAutomaticos: string[]
}

function indiceDe(letra: Pick<Letra, 'lineas'>, id: string): number {
  const i = letra.lineas.findIndex((e) => e.id === id)
  if (i === -1) throw new RangeError(`No existe ningún elemento con id «${id}»`)
  return i
}

/**
 * Mueve el inicio de una línea. Sus palabras (si tiene) se desplazan el mismo
 * delta. Si las palabras de esa línea o de la anterior ya no caben, se
 * descartan. No toca `fin_ms`, salvo que un fin fijado deje de cumplir
 * `inicio < fin ≤ siguiente inicio`: entonces pasa a null (automático).
 *
 * Lanza RangeError si el id no existe, no es una línea, o si el nuevo inicio
 * no es un entero ≥ 0 estrictamente entre los inicios vecinos.
 */
export function moverInicioLinea(
  letra: Letra,
  id: string,
  nuevoInicioMs: number
): ResultadoMoverInicio {
  const i = indiceDe(letra, id)
  const original = letra.lineas[i]!
  if (original.tipo !== 'linea') throw new RangeError('Solo se puede mover el inicio de una línea')
  if (!Number.isInteger(nuevoInicioMs) || nuevoInicioMs < 0) {
    throw new RangeError('El inicio debe ser un número entero de milisegundos mayor o igual que 0')
  }

  const ant = anteriorConInicio(letra.lineas, i)
  const sig = siguienteConInicio(letra.lineas, i)
  const inicioAnt = ant === -1 ? null : letra.lineas[ant]!.inicio_ms!
  const inicioSig = sig === -1 ? null : letra.lineas[sig]!.inicio_ms!
  if (inicioAnt !== null && nuevoInicioMs <= inicioAnt) {
    throw new RangeError(
      `El inicio debe ser posterior al de ${describirElemento(letra.lineas, ant)} (${inicioAnt} ms)`
    )
  }
  if (inicioSig !== null && nuevoInicioMs >= inicioSig) {
    throw new RangeError(
      `El inicio debe ser anterior al de ${describirElemento(letra.lineas, sig)} (${inicioSig} ms)`
    )
  }

  const delta = original.inicio_ms === null ? 0 : nuevoInicioMs - original.inicio_ms
  const lineas: ElementoLetra[] = letra.lineas.map((e) => ({
    ...e,
    palabras: e.palabras ? e.palabras.map((p) => ({ ...p })) : null
  }))
  const palabrasDescartadas: string[] = []
  const finesAutomaticos: string[] = []

  const actual = lineas[i]!
  actual.inicio_ms = nuevoInicioMs
  if (actual.palabras) {
    actual.palabras = actual.palabras.map((p) => ({
      ...p,
      inicio_ms: p.inicio_ms + delta,
      fin_ms: p.fin_ms + delta
    }))
    const ultima = actual.palabras[actual.palabras.length - 1]
    const primera = actual.palabras[0]
    const caben =
      primera !== undefined &&
      ultima !== undefined &&
      primera.inicio_ms >= nuevoInicioMs &&
      (inicioSig === null || ultima.fin_ms <= inicioSig)
    if (!caben) {
      actual.palabras = null
      palabrasDescartadas.push(actual.id)
    }
  }

  if (ant !== -1) {
    const previa = lineas[ant]!
    const ultima = previa.palabras?.[previa.palabras.length - 1]
    if (ultima && ultima.fin_ms > nuevoInicioMs) {
      previa.palabras = null
      palabrasDescartadas.push(previa.id)
    }
    if (previa.fin_ms !== null && previa.fin_ms > nuevoInicioMs) {
      previa.fin_ms = null
      finesAutomaticos.push(previa.id)
    }
  }
  if (actual.fin_ms !== null) {
    if (actual.fin_ms <= nuevoInicioMs || (inicioSig !== null && actual.fin_ms > inicioSig)) {
      actual.fin_ms = null
      finesAutomaticos.push(actual.id)
    }
  }

  return { letra: { ...letra, lineas }, palabrasDescartadas, finesAutomaticos }
}

/** Borra los tiempos de un elemento: inicio, fin y palabras pasan a null. */
export function borrarTiemposLinea(letra: Letra, id: string): Letra {
  const i = indiceDe(letra, id)
  return {
    ...letra,
    lineas: letra.lineas.map((e, k) =>
      k === i ? { ...e, inicio_ms: null, fin_ms: null, palabras: null } : { ...e }
    )
  }
}
