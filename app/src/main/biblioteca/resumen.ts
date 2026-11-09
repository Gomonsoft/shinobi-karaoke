import type {
  AparienciaResumenIpc,
  Cancion,
  Estilo,
  EstadoCancion,
  EstadoPaso,
  NombrePaso,
  ResueltaIpc
} from '../../shared'
import {
  DESTINO_HEREDAR_PROVISIONAL,
  NOMBRES_PASO,
  resolverApariencia,
  claveAlbum,
  claveAlbumTexto,
  claveArtista,
  esAparienciaNeutra,
  estaIncompleta,
  numerosLineasSinInicio
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
  modificada: string
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
  danada: boolean
  motivo: MotivoDanada | null
  /** Solo con `motivo === 'pistas'`: tampoco existe `fuente/mezcla.flac` (no se puede re-separar). */
  sinMezcla?: boolean
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
    alHeredar: { ...r.alHeredar }
  }
}

/** Parte `resuelta` de `biblioteca.obtener`. */
export function resueltaDeResolucion(r: ResolucionCancion): ResueltaIpc {
  return {
    estilo: r.estilo,
    procedencia: r.procedencia,
    temaId: r.temaId,
    temaNombre: r.temaNombre,
    alHeredar: { ...r.alHeredar }
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
    modificada: cancion.modificada,
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
    danada: danada !== null,
    motivo: danada,
    ...(danada === 'pistas' && sinMezcla ? { sinMezcla: true } : {})
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
    modificada: new Date(0).toISOString(),
    estilo: null,
    album: null,
    claves: { artista: null, album: null },
    apariencia: {
      modo: 'propio',
      procedencia: 'propio',
      temaId: null,
      temaNombre: null,
      neutra: false,
      alHeredar: { ...DESTINO_HEREDAR_PROVISIONAL }
    },
    miniatura: null,
    pasos: null,
    incompleta: false,
    lineasSinSincronizar: 0,
    danada: true,
    motivo: 'json'
  }
}
