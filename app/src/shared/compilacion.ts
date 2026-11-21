// Número de compilación y líneas de versión (spec 08, fase 10). Módulo puro, común a main y renderer.
import { z } from 'zod'

export const compilacionSchema = z.object({
  canal: z.enum(['publicada', 'desarrollo', 'local']),
  numero: z.number().int().min(1).nullable(),
  commit: z.string().nullable()
})
export type Compilacion = z.infer<typeof compilacionSchema>

export const COMPILACION_LOCAL: Compilacion = { canal: 'local', numero: null, commit: null }

/** `0.2.0-alpha.2-1234`; solo la versión en `local` o sin número. */
export function numeroVisible(version: string, c: Compilacion): string {
  return c.canal === 'local' || c.numero === null ? version : `${version}-${c.numero}`
}

/** Hash de 7 caracteres, o `null` si no se conoce. */
export function hashCorto(c: Compilacion): string | null {
  return c.commit && c.commit.length >= 7 ? c.commit.slice(0, 7) : null
}

/** `aj.compilacion.id`: `{número} ({canal}, commit {hash})` y sus variantes. */
export function identificador(version: string, c: Compilacion): string {
  const hash = hashCorto(c)
  const commit = hash ? `commit ${hash}` : 'sin commit'
  if (c.canal === 'local' || c.numero === null) {
    return `${version} (local, sin número, ${commit})`
  }
  return `${numeroVisible(version, c)} (${c.canal}, ${commit})`
}

/** `aj.detalles.version`: la última línea de todo «Copiar detalles». */
export function lineaVersion(version: string, c: Compilacion): string {
  return `Versión: ${identificador(version, c)}`
}
