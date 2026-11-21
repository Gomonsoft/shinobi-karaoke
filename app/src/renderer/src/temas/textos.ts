import type { ImpactoIpc } from '@shared/ipc'
import type { Procedencia } from '@shared/temas'

/*
 * Textos compartidos de temas (docs/ux/06 «Microcopy (fase 3, editor)», 02 y 08). Claves en comentarios.
 * Una sola constante por cadena que se repite en varias specs.
 */

/** `tema.origen.anterior` y `aj.temas.origen.anterior`: la misma cadena (0055). */
export const ORIGEN_ANTERIOR = 'Tema predeterminado anterior'
/** `bib.danada.sintitulo`. */
export const SIN_TITULO = 'Canción sin nombre'
export const SIN_ARTISTA = 'Sin artista'

export const nombreCancion = (titulo: string): string =>
  titulo.trim() === '' ? SIN_TITULO : titulo
export const nombreArtista = (artista: string): string =>
  artista.trim() === '' ? SIN_ARTISTA : artista
/** «{título} — {artista}» con los valores por defecto de la Biblioteca. */
export const tituloYArtista = (titulo: string, artista: string): string =>
  `${nombreCancion(titulo)} — ${nombreArtista(artista)}`

const plural = (n: number, uno: string, varios: string): string => (n === 1 ? uno : varios)
const minuscula = (t: string): string => t.charAt(0).toLowerCase() + t.slice(1)

// ------------------------------------------------------------------ procedencias

/** `tema.origen.corta.*` (tarjeta de la Biblioteca y filas de los diálogos). */
export function procedenciaCorta(p: Procedencia): string {
  switch (p) {
    case 'propio':
    case 'cancion':
      return 'propio'
    case 'album':
      return 'del álbum'
    case 'artista':
      return 'del artista'
    case 'aleatorio':
      return 'al azar'
    case 'predeterminado_anterior':
      return 'predeterminado anterior'
    case 'predeterminado':
      return 'predeterminado'
    case 'incluido':
      return 'incluido'
    case 'respaldo':
      return 'no disponible'
  }
}

/** `tema.origen.*` (editor). `album`/`artista` son los nombres visibles del grupo. */
export function procedenciaLarga(
  p: Procedencia,
  ctx: { album?: string | null; artista?: string | null } = {}
): string {
  const artista = nombreArtista(ctx.artista ?? '')
  switch (p) {
    case 'propio':
      return 'Estilo propio de esta canción. Los cambios no afectan a ningún tema.'
    case 'cancion':
      return 'Asignado a esta canción'
    case 'album':
      return `Del álbum «${ctx.album ?? ''}» de ${artista}`
    case 'artista':
      return `Del artista ${artista}`
    case 'aleatorio':
      return 'Elegido al azar al crear la canción'
    case 'predeterminado_anterior':
      return ORIGEN_ANTERIOR
    case 'predeterminado':
      return 'Tema predeterminado'
    case 'incluido':
      return 'Estilo incluido de Shinobi Karaoke'
    case 'respaldo':
      return 'Tema no disponible'
  }
}

/** `tema.heredar.destino` (y `bib.toast.temaCambiado`): «{procedencia en minúscula}». */
export function destinoHeredar(
  destino: { procedencia: Procedencia; temaNombre: string | null },
  ctx: { album?: string | null; artista?: string | null } = {}
): string {
  if (destino.procedencia === 'incluido') return 'Usará el estilo incluido de Shinobi Karaoke.'
  if (destino.procedencia === 'predeterminado_anterior') {
    return `Usará «${destino.temaNombre ?? ''}», el tema predeterminado anterior.`
  }
  return `Usará «${destino.temaNombre ?? ''}», ${minuscula(procedenciaLarga(destino.procedencia, ctx))}.`
}

// ------------------------------------------------------------------ desglose

/** Líneas del desglose en el orden de la spec 06; sin líneas a 0; álbum + artista en una. */
export function lineasDesglose(d: ImpactoIpc['desglose']): string[] {
  const lineas: string[] = []
  const heredan = d.album + d.artista
  if (d.cancion > 0) {
    lineas.push(d.cancion === 1 ? '1 lo tiene asignado' : `${d.cancion} lo tienen asignado`)
  }
  if (heredan > 0) {
    lineas.push(
      heredan === 1
        ? '1 lo hereda de su álbum o artista'
        : `${heredan} lo heredan de su álbum o artista`
    )
  }
  if (d.predeterminado > 0) {
    lineas.push(
      d.predeterminado === 1
        ? '1 lo usa como tema predeterminado'
        : `${d.predeterminado} lo usan como tema predeterminado`
    )
  }
  if (d.aleatorio > 0) {
    lineas.push(d.aleatorio === 1 ? '1 lo recibió al azar' : `${d.aleatorio} lo recibieron al azar`)
  }
  if (d.predeterminadoAnterior > 0) {
    lineas.push(
      d.predeterminadoAnterior === 1
        ? '1 lo conserva como predeterminado anterior'
        : `${d.predeterminadoAnterior} lo conservan como predeterminado anterior`
    )
  }
  return lineas
}

// ------------------------------------------------------------------ editor (06)

export const TEMA = {
  usos: (n: number): string =>
    n === 0 ? 'Ninguna canción lo usa.' : n === 1 ? 'Lo usa 1 canción.' : `Lo usan ${n} canciones.`,
  verCanciones: 'Ver las canciones',
  ocultarCanciones: 'Ocultar las canciones',
  obsoleto:
    'Mientras confirmabas cambió qué canciones usan este tema. Revisa el nuevo recuento y confirma otra vez.',
  cancelar: 'Cancelar',
  cerrar: 'Cerrar',
  reintentar: 'Reintentar',
  copiarDetalles: 'Copiar detalles',
  soloLectura:
    'Tus temas se guardaron con una versión más nueva de Shinobi Karaoke y aquí no se pueden usar ni cambiar. Las canciones se ven con el aspecto guardado en cada una. Puedes personalizar esta canción.',
  borradoPendiente:
    'La eliminación de este tema quedó a medias. Termínala o cancélala en Ajustes › Temas.',
  errorNoExiste: 'Este tema ya no existe. Puedes guardar tus cambios como un tema nuevo.',
  /** `tema.toast.error`: mensaje (acciones [Reintentar] y [Copiar detalles] a cargo del consumidor). */
  toastError: 'No se pudo guardar el tema. Tus cambios siguen aquí.',
  toastGuardado: (tema: string): string => `Tema «${tema}» guardado.`,
  toastCreado: (nuevo: string): string => `Tema «${nuevo}» creado.`,
  toastRenombrado: (nuevo: string): string => `Tema renombrado: «${nuevo}».`,
  toastEliminado: (tema: string, n: number): string =>
    n === 0
      ? `Tema «${tema}» eliminado.`
      : `Tema «${tema}» eliminado. ${n} ${plural(n, 'canción conserva', 'canciones conservan')} su aspecto como tema personalizado.`,
  toastBorradoCancelado: (tema: string, k: number): string =>
    `Eliminación de «${tema}» cancelada. El tema sigue disponible; ${k} ${plural(k, 'canción ya conserva', 'canciones ya conservan')} su aspecto como tema personalizado.`,

  /** `tema.dialogo.guardar`. */
  guardar: {
    titulo: (tema: string): string => `¿Guardar los cambios en «${tema}»?`,
    cuerpo: (n: number, incluidaEsta: boolean): string => {
      if (n === 0) return TEMA.usos(0)
      if (n === 1) return `Cambiará el aspecto de 1 canción${incluidaEsta ? ', que es esta' : ''}.`
      return `Cambiará el aspecto de ${n} canciones${incluidaEsta ? ', incluida esta' : ''}.`
    },
    nota: 'No cambian las canciones con tema personalizado ni las que usan otro tema.',
    sesion: 'Lo que ya se está reproduciendo seguirá con el aspecto anterior hasta que termine.',
    guardarNuevo: 'Guardar como tema nuevo…',
    guardarEn: (tema: string): string => `Guardar en «${tema}»`
  },

  /** `tema.dialogo.nuevo` / `duplicar` / `renombrar` y validaciones. */
  nombre: {
    tituloNuevo: 'Guardar como tema nuevo',
    tituloDuplicar: 'Duplicar tema',
    tituloRenombrar: 'Renombrar tema',
    campo: 'Nombre del tema',
    ayudaNuevoTema: (tema: string): string =>
      `Se creará un tema nuevo. «${tema}» y las canciones que lo usan no cambian.`,
    ayudaNuevoCancion: 'Se creará un tema con el aspecto de esta canción. La canción no cambia.',
    ayudaDuplicar: (tema: string): string =>
      `La copia empieza igual que «${tema}». Ninguna canción la usa todavía.`,
    botonNuevo: 'Crear tema',
    botonDuplicar: 'Duplicar',
    botonRenombrar: 'Renombrar',
    copia: (tema: string): string => `${tema} (copia)`,
    cancion: (titulo: string): string => `Tema de «${titulo}»`,
    vacio: 'Escribe un nombre.',
    repetido: 'Ya tienes un tema con ese nombre.',
    contador: (n: number): string => `${n} / 60`
  },

  /** `tema.dialogo.eliminar`. */
  eliminar: {
    titulo: (tema: string): string => `¿Eliminar el tema «${tema}»?`,
    cuerpo: (n: number, tema: string): string =>
      n === 0
        ? 'Ninguna canción lo usa.'
        : n === 1
          ? `1 canción lo usa. Conservará su aspecto actual como tema personalizado y dejará de estar vinculada a «${tema}».`
          : `${n} canciones lo usan. Conservarán su aspecto actual como tema personalizado y dejarán de estar vinculadas a «${tema}».`,
    grupos: (artistas: number, albumes: number): string | null => {
      const partes: string[] = []
      if (artistas > 0) partes.push(plural(artistas, '1 artista', `${artistas} artistas`))
      if (albumes > 0) partes.push(plural(albumes, '1 álbum', `${albumes} álbumes`))
      return partes.length > 0 ? `También se quitará de ${partes.join(' y ')}.` : null
    },
    predeterminado:
      'Las canciones nuevas recibirán un tema al azar hasta que elijas otro tema predeterminado en Ajustes.',
    cierre: 'No se puede deshacer.',
    boton: 'Eliminar tema',
    eliminando: 'Eliminando…',
    cancelarBorrado: 'Cancelar el borrado',
    progreso: (i: number, n: number): string => `Guardando el aspecto de ${i} de ${n} canciones…`,
    /** `tema.eliminar.parcial` (con la variante f = 1). */
    parcial: (titulo: string, f: number): string =>
      f === 1
        ? `No se pudo terminar: falló al guardar «${titulo}». Falta esa canción por conservar su aspecto. El tema no se eliminará hasta que se guarde.`
        : `No se pudo terminar: falló al guardar «${titulo}» y el borrado se detuvo. Faltan ${f} canciones por conservar su aspecto. El tema no se eliminará hasta que se guarden todas.`
  },

  /** Lista tras un fallo a mitad (0056). */
  parcial: {
    filaError: 'No se pudo guardar.',
    filaPendiente: 'Pendiente',
    notaPendientes:
      'Las pendientes no se intentaron porque el proceso se detuvo en el fallo. Reintentar las guarda todas.',
    nombreError: (titulo: string, artista: string): string =>
      `${tituloYArtista(titulo, artista)}, no se pudo guardar`,
    nombrePendiente: (titulo: string, artista: string): string =>
      `${tituloYArtista(titulo, artista)}, pendiente`
  }
} as const

// ------------------------------------------------------------------ Biblioteca (02)

export const BIB_GRUPO = {
  tituloArtista: (artista: string): string => `Tema del artista ${nombreArtista(artista)}`,
  tituloAlbum: (album: string, artista: string): string =>
    `Tema del álbum «${album}» de ${nombreArtista(artista)}`,
  sinTemaArtista: 'Sin tema de artista (usar el predeterminado)',
  sinTemaAlbum: 'Sin tema de álbum (usar el del artista o el predeterminado)',
  selector: 'Tema',
  aplicar: 'Aplicar',
  /** `bib.grupo.impacto`: asignar un tema. */
  impacto: (n: number, m: number): string =>
    m === 1
      ? 'Cambiará el aspecto de su canción.'
      : n === m
        ? `Cambiará el aspecto de sus ${m} canciones.`
        : `Cambiará el aspecto de ${n} de sus ${m} canciones.`,
  /** (quitar). `procedencia` ya va en minúscula. */
  impactoQuitar: (n: number, tema: string, procedencia: string): string =>
    `${n} ${plural(n, 'canción pasará', 'canciones pasarán')} a usar «${tema}», ${procedencia}.`,
  impactoQuitarIncluido: (n: number): string =>
    `${n} ${plural(n, 'canción pasará', 'canciones pasarán')} a usar el estilo incluido de Shinobi Karaoke.`,
  /** (quitar, destinos distintos). */
  impactoDistintos: (n: number, nivel: 'artista' | 'album'): string =>
    `${n} ${plural(n, 'canción volverá', 'canciones volverán')} al tema que ${plural(n, 'usaba', 'usaban')} sin el del ${nivel === 'album' ? 'álbum' : 'artista'}; en la lista se ve cuál usará cada una.`,
  /** (fila de la lista al quitar). */
  filaDestino: (titulo: string, artista: string, tema: string, corta: string): string =>
    `${tituloYArtista(titulo, artista)} · usará «${tema}» (${corta})`,
  filaIncluido: (titulo: string, artista: string): string =>
    `${tituloYArtista(titulo, artista)} · usará el estilo incluido`,
  filaNoDisponible: (titulo: string, artista: string): string =>
    `${tituloYArtista(titulo, artista)} · se verá con el último aspecto guardado (su tema de origen no está en tus temas)`,
  /** (quitar, todas no disponibles), con la variante n = 1. */
  impactoTodasNoDisponibles: (n: number): string =>
    n === 1
      ? '1 canción se verá con el último aspecto guardado en ella: su tema de origen no está en tus temas.'
      : `${n} canciones se verán con el último aspecto guardado en cada una: su tema de origen no está en tus temas.`,
  /** `bib.grupo.impacto.noDisponible` (r = 1 en singular). Sin el ⚠: lo pinta el componente. */
  noDisponible: (r: number): string =>
    r === 1
      ? '1 de ellas quedará como «Tema no disponible» porque su tema de origen no está en tus temas. Puedes darle otro con «Aplicar tema…».'
      : `${r} de ellas quedarán como «Tema no disponible» porque su tema de origen no está en tus temas. Puedes darles otro con «Aplicar tema…».`,
  excluidas: (k: number, nivel: 'artista' | 'album'): string => {
    const base =
      k === 1
        ? '1 no cambia porque tiene tema personalizado o asignado'
        : `${k} no cambian porque tienen tema personalizado o asignado`
    return nivel === 'artista' ? `${base}, o su álbum tiene tema.` : `${base}.`
  },
  ninguna: 'Ahora no cambiará ninguna canción.',
  futuras: (nivel: 'artista' | 'album'): string =>
    `Las canciones que añadas a este ${nivel === 'album' ? 'álbum' : 'artista'} también lo usarán.`,
  /** `bib.grupo.toast`. */
  toast: (nivel: 'artista' | 'album', nombre: string, tema: string | null): string => {
    const quien = nivel === 'album' ? 'Álbum' : 'Artista'
    return tema === null
      ? `${quien} ${nombre}: sin tema propio.`
      : `${quien} ${nombre}: tema «${tema}».`
  }
} as const

// ------------------------------------------------------------------ Ajustes (08)

export const AJ_TEMAS = {
  /** `aj.temas.origen.anterior`: la misma constante que `tema.origen.anterior`. */
  origenAnterior: ORIGEN_ANTERIOR,
  /** `aj.temas.ninguno` (opción del selector de predeterminado). */
  ninguno: 'Ninguno · un tema al azar para cada canción nueva',
  predet: {
    titulo: (nuevo: string): string => `¿Usar «${nuevo}» como tema predeterminado?`,
    /** `anterior` `null` = sin predeterminado (variante «sin anterior»). */
    cuerpo: (n: number, anterior: string | null): string =>
      anterior === null
        ? `Cambiará el aspecto de ${n} ${plural(n, 'canción que ahora usa', 'canciones que ahora usan')} el estilo incluido de Shinobi Karaoke.`
        : `Cambiará el aspecto de ${n} ${plural(n, 'canción que usa', 'canciones que usan')} el predeterminado «${anterior}».`,
    nota: 'No cambian las canciones con tema personalizado, las que tienen tema propio, de álbum o de artista, ni las que recibieron un tema al azar o conservan un predeterminado anterior.',
    boton: (nuevo: string): string => `Usar «${nuevo}»`
  },
  quitar: {
    titulo: '¿Quitar el tema predeterminado?',
    cuerpo: (n: number, anterior: string): string =>
      n === 1
        ? `La canción que usa «${anterior}» lo conservará y seguirá recibiendo sus cambios. Su aspecto no cambia.`
        : `Las ${n} canciones que usan «${anterior}» lo conservarán y seguirán recibiendo sus cambios. Su aspecto no cambia.`,
    nota: 'Las canciones nuevas recibirán un tema al azar.',
    boton: 'Quitar predeterminado',
    quitando: 'Quitando…',
    progreso: (i: number, n: number): string => `Guardando ${i} de ${n} canciones…`,
    /** `aj.temas.ninguno.parcial` (con la variante f = 1). */
    parcial: (titulo: string, f: number, anterior: string): string =>
      f === 1
        ? `No se pudo quitar el predeterminado: falló al guardar «${titulo}». Falta esa canción por guardar. «${anterior}» sigue siendo el predeterminado y ninguna canción ha cambiado de aspecto.`
        : `No se pudo quitar el predeterminado: falló al guardar «${titulo}» y se detuvo. Faltan ${f} canciones por guardar. «${anterior}» sigue siendo el predeterminado y ninguna canción ha cambiado de aspecto.`
  }
} as const
