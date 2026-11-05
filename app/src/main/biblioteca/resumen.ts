import type { Cancion, Estilo, EstadoCancion, EstadoPaso, NombrePaso } from '../../shared'
import { NOMBRES_PASO, estaIncompleta, numerosLineasSinInicio } from '../../shared'

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
  estilo: Estilo | null
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

export function resumirCancion(
  id: string,
  cancion: Cancion,
  miniatura: string | null,
  danada: MotivoDanada | null,
  sinMezcla = false
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
    estilo: cancion.estilo,
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
    miniatura: null,
    pasos: null,
    incompleta: false,
    lineasSinSincronizar: 0,
    danada: true,
    motivo: 'json'
  }
}
