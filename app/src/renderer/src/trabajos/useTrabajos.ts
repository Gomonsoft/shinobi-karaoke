import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { EventoProgresoIpc, TrabajoIpc } from '@shared/ipc'

/** Tiempo que el indicador muestra "✓ Terminado" al acabar todos los trabajos (docs/ux/04 §2). */
export const DURACION_TERMINADO_MS = 4000

export interface EstadoTrabajos {
  /** Trabajos en curso y en cola (los terminados desaparecen). */
  trabajos: TrabajoIpc[]
  /** Último progreso recibido por id de trabajo. */
  progreso: Record<string, EventoProgresoIpc>
  /** `true` durante 4 s tras terminar el último trabajo activo. */
  terminado: boolean
}

const VACIO: EstadoTrabajos = { trabajos: [], progreso: {}, terminado: false }

export const TrabajosContexto = createContext<EstadoTrabajos>(VACIO)

/** Estado de los trabajos en segundo plano, común a la barra superior y a las tarjetas. */
export function useTrabajosVivos(): EstadoTrabajos {
  return useContext(TrabajosContexto)
}

/**
 * Suscripción a `window.shinobi.trabajos` (0014): `listar()` da el estado inicial y
 * `alCambiar` / `alProgreso` las altas, bajas y el progreso. Los eventos que llegan antes de
 * la respuesta de `listar()` prevalecen sobre ella (son más recientes).
 */
export function useEstadoTrabajos(): EstadoTrabajos {
  const [estado, setEstado] = useState<EstadoTrabajos>(VACIO)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let activo = true
    const mapa = new Map<string, TrabajoIpc>()
    const progreso = new Map<string, EventoProgresoIpc>()
    const porEvento = new Set<string>()
    let huboCompletado = false
    let terminado = false

    const publicar = () => {
      if (!activo) return
      setEstado({
        trabajos: [...mapa.values()],
        progreso: Object.fromEntries(progreso),
        terminado
      })
    }
    const quitarTerminado = () => {
      if (temporizador.current) clearTimeout(temporizador.current)
      temporizador.current = null
      terminado = false
    }

    const bajaCambios = window.shinobi.trabajos.alCambiar((t) => {
      porEvento.add(t.id)
      if (t.estado === 'terminado') {
        const habia = mapa.size > 0
        mapa.delete(t.id)
        progreso.delete(t.id)
        if (t.resultado === 'completado') huboCompletado = true
        if (habia && mapa.size === 0 && huboCompletado) {
          huboCompletado = false
          terminado = true
          temporizador.current = setTimeout(() => {
            terminado = false
            publicar()
          }, DURACION_TERMINADO_MS)
        }
      } else {
        if (terminado) quitarTerminado()
        mapa.set(t.id, t)
      }
      publicar()
    })
    const bajaProgreso = window.shinobi.trabajos.alProgreso((p) => {
      if (mapa.has(p.id) || !porEvento.has(p.id)) progreso.set(p.id, p)
      publicar()
    })
    window.shinobi.trabajos.listar().then(
      (lista) => {
        if (!activo) return
        for (const t of lista) if (!porEvento.has(t.id)) mapa.set(t.id, t)
        publicar()
      },
      () => undefined // sin lista inicial solo se perdería el estado previo: se sigue por eventos
    )
    return () => {
      activo = false
      bajaCambios()
      bajaProgreso()
      quitarTerminado()
    }
  }, [])

  return estado
}
