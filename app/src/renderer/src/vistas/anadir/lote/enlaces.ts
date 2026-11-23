import { analizarUrlLista } from '@shared/listaYoutube'
import { analizarUrlYoutube } from '@shared/youtube'

/** Un renglón del campo de enlaces ya clasificado (validación local, sin red). */
export type Enlace =
  | { tipo: 'video'; id: string; url: string; listaId: string | null }
  | { tipo: 'lista'; idLista: string; url: string }

export interface EnlacesClasificados {
  enlaces: Enlace[]
  /** Renglones que no son enlaces de YouTube (o no se admiten): `add.lote.enlacesIgnorados`. */
  ignorados: number
  /** Cuántos de los ignorados eran directos, canales o mezclas (`URL_NO_SOPORTADA`). */
  noSoportadas: number
  /** Enlaces iguales dentro del campo (se unen en uno). */
  repetidos: number
}

/** Qué hay en cada renglón: video (con su lista, si la trae), lista o álbum, o nada que se pueda usar. */
export function clasificarEnlaces(texto: string): EnlacesClasificados {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')
  const enlaces: Enlace[] = []
  const vistos = new Set<string>()
  let ignorados = 0
  let noSoportadas = 0
  let repetidos = 0
  for (const url of lineas) {
    const video = analizarUrlYoutube(url)
    const lista = analizarUrlLista(url)
    let enlace: Enlace | null = null
    let clave = ''
    if (video.ok) {
      enlace = { tipo: 'video', id: video.idVideo, url, listaId: lista.ok ? lista.idLista : null }
      clave = `v:${video.idVideo}`
    } else if (lista.ok) {
      enlace = { tipo: 'lista', idLista: lista.idLista, url }
      clave = `l:${lista.idLista}`
    } else {
      ignorados++
      if (video.codigo === 'URL_NO_SOPORTADA' || lista.codigo === 'URL_NO_SOPORTADA') noSoportadas++
      continue
    }
    if (vistos.has(clave)) {
      repetidos++
      continue
    }
    vistos.add(clave)
    enlaces.push(enlace)
  }
  return { enlaces, ignorados, noSoportadas, repetidos }
}
