/**
 * Avisos al terminar o fallar un trabajo (0072; docs/ux/04 §3, `prog.toast.*`). Los textos viven aquí
 * porque los usan el main (notificación del sistema) y el renderer (toast): el mismo texto en ambos.
 * La oferta del modelo Rápido nunca se incluye en un aviso (ux/04 criterio 8b).
 */

export const TIPOS_AVISO_TRABAJO = ['ok', 'lista', 'error'] as const
export type TipoAvisoTrabajo = (typeof TIPOS_AVISO_TRABAJO)[number]

/** Vista de la canción a la que lleva el aviso. */
export type DestinoAviso = 'progreso' | 'editor'

/** Evento main → renderer: un trabajo terminó o falló (el renderer decide si muestra el toast). */
export interface AvisoTrabajoIpc {
  cancionId: string
  tipo: TipoAvisoTrabajo
  /** Texto completo (`prog.toast.*`), el mismo de la notificación del sistema. */
  texto: string
  /** Etiqueta de la acción del toast: Abrir, Abrir editor o Ver. */
  etiqueta: string
  destino: DestinoAviso
}

/** Evento main → renderer: el usuario pulsó la notificación del sistema. */
export interface AbrirCancionIpc {
  cancionId: string
  destino: DestinoAviso
}

export const AVISOS = {
  ok: (titulo: string): string => `«${titulo}»: voz e instrumental separadas.`,
  lista: (titulo: string): string => `«${titulo}» ya se puede marcar como lista.`,
  error: (titulo: string, tituloError: string): string => `«${titulo}»: ${tituloError}`,
  etiquetaOk: 'Abrir',
  etiquetaLista: 'Abrir editor',
  etiquetaError: 'Ver'
} as const

const ERRORES_DESCARGA: Record<string, string> = {
  FORMATO_NO_SOPORTADO: 'No podemos leer este archivo.',
  AUDIO_DEMASIADO_CORTO: 'El audio es demasiado corto.',
  URL_NO_VALIDA: 'Este enlace no es de un vídeo de YouTube.',
  URL_NO_SOPORTADA: 'Las listas y los directos no se pueden usar.',
  VIDEO_NO_DISPONIBLE: 'Este vídeo no está disponible.',
  YOUTUBE_BLOQUEADO: 'YouTube no permite la descarga ahora mismo.',
  SIN_CONEXION: 'Sin conexión a internet.',
  SIN_ESPACIO: 'No queda espacio en el disco.'
}
const GENERICO_DESCARGA = 'Algo salió mal.'

const ERRORES_SEPARACION: Record<string, string> = {
  SIN_CONEXION: 'Sin conexión a internet.',
  SIN_ESPACIO: 'No queda espacio en el disco.',
  MODELO_NO_DISPONIBLE: 'No hemos podido descargar el modelo de separación.'
}
const GENERICO_SEPARACION = 'Algo salió mal al separar.'
const MEMORIA = {
  calidad: 'Tu equipo no tiene memoria suficiente para el modelo Calidad.',
  rapido: 'Tu equipo se quedó sin memoria.'
} as const

/** Título del error (sin cuerpo ni oferta) para el aviso de un trabajo de `paso` que falló. */
export function tituloErrorAviso(
  paso: 'fuente' | 'separacion',
  codigo: string,
  modo: 'calidad' | 'rapido' = 'calidad'
): string {
  if (paso === 'fuente') return ERRORES_DESCARGA[codigo] ?? GENERICO_DESCARGA
  if (codigo === 'MEMORIA_INSUFICIENTE') return MEMORIA[modo]
  return ERRORES_SEPARACION[codigo] ?? GENERICO_SEPARACION
}
