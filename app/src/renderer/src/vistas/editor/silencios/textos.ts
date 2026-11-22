import { formatearTiempo } from '@shared/letras/tiempos'

/** Textos de «Ajustar los silencios» (spec 06, claves `edi.silencios.*`), en bloque propio. */
export const decimal = (ms: number): string => (ms / 1000).toFixed(1).replace('.', ',')

export const esMac = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '')

export const S = {
  boton: 'Ajustar los silencios',
  buscando: 'Buscando silencios…',
  falta: {
    titulo: 'Para ajustar los silencios falta:',
    separacion: 'La forma de onda de la voz (disponible cuando termine la separación)',
    preparando: 'La forma de onda de la voz (se está preparando…)',
    error: 'La forma de onda de la voz (no se pudo preparar)',
    reintentar: 'Reintentar',
    noDisponible: 'La forma de onda de la voz (no está disponible)',
    ritmo: 'No disponible mientras sincronizas al ritmo.',
    tema: 'Terminar de editar el tema (guarda o descarta sus cambios)'
  },
  dialogo: {
    titulo: '¿Ajustar los silencios?',
    explicacion:
      'Shinobi Karaoke buscará en la voz el primer silencio después de cada línea y llevará su fin al último momento con voz. Las líneas sin silencio, las que tienen tiempos por palabra hechos a mano y las pausas no cambian.',
    cancelar: 'Cancelar'
  },
  lineas: (n: number, total: number): string =>
    n === 0
      ? 'Ningún fin cambia.'
      : n === 1
        ? `Cambiará el fin de 1 de ${total} líneas.`
        : `Cambiará el fin de ${n} de ${total} líneas.`,
  manuales: (m: number): string =>
    m === 1
      ? '1 de ellas tenía un fin fijado (a mano o con la letra). También se ajustará.'
      : `${m} de ellas tenían un fin fijado (a mano o con la letra). También se ajustarán.`,
  cuentaActivar: (k: number, umbralMs: number): string =>
    k === 1
      ? `Quedará 1 silencio de ${decimal(umbralMs)} s o más. Se activará la cuenta 3·2·1 en esta canción: saldrá en él y en cualquier otro silencio de ${decimal(umbralMs)} s o más.`
      : `Quedarán ${k} silencios de ${decimal(umbralMs)} s o más. Se activará la cuenta 3·2·1 en esta canción: saldrá en ellos y en cualquier otro silencio de ${decimal(umbralMs)} s o más.`,
  cuentaYaActiva: (k: number, umbralMs: number): string =>
    k === 1
      ? `Quedará 1 silencio de ${decimal(umbralMs)} s o más, con la cuenta 3·2·1 que ya tiene esta canción.`
      : `Quedarán ${k} silencios de ${decimal(umbralMs)} s o más, con la cuenta 3·2·1 que ya tiene esta canción.`,
  verLineas: (abierto: boolean): string => (abierto ? 'Ocultar las líneas' : 'Ver las líneas'),
  fila: (
    n: number,
    texto: string,
    antes: number,
    despues: number,
    fijado: boolean,
    largo: boolean
  ): string =>
    `Línea ${n} · «${texto}» ${formatearTiempo(antes)} → ${formatearTiempo(despues)}` +
    (fijado ? ' · fijado' : '') +
    (largo ? ' · silencio largo' : ''),
  filaAria: (
    n: number,
    texto: string,
    antes: number,
    despues: number,
    fijado: boolean,
    largo: boolean
  ): string =>
    `Línea ${n}, ${texto}: el fin pasa de ${formatearTiempo(antes)} a ${formatearTiempo(despues)}` +
    (fijado ? ', tenía fin fijado' : '') +
    (largo ? ', deja un silencio largo' : ''),
  deshacer: (mac: boolean): string => `Puedes deshacerlo de una vez con ${mac ? '⌘Z' : 'Ctrl+Z'}.`,
  aplicar: 'Ajustar los silencios',
  nada: 'No hay silencios que ajustar: los fines ya coinciden con la voz.',
  toast: (n: number, cuenta: boolean): string =>
    (n === 1 ? 'Se ajustó el fin de 1 línea.' : `Se ajustó el fin de ${n} líneas.`) +
    (cuenta ? ' Se activó la cuenta 3·2·1 en esta canción.' : ''),
  obsoleto:
    'Los tiempos cambiaron mientras decidías. Revisa los nuevos recuentos y confirma otra vez.',
  deshacerToast: 'Deshacer'
} as const
