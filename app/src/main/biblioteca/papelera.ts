import { cp, mkdir, rename, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { ShellBiblioteca } from './operaciones'

/** Variable de entorno que sustituye la papelera real en las pruebas E2E (0023). */
export const VARIABLE_PAPELERA_PRUEBAS = 'SHINOBI_PAPELERA_PRUEBAS'

/**
 * Devuelve un `shell` cuyo `trashItem` no toca la papelera real si `SHINOBI_PAPELERA_PRUEBAS`
 * está definida. Se ignora siempre en la app empaquetada.
 * - Ruta de directorio: renombra la carpeta a `<ruta>/<nombre>-<marca de tiempo>`.
 * - `fallar`: `trashItem` rechaza.
 */
export function shellConPapeleraDePruebas<T extends ShellBiblioteca>(
  shell: T,
  opciones: { env: NodeJS.ProcessEnv; empaquetada: boolean; ahora?: () => number }
): T | ShellBiblioteca {
  const valor = opciones.env[VARIABLE_PAPELERA_PRUEBAS]
  if (opciones.empaquetada || !valor) return shell
  const ahora = opciones.ahora ?? Date.now
  return {
    openPath: (ruta) => shell.openPath(ruta),
    trashItem: async (carpeta) => {
      if (valor === 'fallar') throw new Error('Papelera de pruebas: fallo simulado.')
      await mkdir(valor, { recursive: true })
      const destino = join(valor, `${basename(carpeta)}-${ahora()}`)
      try {
        await rename(carpeta, destino)
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e
        await cp(carpeta, destino, { recursive: true })
        await rm(carpeta, { recursive: true, force: true })
      }
    }
  }
}
