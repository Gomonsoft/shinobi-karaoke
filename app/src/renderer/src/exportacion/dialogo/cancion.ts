import type { Estilo } from '@shared/estilo'
import type { CancionIpc } from '@shared/ipc'
import type { Letra } from '@shared/letra'
import { numerosLineasSinInicio } from '@shared/letra'
import type { Modalidad } from '@shared/cancion'

/** Lo que el diálogo necesita saber de la canción: lo guardado, resuelto para mostrar la muestra. */
export interface CancionExportable {
  id: string
  titulo: string
  artista: string
  duracionMs: number
  estado: 'borrador' | 'lista'
  /** Un borrador siempre se exporta con barrido (ADR 0019 §2). */
  modalidad: Modalidad
  letra: Letra | null
  estilo: Estilo
  /** Hay `voz.flac` registrada; main lo vuelve a comprobar al iniciar. */
  vozDisponible: boolean
  /** Líneas de la letra sin inicio (no se ven en el video). */
  sinInicio: number
}

export function cancionExportable(c: CancionIpc): CancionExportable {
  return {
    id: c.id,
    titulo: c.metadatos.titulo,
    artista: c.metadatos.artista,
    duracionMs: c.metadatos.duracion_ms,
    estado: c.estado,
    modalidad: c.estado === 'lista' && c.modalidad === 'letra_lista' ? 'letra_lista' : 'karaoke',
    letra: c.letra,
    estilo: c.resuelta.estilo,
    vozDisponible: c.pistas !== null && Boolean(c.pistas.voz),
    sinInicio: numerosLineasSinInicio(c.letra).length
  }
}
