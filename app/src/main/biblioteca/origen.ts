import type { Cancion, MetadatosEditables, OrigenMetadatos } from '../../shared'

/**
 * `metadatos.origen` tras «Editar datos»: cada campo que el usuario cambia pasa a `usuario` (también
 * si lo vacía, p. ej. «Quitar» el álbum de LRCLIB); los demás no se tocan. `undefined` si no cambió nada.
 */
export function origenTrasEdicion(
  previos: Cancion['metadatos'] | undefined,
  nuevos: MetadatosEditables
): OrigenMetadatos | undefined {
  const igual = (a: string | null | undefined, b: string | null | undefined): boolean =>
    (a ?? '').trim() === (b ?? '').trim()
  const origen: OrigenMetadatos = {}
  if (!previos || !igual(previos.titulo, nuevos.titulo)) origen.titulo = 'usuario'
  if (!previos || !igual(previos.artista, nuevos.artista)) origen.artista = 'usuario'
  if (!previos || !igual(previos.album, nuevos.album)) origen.album = 'usuario'
  return Object.keys(origen).length > 0 ? origen : undefined
}

/** Metadatos del registro de LRCLIB elegido (no la letra): lo que guarda `letra.datos_lrclib`. */
export interface RegistroLrclibDatos {
  titulo: string
  artista: string
  album: string | null
}

/**
 * Álbum desde LRCLIB (ADR 0025 §6, revisión de la pregunta 0220; spec 03 F6-N7). Se llama al guardar una
 * letra que viene de LRCLIB, la elija la preparación o el usuario. Solo rellena un álbum **vacío** y con
 * origen distinto de `usuario` (así «Quitar», que lo vacía con origen `usuario`, no vuelve a rellenarlo);
 * anota `metadatos.origen.album = "lrclib"` y nunca toca título ni artista. Devuelve si escribió.
 */
export async function rellenarAlbumDesdeLrclib(
  biblioteca: {
    obtener(id: string): Cancion | null
    actualizar(id: string, cambio: { metadatos: Partial<Cancion['metadatos']> }): Promise<unknown>
  },
  cancionId: string,
  registro: RegistroLrclibDatos
): Promise<boolean> {
  const cancion = biblioteca.obtener(cancionId)
  const album = registro.album?.trim()
  if (!cancion || !album) return false
  if ((cancion.metadatos.album ?? '').trim() !== '') return false
  if (cancion.metadatos.origen?.album === 'usuario') return false
  await biblioteca.actualizar(cancionId, { metadatos: { album, origen: { album: 'lrclib' } } })
  return true
}
