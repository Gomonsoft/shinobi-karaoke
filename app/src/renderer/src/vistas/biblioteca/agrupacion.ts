import type { AgruparBiblioteca } from '@shared/config'
import { claveTexto, nombreVisibleGrupo } from '@shared/identidad'
import type { ResumenCancionIpc } from '@shared/ipc'

/** Tipo de grupo. Solo `artista` y `album` admiten tema (0174); el resto son agrupaciones visuales. */
export type TipoGrupo = 'artista' | 'album' | 'sinArtista' | 'sinAlbum' | 'albumSinArtista'

export interface Grupo {
  /** Identidad estable (clave de main, sin tildes perdidas): sirve para el plegado de sesión. */
  id: string
  tipo: TipoGrupo
  /** Nombre visible completo: «Queen», «Greatest Hits — Queen», «Sin artista»… */
  nombre: string
  /** Grafía visible del artista y del álbum del grupo (`null` si no aplica); la usa 0174. */
  artista: string | null
  album: string | null
  /** ¿Admite tema propio? (`artista` y `album`). */
  asignable: boolean
  /** Canciones que se muestran (tras búsqueda y filtro), en el orden recibido. */
  canciones: ResumenCancionIpc[]
  /** Canciones del grupo en toda la biblioteca (el «n» de «{v} de {n}»). */
  total: number
}

const SIN_ARTISTA = 'Sin artista'
const SIN_ALBUM = 'Sin álbum'

interface Identidad {
  id: string
  tipo: TipoGrupo
}

/** Grupo al que pertenece una canción según la agrupación (`ninguno` no tiene grupos). */
export function identidadDeGrupo(
  c: ResumenCancionIpc,
  modo: Exclude<AgruparBiblioteca, 'ninguno'>
): Identidad {
  if (modo === 'artista') {
    return c.claves.artista === null
      ? { id: 'sinArtista', tipo: 'sinArtista' }
      : { id: `artista:${c.claves.artista}`, tipo: 'artista' }
  }
  if (c.claves.album !== null) return { id: `album:${c.claves.album}`, tipo: 'album' }
  const soloAlbum = claveTexto(c.album)
  return soloAlbum === null
    ? { id: 'sinAlbum', tipo: 'sinAlbum' }
    : { id: `albumSinArtista:${soloAlbum}`, tipo: 'albumSinArtista' }
}

/** Id del grupo de una canción, o `null` sin agrupar. */
export function idGrupoDe(c: ResumenCancionIpc, modo: AgruparBiblioteca): string | null {
  return modo === 'ninguno' ? null : identidadDeGrupo(c, modo).id
}

const comparar = new Intl.Collator(undefined, { sensitivity: 'base' }).compare

/** Rango de orden: grupos con nombre, luego los de álbum sin artista, luego «Sin …». */
const RANGO: Record<TipoGrupo, number> = {
  artista: 0,
  album: 0,
  albumSinArtista: 1,
  sinArtista: 2,
  sinAlbum: 2
}

/**
 * Grupos de la vista agrupada (ADR 0016 §4). La identidad usa las claves de main; el nombre visible
 * sale de todas las canciones del grupo (no solo de las visibles) para que no cambie al buscar.
 * Solo se devuelven los grupos con alguna canción visible.
 */
export function agruparCanciones(
  visibles: ResumenCancionIpc[],
  todas: ResumenCancionIpc[],
  modo: AgruparBiblioteca
): Grupo[] {
  if (modo === 'ninguno') return []
  const totales = new Map<string, ResumenCancionIpc[]>()
  for (const c of todas) {
    const { id } = identidadDeGrupo(c, modo)
    const lista = totales.get(id)
    if (lista) lista.push(c)
    else totales.set(id, [c])
  }
  const grupos = new Map<string, Grupo>()
  for (const c of visibles) {
    const { id, tipo } = identidadDeGrupo(c, modo)
    const existente = grupos.get(id)
    if (existente) {
      existente.canciones.push(c)
      continue
    }
    const miembros = totales.get(id) ?? [c]
    const artista = nombreVisibleGrupo(
      miembros.map((m) => ({ texto: m.artista, modificada: m.modificada }))
    )
    const album = nombreVisibleGrupo(
      miembros.map((m) => ({ texto: m.album ?? '', modificada: m.modificada }))
    )
    const nombre =
      tipo === 'artista'
        ? artista
        : tipo === 'sinArtista'
          ? SIN_ARTISTA
          : tipo === 'sinAlbum'
            ? SIN_ALBUM
            : `${album} — ${tipo === 'album' ? artista : SIN_ARTISTA}`
    grupos.set(id, {
      id,
      tipo,
      nombre,
      artista: tipo === 'artista' || tipo === 'album' ? artista : null,
      album: tipo === 'album' || tipo === 'albumSinArtista' ? album : null,
      asignable: tipo === 'artista' || tipo === 'album',
      canciones: [c],
      total: miembros.length
    })
  }
  return [...grupos.values()].sort((a, b) => {
    if (RANGO[a.tipo] !== RANGO[b.tipo]) return RANGO[a.tipo] - RANGO[b.tipo]
    if (a.tipo === 'album' && b.tipo === 'album') {
      return comparar(a.artista ?? '', b.artista ?? '') || comparar(a.album ?? '', b.album ?? '')
    }
    return comparar(a.album ?? a.nombre, b.album ?? b.nombre)
  })
}

/** `bib.grupo.recuento`: «{n} canciones», «1 canción» o, con búsqueda o filtro, «{v} de {n} canciones». */
export function textoRecuentoGrupo(visibles: number, total: number, filtrando: boolean): string {
  if (filtrando) return `${visibles} de ${total} canciones`
  return total === 1 ? '1 canción' : `${total} canciones`
}

/** `bib.anuncio.resultados`. */
export function textoAnuncioResultados(n: number): string {
  if (n === 0) return 'Ninguna canción'
  return n === 1 ? '1 canción' : `${n} canciones`
}
