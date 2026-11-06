import { MAX_BYTES_TEXTO_LETRA, MAX_ELEMENTOS_LETRA } from '@shared/letrasBusqueda'
import { limpiarTexto } from '@shared/letras'

export function textoSuperaLimites(texto: string): boolean {
  return (
    texto.length > MAX_BYTES_TEXTO_LETRA ||
    new TextEncoder().encode(texto).length > MAX_BYTES_TEXTO_LETRA ||
    limpiarTexto(texto).split('\n', MAX_ELEMENTOS_LETRA + 1).length > MAX_ELEMENTOS_LETRA
  )
}
