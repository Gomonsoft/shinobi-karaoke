import { useEffect, useState } from 'react'
import type { TandaPreparacionIpc } from '@shared/ipc'

/**
 * Tanda actual de la cola de preparación (ADR 0025 §5): la lectura inicial de `preparacion.tanda()`
 * y, después, el evento `preparacion:tanda`. `null` sin tanda. Sin la API (pruebas sueltas), `null`.
 */
export function useTandaPreparacion(): TandaPreparacionIpc | null {
  const [tanda, setTanda] = useState<TandaPreparacionIpc | null>(null)
  useEffect(() => {
    let activo = true
    const api = window.shinobi?.preparacion
    if (typeof api?.tanda !== 'function' || typeof api.alTanda !== 'function') return
    void api.tanda().then(
      (t) => activo && setTanda((actual) => actual ?? t),
      () => undefined
    )
    const baja = api.alTanda((t) => activo && setTanda(t))
    return () => {
      activo = false
      baja()
    }
  }, [])
  return tanda
}
