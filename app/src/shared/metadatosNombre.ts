/**
 * Datos de la canción propuestos desde el nombre de un archivo o de una carpeta (ADR 0025 §6,
 * spec 03 · Feature 6). Puro y compartido; siempre son propuestas editables.
 */

export type PatronNombre =
  /** `Artista - Título`. */
  | 'artista-titulo'
  /** `Artista - Álbum - NN - Título`. */
  | 'artista-album-pista-titulo'
  /** Solo un número de pista delante: `03 - Título`, `03. Título`, `1-03 Título`. */
  | 'pista-titulo'
  /** Ningún patrón: el nombre sin extensión es el título. */
  | 'ninguno'

export interface DatosDeNombre {
  titulo: string
  artista: string
  album: string
  patron: PatronNombre
}

const SEPARADOR = /\s[-–—]\s/
const EXTENSION = /\.[A-Za-z0-9]{2,5}$/
/** `1-01 ` (disco y pista) y `01 `, `01. `, `01 - `, `01) `. Exige texto detrás: `1999` queda intacto. */
const PISTA_CON_DISCO = /^\d-\d{2}\s+(?=\S)/
const PISTA = /^\d{1,3}(?:\s*[.\-–—)]\s*|\s+)(?=\S)/

const espacios = (t: string): string => t.replace(/\s+/g, ' ').trim()

/** Parte por el primer « - » (también « – » y « — »); `null` si falta o un lado queda vacío. */
export function partirPorSeparador(texto: string): [string, string] | null {
  const m = SEPARADOR.exec(texto)
  if (!m) return null
  const izquierda = texto.slice(0, m.index).trim()
  const derecha = texto.slice(m.index + m[0].length).trim()
  return izquierda !== '' && derecha !== '' ? [izquierda, derecha] : null
}

/** Un título con restos de paréntesis, corchetes, « - » o «|» después de limpiarlo es dudoso. */
export function tituloConRestos(titulo: string): boolean {
  return /[()[\]|]/.test(titulo) || SEPARADOR.test(titulo)
}

/** Quita la extensión, el número de pista y los guiones bajos, y reconoce los patrones de la spec. */
export function metadatosDeNombre(nombreArchivo: string): DatosDeNombre {
  const base = espacios(nombreArchivo.replace(EXTENSION, '').replace(/_/g, ' '))
  const sinPista = base.replace(PISTA_CON_DISCO, '').replace(PISTA, '')
  const hayPista = sinPista !== base
  const partes = sinPista.split(SEPARADOR).map((p) => p.trim())
  const [a, b, c, ...resto] = partes
  const util = partes.every((p) => p !== '')
  if (util && a !== undefined && b !== undefined) {
    if (partes.length >= 4 && c !== undefined && /^\d{1,3}$/.test(c)) {
      return {
        artista: a,
        album: b,
        titulo: resto.join(' - '),
        patron: 'artista-album-pista-titulo'
      }
    }
    const titulo = partes.slice(1).join(' - ')
    return { artista: a, album: '', titulo, patron: 'artista-titulo' }
  }
  return { artista: '', album: '', titulo: sinPista, patron: hayPista ? 'pista-titulo' : 'ninguno' }
}

/** Nombre de la carpeta de un lote: `Artista - Álbum` o solo el álbum. */
export function metadatosDeCarpeta(nombreCarpeta: string): { artista: string; album: string } {
  const base = espacios(nombreCarpeta.replace(/_/g, ' '))
  const partes = partirPorSeparador(base)
  return partes ? { artista: partes[0], album: partes[1] } : { artista: '', album: base }
}
