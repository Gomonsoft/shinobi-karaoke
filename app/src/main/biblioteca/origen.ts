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
