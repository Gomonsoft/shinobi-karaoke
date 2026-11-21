import type { ImpactoIpc, ResultadoOperacionIpc } from '@shared/ipc'
import { procedenciaCorta } from '../../temas/textos'

/*
 * Textos de la selección múltiple y de «Aplicar tema…» (docs/ux/02 «Microcopy (fase 3, biblioteca)»,
 * claves `bib.sel.*`, `bib.lote.*` y `bib.temas.*`).
 */

const plural = (n: number, uno: string, varios: string): string => (n === 1 ? uno : varios)

export const SEL = {
  boton: 'Seleccionar',
  contador: (n: number): string => `${n} ${plural(n, 'seleccionada', 'seleccionadas')}`,
  fuera: (k: number): string => `${k} fuera de la vista`,
  visibles: 'Seleccionar visibles',
  quitar: 'Quitar selección',
  terminar: 'Terminar',
  casilla: (titulo: string): string => `Seleccionar «${titulo}»`,
  grupo: (grupo: string): string => `Seleccionar las canciones de ${grupo}`,
  noEditable: 'No se puede cambiar el tema de una canción que no se puede abrir.',
  ninguna: 'Selecciona al menos una canción.',
  anuncioEntrar: 'Modo selección. Usa Espacio para marcar canciones y Esc para terminar.',
  aplicarTema: 'Aplicar tema…'
} as const

/** `bib.temas.soloLectura` y `bib.temas.vacio`. */
export const TEMAS_NO_DISPONIBLES = {
  soloLectura:
    'Tus temas son de una versión más nueva de Shinobi Karaoke y aquí no se pueden cambiar.',
  vacio: 'Aún no tienes temas. Crea uno desde el editor de una canción.'
} as const

type Afectada = ImpactoIpc['afectadas'][number]

export interface NotaLote {
  texto: string
  /** `bib.lote.nota.personalizado` lleva ⚠ (el aviso no depende solo del color). */
  aviso: boolean
}

export const LOTE = {
  titulo: (n: number): string => `Aplicar tema a ${n} ${plural(n, 'canción', 'canciones')}`,
  tituloUna: (titulo: string): string => `Aplicar tema a «${titulo}»`,
  campo: 'Tema',
  explicacion: (tema: string): string =>
    `Se asignará «${tema}» a cada canción. No cambia el tema de sus álbumes ni de sus artistas.`,
  explicacionUna: (tema: string): string =>
    `Se asignará «${tema}» a esta canción. No cambia el tema de su álbum ni de su artista.`,
  avisoPersonalizado: (k: number): string =>
    `⚠ ${k} ${plural(k, 'canción perderá', 'canciones perderán')} su tema personalizado.`,
  aplicar: (n: number): string => `Aplicar a ${n} ${plural(n, 'canción', 'canciones')}`,
  nadaQueCambiar: 'Todas las canciones ya tienen asignado este tema.',
  aplicando: (i: number, n: number): string => `Aplicando… ${i} de ${n}`,
  resultado: (tema: string, a: number, n: number): string =>
    a === n
      ? `«${tema}» se aplicó a ${n} ${plural(n, 'canción', 'canciones')}.`
      : `«${tema}» se aplicó a ${a} de ${n} canciones.`,
  filaAplicada: 'Aplicado',
  filaSinCambios: 'Ya lo tenía',
  falloGuardar: 'No se pudo guardar.',
  falloCambio: 'Cambió mientras confirmabas.',
  falloNoExiste: 'Ya no está en la biblioteca.',
  falloDanada: 'Está dañada.',
  reintentar: 'Revisar y reintentar',
  cerrar: 'Cerrar',
  cancelar: 'Cancelar',
  copiarDetalles: 'Copiar detalles',

  /**
   * `bib.lote.nota.*`: se deriva de `antes` y `efecto` de cada afectada. Para «estilo incluido» (sin
   * tema que nombrar) la spec no define texto: se usa «Ahora usa el estilo incluido».
   */
  nota(a: Afectada, temaId: string): NotaLote {
    const { antes } = a
    if (
      a.efecto === 'sin_cambios' ||
      (antes.procedencia === 'cancion' && antes.temaId === temaId)
    ) {
      return { texto: `Ya tiene asignado «${antes.temaNombre ?? ''}»: no cambia`, aviso: false }
    }
    switch (antes.procedencia) {
      case 'propio':
        return { texto: '⚠ Sustituye su tema personalizado', aviso: true }
      case 'cancion':
        return { texto: `Sustituye el tema asignado «${antes.temaNombre ?? ''}»`, aviso: false }
      case 'respaldo':
        return { texto: 'Sustituye un tema no disponible', aviso: false }
      case 'incluido':
        return { texto: 'Ahora usa el estilo incluido', aviso: false }
      default:
        return {
          texto: `Ahora usa «${antes.temaNombre ?? ''}» (${procedenciaCorta(antes.procedencia)})`,
          aviso: false
        }
    }
  },

  /** Texto de la fila de una canción en el resultado (sin el símbolo). */
  fila(c: ResultadoOperacionIpc['canciones'][number]): string {
    switch (c.estado) {
      case 'aplicada':
        return LOTE.filaAplicada
      case 'sin_cambios':
        return LOTE.filaSinCambios
      case 'omitida':
        return c.motivo === 'no_existe'
          ? LOTE.falloNoExiste
          : c.motivo === 'danada'
            ? LOTE.falloDanada
            : LOTE.falloCambio
      case 'error':
        return LOTE.falloGuardar
      case 'pendiente':
        return 'Pendiente'
    }
  }
} as const

/** Resumen de un resultado de `aplicar` ya clasificado. */
export interface ResumenLote {
  /** Aplicadas y las que ya lo tenían: cuentan como «se aplicó». */
  correctas: number
  total: number
  /** Ids de `error` y `omitida: cambio`, en el orden del resultado. */
  reintentables: string[]
  /** Hay alguna `error` u `omitida`. */
  conFallos: boolean
}

export function resumirLote(r: ResultadoOperacionIpc): ResumenLote {
  const reintentables = r.canciones
    .filter((c) => c.estado === 'error' || (c.estado === 'omitida' && c.motivo === 'cambio'))
    .map((c) => c.id)
  return {
    correctas: r.canciones.filter((c) => c.estado === 'aplicada' || c.estado === 'sin_cambios')
      .length,
    total: r.canciones.length,
    reintentables,
    conFallos: r.canciones.some((c) => c.estado === 'error' || c.estado === 'omitida')
  }
}
