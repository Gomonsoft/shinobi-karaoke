import type { TandaPreparacionIpc } from '@shared/ipc'
import { textoDeError } from '../vistas/progreso/textos'

/** Textos de la cola de preparación (docs/ux/04 · 0.2.2 · Feature 7: claves `act.cola.*`). */
export const COLA = {
  titulo: (t: number, n: number): string => `Cola de preparación · ${t} de ${n} terminadas`,
  tituloPausa: (t: number, n: number): string =>
    `Cola de preparación · en pausa · ${t} de ${n} terminadas`,
  tituloFin: (n: number): string => `Preparación terminada · ${n} canciones`,
  verResultado: 'Ver resultado',
  boton: (i: number, n: number): string => `Preparando ${i} de ${n}`,
  botonPausa: (m: number): string => `En pausa · faltan ${m}`,
  botonParada: (m: number): string => `Cola parada · faltan ${m}`,
  pausar: 'Pausar',
  reanudar: 'Reanudar',
  pausaAyuda: 'La canción en curso termina su paso; las demás esperan.',
  cancelarBoton: 'Cancelar lo que falta…',
  cancelarTitulo: (m: number): string =>
    m === 1 ? '¿Cancelar la canción que falta?' : `¿Cancelar las ${m} canciones que faltan?`,
  cancelarCuerpo: (m: number): string =>
    m === 1
      ? 'Se quedará en tu biblioteca como borrador sin terminar. Podrás prepararla más tarde o eliminarla. Las que ya están preparadas no cambian.'
      : 'Se quedarán en tu biblioteca como borradores sin terminar. Podrás prepararlas más tarde o eliminarlas. Las que ya están preparadas no cambian.',
  seguir: 'Seguir preparando',
  cancelarConfirmar: 'Cancelar lo que falta',
  grupoCola: (n: number): string => `En cola (${n})`,
  grupoError: (n: number): string => `Con error (${n})`,
  grupoTerminadas: (n: number): string => `Terminadas (${n})`,
  reintentar: 'Reintentar las fallidas',
  ver: 'Ver',
  ir: 'Ir',
  res: {
    lista_para_revisar: 'Lista para revisar',
    elige_letra: 'Elige la letra',
    sin_letra: 'No encontramos la letra',
    letra_pendiente: 'Letra pendiente: sin conexión',
    sinBuscar: 'Falta la letra',
    cancelada: 'Cancelada',
    error: 'Con error'
  },
  anuncio: (i: number, n: number, titulo: string, resultado: string): string =>
    `${i} de ${n}: «${titulo}», ${resultado.toLowerCase()}.`,
  youtube: (k: number): string =>
    `YouTube no permite descargas ahora mismo. Hemos parado las ${k} descargas que faltaban para no empeorarlo. Lo demás sigue. Inténtalo más tarde.`,
  reintentarDescargas: 'Reintentar las descargas',
  sinConexion: (k: number): string =>
    `Sin conexión a internet. Las ${k} descargas que faltan seguirán solas cuando vuelva.`,
  reintentarAhora: 'Reintentar ahora',
  espacio: 'No queda espacio en el disco. La cola está parada. Libera espacio y reanúdala.',
  motor: 'Hay que reparar el motor de audio. La cola está parada hasta entonces.',
  /** `act.cola.motor.separaciones`: solo las separaciones paradas; lo demás sigue. */
  motorSeparaciones: (k: number): string =>
    k === 1
      ? 'Hay que reparar el motor de audio para separar las pistas. Hemos parado la separación que falta. Las descargas y la búsqueda de letras siguen.'
      : `Hay que reparar el motor de audio para separar las pistas. Hemos parado las ${k} separaciones que faltan. Las descargas y la búsqueda de letras siguen.`,
  repararMotor: 'Reparar el motor de audio',
  repetido: (titulo: string): string =>
    `Tres canciones seguidas han fallado: ${titulo}. Hemos parado la cola.`,
  verPrimera: 'Ver la primera',
  sesion:
    'El reproductor está abierto en otra pantalla. Si notas cortes en el sonido, pausa la cola.',
  anuncioPausa: 'Cola en pausa.',
  anuncioReanudada: 'Cola reanudada.',
  etaCalculando: 'Calculando tiempo…',
  cierre: (m: number): string =>
    `Faltan ${m} canciones por preparar. Si cierras ahora, se pararán y seguirán solas la próxima vez que abras Shinobi Karaoke. Tu letra y tu estilo están guardados.`
} as const

export type CancionTanda = TandaPreparacionIpc['canciones'][number]

/** Una tanda de 2 o más canciones (con una sola, la interfaz no cambia). */
export const esTandaDeVarias = (t: TandaPreparacionIpc | null): t is TandaPreparacionIpc =>
  t !== null && t.total >= 2

export const tandaViva = (t: TandaPreparacionIpc | null): t is TandaPreparacionIpc =>
  esTandaDeVarias(t) && t.terminadas < t.total

export const faltan = (t: TandaPreparacionIpc): number => Math.max(0, t.total - t.terminadas)

/** Pausa que pidió el usuario (sin causa) frente a una parada automática (con causa). */
export const pausaDelUsuario = (t: TandaPreparacionIpc): boolean =>
  t.pausada && t.motivoPausa === null

export const paradaAutomatica = (t: TandaPreparacionIpc): boolean =>
  t.motivoPausa !== null || t.descargasParadas !== null

/** `aviso`: sigue en marcha, pero con las separaciones paradas (icono ⚠). */
export type EstadoBotonCola = 'curso' | 'pausa' | 'parada' | 'aviso'

/**
 * Texto y estado del botón de la barra. Con las separaciones paradas (`act.cola.boton.parada` solo si no queda nada
 * en marcha): mientras algo sigue, «Preparando {i} de {n}» con el icono ⚠.
 */
export function botonDeCola(
  t: TandaPreparacionIpc,
  algoEnMarcha = true
): { texto: string; estado: EstadoBotonCola } {
  if (paradaAutomatica(t)) return { texto: COLA.botonParada(faltan(t)), estado: 'parada' }
  if (pausaDelUsuario(t)) return { texto: COLA.botonPausa(faltan(t)), estado: 'pausa' }
  if (t.separacionesParadas !== null && !algoEnMarcha) {
    return { texto: COLA.botonParada(faltan(t)), estado: 'parada' }
  }
  const texto = COLA.boton(Math.min(t.total, t.terminadas + 1), t.total)
  return { texto, estado: t.separacionesParadas !== null ? 'aviso' : 'curso' }
}

/** Texto del resultado de una canción terminada (`act.cola.res.*`). */
export function textoResultado(c: CancionTanda, busquedaAutomatica: boolean): string {
  switch (c.resultado) {
    case 'sin_letra':
      return busquedaAutomatica ? COLA.res.sin_letra : COLA.res.sinBuscar
    case 'lista_para_revisar':
    case 'elige_letra':
    case 'letra_pendiente':
    case 'cancelada':
      return COLA.res[c.resultado]
    case 'error':
      return textoDeError(c.motivo ?? '').titulo.replace(/\.$/, '')
    default:
      return ''
  }
}

/** Fracción 0–1 de la tanda: terminadas más lo avanzado de las que están en curso. */
export function fraccionGlobal(t: TandaPreparacionIpc, avanceEnCurso: number): number {
  if (t.total === 0) return 0
  return Math.min(1, (t.terminadas + Math.max(0, avanceEnCurso)) / t.total)
}

/** `quedan unos N min` (como `prog.eta`) o `prog.eta.calculando`. */
export function textoEtaCola(estimacionMin: number | null): string {
  if (estimacionMin === null) return COLA.etaCalculando
  if (estimacionMin < 1) return 'queda menos de 1 min'
  return estimacionMin <= 1
    ? 'queda alrededor de 1 min'
    : `quedan unos ${Math.round(estimacionMin)} min`
}
