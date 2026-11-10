import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CatalogoIpc } from '@shared/ipc'

export type TemaCatalogo = CatalogoIpc['temas'][number]

const COMPARADOR = new Intl.Collator(undefined, { sensitivity: 'base' })

/** Orden alfabético del idioma, sin distinguir mayúsculas ni tildes. */
export function ordenarTemas<T extends { nombre: string }>(temas: readonly T[]): T[] {
  return [...temas].sort((a, b) => COMPARADOR.compare(a.nombre, b.nombre))
}

export interface CatalogoTemas {
  catalogo: CatalogoIpc | null
  cargando: boolean
  /** Error de la carga inicial (el catálogo sigue `null`). */
  error: unknown
  soloLectura: boolean
  /** Temas ofrecibles (sin los que están en borrado), ordenados. */
  ofrecibles: TemaCatalogo[]
  recargar(): Promise<void>
}

/** Catálogo vivo: carga `temas.catalogo()` y se mantiene al día con `alCambiarTemas`. */
export function useCatalogoTemas(): CatalogoTemas {
  const [catalogo, setCatalogo] = useState<CatalogoIpc | null>(null)
  const [error, setError] = useState<unknown>(null)
  // Un evento más reciente que la carga en vuelo la invalida.
  const version = useRef(0)

  const cargar = useCallback(async () => {
    const mia = ++version.current
    try {
      const c = await window.shinobi.temas.catalogo()
      if (mia === version.current) {
        setCatalogo(c)
        setError(null)
      }
    } catch (e) {
      if (mia === version.current) setError(e)
    }
  }, [])

  useEffect(() => {
    let vivo = true
    // Los dobles de pruebas ajenas a los temas pueden no definir la suscripción.
    const desuscribir = (window.shinobi.alCambiarTemas ?? (() => () => undefined))((c) => {
      if (!vivo) return
      version.current++
      setCatalogo(c)
      setError(null)
    })
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar()
    return () => {
      vivo = false
      // eslint-disable-next-line react-hooks/exhaustive-deps
      version.current++
      desuscribir()
    }
  }, [cargar])

  const ofrecibles = useMemo(
    () => ordenarTemas((catalogo?.temas ?? []).filter((t) => !t.enBorrado)),
    [catalogo]
  )

  return {
    catalogo,
    cargando: catalogo === null && error === null,
    error,
    soloLectura: catalogo?.soloLectura ?? false,
    ofrecibles,
    recargar: cargar
  }
}
