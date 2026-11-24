import { useEffect, useState } from 'react'

const CONSULTA_COMPACTA = '(max-width: 1279px)'

/**
 * Por debajo de 1280 px de ancho (también 1280 × 720 al 125 %) los botones de la fila de controles de la
 * línea de tiempo son solo el icono (AS1, spec 06): con tooltip y nombre accesible con el texto.
 */
export function useSoloIcono(): boolean {
  const [solo, setSolo] = useState(() => window.matchMedia?.(CONSULTA_COMPACTA).matches ?? false)
  useEffect(() => {
    const lista = window.matchMedia?.(CONSULTA_COMPACTA)
    if (!lista) return
    const alCambiar = () => setSolo(lista.matches)
    lista.addEventListener('change', alCambiar)
    return () => lista.removeEventListener('change', alCambiar)
  }, [])
  return solo
}
