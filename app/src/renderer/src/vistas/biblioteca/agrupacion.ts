import type { AgruparBiblioteca } from '@shared/config'
import { claveTexto, nombreVisibleGrupo } from '@shared/identidad'
import type { CatalogoIpc, ResumenCancionIpc } from '@shared/ipc'

/** Tipo de grupo. Solo `artista` y `album` admiten tema (0174); el resto son agrupaciones visuales. */
export type TipoGrupo =
  'artista' | 'album' | 'sinArtista' | 'sinAlbum' | 'albumSinArtista' | 'fecha' | 'sinFecha'

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

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
]

interface GrupoFecha extends Identidad {
  nombre: string
  /** Posición en la lista: 0 = Hoy; los meses, por antigüedad; `Infinity` = Sin agrupar. */
  orden: number
}

/**
 * Grupo por fecha de añadido (B8-4), en hora local: Hoy · Ayer · Esta semana (desde el lunes) ·
 * Este mes · un grupo por mes y año. Cada canción va al primero que la contiene; una fecha futura
 * es Hoy; sin `creada` válida (`null`) va a «Sin agrupar».
 */
export function grupoDeFecha(creada: string | null, ahora: Date): GrupoFecha {
  const t = creada === null ? NaN : new Date(creada).getTime()
  if (Number.isNaN(t))
    return { id: 'sinFecha', tipo: 'sinFecha', nombre: 'Sin agrupar', orden: Infinity }
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const dia = (desplazamiento: number) =>
    new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + desplazamiento).getTime()
  const lunes = dia(-((hoy.getDay() + 6) % 7))
  const mes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).getTime()
  const fijo = (clave: string, nombre: string, orden: number): GrupoFecha => ({
    id: `fecha:${clave}`,
    tipo: 'fecha',
    nombre,
    orden
  })
  if (t >= dia(0)) return fijo('hoy', 'Hoy', 0)
  if (t >= dia(-1)) return fijo('ayer', 'Ayer', 1)
  if (t >= lunes) return fijo('semana', 'Esta semana', 2)
  if (t >= mes) return fijo('mes', 'Este mes', 3)
  const d = new Date(t)
  const meses = (hoy.getFullYear() - d.getFullYear()) * 12 + hoy.getMonth() - d.getMonth()
  const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return fijo(clave, `${MESES[d.getMonth()]} de ${d.getFullYear()}`, 3 + meses)
}

/** Grupo al que pertenece una canción según la agrupación (`ninguno` no tiene grupos). */
export function identidadDeGrupo(
  c: ResumenCancionIpc,
  modo: Exclude<AgruparBiblioteca, 'ninguno'>,
  ahora: Date = new Date()
): Identidad {
  if (modo === 'fecha') return grupoDeFecha(c.creada, ahora)
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
export function idGrupoDe(
  c: ResumenCancionIpc,
  modo: AgruparBiblioteca,
  ahora: Date = new Date()
): string | null {
  return modo === 'ninguno' ? null : identidadDeGrupo(c, modo, ahora).id
}

const comparar = new Intl.Collator(undefined, { sensitivity: 'base' }).compare

/** Rango de orden: grupos con nombre, luego los de álbum sin artista, luego «Sin …». */
const RANGO: Record<TipoGrupo, number> = {
  artista: 0,
  album: 0,
  albumSinArtista: 1,
  sinArtista: 2,
  sinAlbum: 2,
  fecha: 0,
  sinFecha: 2
}

/**
 * Grupos de la vista agrupada (ADR 0016 §4). La identidad usa las claves de main; el nombre visible
 * sale de todas las canciones del grupo (no solo de las visibles) para que no cambie al buscar.
 * Solo se devuelven los grupos con alguna canción visible.
 */
export function agruparCanciones(
  visibles: ResumenCancionIpc[],
  todas: ResumenCancionIpc[],
  modo: AgruparBiblioteca,
  ahora: Date = new Date()
): Grupo[] {
  if (modo === 'ninguno') return []
  if (modo === 'fecha') return agruparPorFecha(visibles, todas, ahora)
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

function agruparPorFecha(
  visibles: ResumenCancionIpc[],
  todas: ResumenCancionIpc[],
  ahora: Date
): Grupo[] {
  const totales = new Map<string, number>()
  for (const c of todas) {
    const { id } = grupoDeFecha(c.creada, ahora)
    totales.set(id, (totales.get(id) ?? 0) + 1)
  }
  const grupos = new Map<string, Grupo>()
  const ordenes = new Map<string, number>()
  for (const c of visibles) {
    const g = grupoDeFecha(c.creada, ahora)
    const existente = grupos.get(g.id)
    if (existente) existente.canciones.push(c)
    else {
      grupos.set(g.id, {
        id: g.id,
        tipo: g.tipo,
        nombre: g.nombre,
        artista: null,
        album: null,
        asignable: false,
        canciones: [c],
        total: totales.get(g.id) ?? 1
      })
      ordenes.set(g.id, g.orden)
    }
  }
  // Dentro de un grupo, por `creada` descendente; en «Sin agrupar», por `modificada` (B8-5).
  const reciente = (a: string | null, b: string | null) => (b ?? '').localeCompare(a ?? '')
  return [...grupos.values()]
    .sort((a, b) => ordenes.get(a.id)! - ordenes.get(b.id)!)
    .map((g) => ({
      ...g,
      canciones: [...g.canciones].sort((a, b) =>
        g.tipo === 'sinFecha' ? reciente(a.modificada, b.modificada) : reciente(a.creada, b.creada)
      )
    }))
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

/**
 * Tema asignado a un grupo, por **clave** de identidad (nunca por el nombre visible): la clave del
 * artista, o el par artista + álbum, vienen en el id del grupo. `null` si no tiene o no es asignable.
 */
export function temaAsignadoAGrupo(
  grupo: Pick<Grupo, 'id' | 'tipo'>,
  asignaciones: CatalogoIpc['asignaciones']
): string | null {
  if (grupo.tipo === 'artista') {
    const artista = grupo.id.slice('artista:'.length)
    // `CatalogoIpc.asignaciones` trae el nombre visible; la clave de identidad se deriva de él.
    return asignaciones.artistas.find((a) => claveTexto(a.artista) === artista)?.temaId ?? null
  }
  if (grupo.tipo === 'album') {
    try {
      const [artista, album] = JSON.parse(grupo.id.slice('album:'.length)) as [string, string]
      return (
        asignaciones.albumes.find(
          (a) => claveTexto(a.artista) === artista && claveTexto(a.album) === album
        )?.temaId ?? null
      )
    } catch {
      return null
    }
  }
  return null
}
