// Versiones SemVer 2.0 de las etiquetas publicadas (ADR 0023 §2, formato de ADR 0020 §2). Módulo puro.

/** Etiqueta publicada: `v` + SemVer, con sufijo `alpha|beta|rc` numerado (ADR 0020 §2). */
const ETIQUETA = /^v((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:alpha|beta|rc)\.[1-9]\d*))?)$/
const VERSION =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

export interface EtiquetaAnalizada {
  /** Sin la `v`: `0.2.2-alpha.2`. */
  version: string
  /** Lleva sufijo (preliminar). */
  previa: boolean
}

/** `v0.2.2-alpha.2` → `{ version: '0.2.2-alpha.2', previa: true }`; `null` si no cumple el formato. */
export function analizarEtiqueta(etiqueta: string): EtiquetaAnalizada | null {
  const m = ETIQUETA.exec(etiqueta)
  return m ? { version: m[1] ?? '', previa: m[5] !== undefined } : null
}

/** La versión instalada lleva sufijo de preliminar. */
export const esPrevia = (version: string): boolean => (VERSION.exec(version)?.[4] ?? '') !== ''

const soloDigitos = /^\d+$/

function compararIdentificadores(a: string, b: string): number {
  const na = soloDigitos.test(a)
  const nb = soloDigitos.test(b)
  if (na && nb) return Math.sign(Number(a) - Number(b))
  if (na) return -1
  if (nb) return 1
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * Precedencia SemVer 2.0 (§11): negativo si `a < b`, 0 si iguales, positivo si `a > b`. Ignora
 * los metadatos de compilación (`+…`). Una versión mal formada lanza `RangeError`.
 */
export function compararVersiones(a: string, b: string): number {
  const pa = VERSION.exec(a)
  const pb = VERSION.exec(b)
  if (!pa || !pb) throw new RangeError(`Versión no válida: ${pa ? b : a}`)
  for (let i = 1; i <= 3; i++) {
    const d = Number(pa[i]) - Number(pb[i])
    if (d !== 0) return Math.sign(d)
  }
  const ra = pa[4]
  const rb = pb[4]
  if (ra === undefined && rb === undefined) return 0
  if (ra === undefined) return 1
  if (rb === undefined) return -1
  const ia = ra.split('.')
  const ib = rb.split('.')
  for (let i = 0; i < Math.min(ia.length, ib.length); i++) {
    const d = compararIdentificadores(ia[i] ?? '', ib[i] ?? '')
    if (d !== 0) return d
  }
  return Math.sign(ia.length - ib.length)
}
