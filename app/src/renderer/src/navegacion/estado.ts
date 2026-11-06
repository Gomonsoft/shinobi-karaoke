import { createContext, useContext } from 'react'
import type { GuardaSalida } from './salida'

/** Pasos del espacio de canción (docs/ux/00 §2): 1 Fuente, 2 Separación, 3 Letra, 4 Editor. */
export type PasoCancion = 'fuente' | 'progreso' | 'letra' | 'editor'

/** "Usar otro enlace" (0045): metadatos de la canción existente, valores iniciales de la vista 03. */
export interface DatosInicialesAnadir {
  cancionId: string
  titulo: string
  artista: string
  album: string | null
  /** Pestaña con la que abre la vista 03 (por defecto, Archivo). */
  origen?: 'archivo' | 'youtube'
}

/** Estado de navegación propio (ADR 0007: sin router). */
export type Vista =
  | { tipo: 'primer-arranque' }
  | { tipo: 'biblioteca' }
  /** `archivo`: ruta de un archivo arrastrado sobre la Biblioteca (la vista 03 lo recibe). */
  | { tipo: 'anadir'; archivo?: string; iniciales?: DatosInicialesAnadir }
  | { tipo: 'cancion'; id: string; paso: PasoCancion }
  | { tipo: 'ajustes' }
  | { tipo: 'reproductor'; id: string }

export type TipoVista = Vista['tipo']

/** Vistas sin barra superior (docs/ux/00 §2). */
export const VISTAS_SIN_BARRA: readonly TipoVista[] = ['primer-arranque', 'reproductor']

/** Vistas desde las que Esc devuelve a la Biblioteca. */
export const VISTAS_CON_ESC: readonly TipoVista[] = ['anadir', 'cancion', 'ajustes', 'reproductor']

export const TITULOS_VISTA: Record<TipoVista, string> = {
  'primer-arranque': 'Primer arranque',
  biblioteca: 'Biblioteca',
  anadir: 'Añadir canción',
  cancion: 'Canción',
  ajustes: 'Ajustes',
  reproductor: 'Reproductor'
}

/** Clave estable de la vista (cambia al cambiar de vista, de canción o de paso). */
export function claveVista(v: Vista): string {
  if (v.tipo === 'cancion') return `cancion:${v.id}:${v.paso}`
  if (v.tipo === 'reproductor') return `reproductor:${v.id}`
  return v.tipo
}

/** Vista inicial según el estado de instalación (docs/ux/00 §3). */
export function vistaInicial(estadoInstalacion: string): Vista {
  return estadoInstalacion === 'completa' ? { tipo: 'biblioteca' } : { tipo: 'primer-arranque' }
}

export interface Navegacion {
  vista: Vista
  ir(vista: Vista): void
  registrarGuardaSalida?(fn: GuardaSalida): () => void
}

export const NavegacionContexto = createContext<Navegacion | null>(null)

export function useNavegacion(): Navegacion {
  const n = useContext(NavegacionContexto)
  if (!n) throw new Error('useNavegacion fuera de NavegacionContexto')
  return n
}
