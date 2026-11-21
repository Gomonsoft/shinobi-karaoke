import type { EntradaIpc } from '@shared/sesion'

/**
 * Aritmética del reordenado de las pendientes (ADR 0017 §6). Ratón, teclado y menú pasan por
 * aquí, de modo que la misma intención produce siempre la misma llamada `cola.mover`.
 */

export type MovimientoTeclado = 'subir' | 'bajar' | 'inicio' | 'fin'

/** Posición final (0-based) de la entrada tras un movimiento; `null` si no cambia o no se puede. */
export function indiceTras(
  movimiento: MovimientoTeclado,
  indice: number,
  total: number
): number | null {
  if (indice < 0 || indice >= total) return null
  const destino =
    movimiento === 'subir'
      ? indice - 1
      : movimiento === 'bajar'
        ? indice + 1
        : movimiento === 'inicio'
          ? 0
          : total - 1
  return destino < 0 || destino >= total || destino === indice ? null : destino
}

/** `antesDe` para dejar `entradaId` en la posición final `indiceFinal` (`null`: al final). */
export function antesDeParaIndice(
  pendientes: readonly EntradaIpc[],
  entradaId: string,
  indiceFinal: number
): string | null {
  const resto = pendientes.filter((e) => e.entradaId !== entradaId)
  return resto[indiceFinal]?.entradaId ?? null
}

/**
 * Posición final de una entrada soltada en el hueco `hueco` (0 = antes de la primera,
 * `total` = tras la última) o `null` si soltarla ahí no la mueve.
 */
export function indiceTrasSoltar(indice: number, hueco: number): number | null {
  if (hueco === indice || hueco === indice + 1) return null
  return hueco > indice ? hueco - 1 : hueco
}

/** Hueco más cercano a la coordenada `y`, dadas las mitades verticales de las filas. */
export function huecoPorPosicion(centros: readonly number[], y: number): number {
  let hueco = 0
  for (const c of centros) if (y > c) hueco++
  return hueco
}

/**
 * Fila que recibe el foco cuando desaparece `idPerdido`: la siguiente de la lista anterior que
 * siga existiendo, si no la anterior, si no `null` (el encabezado).
 */
export function filaTrasQuitar(
  antes: readonly string[],
  ahora: readonly string[],
  idPerdido: string
): string | null {
  const i = antes.indexOf(idPerdido)
  const existentes = new Set(ahora)
  if (i === -1) return ahora[0] ?? null
  for (let k = i + 1; k < antes.length; k++) if (existentes.has(antes[k]!)) return antes[k]!
  for (let k = i - 1; k >= 0; k--) if (existentes.has(antes[k]!)) return antes[k]!
  return null
}
