/**
 * Identidad de artista y álbum, y nombres de tema (ADR 0016 §4). Funciones puras compartidas por
 * main y renderer. NO es búsqueda: la búsqueda flexible (sin diacríticos) vive en el renderer y nunca
 * se usa como identidad.
 */

/** Versión del algoritmo de claves (`catalogo.claves`). */
export const VERSION_CLAVES = 1

/** Recorta, colapsa toda secuencia de espacios Unicode (NBSP, U+3000…) en uno y pasa a NFC. */
function normalizarTexto(t: string): string {
  return t.trim().replace(/\s+/g, ' ').normalize('NFC')
}

/**
 * Clave de identidad: NFC(minúsculas(NFC(colapsar(recortar(t))))). Conserva los diacríticos
 * («Canción» distinto de «Cancion»). `""`, solo espacios, `null` o `undefined` dan `null`.
 * Se usa `toLowerCase` (independiente de la configuración regional) y se renormaliza porque
 * bajar a minúsculas puede descomponer (`İ` pasa a `i̇`).
 */
export function claveTexto(t: string | null | undefined): string | null {
  if (t == null) return null
  const base = normalizarTexto(t)
  if (base === '') return null
  return base.toLowerCase().normalize('NFC')
}

export interface MetadatosIdentidad {
  artista?: string | null
  album?: string | null
}

export interface ClaveAlbum {
  artista: string
  album: string
}

export function claveArtista(m: MetadatosIdentidad): string | null {
  return claveTexto(m.artista)
}

/** El álbum pertenece al artista: su identidad es el par. `null` si falta cualquiera de las dos claves. */
export function claveAlbum(m: MetadatosIdentidad): ClaveAlbum | null {
  const artista = claveArtista(m)
  const album = claveTexto(m.album)
  return artista !== null && album !== null ? { artista, album } : null
}

/** Serialización estable del par para usarla como clave de mapa. */
export function claveAlbumTexto(clave: ClaveAlbum): string {
  return JSON.stringify([clave.artista, clave.album])
}

/**
 * Grafía visible de un grupo: la de la canción modificada más recientemente (recortada, NFC, espacios
 * colapsados). Empate (o fechas ilegibles): la primera en el orden de entrada. Lista vacía: `""`.
 */
export function nombreVisibleGrupo(canciones: { texto: string; modificada: string }[]): string {
  let mejor: { texto: string; t: number } | null = null
  for (const c of canciones) {
    const parsed = Date.parse(c.modificada)
    const t = Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
    if (mejor === null || t > mejor.t) mejor = { texto: c.texto, t }
  }
  return mejor ? normalizarTexto(mejor.texto) : ''
}

/** Nombre de tema o de grupo visible: NFC, recortado y con los espacios colapsados. */
export function normalizarNombreTema(t: string): string {
  return normalizarTexto(t)
}

/** Clave de unicidad de los nombres de tema. */
export const claveNombreTema = claveTexto
