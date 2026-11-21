export interface SitioVersion {
  archivo: string
  valor: string
  pep440: boolean
}

export function validar(version: string): boolean
export function analizar(version: string): {
  numeros: number[]
  previa: { tipo: string; n: number } | null
}
export function comparar(a: string, b: string): number
export function aPep440(version: string): string
export function analizarEtiqueta(etiqueta: string): string
export function esPrevia(version: string): boolean
export function leerVersiones(raiz: string): SitioVersion[]
export function comprobarVersiones(raiz: string, opciones?: { etiqueta?: string }): string
export function subirVersion(raiz: string, nueva: string): { anterior: string; nueva: string }
export function raizDelRepositorio(): string
export const SITIOS: readonly { archivo: string; pep440: boolean }[]
