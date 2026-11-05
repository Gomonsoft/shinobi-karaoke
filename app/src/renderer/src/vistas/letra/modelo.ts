import type { ElementoLetra } from '@shared/letra'

/** `[mm:ss.x]` (décimas) de un inicio en milisegundos. */
export function marcaDeTiempo(ms: number): string {
  const decimas = Math.floor(Math.max(0, ms) / 100)
  const d = decimas % 10
  const totalS = Math.floor(decimas / 10)
  const s = String(totalS % 60).padStart(2, '0')
  const m = String(Math.floor(totalS / 60)).padStart(2, '0')
  return `[${m}:${s}.${d}]`
}

export interface FilaPrevia {
  id: string
  pausa: boolean
  marca: string | null
  texto: string
}

/** Filas de la vista previa: las pausas son renglones vacíos. */
export function filasDePrevia(lineas: readonly ElementoLetra[]): FilaPrevia[] {
  return lineas.map((e) => ({
    id: e.id,
    pausa: e.tipo === 'pausa',
    marca: e.tipo === 'linea' && e.inicio_ms !== null ? marcaDeTiempo(e.inicio_ms) : null,
    texto: e.tipo === 'linea' ? e.texto : ''
  }))
}
