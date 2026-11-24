import type { ElementoLetra, Letra } from '../letra'

/*
 * Letras aleatorias inventadas (semilla fija) para las pruebas de regresión de la regla del fin por parte
 * (0.2.3, tareas 0357 y 0358): válidas con la regla de 0.2.2, es decir, sin solapes, con o sin reparto.
 */

const l = (
  id: string,
  inicio: number | null,
  extra: Partial<ElementoLetra> = {}
): ElementoLetra => ({
  id,
  tipo: 'linea',
  texto: `Verso ${id}`,
  inicio_ms: inicio,
  fin_ms: null,
  palabras: null,
  ...extra
})
const pausa = (id: string, inicio: number | null = null): ElementoLetra => ({
  id,
  tipo: 'pausa',
  texto: '',
  inicio_ms: inicio,
  fin_ms: null,
  palabras: null
})
const DUO = [
  { id: 'c1' as const, nombre: 'Ana' },
  { id: 'c2' as const, nombre: 'Luis' }
]
const TRIO = [...DUO, { id: 'c3' as const, nombre: null }]

export function mulberry32(semilla: number): () => number {
  let a = semilla
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Una letra aleatoria **válida con la regla de 0.2.2** (sin solapes), con o sin reparto. */
export function letraAleatoria(rng: () => number, conReparto: boolean): Letra {
  const entero = (n: number) => Math.floor(rng() * n)
  const n = 3 + entero(10)
  const lineas: ElementoLetra[] = []
  let t = 500
  const cantantes = conReparto ? [...(rng() < 0.5 ? DUO : TRIO)] : []
  const partesPosibles = ['c1', ...cantantes.slice(1).map((c) => c.id), 'todos', 'coro'] as const
  for (let i = 0; i < n; i++) {
    const esPausa = i > 0 && i < n - 1 && lineas[i - 1]!.tipo === 'linea' && rng() < 0.15
    const inicio = rng() < 0.1 ? null : (t += 600 + entero(3000))
    const parte = conReparto ? partesPosibles[entero(partesPosibles.length)]! : 'c1'
    const base = esPausa
      ? pausa(`e${i}`, inicio)
      : l(`e${i}`, inicio, parte === 'c1' ? {} : { parte })
    lineas.push(base)
  }
  lineas.forEach((e, i) => {
    if (e.tipo !== 'linea' || e.inicio_ms === null) return
    const sig = lineas.slice(i + 1).find((x) => x.inicio_ms !== null)
    const tope = sig?.inicio_ms ?? e.inicio_ms + 4000
    const hueco = tope - e.inicio_ms
    if (rng() < 0.4) e.fin_ms = e.inicio_ms + 1 + entero(hueco)
    else if (hueco >= 200 && rng() < 0.2) {
      const fin = e.inicio_ms + 100 + entero(hueco - 100)
      e.palabras = [
        { texto: 'Uno', inicio_ms: e.inicio_ms, fin_ms: e.inicio_ms + 50 },
        { texto: 'dos', inicio_ms: e.inicio_ms + 50, fin_ms: fin }
      ]
      if (rng() < 0.5) e.origen_palabras = 'manual'
    }
  })
  const base = { origen: 'manual' as const, lrclib_id: null, offset_ms: 0, lineas }
  return conReparto ? { ...base, partes: { cantantes } } : base
}
