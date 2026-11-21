import type { Espera } from '@shared/espera'

/** Textos de «Indicadores de espera» (spec 06, claves `edi.espera.*`), en bloque propio. */
export const decimal = (ms: number): string => (ms / 1000).toFixed(1).replace('.', ',')

/** «Puntos ●●●, barra y cuenta 3·2·1» (el primero con mayúscula); vacío si no hay ninguno. */
export function indicadores(e: Espera): string {
  const nombres = [e.puntos && 'puntos ●●●', e.barra && 'barra', e.cuenta && 'cuenta 3·2·1'].filter(
    (n): n is string => Boolean(n)
  )
  if (nombres.length === 0) return ''
  const texto =
    nombres.length === 1 ? nombres[0]! : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export const T_ESPERA = {
  titulo: 'Indicadores de espera',
  ayuda: 'Avisan de cuándo vuelve la letra tras un silencio.',
  puntos: 'Puntos ●●●',
  puntosAria: 'Puntos de espera',
  barra: 'Barra hasta la próxima línea',
  cuenta: 'Cuenta 3·2·1',
  cuentaAria: 'Cuenta tres, dos, uno',
  primera: 'Antes de la primera línea',
  umbral: 'Silencio mínimo',
  umbralRango: 'Entre 1 y 60 segundos.',
  menos: 'Reducir el silencio mínimo',
  mas: 'Aumentar el silencio mínimo',
  resumen: (e: Espera): string =>
    indicadores(e) === ''
      ? 'Sin indicadores: los silencios se verán solo con la línea siguiente en espera.'
      : e.primera_entrada
        ? `Salen en silencios de ${decimal(e.umbral_ms)} s o más y antes de la primera línea.`
        : `Salen en silencios de ${decimal(e.umbral_ms)} s o más.`,
  resumenCorto: (e: Espera): string =>
    indicadores(e) === ''
      ? 'Sin indicadores'
      : `${indicadores(e)} · silencios de ${decimal(e.umbral_ms)} s o más`,
  origen: (procedencia: string, tema: string | null): string =>
    procedencia === 'incluido'
      ? 'Del estilo incluido de Shinobi Karaoke'
      : procedencia === 'respaldo'
        ? 'Del aspecto guardado en esta canción'
        : `Del tema «${tema ?? ''}»`,
  cambiar: 'Cambiar solo en esta canción',
  propios: (tema: string | null): string =>
    `Propios de esta canción. El resto del aspecto sigue el tema «${tema ?? ''}».`,
  usarTema: 'Usar los del tema',
  d3Propios: 'Esta canción tiene indicadores propios: fuera de esta edición seguirá usándolos.',
  ejemplo: 'Ver un ejemplo',
  detenerEjemplo: 'Detener el ejemplo',
  ejemploEtiqueta: 'Ejemplo',
  anuncio: {
    propios: 'Indicadores propios de esta canción.',
    usarTema: 'Esta canción vuelve a usar los indicadores del tema.',
    ejemploInicio: 'Mostrando un ejemplo de espera de 6 segundos en la vista previa.',
    ejemploFin: 'Fin del ejemplo.'
  }
} as const
