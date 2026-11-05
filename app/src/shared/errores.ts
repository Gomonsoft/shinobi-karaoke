/**
 * Catálogo de códigos de error estables (arquitectura.md "Restricciones" §3 y
 * ux/00-mapa-de-vistas.md §7). La UX los traduce a textos propios; un código
 * desconocido se muestra como "Algo salió mal".
 */
export const CODIGOS_ERROR = [
  'SIN_CONEXION',
  'SIN_ESPACIO',
  'FORMATO_NO_SOPORTADO',
  'AUDIO_DEMASIADO_CORTO',
  'URL_NO_VALIDA',
  'URL_NO_SOPORTADA',
  'VIDEO_NO_DISPONIBLE',
  'YOUTUBE_BLOQUEADO',
  'MEMORIA_INSUFICIENTE',
  'MODELO_NO_DISPONIBLE',
  'LETRA_NO_ENCONTRADA',
  'INSTRUMENTAL',
  'SERVICIO_NO_DISPONIBLE',
  'ARGUMENTOS_NO_VALIDOS',
  'ERROR_INTERNO',
  'RUNTIME_NO_DISPONIBLE',
  'VERIFICACION_FALLIDA',
  'PLATAFORMA_NO_SOPORTADA',
  'CANCELADO',
  'DEMO_FALLO',
  'PROCESO_TERMINADO'
] as const

/**
 * Códigos que solo genera el proceso principal y que el worker nunca emite (por eso no están en
 * `worker/shinobi_worker/errores.py`). `PROCESO_TERMINADO`: el sistema mató el proceso sin que dejara
 * línea de error (p. ej. el OOM killer de Linux; 0063). Fuera de la separación la interfaz lo muestra con
 * `prog.error.generico`; en `separar` el main lo convierte en `MEMORIA_INSUFICIENTE` (0066).
 */
export const CODIGOS_SOLO_MAIN = ['PROCESO_TERMINADO'] as const

export type CodigoError = (typeof CODIGOS_ERROR)[number]

export function esCodigoError(valor: unknown): valor is CodigoError {
  return typeof valor === 'string' && (CODIGOS_ERROR as readonly string[]).includes(valor)
}
