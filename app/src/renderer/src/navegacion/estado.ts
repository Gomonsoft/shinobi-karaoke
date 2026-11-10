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
  | { tipo: 'biblioteca'; enfocar?: { id: string; resaltar: boolean } }
  /** `archivo`: ruta de un archivo arrastrado sobre la Biblioteca (la vista 03 lo recibe). */
  | { tipo: 'anadir'; archivo?: string; iniciales?: DatosInicialesAnadir }
  /** `pestana`: pestaña con la que abre el editor (al volver de Ajustes, `estilo`; 0175). */
  | { tipo: 'cancion'; id: string; paso: PasoCancion; pestana?: 'estilo' }
  /** `origen`: vista a la que regresa «Volver» y Esc; `seccion`: sección a la que se baja al abrir. */
  | { tipo: 'ajustes'; origen?: OrigenAjustes; seccion?: SeccionAjustes }

export type TipoVista = Vista['tipo']

/** Vistas desde las que se abre Ajustes y a las que se regresa (docs/ux/08, A10). */
export type OrigenAjustes = { tipo: 'biblioteca' } | { tipo: 'editor'; id: string }
export type SeccionAjustes = 'temas'

/** Origen que recuerda Ajustes al abrirse desde `vista`: el editor de una canción o, si no, la Biblioteca. */
export function origenAjustes(vista: Vista): OrigenAjustes {
  if (vista.tipo === 'cancion' && vista.paso === 'editor') return { tipo: 'editor', id: vista.id }
  if (vista.tipo === 'ajustes' && vista.origen) return vista.origen
  return { tipo: 'biblioteca' }
}

/** Vista a la que regresan «Volver» y Esc en Ajustes (el editor reabre con la pestaña Estilo). */
export function vistaDeOrigen(origen: OrigenAjustes | undefined): Vista {
  if (origen?.tipo === 'editor') {
    return { tipo: 'cancion', id: origen.id, paso: 'editor', pestana: 'estilo' }
  }
  return { tipo: 'biblioteca' }
}

/** Vista Ajustes abierta desde `vista` (⚙, Ctrl/Cmd + , o «Administrar temas…» con `seccion`). */
export function vistaAjustesDesde(vista: Vista, seccion?: SeccionAjustes): Vista {
  return {
    tipo: 'ajustes',
    origen: origenAjustes(vista),
    ...(seccion ? { seccion } : {})
  }
}

/** Vistas sin barra superior (docs/ux/00 §2). */
export const VISTAS_SIN_BARRA: readonly TipoVista[] = ['primer-arranque']

/** Vistas desde las que Esc devuelve a la Biblioteca. */
export const VISTAS_CON_ESC: readonly TipoVista[] = ['anadir', 'cancion', 'ajustes']

export const TITULOS_VISTA: Record<TipoVista, string> = {
  'primer-arranque': 'Primer arranque',
  biblioteca: 'Biblioteca',
  anadir: 'Añadir canción',
  cancion: 'Canción',
  ajustes: 'Ajustes'
}

/** Clave estable de la vista (cambia al cambiar de vista, de canción o de paso). */
export function claveVista(v: Vista): string {
  if (v.tipo === 'cancion') return `cancion:${v.id}:${v.paso}`
  return v.tipo
}

/** Vista inicial según el estado de instalación (docs/ux/00 §3). */
export function vistaInicial(estadoInstalacion: string): Vista {
  return estadoInstalacion === 'completa' ? { tipo: 'biblioteca' } : { tipo: 'primer-arranque' }
}

export interface Navegacion {
  vista: Vista
  ir(vista: Vista, alNavegar?: () => void): void
  registrarGuardaSalida?(fn: GuardaSalida): () => void
}

export const NavegacionContexto = createContext<Navegacion | null>(null)

export function useNavegacion(): Navegacion {
  const n = useContext(NavegacionContexto)
  if (!n) throw new Error('useNavegacion fuera de NavegacionContexto')
  return n
}
