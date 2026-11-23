/** Textos de la vista Letra para la preparación desatendida (docs/ux/05 · 0.2.2 · Feature 5, `let.prep.*`). */
export const LP = {
  elegida:
    'Elegimos esta letra por ti: es la coincidencia exacta de LRCLIB y coincide con tu audio.',
  elegidaCorregida: (d: string, adelantada: boolean): string =>
    `Elegimos esta letra por ti: es la coincidencia exacta de LRCLIB. Iba ${d} s ${adelantada ? 'adelantada' : 'atrasada'} y la hemos corregido.`,
  verOtras: 'Ver otras candidatas',
  cerrarAviso: 'Cerrar aviso',
  actual: 'Letra actual',
  elige: 'Elige la letra.',
  eligeCuerpo: (motivo: string): string => `No la elegimos por ti porque ${motivo}.`,
  motivo: {
    varias: 'hay varias versiones que coinciden con tu audio',
    sinArtista: 'falta el artista de la canción: escríbelo arriba y vuelve a buscar, o elige tú',
    sinExacta:
      'aunque alguna encaja con tu audio, ninguna coincide a la vez en título, artista y duración con tu canción',
    duda: 'no está claro que coincida con tu audio',
    limitada:
      'no podemos comprobarlas con tu audio: la voz casi no tiene pausas o las letras no marcan dónde acaba cada línea',
    noCoincide: 'ninguna coincide con tu audio',
    soloTexto: 'solo hay letras sin sincronizar',
    sinComprobar: 'no pudimos comprobarla con tu audio'
  },
  continuando: 'Terminando de preparar la canción…'
} as const

export type MotivoElige = Exclude<keyof typeof LP.motivo, 'sinArtista' | 'limitada'>

/**
 * Motivo de «Elige la letra» (`let.prep.motivo.*`). `sinArtista` tiene prioridad cuando el artista está vacío
 * y se deduce aquí (no se guarda en `busqueda.no_elige`: el artista puede escribirse después). `sinExacta`
 * dice «aunque alguna encaja con tu audio» solo si se sabe que alguna encaja (`algunaEncaja === true`).
 */
export function motivoElige(
  noElige: MotivoElige | null | undefined,
  {
    artistaVacio,
    algunaEncaja,
    limitada = false
  }: { artistaVacio: boolean; algunaEncaja: boolean; limitada?: boolean }
): string {
  if (artistaVacio) return LP.motivo.sinArtista
  if (noElige === 'sinExacta' && !algunaEncaja) {
    return 'ninguna coincide a la vez en título, artista y duración con tu canción'
  }
  // `duda` con el mejor candidato `dudosa` por una limitación: el motivo dice por qué (spec 05, F4).
  if ((noElige ?? 'duda') === 'duda' && limitada) return LP.motivo.limitada
  return LP.motivo[noElige ?? 'duda']
}
