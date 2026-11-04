import { useCallback, useEffect, useRef, useState } from 'react'
import type { ResumenCancionIpc } from '@shared/ipc'

export const RETRASO_CARGA_LENTA_MS = 3000

export type EstadoCarga = 'cargando' | 'listo' | 'error'

export interface BibliotecaDatos {
  estado: EstadoCarga
  /** Pasados 3 s sin respuesta (muestra "Cargando tu biblioteca…"). */
  lenta: boolean
  canciones: ResumenCancionIpc[]
  reintentar(): void
}

/**
 * Canciones de la biblioteca. Se leen al entrar en la vista y, después, los cambios en vivo
 * actualizan las tarjetas **en su sitio**: no se reordenan hasta volver a entrar (docs/ux/02).
 * Una canción nueva se añade al final; una eliminada se quita.
 */
export function useBiblioteca(): BibliotecaDatos {
  const [estado, setEstado] = useState<EstadoCarga>('cargando')
  const [lenta, setLenta] = useState(false)
  const [canciones, setCanciones] = useState<ResumenCancionIpc[]>([])
  const [intento, setIntento] = useState(0)
  const cargada = useRef(false)

  useEffect(() => {
    let activo = true
    cargada.current = false
    const temporizador = setTimeout(() => activo && setLenta(true), RETRASO_CARGA_LENTA_MS)
    window.shinobi.biblioteca.listar().then(
      (lista) => {
        if (!activo) return
        clearTimeout(temporizador)
        cargada.current = true
        setCanciones(lista)
        setEstado('listo')
      },
      () => {
        if (!activo) return
        clearTimeout(temporizador)
        setEstado('error')
      }
    )
    const baja = window.shinobi.alCambiarCancion((evento) => {
      // Los eventos anteriores a la primera lectura se ignoran: `listar()` ya los incluye.
      if (!activo || !cargada.current) return
      setCanciones((actual) => {
        if (evento.eliminada) return actual.filter((c) => c.id !== evento.id)
        if (!evento.resumen) return actual
        const i = actual.findIndex((c) => c.id === evento.id)
        if (i < 0) return [...actual, evento.resumen]
        const copia = actual.slice()
        copia[i] = evento.resumen
        return copia
      })
    })
    return () => {
      activo = false
      clearTimeout(temporizador)
      baja()
    }
  }, [intento])

  const reintentar = useCallback(() => {
    setEstado('cargando')
    setLenta(false)
    setIntento((n) => n + 1)
  }, [])
  return { estado, lenta, canciones, reintentar }
}
