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
  /**
   * Se descartó un número inicial separado solo por espacio («03 Artista - Título»): podría ser parte del
   * nombre, así que el campo que sigue al número se marca como dudoso (pregunta 0231).
   */
  numeroDudoso: boolean
}

const SEPARADOR = /\s[-–—]\s/
const EXTENSION = /\.[A-Za-z0-9]{2,5}$/
/** `1-01 ` (disco y pista). Exige texto detrás: `1999` queda intacto. */
const PISTA_CON_DISCO = /^\d-\d{2}\s+(?=\S)/
/** Número seguido de puntuación: `03 -`, `3.`, `3)`. */
const PISTA_PUNTUADA = /^\d{1,3}\s*[.\-–—)]\s*(?=\S)/
/** `03_Título`: el guion bajo se detecta antes de convertirlo en espacio. */
const PISTA_GUION_BAJO = /^\d{1,3}_+(?=\S)/
/** Dos o más cifras con cero a la izquierda y un espacio: `03 Artista - Título`. */
const PISTA_CON_CERO = /^0\d{1,2}\s+(?=\S)/
/** Un número sin cero y separado solo por espacio es parte del nombre: «3 Doors Down», «21 Guns». */

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
  const sinExtension = nombreArchivo.replace(EXTENSION, '')
  const base = espacios(sinExtension.replace(/_/g, ' '))
  let sinPista = base
  let numeroDudoso = false
  if (PISTA_GUION_BAJO.test(sinExtension)) {
    sinPista = base.replace(/^\d{1,3}\s+/, '')
  } else if (PISTA_CON_DISCO.test(base)) {
    sinPista = base.replace(PISTA_CON_DISCO, '')
  } else if (PISTA_PUNTUADA.test(base)) {
    sinPista = base.replace(PISTA_PUNTUADA, '')
  } else if (PISTA_CON_CERO.test(base)) {
    sinPista = base.replace(PISTA_CON_CERO, '')
    numeroDudoso = true
  }
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
        patron: 'artista-album-pista-titulo',
        numeroDudoso: false
      }
    }
    const titulo = partes.slice(1).join(' - ')
    return { artista: a, album: '', titulo, patron: 'artista-titulo', numeroDudoso }
  }
  return {
    artista: '',
    album: '',
    titulo: sinPista,
    patron: hayPista ? 'pista-titulo' : 'ninguno',
    numeroDudoso
  }
}

/** Nombre de la carpeta de un lote: `Artista - Álbum` o solo el álbum. */
export function metadatosDeCarpeta(nombreCarpeta: string): { artista: string; album: string } {
  const base = espacios(nombreCarpeta.replace(/_/g, ' '))
  const partes = partirPorSeparador(base)
  return partes ? { artista: partes[0], album: partes[1] } : { artista: '', album: base }
}
