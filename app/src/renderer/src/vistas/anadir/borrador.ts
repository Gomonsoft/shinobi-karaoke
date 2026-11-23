import type { ValoresDatos } from './CamposDatos'

/**
 * Lo escrito en «Revisar datos» al ir a Ajustes con «Cambiar en Ajustes» (docs/ux/03 · F6-N8): al volver
 * se vuelve a leer el mismo archivo o enlace y se recuperan los valores. Solo vive en memoria.
 */
export type BorradorAnadir =
  | { origen: 'archivo'; ruta: string; valores: ValoresDatos }
  | { origen: 'youtube'; url: string; valores: ValoresDatos }

let guardado: BorradorAnadir | null = null

export const guardarBorrador = (b: BorradorAnadir): void => {
  guardado = b
}
export const leerBorrador = (): BorradorAnadir | null => guardado
export const olvidarBorrador = (): void => {
  guardado = null
}
