import {
  claveAlbum,
  claveAlbumTexto,
  claveArtista,
  crearIndiceCatalogo,
  nombreVisibleGrupo,
  resolverApariencia,
  type Apariencia,
  type Catalogo,
  type CatalogoIpc,
  type Estilo,
  type Procedencia
} from '../../shared'

/** Lo que `ServicioTemas` necesita saber de cada canción del índice de la biblioteca. */
export interface CancionIndice {
  id: string
  metadatos: { titulo?: string; artista?: string | null; album?: string | null }
  modificada: string
  /** Estilo en disco (propio o instantánea de respaldo). `null` solo si `danada === 'json'`. */
  estilo: Estilo | null
  apariencia?: Apariencia | undefined
  /** `json`: cancion.json ilegible (no cuenta para nada). `pistas`: legible pero sin audio. */
  danada: 'json' | 'pistas' | null
}

export interface UsosTema {
  total: number
  cancion: number
  album: number
  artista: number
  predeterminado: number
  aleatorio: number
  predeterminadoAnterior: number
}

export interface TemaCatalogo {
  id: string
  nombre: string
  revision: number
  estilo: Estilo
  enBorrado: boolean
  usos: UsosTema
  grupos: { artistas: string[]; albumes: { artista: string; album: string }[] }
}

/** Catálogo con usos: el contrato IPC (0164). */
export type CatalogoTemas = CatalogoIpc

const usosVacios = (): UsosTema => ({
  total: 0,
  cancion: 0,
  album: 0,
  artista: 0,
  predeterminado: 0,
  aleatorio: 0,
  predeterminadoAnterior: 0
})

const CAMPO_USO: Partial<Record<Procedencia, Exclude<keyof UsosTema, 'total'>>> = {
  cancion: 'cancion',
  album: 'album',
  artista: 'artista',
  predeterminado: 'predeterminado',
  aleatorio: 'aleatorio',
  predeterminado_anterior: 'predeterminadoAnterior'
}

export type PasoBorrado = 'congelar' | 'quitar_base'

/** Procedencias que dependen de un tema del catálogo (las congela el borrado). */
const DEPENDEN_DE_TEMA: ReadonlySet<Procedencia> = new Set([
  'cancion',
  'album',
  'artista',
  'aleatorio',
  'predeterminado_anterior',
  'predeterminado'
])

/**
 * Qué hace el borrado del tema `temaId` con una canción (ADR 0016 §8, paso 3): `congelar` si hoy
 * resuelve a ese tema; `quitar_base` si solo conserva una `base` hacia él y hereda de un nivel
 * superior (su aspecto no cambia); `null` si no la toca.
 */
export function pasoBorrado(
  resolucion: { procedencia: Procedencia; temaId: string | null },
  apariencia: Apariencia | undefined,
  temaId: string
): PasoBorrado | null {
  if (resolucion.temaId === temaId && DEPENDEN_DE_TEMA.has(resolucion.procedencia)) {
    return 'congelar'
  }
  const base = apariencia?.modo === 'heredar' ? apariencia.base : undefined
  if (
    base &&
    base.tipo !== 'incluido' &&
    base.tema_id === temaId &&
    (resolucion.procedencia === 'album' || resolucion.procedencia === 'artista')
  ) {
    return 'quitar_base'
  }
  return null
}

interface Textos {
  texto: string
  modificada: string
}

/**
 * Catálogo con usos, grupos y referencias que faltan (ADR 0016 §9). Función pura, O(canciones).
 * `catalogo === null` = solo lectura (o sin catálogo): sin temas y `referenciasFaltantes = 0`.
 * Las canciones con `danada === 'json'` no cuentan.
 */
export function construirCatalogoTemas(
  catalogo: Catalogo | null,
  canciones: readonly CancionIndice[],
  opciones: { soloLectura: boolean }
): CatalogoTemas {
  if (!catalogo) {
    return {
      temas: [],
      predeterminado: null,
      predeterminadoUsos: 0,
      asignaciones: { artistas: [], albumes: [] },
      borradoPendiente: null,
      soloLectura: opciones.soloLectura,
      apartado: null,
      referenciasFaltantes: 0
    }
  }
  const indice = crearIndiceCatalogo(catalogo)
  const usosPorTema = new Map<string, UsosTema>(catalogo.temas.map((t) => [t.id, usosVacios()]))
  // Textos de las canciones de cada grupo asignado, para el nombre visible (0054 §4).
  const textosArtista = new Map<string, Textos[]>(
    catalogo.asignaciones.artistas.map((a) => [a.artista, []])
  )
  const textosAlbum = new Map<string, { artista: Textos[]; album: Textos[] }>(
    catalogo.asignaciones.albumes.map((a) => [
      claveAlbumTexto({ artista: a.artista, album: a.album }),
      { artista: [], album: [] }
    ])
  )
  let predeterminadoUsos = 0
  let referenciasFaltantes = 0
  // Canciones que aún faltan por escribir para terminar el borrado pendiente (0167).
  const idBorrado = catalogo.borrado_pendiente?.tema_id
  let restantesBorrado = 0

  for (const c of canciones) {
    if (c.danada === 'json' || c.estilo === null) continue
    const r = resolverApariencia(
      { metadatos: c.metadatos, estilo: c.estilo, apariencia: c.apariencia },
      indice
    )
    const campo = CAMPO_USO[r.procedencia]
    const usos = campo && r.temaId !== null ? usosPorTema.get(r.temaId) : undefined
    if (campo && usos) {
      usos[campo]++
      usos.total++
    }
    if (r.procedencia === 'respaldo') referenciasFaltantes++
    if (idBorrado !== undefined && pasoBorrado(r, c.apariencia, idBorrado) !== null) {
      restantesBorrado++
    }
    if (
      r.procedencia === 'predeterminado' ||
      (r.procedencia === 'incluido' &&
        c.apariencia?.modo === 'heredar' &&
        c.apariencia.base === undefined)
    ) {
      predeterminadoUsos++
    }

    const artista = claveArtista(c.metadatos)
    const album = claveAlbum(c.metadatos)
    if (artista !== null) {
      textosArtista
        .get(artista)
        ?.push({ texto: c.metadatos.artista ?? '', modificada: c.modificada })
    }
    if (album) {
      const grupo = textosAlbum.get(claveAlbumTexto(album))
      if (grupo) {
        grupo.artista.push({ texto: c.metadatos.artista ?? '', modificada: c.modificada })
        grupo.album.push({ texto: c.metadatos.album ?? '', modificada: c.modificada })
      }
    }
  }

  const visible = (textos: Textos[] | undefined, respaldo: string): string =>
    textos && textos.length > 0 ? nombreVisibleGrupo(textos) : respaldo

  const asignacionesArtistas = catalogo.asignaciones.artistas.map((a) => ({
    artista: visible(textosArtista.get(a.artista), a.nombre_artista),
    temaId: a.tema_id
  }))
  const asignacionesAlbumes = catalogo.asignaciones.albumes.map((a) => {
    const grupo = textosAlbum.get(claveAlbumTexto({ artista: a.artista, album: a.album }))
    return {
      artista: visible(grupo?.artista, a.nombre_artista),
      album: visible(grupo?.album, a.nombre_album),
      temaId: a.tema_id
    }
  })

  const borrado = catalogo.borrado_pendiente
  const enBorrado = borrado ? catalogo.temas.find((t) => t.id === borrado.tema_id) : undefined
  return {
    temas: catalogo.temas.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      revision: t.revision,
      estilo: t.estilo,
      enBorrado: t.id === borrado?.tema_id,
      usos: usosPorTema.get(t.id) ?? usosVacios(),
      grupos: {
        artistas: asignacionesArtistas.filter((a) => a.temaId === t.id).map((a) => a.artista),
        albumes: asignacionesAlbumes
          .filter((a) => a.temaId === t.id)
          .map((a) => ({ artista: a.artista, album: a.album }))
      }
    })),
    predeterminado: catalogo.predeterminado,
    predeterminadoUsos,
    asignaciones: { artistas: asignacionesArtistas, albumes: asignacionesAlbumes },
    borradoPendiente:
      borrado && enBorrado
        ? {
            temaId: borrado.tema_id,
            nombre: enBorrado.nombre,
            // El diario es el recuento confirmado; si el conjunto recalculado creció (canciones
            // nuevas o que solo pierden la base), el total no puede quedar por debajo de lo que falta.
            total: Math.max(borrado.canciones.length, restantesBorrado),
            restantes: restantesBorrado
          }
        : null,
    soloLectura: opciones.soloLectura,
    apartado: catalogo.apartado,
    referenciasFaltantes
  }
}
