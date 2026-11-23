import type {
  AparienciaResumenIpc,
  Cancion,
  Estilo,
  EstadoCancion,
  Modalidad,
  EstadoPaso,
  NombrePaso,
  ResueltaIpc,
  RevisionResumenIpc
} from '../../shared'
import {
  CREADA_POR_DEFECTO,
  DESTINO_HEREDAR_PROVISIONAL,
  NOMBRES_PASO,
  resolverApariencia,
  claveAlbum,
  claveAlbumTexto,
  claveArtista,
  esAparienciaNeutra,
  estaIncompleta,
  modalidadEfectiva,
  estadoPreparacion,
  aplicaPreparar,
  numerosLineasSinInicio,
  type EstadoPreparacionDerivado,
  type ResumenPreparacionIpc
} from '../../shared'
import type { ResolucionCancion } from '../temas/servicio'

export type MotivoDanada = 'json' | 'pistas'

export interface ResumenPaso {
  estado: EstadoPaso
  progreso: number | null
  error: { codigo: string; mensaje: string; modelo?: 'calidad' | 'rapido' } | null
  segundos?: number
}

/** Datos que necesita la vista Biblioteca (y la IPC) por canción. */
export interface ResumenCancion {
  /** Nombre de la carpeta de la canción. */
  id: string
  titulo: string
  artista: string
  duracionMs: number | null
  estado: EstadoCancion
  /** Modalidad efectiva (ADR 0018 §5). */
  modalidad: Modalidad
  modificada: string
  /** Fecha de añadido (ISO); `null` si falta, es ilegible o es `CREADA_POR_DEFECTO`. */
  creada: string | null
  /** Estilo resuelto; `null` solo en la canción dañada por JSON. */
  estilo: Estilo | null
  /** Álbum tal como está en los metadatos (`null` si no tiene). */
  album: string | null
  /** Claves de identidad para agrupar (ADR 0016 §4). */
  claves: { artista: string | null; album: string | null }
  apariencia: AparienciaResumenIpc
  /** Ruta absoluta de la miniatura si existe en disco. */
  miniatura: string | null
  pasos: Record<NombrePaso, ResumenPaso> | null
  incompleta: boolean
  lineasSinSincronizar: number
  /** Líneas con inicio: «Exportar la letra (.lrc)» solo vale con al menos una (0.2.2 · feature 9). */
  lineasConTiempo?: number
  /** Origen del audio: una Lista sin audio importada de un paquete ligero dice «descargar» o «preparar». */
  fuenteTipo?: 'archivo' | 'youtube'
  danada: boolean
  motivo: MotivoDanada | null
  /** Solo con `motivo === 'pistas'`: tampoco existe `fuente/mezcla.flac` (no se puede re-separar). */
  sinMezcla?: boolean
  /** Registro de la preparación (0.2.2) sin ids; `null` sin registro. */
  preparacion?: ResumenPreparacionIpc | null
  estadoPreparacion?: EstadoPreparacionDerivado | null
  /** «Preparar» solo pondría fines y exige confirmar (letra sin `intacta`; ADR 0025, revisión 0278). */
  prepararFinesSinMarca?: boolean
  /** Líneas con inicio y sin fin; solo con `prepararFinesSinMarca`. */
  lineasSinFin?: number
}

function resumenPreparacion(c: Cancion): ResumenPreparacionIpc | null {
  const p = c.preparacion
  if (!p) return null
  return {
    estado: p.estado,
    paso: p.paso,
    busqueda: p.busqueda
      ? {
          resultado: p.busqueda.resultado,
          candidatas: p.busqueda.candidatas,
          motivo: p.busqueda.motivo,
          noElige: p.busqueda.no_elige ?? null
        }
      : null,
    dudosas: p.dudosas,
    dudosasImportantes: p.dudosas_importantes ?? p.dudosas,
    revisada: p.revisada,
    eleccionAutomatica: p.eleccion?.por === 'app',
    desfaseCorregido: c.letra?.desfase_corregido_ms !== undefined
  }
}

/**
 * Recuento de líneas por revisar que lleva el resumen: el de memoria (`RecuentoRevision`) si ya está
 * calculado; si no, el guardado en el registro de la preparación; sin ninguno, `null`.
 */
export function revisionDeResumen(
  r: Pick<ResumenCancion, 'preparacion'>,
  memoria: RevisionResumenIpc | null | undefined
): RevisionResumenIpc | null {
  if (memoria !== undefined) return memoria
  const p = r.preparacion
  return p ? { dudosas: p.dudosas, dudosasImportantes: p.dudosasImportantes ?? p.dudosas } : null
}

/**
 * Resolución sin catálogo (solo pruebas o arranque sin `ServicioTemas`): como en solo lectura, con
 * `heredar` cayendo al respaldo. La resolución real vive en `main/temas/`.
 */
export function resolucionSinCatalogo(cancion: Cancion): ResolucionCancion {
  const r = resolverApariencia(cancion, null)
  const h = resolverApariencia(
    {
      ...cancion,
      apariencia: cancion.apariencia?.base
        ? { modo: 'heredar', base: cancion.apariencia.base }
        : { modo: 'heredar' }
    },
    null
  )
  return {
    ...r,
    neutra: esAparienciaNeutra(r, cancion, null),
    alHeredar: {
      procedencia: h.procedencia as ResolucionCancion['alHeredar']['procedencia'],
      temaId: h.temaId,
      temaNombre: h.temaNombre
    }
  }
}

/** Parte `apariencia` del resumen, desde la resolución de la canción. */
export function aparienciaDeResolucion(
  cancion: Pick<Cancion, 'apariencia'>,
  r: ResolucionCancion
): AparienciaResumenIpc {
  return {
    modo: cancion.apariencia?.modo ?? 'propio',
    procedencia: r.procedencia,
    temaId: r.temaId,
    temaNombre: r.temaNombre,
    neutra: r.neutra,
    alHeredar: { ...r.alHeredar },
    procedenciaEspera: r.procedenciaEspera,
    procedenciaPantalla: r.procedenciaPantalla
  }
}

/** Parte `resuelta` de `biblioteca.obtener`. */
export function resueltaDeResolucion(r: ResolucionCancion): ResueltaIpc {
  return {
    estilo: r.estilo,
    procedencia: r.procedencia,
    temaId: r.temaId,
    temaNombre: r.temaNombre,
    alHeredar: { ...r.alHeredar },
    procedenciaEspera: r.procedenciaEspera,
    procedenciaPantalla: r.procedenciaPantalla
  }
}

export function resumirCancion(
  id: string,
  cancion: Cancion,
  miniatura: string | null,
  danada: MotivoDanada | null,
  sinMezcla = false,
  resolucion: ResolucionCancion = resolucionSinCatalogo(cancion)
): ResumenCancion {
  const pasos = {} as Record<NombrePaso, ResumenPaso>
  for (const nombre of NOMBRES_PASO) {
    const p = cancion.pasos[nombre]
    pasos[nombre] = {
      estado: p.estado,
      progreso: p.progreso ?? null,
      error: p.error,
      ...(typeof p.segundos === 'number' ? { segundos: p.segundos } : {})
    }
  }
  return {
    id,
    titulo: cancion.metadatos.titulo,
    artista: cancion.metadatos.artista,
    duracionMs: cancion.metadatos.duracion_ms,
    estado: cancion.estado,
    modalidad: modalidadEfectiva(cancion),
    modificada: cancion.modificada,
    creada: cancion.creada === CREADA_POR_DEFECTO ? null : cancion.creada,
    estilo: resolucion.estilo,
    album: cancion.metadatos.album ?? null,
    claves: {
      artista: claveArtista(cancion.metadatos),
      // Clave del álbum dentro de su artista (`claveAlbumTexto`): distingue homónimos de artistas distintos.
      album: ((c) => (c ? claveAlbumTexto(c) : null))(claveAlbum(cancion.metadatos))
    },
    apariencia: aparienciaDeResolucion(cancion, resolucion),
    miniatura,
    pasos,
    incompleta: estaIncompleta(cancion),
    lineasSinSincronizar: numerosLineasSinInicio(cancion.letra).length,
    lineasConTiempo:
      cancion.letra?.lineas.filter((l) => l.tipo === 'linea' && l.inicio_ms !== null).length ?? 0,
    fuenteTipo: cancion.fuente.tipo,
    danada: danada !== null,
    motivo: danada,
    ...(danada === 'pistas' && sinMezcla ? { sinMezcla: true } : {}),
    preparacion: resumenPreparacion(cancion),
    estadoPreparacion: danada ? null : estadoPreparacion(cancion),
    prepararFinesSinMarca: !danada && aplicaPreparar(cancion).confirmar === 'finesSinMarca',
    lineasSinFin: !danada
      ? (cancion.letra?.lineas.filter(
          (l) => l.tipo === 'linea' && l.inicio_ms !== null && l.fin_ms === null
        ).length ?? 0)
      : 0
  }
}

/** Canción ilegible: título provisional = nombre de la carpeta. */
export function resumenDanadaPorJson(id: string): ResumenCancion {
  return {
    id,
    titulo: id,
    artista: '',
    duracionMs: null,
    estado: 'borrador',
    modalidad: 'karaoke',
    modificada: new Date(0).toISOString(),
    creada: null,
    estilo: null,
    album: null,
    claves: { artista: null, album: null },
    apariencia: {
      modo: 'propio',
      procedencia: 'propio',
      temaId: null,
      temaNombre: null,
      neutra: false,
      alHeredar: { ...DESTINO_HEREDAR_PROVISIONAL },
      procedenciaEspera: 'propio',
      procedenciaPantalla: 'propio'
    },
    miniatura: null,
    pasos: null,
    incompleta: false,
    lineasSinSincronizar: 0,
    danada: true,
    motivo: 'json',
    preparacion: null,
    estadoPreparacion: null
  }
}
