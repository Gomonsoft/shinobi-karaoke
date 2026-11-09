import type { AparienciaResumenIpc } from '@shared/ipc'

/*
 * Textos mínimos de la línea de tema (`bib.tarjeta.tema`, `tema.origen.corta.*`). Provisionales:
 * 0169 define `procedenciaCorta` en `renderer/src/temas/textos.ts`; al integrarse, esta tabla debe
 * unificarse con la suya y borrarse de aquí.
 */
export const PROCEDENCIA_CORTA: Record<AparienciaResumenIpc['procedencia'], string> = {
  propio: 'propio',
  cancion: 'propio',
  album: 'del álbum',
  artista: 'del artista',
  aleatorio: 'al azar',
  predeterminado_anterior: 'predeterminado anterior',
  predeterminado: 'predeterminado',
  incluido: 'incluido',
  respaldo: 'no disponible'
}

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
        texto: `${a.temaNombre ?? 'Tema'} · ${PROCEDENCIA_CORTA[a.procedencia]}`,
        aviso: false
      }
  }
}
