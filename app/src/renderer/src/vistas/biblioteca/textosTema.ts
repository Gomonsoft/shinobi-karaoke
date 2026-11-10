import type { AparienciaResumenIpc } from '@shared/ipc'
import { procedenciaCorta } from '../../temas/textos'

/*
 * Textos de la línea de tema de la tarjeta (`bib.tarjeta.tema`) y del encabezado de grupo
 * (`bib.grupo.tema`, `bib.grupo.sinTemaPropio`, `bib.grupo.temaBorrando`, `bib.grupo.boton`). La
 * procedencia corta es la única de la app: `procedenciaCorta` de `renderer/src/temas/textos.ts`.
 */

export const GRUPO = {
  boton: 'Tema…',
  /** `bib.grupo.boton`: nombre accesible de [Tema…]. */
  nombreBoton: (nivel: 'artista' | 'album', nombre: string): string =>
    `Tema del ${nivel === 'album' ? 'álbum' : 'artista'} ${nombre}…`,
  tema: (nivel: 'artista' | 'album', tema: string): string =>
    `Tema del ${nivel === 'album' ? 'álbum' : 'artista'}: ${tema}`,
  sinTemaPropio: (nivel: 'artista' | 'album'): string =>
    `Sin tema de ${nivel === 'album' ? 'álbum' : 'artista'}`,
  temaBorrando: (tema: string): string => `${tema}: eliminación sin terminar`
} as const

export interface LineaTema {
  texto: string
  /** «⚠ Tema no disponible»: icono de aviso en lugar de la paleta. */
  aviso: boolean
}

/** Línea de tema de la tarjeta; una sola línea, sin el icono. */
export function lineaDeTema(a: AparienciaResumenIpc): LineaTema {
  switch (a.procedencia) {
    case 'respaldo':
      return { texto: 'Tema no disponible', aviso: true }
    case 'propio':
      return { texto: 'Tema personalizado', aviso: false }
    case 'incluido':
      return { texto: 'Estilo incluido', aviso: false }
    default:
      return {
        texto: `${a.temaNombre ?? 'Tema'} · ${procedenciaCorta(a.procedencia)}`,
        aviso: false
      }
  }
}
