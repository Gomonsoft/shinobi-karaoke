import { useEffect } from 'react'
import { mostrarToast } from '../componentes/gestorToasts'
import { abrirImportarPaquete } from '../vistas/biblioteca/paquete/almacen'
import { PAQ } from '../vistas/biblioteca/paquete/textos'
import type { Vista } from './estado'

/** Extensión de los paquetes y las copias de seguridad (ADR 0027). */
const esPaquete = (nombre: string): boolean => nombre.toLowerCase().endsWith('.shinobi')

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
  const enAjustes = vista.tipo === 'ajustes'
  useEffect(() => {
    const alArrastrar = (e: DragEvent) => {
      if (traeArchivos(e)) e.preventDefault()
    }
    const alSoltar = (e: DragEvent) => {
      if (!traeArchivos(e)) return
      e.preventDefault()
      // Un paquete `.shinobi` abre el diálogo de importar, en la Biblioteca y en Ajustes y sin otro
      // diálogo abierto (docs/ux/02 · Feature 9). El renderer solo pasa el `File`: main saca la ruta.
      const soltados = Array.from(e.dataTransfer?.files ?? [])
      const paquete = soltados[0]
      if (paquete && esPaquete(paquete.name)) {
        if ((enBiblioteca || enAjustes) && !document.querySelector('[role="dialog"]')) {
          if (soltados.length > 1) mostrarToast({ tipo: 'aviso', mensaje: PAQ.arrastrarVarios })
          abrirImportarPaquete(paquete)
        }
        return
      }
      if (!enBiblioteca) return
      const archivos = Array.from(e.dataTransfer?.files ?? [])
      const primero = archivos[0]
      if (!primero) return
      const hayCarpeta = Array.from(e.dataTransfer?.items ?? []).some(
        (i) => i.kind === 'file' && i.webkitGetAsEntry?.()?.isDirectory === true
      )
      const rutas = archivos
        .map((f) => window.shinobi.rutaDeArchivo(f))
        .filter((r) => !/\.shinobi$/i.test(r))
      if (rutas.length === 0) return
      // Varios archivos o una carpeta: modo lote (spec 02 · feature 7). Un archivo: como siempre.
      if (rutas.length > 1 || hayCarpeta || rutas.length < archivos.length) {
        ir({ tipo: 'anadir', archivos: rutas })
        return
      }
      if (!esArchivoAdmitido(primero.name)) {
        mostrarToast({
          tipo: 'aviso',
          mensaje:
            'Ese tipo de archivo no se puede usar. Prueba con un archivo de audio o de vídeo.'
        })
        return
      }
      ir({ tipo: 'anadir', archivo: rutas[0] })
    }
    window.addEventListener('dragover', alArrastrar)
    window.addEventListener('drop', alSoltar)
    return () => {
      window.removeEventListener('dragover', alArrastrar)
      window.removeEventListener('drop', alSoltar)
    }
  }, [enBiblioteca, enAjustes, ir])
}
