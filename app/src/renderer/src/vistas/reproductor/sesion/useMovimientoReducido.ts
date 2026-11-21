import { useEffect, useState } from 'react'

const MEDIA_REDUCIDA = '(prefers-reduced-motion: reduce)'

export function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(
    () => window.matchMedia?.(MEDIA_REDUCIDA).matches ?? false
  )
  useEffect(() => {
    const media = window.matchMedia?.(MEDIA_REDUCIDA)
    const cambio = () => setReducido(media?.matches ?? false)
    media?.addEventListener?.('change', cambio)
    return () => media?.removeEventListener?.('change', cambio)
  }, [])
  return reducido
}
