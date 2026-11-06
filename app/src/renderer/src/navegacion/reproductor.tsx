import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ReproductorBiblioteca } from '../vistas/reproductor/ReproductorBiblioteca'
import { useNavegacion } from './estado'

export interface ControlReproductor {
  abrir(cancionId: string): void
  abierto: string | null
}

export const ReproductorContexto = createContext<ControlReproductor | null>(null)
const CerrarReproductorContexto = createContext(() => {})
const controlVacio: ControlReproductor = { abrir: () => {}, abierto: null }

export function useReproductor(): ControlReproductor {
  return useContext(ReproductorContexto) ?? controlVacio
}

export function ProveedorReproductor({ children }: { children: ReactNode }) {
  const navegacion = useNavegacion()
  const actual = useRef(navegacion)
  const [abierto, setAbierto] = useState<string | null>(null)
  const idAbierto = useRef<string | null>(null)

  useEffect(() => {
    actual.current = navegacion
  }, [navegacion])

  const abrir = useCallback((id: string) => {
    if (idAbierto.current !== null || actual.current.vista.tipo === 'primer-arranque') return
    const abrirCapa = () => {
      idAbierto.current = id
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
    requestAnimationFrame(() => {
      if (idAbierto.current !== null) return
      const tarjetas = document.querySelectorAll<HTMLElement>('[data-tarjeta]')
      Array.from(tarjetas)
        .find((tarjeta) => tarjeta.dataset.tarjeta === id)
        ?.focus({ preventScroll: false })
    })
  }, [])

  return (
    <ReproductorContexto.Provider value={{ abrir, abierto }}>
      <CerrarReproductorContexto.Provider value={cerrar}>
        {children}
      </CerrarReproductorContexto.Provider>
    </ReproductorContexto.Provider>
  )
}

export function CapaReproductor() {
  const { abierto } = useReproductor()
  const cerrar = useContext(CerrarReproductorContexto)
  return abierto === null ? null : (
    <ReproductorBiblioteca key={abierto} id={abierto} alCerrar={cerrar} />
  )
}
