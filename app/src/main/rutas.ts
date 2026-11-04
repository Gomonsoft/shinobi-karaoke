import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export interface EntornoRutas {
  plataforma: NodeJS.Platform
  env: Record<string, string | undefined>
  hogar: string
}

/**
 * Directorio de datos de la app (ADR 0006). `SHINOBI_DATOS` tiene prioridad
 * (desarrollo y pruebas). Función pura: no toca el disco ni `process`.
 */
export function resolverRutaDatos({ plataforma, env, hogar }: EntornoRutas): string {
  const forzada = env.SHINOBI_DATOS
  if (forzada) return forzada

  if (plataforma === 'win32') {
    const base = env.LOCALAPPDATA || join(hogar, 'AppData', 'Local')
    return join(base, 'ShinobiKaraoke')
  }
  if (plataforma === 'darwin') {
    return join(hogar, 'Library', 'Application Support', 'Shinobi Karaoke')
  }
  const base = env.XDG_DATA_HOME || join(hogar, '.local', 'share')
  return join(base, 'shinobi-karaoke')
}

/** Directorio de datos de la app: `SHINOBI_DATOS` o la ruta por SO del ADR 0006. */
export function rutaDatos(): string {
  return resolve(
    resolverRutaDatos({ plataforma: process.platform, env: process.env, hogar: homedir() })
  )
}
