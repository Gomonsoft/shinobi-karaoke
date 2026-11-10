import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { AgruparBiblioteca } from '@shared/config'
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
 * Biblioteca compartida (0071, deuda del marco 0018): `App` lee `listar()` una sola vez y la
 * barra superior, el panel de actividad y la vista Biblioteca usan ese mismo estado. `null`
 * fuera de `App` (pruebas de componentes sueltos): `Biblioteca` entonces lee la suya.
 */
export const BibliotecaContexto = createContext<BibliotecaDatos | null>(null)

/** Datos de la biblioteca compartida, o `null` si no hay proveedor. */
export const useBibliotecaCompartida = (): BibliotecaDatos | null => useContext(BibliotecaContexto)

/**
 * Sustituye cada resumen por su versión nueva **sin cambiar el orden** de los que siguen existiendo;
 * las canciones nuevas van al final y las que ya no están salen (ADR 0016 §9: refresco tras
 * `temas:cambiado`; las tarjetas se actualizan en su sitio).
 */
export function fusionarResumenes(
  actual: readonly ResumenCancionIpc[],
  nueva: readonly ResumenCancionIpc[]
): ResumenCancionIpc[] {
  const porId = new Map(nueva.map((c) => [c.id, c]))
  const conservadas = actual.flatMap((c) => {
    const n = porId.get(c.id)
    return n ? [n] : []
  })
  const vistas = new Set(actual.map((c) => c.id))
  return [...conservadas, ...nueva.filter((c) => !vistas.has(c.id))]
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
    // `temas:cambiado` (catálogo, asignaciones, predeterminado): los resúmenes traen la apariencia
    // resuelta, así que se vuelve a pedir `listar()` una vez por evento y se fusiona en su sitio.
    let recarga = 0
    const bajaTemas = window.shinobi.alCambiarTemas?.(() => {
      if (!activo || !cargada.current) return
      const mia = ++recarga
      window.shinobi.biblioteca.listar().then(
        (lista) => {
          if (activo && mia === recarga) setCanciones((actual) => fusionarResumenes(actual, lista))
        },
        () => undefined
      )
    })
    return () => {
      activo = false
      clearTimeout(temporizador)
      baja()
      bajaTemas?.()
    }
  }, [intento])

  const reintentar = useCallback(() => {
    setEstado('cargando')
    setLenta(false)
    setIntento((n) => n + 1)
  }, [])
  return { estado, lenta, canciones, reintentar }
}

// «Agrupar por» se guarda en `config.biblioteca.agrupar`; la copia de sesión evita el parpadeo al volver.
let agruparDeSesion: AgruparBiblioteca = 'ninguno'
/** Solo para pruebas. */
export function reiniciarAgruparDeSesion(): void {
  agruparDeSesion = 'ninguno'
}

/**
 * Preferencia «Agrupar por»: se lee de `config` (y sigue a `alCambiarConfig`) y se escribe con
 * `config.actualizar`. Si la escritura falla, la vista agrupa igual durante la sesión, sin aviso.
 */
export function useAgrupar(): [AgruparBiblioteca, (valor: AgruparBiblioteca) => void] {
  const [agrupar, setAgruparEstado] = useState<AgruparBiblioteca>(agruparDeSesion)
  useEffect(() => {
    let activo = true
    const aplicar = (valor: AgruparBiblioteca | undefined) => {
      if (!activo || !valor) return
      agruparDeSesion = valor
      setAgruparEstado(valor)
    }
    window.shinobi.config?.obtener().then(
      (c) => aplicar(c.biblioteca?.agrupar),
      () => undefined
    )
    const baja = window.shinobi.alCambiarConfig?.((c) => aplicar(c.biblioteca?.agrupar))
    return () => {
      activo = false
      baja?.()
    }
  }, [])
  const cambiar = useCallback((valor: AgruparBiblioteca) => {
    agruparDeSesion = valor
    setAgruparEstado(valor)
    void Promise.resolve(
      window.shinobi.config?.actualizar({ biblioteca: { agrupar: valor } })
    ).catch(() => undefined)
  }, [])
  return [agrupar, cambiar]
}
