import type { ElementoLetra } from '../letra'
import { comprobarTamanoTexto, limpiarTexto, normalizarLetra, type GeneradorId } from './normalizar'

/**
 * Texto plano → elementos sin tiempos. Un renglón es una línea; los vacíos son
 * pausas (varios seguidos se funden; los del principio y del final se descartan).
 */
export function textoPlanoALetra(texto: string, generarId?: GeneradorId): ElementoLetra[] {
  comprobarTamanoTexto(texto)
  const elementos: ElementoLetra[] = limpiarTexto(texto)
    .split('\n')
    .map((r) => r.trim())
    .map((r) => ({
      id: '',
      tipo: r === '' ? 'pausa' : 'linea',
      texto: r,
      inicio_ms: null,
      fin_ms: null,
      palabras: null
    }))
  return normalizarLetra(elementos, generarId)
}
