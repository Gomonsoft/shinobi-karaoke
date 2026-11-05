/**
 * Letras **inventadas** (nunca reales; ADR 0005, Revisión 2026-11-05) para los tests de 0078–0083 y los
 * E2E (0088). Solo para tests y herramientas de Node: lee los archivos del disco.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const NOMBRES_FIXTURES_LETRAS = [
  'por-linea.lrc',
  'varias-marcas-offset.lrc',
  'mejorado.lrc',
  'con-palabras.lyricsfile.yaml',
  'sin-palabras.lyricsfile.yaml',
  'texto-plano.txt',
  'lrclib-get.json',
  'lrclib-search.json',
  'lrclib-instrumental.json'
] as const

export type NombreFixtureLetra = (typeof NOMBRES_FIXTURES_LETRAS)[number]

/** Directorio con los archivos (para que los E2E los copien o los sirvan). */
export const DIR_FIXTURES_LETRAS = __dirname

export function leerFixtureLetra(nombre: NombreFixtureLetra): string {
  return readFileSync(join(DIR_FIXTURES_LETRAS, nombre), 'utf8')
}

export function leerFixtureLetraJson<T = unknown>(nombre: NombreFixtureLetra): T {
  return JSON.parse(leerFixtureLetra(nombre)) as T
}
