import { useCallback, useEffect, useState } from 'react'
import type { EstadoActualizacionesIpc } from '@shared/ipc'

/** Estado del aviso de versión nueva (ADR 0023): lectura inicial y evento de cambio. */
export function useActualizaciones(): {
  estado: EstadoActualizacionesIpc | null
  refrescar: () => Promise<void>
} {
  const [estado, setEstado] = useState<EstadoActualizacionesIpc | null>(null)
  // Sin API (pruebas de otras vistas) no hay aviso.
  const api = window.shinobi.actualizaciones
  const refrescar = useCallback(() => {
    if (typeof api?.estado !== 'function') return Promise.resolve()
    return api.estado().then(setEstado, () => undefined)
  }, [api])
  useEffect(() => {
    void refrescar()
    if (typeof api?.alCambiar !== 'function') return
    return api.alCambiar(setEstado)
  }, [api, refrescar])
  return { estado, refrescar }
}
