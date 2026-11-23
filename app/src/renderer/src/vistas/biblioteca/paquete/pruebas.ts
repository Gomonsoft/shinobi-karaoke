import { vi } from 'vitest'
import type {
  ApiShinobi,
  CambioCopiaIpc,
  ProgresoCopiaIpc,
  ResumenCancionIpc,
  ResumenPaqueteIpc
} from '@shared/ipc'
import { apiNuevaFalsa, letrasNuevasFalsas } from '../../apiNuevaFalsa'

type Copias = ApiShinobi['copias']

/**
 * Solo pruebas: `window.shinobi` con un doble de `copias` cuyos eventos se disparan a mano
 * (`cambio`, `progreso`). Todo lo demás son los dobles de `apiNuevaFalsa`.
 */
export function montarApiPaquetes(
  opciones: {
    canciones?: ResumenCancionIpc[]
    copias?: Partial<Copias>
    temas?: number
    config?: unknown
  } = {}
) {
  let cambio: (c: CambioCopiaIpc) => void = () => undefined
  let progreso: (p: ProgresoCopiaIpc) => void = () => undefined
  const mostrarEnCarpeta = vi.fn(() => Promise.resolve())
  const nueva = apiNuevaFalsa()
  const copias: Copias = {
    ...nueva.copias,
    alCambiar: (cb) => {
      cambio = cb
      return () => undefined
    },
    alProgreso: (cb) => {
      progreso = cb
      return () => undefined
    },
    ...opciones.copias
  }
  const api = {
    ...nueva,
    copias,
    letras: { ...letrasNuevasFalsas(), mostrarEnCarpeta },
    biblioteca: { listar: () => Promise.resolve(opciones.canciones ?? []) },
    temas: {
      catalogo: () => Promise.resolve({ temas: Array.from({ length: opciones.temas ?? 0 }) })
    },
    config: {
      obtener: () => Promise.resolve(opciones.config ?? {}),
      actualizar: () => Promise.resolve({})
    },
    sistema: { info: () => Promise.reject(new Error('sin info')) }
  }
  ;(window as unknown as { shinobi: unknown }).shinobi = api
  return {
    api: api as unknown as ApiShinobi,
    mostrarEnCarpeta,
    cambio: (c: CambioCopiaIpc) => cambio(c),
    progreso: (p: ProgresoCopiaIpc) => progreso(p)
  }
}

export const resumenPaquete = (extra: Partial<ResumenPaqueteIpc> = {}): ResumenPaqueteIpc => ({
  tipo: 'paquete',
  conAudio: true,
  canciones: [],
  temas: [],
  ...extra
})
