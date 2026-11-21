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
  'PROCESO_TERMINADO',
  'ARCHIVO_SIN_LETRA',
  'LETRA_DESACTUALIZADA',
  'CONFIRMACION_OBSOLETA',
  'TEMA_NO_ENCONTRADO',
  'TEMA_NOMBRE_DUPLICADO',
  'TEMAS_SOLO_LECTURA',
  'BORRADO_PENDIENTE',
  'EDICION_BLOQUEADA',
  'SESION_EN_CURSO',
  'SESION_NO_ACTIVA',
  'GUARDADO_PENDIENTE',
  'PANTALLA_NO_DISPONIBLE',
  'CANCION_NO_DISPONIBLE',
  'CANCION_EN_REPRODUCCION',
  'ENTRADA_NO_ENCONTRADA',
  'COLA_LLENA'
] as const

/**
 * Códigos que solo genera el proceso principal y que el worker nunca emite (por eso no están en
 * `worker/shinobi_worker/errores.py`). `PROCESO_TERMINADO`: el sistema mató el proceso sin que dejara
 * línea de error (p. ej. el OOM killer de Linux; 0063). Fuera de la separación la interfaz lo muestra con
 * `prog.error.generico`; en `separar` el main lo convierte en `MEMORIA_INSUFICIENTE` (0066).
 * `ARCHIVO_SIN_LETRA`: el archivo elegido en `letras.leerArchivo` no contiene letra legible (0077;
 * la interfaz lo muestra con `let.error.archivo`).
 * `LETRA_DESACTUALIZADA`: la letra guardada ya no tiene los mismos elementos que envía
 * el editor (0090/0091); el editor recarga.
 * Fase 3 (ADR 0016 §11): `CONFIRMACION_OBSOLETA` (el impacto confirmado ya no coincide; el nuevo va en
 * `detalles`), `TEMA_NO_ENCONTRADO`, `TEMA_NOMBRE_DUPLICADO`, `TEMAS_SOLO_LECTURA` (catálogo de un esquema
 * más nuevo) y `BORRADO_PENDIENTE` (tema en borrado: no admite otra operación).
 * Fase 4 (ADR 0017 §11): sesión y cola. `EDICION_BLOQUEADA` (hay una sesión en la ventana secundaria),
 * `SESION_EN_CURSO`, `SESION_NO_ACTIVA`, `GUARDADO_PENDIENTE`, `PANTALLA_NO_DISPONIBLE`,
 * `CANCION_NO_DISPONIBLE`, `CANCION_EN_REPRODUCCION`, `ENTRADA_NO_ENCONTRADA` y `COLA_LLENA`.
 */
export const CODIGOS_SOLO_MAIN = [
  'PROCESO_TERMINADO',
  'ARCHIVO_SIN_LETRA',
  'LETRA_DESACTUALIZADA',
  'CONFIRMACION_OBSOLETA',
  'TEMA_NO_ENCONTRADO',
  'TEMA_NOMBRE_DUPLICADO',
  'TEMAS_SOLO_LECTURA',
  'BORRADO_PENDIENTE',
  'EDICION_BLOQUEADA',
  'SESION_EN_CURSO',
  'SESION_NO_ACTIVA',
  'GUARDADO_PENDIENTE',
  'PANTALLA_NO_DISPONIBLE',
  'CANCION_NO_DISPONIBLE',
  'CANCION_EN_REPRODUCCION',
  'ENTRADA_NO_ENCONTRADA',
  'COLA_LLENA'
] as const

export type CodigoError = (typeof CODIGOS_ERROR)[number]

export function esCodigoError(valor: unknown): valor is CodigoError {
  return typeof valor === 'string' && (CODIGOS_ERROR as readonly string[]).includes(valor)
}
