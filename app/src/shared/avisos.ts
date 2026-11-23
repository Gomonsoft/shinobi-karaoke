/**
 * Avisos al terminar o fallar un trabajo (0072; docs/ux/04 §3, `prog.toast.*`). Los textos viven aquí
 * porque los usan el main (notificación del sistema) y el renderer (toast): el mismo texto en ambos.
 * La oferta del modelo Rápido nunca se incluye en un aviso (ux/04 criterio 8b).
 */

export const TIPOS_AVISO_TRABAJO = ['ok', 'lista', 'error', 'desfase', 'tanda'] as const
export const TITULO_MOTOR_INCOMPLETO = 'Hay que reparar el motor de audio'
export type TipoAvisoTrabajo = (typeof TIPOS_AVISO_TRABAJO)[number]

/** Vista de la canción a la que lleva el aviso. */
export type DestinoAviso = 'progreso' | 'editor' | 'biblioteca'

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
  etiquetaError: 'Ver',
  /** `let.comp.toast.corregida` (spec 05, feature 4): `desfaseMs` > 0 = la letra se movió más tarde. */
  desfase: (titulo: string, desfaseMs: number): string => {
    const d = (Math.abs(desfaseMs) / 1000).toFixed(1).replace('.', ',')
    return `Movimos la letra de «${titulo}» ${d} s ${desfaseMs > 0 ? 'más tarde' : 'antes'} para que coincida con la voz.`
  },
  etiquetaDesfase: 'Deshacer',
  /**
   * `act.cola.fin` (spec 04, feature 7): una sola vez al vaciarse una tanda de 2 o más canciones. Se omiten
   * las partes con 0; si todas están listas para revisar, «{n} canciones listas para revisar.».
   */
  tanda: (r: { total: number; listas: number; esperanLetra: number; conError: number }): string => {
    if (r.listas === r.total) return `${r.total} canciones listas para revisar.`
    const partes = [
      r.listas > 0 ? `${r.listas} ${r.listas === 1 ? 'lista' : 'listas'} para revisar` : null,
      r.esperanLetra > 0 ? `${r.esperanLetra} esperan letra` : null,
      r.conError > 0 ? `${r.conError} con error` : null
    ].filter((x) => x !== null)
    return `${r.total} canciones preparadas${partes.length > 0 ? `: ${partes.join(' · ')}` : ''}.`
  },
  etiquetaTanda: 'Ver resultado'
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
  if (codigo === 'RUNTIME_NO_DISPONIBLE') return `${TITULO_MOTOR_INCOMPLETO}.`
  if (paso === 'fuente') return ERRORES_DESCARGA[codigo] ?? GENERICO_DESCARGA
  if (codigo === 'MEMORIA_INSUFICIENTE') return MEMORIA[modo]
  return ERRORES_SEPARACION[codigo] ?? GENERICO_SEPARACION
}
