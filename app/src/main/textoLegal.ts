import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { TextoLegal } from '../shared/ipc'

const ARCHIVOS: Record<TextoLegal, string> = { gpl: 'LICENSE', terceros: 'THIRD_PARTY_NOTICES.md' }

export interface OpcionesTextoLegal {
  empaquetada: boolean
  /** `process.resourcesPath` (empaquetada; la tarea 0025 copia ahí los dos archivos). */
  dirRecursos: string
  /** Raíz del repo (sin empaquetar). */
  raizRepo: string
}

/** Lee un texto legal del disco, sin red. El nombre de archivo sale de una lista cerrada. */
export function leerTextoLegal(tipo: TextoLegal, o: OpcionesTextoLegal): Promise<string> {
  const archivo = ARCHIVOS[tipo]
  if (!archivo) return Promise.reject(new Error('Texto legal desconocido'))
  return readFile(join(o.empaquetada ? o.dirRecursos : o.raizRepo, archivo), 'utf8').then(
    (texto) =>
      tipo === 'terceros'
        ? texto.replace(/^<!-- (?:inicio|fin):dependencias-(?:js|python) -->\r?\n?/gm, '')
        : texto
  )
}
