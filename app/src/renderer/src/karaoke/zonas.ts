import type { Letra } from '@shared/letra'

/**
 * Una zona de la pantalla con su propia secuencia de líneas (ADR 0029 §4 bis). En 0.2.2 hay una
 * sola que cubre toda la pantalla; 0.2.3 repartirá la letra en varias. La región va en fracciones
 * del alto de la pantalla: `PantallaLetra` las pasa a píxeles al disponer el bloque.
 */
export interface ZonaLetra {
  id: string
  lineas: Letra['lineas']
  region: { y0: number; alto: number }
}

export const ZONA_PANTALLA_ENTERA = 'todas'

export function zonasDeLetra(letra: Pick<Letra, 'lineas'>): ZonaLetra[] {
  return [{ id: ZONA_PANTALLA_ENTERA, lineas: letra.lineas, region: { y0: 0, alto: 1 } }]
}
