import { homedir } from 'node:os'
import { posix, resolve, win32 } from 'node:path'

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

  // Reglas de rutas de la plataforma pedida, no de la que ejecuta el código
  // (la función es pura y se prueba para los tres SO desde cualquiera).
  if (plataforma === 'win32') {
    const base = env.LOCALAPPDATA || win32.join(hogar, 'AppData', 'Local')
    return win32.join(base, 'ShinobiKaraoke')
  }
  if (plataforma === 'darwin') {
    return posix.join(hogar, 'Library', 'Application Support', 'Shinobi Karaoke')
  }
  const base = env.XDG_DATA_HOME || posix.join(hogar, '.local', 'share')
  return posix.join(base, 'shinobi-karaoke')
}

/** Directorio de datos de la app: `SHINOBI_DATOS` o la ruta por SO del ADR 0006. */
export function rutaDatos(): string {
  return resolve(
    resolverRutaDatos({ plataforma: process.platform, env: process.env, hogar: homedir() })
  )
}
