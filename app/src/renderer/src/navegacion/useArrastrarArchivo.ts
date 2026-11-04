import { useEffect } from 'react'
import { mostrarToast } from '../componentes/gestorToasts'
import type { Vista } from './estado'

/** Formatos anunciados en la Biblioteca vacía (docs/ux/02) y en la vista 03. */
export const EXTENSIONES_ADMITIDAS = [
  'mp3',
  'm4a',
  'flac',
  'wav',
  'ogg',
  'mp4',
  'mkv',
  'mov',
  'webm'
] as const

export function esArchivoAdmitido(nombre: string): boolean {
  const punto = nombre.lastIndexOf('.')
  if (punto < 0) return false
  return (EXTENSIONES_ADMITIDAS as readonly string[]).includes(
    nombre.slice(punto + 1).toLowerCase()
  )
}

const traeArchivos = (e: DragEvent): boolean =>
  Array.from(e.dataTransfer?.types ?? []).includes('Files')

/**
 * Arrastrar un archivo de audio o vídeo sobre la Biblioteca abre la vista 03 recordando su
 * ruta (la importación real llega en la Fase 2). En cualquier vista se evita que Electron
 * navegue al archivo soltado.
 */
export function useArrastrarArchivo(vista: Vista, ir: (v: Vista) => void): void {
  const enBiblioteca = vista.tipo === 'biblioteca'
  useEffect(() => {
    const alArrastrar = (e: DragEvent) => {
      if (traeArchivos(e)) e.preventDefault()
    }
    const alSoltar = (e: DragEvent) => {
      if (!traeArchivos(e)) return
      e.preventDefault()
      if (!enBiblioteca) return
      const archivos = Array.from(e.dataTransfer?.files ?? [])
      const primero = archivos[0]
      if (!primero) return
      if (archivos.length > 1) {
        mostrarToast({ tipo: 'aviso', mensaje: 'Añade las canciones de una en una.' })
      }
      if (!esArchivoAdmitido(primero.name)) {
        mostrarToast({
          tipo: 'aviso',
          mensaje:
            'Ese tipo de archivo no se puede usar. Prueba con un archivo de audio o de vídeo.'
        })
        return
      }
      ir({ tipo: 'anadir', archivo: window.shinobi.rutaDeArchivo(primero) })
    }
    window.addEventListener('dragover', alArrastrar)
    window.addEventListener('drop', alSoltar)
    return () => {
      window.removeEventListener('dragover', alArrastrar)
      window.removeEventListener('drop', alSoltar)
    }
  }, [enBiblioteca, ir])
}
