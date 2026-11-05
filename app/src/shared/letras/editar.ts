import type { ElementoLetra, Letra } from '../letra'
import { normalizarLetra, type GeneradorId } from './normalizar'
import { textoPlanoALetra } from './texto'

/** Texto de la vista C: una línea por renglón y una pausa como renglón vacío. */
export function letraATexto(letra: Pick<Letra, 'lineas'>): string {
  return letra.lineas.map((e) => (e.tipo === 'pausa' ? '' : e.texto)).join('\n')
}

const claveElemento = (e: ElementoLetra): string =>
  e.tipo === 'pausa' ? 'pausa' : `linea:${e.texto.trim().replace(/\s+/g, ' ')}`

/**
 * LCS entre dos secuencias de claves. Devuelve pares [índice en a, índice en b].
 * Poda el prefijo y el sufijo comunes; ante empates empareja la primera
 * aparición con la primera, sin cruces.
 */
function emparejar(
  clavesA: readonly string[],
  clavesB: readonly string[]
): Array<[number, number]> {
  // Se internan las claves como enteros para que la comparación del DP sea barata.
  const tabla = new Map<string, number>()
  const interna = (c: string): number => {
    let v = tabla.get(c)
    if (v === undefined) tabla.set(c, (v = tabla.size))
    return v
  }
  const a = clavesA.map(interna)
  const b = clavesB.map(interna)
  const pares: Array<[number, number]> = []
  let ini = 0
  while (ini < a.length && ini < b.length && a[ini] === b[ini]) {
    pares.push([ini, ini])
    ini++
  }
  let finA = a.length
  let finB = b.length
  const sufijo: Array<[number, number]> = []
  while (finA > ini && finB > ini && a[finA - 1] === b[finB - 1]) {
    finA--
    finB--
    sufijo.push([finA, finB])
  }
  const n = finA - ini
  const m = finB - ini
  if (n > 0 && m > 0) {
    // L[i][j] = longitud del LCS de a[ini+i..finA) y b[ini+j..finB).
    const ancho = m + 1
    const L = new Uint16Array((n + 1) * ancho)
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        L[i * ancho + j] =
          a[ini + i] === b[ini + j]
            ? L[(i + 1) * ancho + j + 1]! + 1
            : Math.max(L[(i + 1) * ancho + j]!, L[i * ancho + j + 1]!)
      }
    }
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (a[ini + i] === b[ini + j] && L[i * ancho + j] === L[(i + 1) * ancho + j + 1]! + 1) {
        pares.push([ini + i, ini + j])
        i++
        j++
      } else if (L[(i + 1) * ancho + j]! >= L[i * ancho + j + 1]!) i++
      else j++
    }
  }
  for (let k = sufijo.length - 1; k >= 0; k--) pares.push(sufijo[k]!)
  return pares
}

/**
 * Aplica el texto editado en la vista C: las líneas que no cambian conservan
 * `id`, tiempos y palabras; las nuevas o modificadas quedan sin tiempos
 * (ADR 0005 §3, tarea 0079). No modifica la entrada.
 */
export function aplicarTextoEditado(letra: Letra, texto: string, generarId?: GeneradorId): Letra {
  // Los ids de `nuevos` son provisionales: los definitivos se generan al final.
  let provisional = 0
  const nuevos = textoPlanoALetra(texto, () => `p${provisional++}`)
  const pares = emparejar(letra.lineas.map(claveElemento), nuevos.map(claveElemento))
  const deNuevo = new Map<number, ElementoLetra>()
  for (const [i, j] of pares) {
    const viejo = letra.lineas[i]!
    const n = nuevos[j]!
    deNuevo.set(
      j,
      viejo.tipo === 'pausa'
        ? { ...viejo, palabras: null, fin_ms: null }
        : {
            id: viejo.id,
            tipo: 'linea',
            texto: n.texto,
            inicio_ms: viejo.inicio_ms,
            fin_ms: viejo.fin_ms,
            palabras: viejo.palabras ? viejo.palabras.map((p) => ({ ...p })) : null
          }
    )
  }
  const conservados = new Set([...deNuevo.values()].map((e) => e.id))
  const base: GeneradorId = generarId ?? (() => globalThis.crypto.randomUUID())
  const idLibre: GeneradorId = () => {
    let id = base()
    for (let k = 0; k < 100 && conservados.has(id); k++) id = base()
    return conservados.has(id) ? `${id}-nuevo` : id
  }

  // Los elementos sin emparejar parten sin tiempos (ya lo están en `nuevos`).
  const entrada = nuevos.map((e, j) => deNuevo.get(j) ?? e)
  const salida = normalizarLetra(entrada, idLibre)

  // normalizarLetra regenera los ids: se devuelven a los emparejados. Los
  // elementos que sobreviven son una subsecuencia de la entrada, del mismo tipo.
  let p = 0
  for (const e of salida) {
    while (p < entrada.length && entrada[p]!.tipo !== e.tipo) p++
    if (p >= entrada.length) break
    if (deNuevo.has(p)) e.id = entrada[p]!.id
    p++
  }
  return { ...letra, lineas: salida }
}
