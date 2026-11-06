import { TITULO_MOTOR_INCOMPLETO } from '@shared/avisos'

/** Títulos visibles de los códigos de error (docs/ux/00-mapa-de-vistas.md §7). */
const TITULOS: Record<string, string> = {
  SIN_CONEXION: 'Sin conexión a internet',
  SIN_ESPACIO: 'No queda espacio en el disco',
  FORMATO_NO_SOPORTADO: 'No podemos leer este archivo',
  AUDIO_DEMASIADO_CORTO: 'El audio es demasiado corto',
  URL_NO_VALIDA: 'Este enlace no es de un vídeo de YouTube',
  URL_NO_SOPORTADA: 'Las listas y los directos no se pueden usar',
  VIDEO_NO_DISPONIBLE: 'Este vídeo no está disponible',
  YOUTUBE_BLOQUEADO: 'YouTube no permite la descarga ahora mismo',
  MEMORIA_INSUFICIENTE: 'Tu equipo se quedó sin memoria',
  MODELO_NO_DISPONIBLE: 'Falta el modelo de separación',
  RUNTIME_NO_DISPONIBLE: TITULO_MOTOR_INCOMPLETO,
  LETRA_NO_ENCONTRADA: 'No encontramos la letra',
  INSTRUMENTAL: 'Esta canción es instrumental',
  SERVICIO_NO_DISPONIBLE: 'El servicio de letras no responde'
}

/** Título de un código de error; los desconocidos se muestran como "Algo salió mal". */
export function tituloDeError(codigo: string): string {
  return TITULOS[codigo] ?? 'Algo salió mal'
}
