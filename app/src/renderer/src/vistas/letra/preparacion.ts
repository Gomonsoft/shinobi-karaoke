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
    sinExacta: 'ninguna es la coincidencia exacta de título, artista y duración',
    duda: 'no está claro que coincida con tu audio',
    noCoincide: 'ninguna coincide con tu audio',
    soloTexto: 'solo hay letras sin sincronizar',
    sinComprobar: 'no pudimos comprobarla con tu audio'
  },
  continuando: 'Terminando de preparar la canción…'
} as const

export type MotivoElige = keyof typeof LP.motivo
