import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ReproductorBiblioteca } from '../vistas/reproductor/ReproductorBiblioteca'
import { useSesion } from '../sesion/ProveedorSesion'
import { useNavegacion } from './estado'

/** Opciones de `abrir`: «Probar» una «Lista para revisar» (docs/ux/02 · Feature 5, ADR 0025 §1). */
export interface OpcionesAbrirReproductor {
  /** Abre un borrador tal como está, sin cambiar su estado. */
  prueba?: boolean
  /** Se llama una vez cerrado el reproductor (con el foco ya devuelto a la tarjeta). */
  alCerrar?: () => void
}

export interface ControlReproductor {
  /** No hace nada mientras hay una sesión en otra ventana. */
  abrir(cancionId: string, opciones?: OpcionesAbrirReproductor): void
  abierto: string | null
  /** El reproductor abierto es una prueba de un borrador. */
  prueba?: boolean
}

export const ReproductorContexto = createContext<ControlReproductor | null>(null)
const CerrarReproductorContexto = createContext(() => {})
const controlVacio: ControlReproductor = { abrir: () => {}, abierto: null }

export function useReproductor(): ControlReproductor {
  return useContext(ReproductorContexto) ?? controlVacio
}

export function ProveedorReproductor({ children }: { children: ReactNode }) {
  const navegacion = useNavegacion()
  const { haySesion } = useSesion()
  const actual = useRef(navegacion)
  const conSesion = useRef(haySesion)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [prueba, setPrueba] = useState(false)
  const idAbierto = useRef<string | null>(null)
  const alCerrarPedido = useRef<(() => void) | undefined>(undefined)

  useEffect(() => {
    actual.current = navegacion
    conSesion.current = haySesion
  }, [navegacion, haySesion])

  const abrir = useCallback((id: string, opciones?: OpcionesAbrirReproductor) => {
    // Con sesión hay un solo transporte audible: el reproductor local no se abre (spec 02).
    if (conSesion.current) return
    if (idAbierto.current !== null || actual.current.vista.tipo === 'primer-arranque') return
    const abrirCapa = () => {
      idAbierto.current = id
      alCerrarPedido.current = opciones?.alCerrar
      setPrueba(opciones?.prueba === true)
      setAbierto(id)
    }
    if (actual.current.vista.tipo === 'biblioteca') abrirCapa()
    else actual.current.ir({ tipo: 'biblioteca' }, abrirCapa)
  }, [])

  const cerrar = useCallback(() => {
    const id = idAbierto.current
    if (id === null) return
    idAbierto.current = null
    setAbierto(null)
    setPrueba(false)
    const alCerrar = alCerrarPedido.current
    alCerrarPedido.current = undefined
    requestAnimationFrame(() => {
      if (idAbierto.current !== null) return
      const tarjetas = document.querySelectorAll<HTMLElement>('[data-tarjeta]')
      Array.from(tarjetas)
        .find((tarjeta) => tarjeta.dataset.tarjeta === id)
        ?.focus({ preventScroll: false })
      alCerrar?.()
    })
  }, [])

  return (
    <ReproductorContexto.Provider value={{ abrir, abierto, prueba }}>
      <CerrarReproductorContexto.Provider value={cerrar}>
        {children}
      </CerrarReproductorContexto.Provider>
    </ReproductorContexto.Provider>
  )
}

export function CapaReproductor() {
  const { abierto, prueba } = useReproductor()
  const cerrar = useContext(CerrarReproductorContexto)
  return abierto === null ? null : (
    <ReproductorBiblioteca key={abierto} id={abierto} prueba={prueba} alCerrar={cerrar} />
  )
}
