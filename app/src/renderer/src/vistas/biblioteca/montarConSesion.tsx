import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import type { ApiShinobi, ResumenCancionIpc } from '@shared/ipc'
import type { EstadoSesionIpc, ListaPantallasIpc } from '@shared/sesion'
import { ContenedorToasts } from '../../componentes/Toasts'
import { NavegacionContexto, type Vista } from '../../navegacion/estado'
import { ReproductorContexto } from '../../navegacion/reproductor'
import { instalarApiSesion } from '../../sesion/pruebas'
import { ProveedorSesion } from '../../sesion/ProveedorSesion'
import { Biblioteca, reiniciarFiltroDeSesion } from './Biblioteca'
import { fixtures } from './fixturesApi'

/**
 * Solo pruebas: monta la Biblioteca con el estado de sesión doble de 0183 (`ProveedorSesion` y
 * `window.shinobi.sesion/cola/pantallas` falsos) y la API de biblioteca mínima de `fixturesApi`.
 */
export function montarConSesion(
  canciones: ResumenCancionIpc[],
  estado: EstadoSesionIpc,
  opciones: {
    pantallas?: ListaPantallasIpc
    biblioteca?: Partial<ApiShinobi['biblioteca']>
    /** `config.reproductor.secundaria` guardado. */
    config?: unknown
    /** Se pinta dentro del proveedor, junto a la Biblioteca (p. ej. una sonda del contexto). */
    hijos?: ReactNode
  } = {}
) {
  reiniciarFiltroDeSesion()
  const ir = vi.fn<(v: Vista) => void>()
  const abrir = vi.fn<(id: string) => void>()
  const api = fixtures({
    biblioteca: opciones.biblioteca,
    listar: () => Promise.resolve(canciones)
  })
  const config = api.config as unknown as { obtener: () => Promise<unknown> }
  const base = config.obtener
  config.obtener = async () => ({
    ...((await base()) as object),
    reproductor: { secundaria: opciones.config ?? null }
  })
  ;(window as unknown as { shinobi: ApiShinobi }).shinobi = api
  const sesion = instalarApiSesion(estado, opciones.pantallas)
  const vista = render(
    <NavegacionContexto.Provider value={{ vista: { tipo: 'biblioteca' }, ir }}>
      <ReproductorContexto.Provider value={{ abrir, abierto: null }}>
        <ProveedorSesion>
          <Biblioteca />
          {opciones.hijos}
          <ContenedorToasts />
        </ProveedorSesion>
      </ReproductorContexto.Provider>
    </NavegacionContexto.Provider>
  )
  return { ...vista, ir, abrir, api, sesion }
}
