import type { Letra } from '@shared/letra'
import { cantantesDe, parteDe, tieneReparto, type Parte } from '@shared/reparto'

/**
 * Partes «en uso» de una canción, para los avisos de contraste y las filas de «Colores de los
 * cantantes»: todos los cantantes (el Cantante 1 siempre) y «Todos» y «Coro» solo si tienen líneas.
 * Sin reparto, ninguna (la canción no usa nada de esto).
 */
export function partesEnUso(letra: Pick<Letra, 'partes' | 'lineas'>): Parte[] {
  if (!tieneReparto(letra)) return []
  const usadas = new Set(
    letra.lineas.filter((l) => l.tipo === 'linea').map((l) => parteDe(l, letra))
  )
  return [
    ...cantantesDe(letra).map((c) => c.id),
    ...(['todos', 'coro'] as const).filter((p) => usadas.has(p))
  ]
}
