import { useCallback, useRef } from 'react'

/**
 * Relleno derecho del panel solo con barras de desplazamiento superpuestas (macOS): ahí
 * `scrollbar-gutter` no reserva sitio y la barra tapa el texto. Con barra clásica el hueco ya está
 * reservado y un relleno más lo estrecharía. Se mide con el ancho de la barra (`offsetWidth − clientWidth`).
 */
export function useRellenoBarra(): (nodo: HTMLElement | null) => void {
  const observador = useRef<ResizeObserver | null>(null)
  return useCallback((nodo: HTMLElement | null) => {
    observador.current?.disconnect()
    observador.current = null
    if (!nodo) return
    const medir = () => {
      const barra = nodo.offsetWidth - nodo.clientWidth
      nodo.style.setProperty('--relleno-barra', barra > 0 ? '0px' : '12px')
    }
    medir()
    if (typeof ResizeObserver === 'undefined') return
    observador.current = new ResizeObserver(medir)
    observador.current.observe(nodo)
    // El contenido cambia de alto sin cambiar el del panel: la barra aparece o desaparece.
    for (const hijo of Array.from(nodo.children)) observador.current.observe(hijo)
  }, [])
}
