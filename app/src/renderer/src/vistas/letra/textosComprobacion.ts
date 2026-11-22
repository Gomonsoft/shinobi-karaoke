/** Textos de «Comprobar la letra contra el audio» en la vista Letra (docs/ux/05, claves `let.comp.*`). */

/** `{d}` con coma decimal y un decimal («0,8»). */
export const segundosDe = (ms: number): string => (Math.abs(ms) / 1000).toFixed(1).replace('.', ',')

/** m:ss de un tiempo de audio. */
export const mmss = (ms: number): string => {
  const s = Math.floor(Math.max(0, ms) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const CC = {
  titulo: 'Comprobación con tu audio',
  comprobando: 'Comprobando con tu audio…',
  coincide: 'Coincide con tu audio',
  adelantada: (d: string): string => `Va ${d} s adelantada: la corregiremos`,
  atrasada: (d: string): string => `Va ${d} s atrasada: la corregiremos`,
  dudosa: 'No está claro si coincide con tu audio',
  noCoincide: 'No coincide con tu audio: puede ser otra versión',
  pendiente: 'Se comprobará con tu audio al terminar la separación',
  noDisponible: 'No se pudo comprobar con tu audio',
  desfaseAyuda: (d: string, adelantada: boolean): string =>
    adelantada
      ? `Toda la letra sale ${d} s antes que la voz. Al usarla la moveremos ${d} s más tarde. Los tiempos de abajo ya están corregidos.`
      : `Toda la letra sale ${d} s después que la voz. Al usarla la moveremos ${d} s antes. Los tiempos de abajo ya están corregidos.`,
  dudosaAyuda:
    'Parte de la letra coincide con la voz y parte no. Puede deberse a coros o a partes sin letra. Escúchala en el editor antes de darla por buena.',
  noCoincideAyuda:
    'Puede ser otra versión de la canción. Prueba con otra letra o revísala en el editor.',
  detalle: {
    silencio: (n: number, total: number, tramos: [number, number][]): string => {
      if (n === 1 && tramos.length === 1)
        return `1 de ${total} líneas cae donde no hay voz (${mmss(tramos[0]![0])}).`
      if (tramos.length === 1)
        return `${n} de ${total} líneas caen donde no hay voz (de ${mmss(tramos[0]![0])} a ${mmss(tramos[0]![1])}).`
      return `${n} de ${total} líneas caen donde no hay voz.`
    },
    vozSinLetra: (tramos: [number, number][]): string => {
      if (tramos.length === 1)
        return `Hay voz sin letra de ${mmss(tramos[0]![0])} a ${mmss(tramos[0]![1])}.`
      const mayor = tramos.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a))
      return `Hay voz sin letra en ${tramos.length} tramos; el más largo, de ${mmss(mayor[0])} a ${mmss(mayor[1])}.`
    },
    variable: 'El desfase cambia a lo largo de la canción: no se arregla moviendo toda la letra.'
  },
  llegada: (n: number): string =>
    `Ya hemos comprobado las letras con tu audio. La que mejor coincide es la ${n}.ª.`,
  seleccionarla: 'Seleccionarla',
  cerrarAviso: 'Cerrar aviso',
  actual: {
    coincide: 'Coincide con la voz de tu audio.',
    corregida: (d: string, mas_tarde: boolean): string =>
      mas_tarde
        ? `Movimos toda la letra ${d} s más tarde para que coincida con la voz.`
        : `Movimos toda la letra ${d} s antes para que coincida con la voz.`,
    adelantada: (d: string): string => `Toda la letra va ${d} s adelantada respecto a la voz.`,
    atrasada: (d: string): string => `Toda la letra va ${d} s atrasada respecto a la voz.`,
    dudosa: 'No está claro si la letra coincide con la voz. Escúchala en el editor.',
    noCoincide: 'La letra no coincide con la voz de tu audio: puede ser otra versión.',
    pendiente: 'La comprobaremos con tu audio al terminar la separación.'
  },
  boton: {
    corregir: 'Corregir el desfase',
    quitar: 'Quitar la corrección',
    porque: 'Ver por qué'
  },
  anuncio: {
    corregida: (d: string, mas_tarde: boolean): string =>
      mas_tarde ? `Letra movida ${d} s más tarde.` : `Letra movida ${d} s antes.`,
    quitada: 'Corrección quitada: la letra vuelve a sus tiempos anteriores.'
  },
  errorGuardar: 'No se pudo mover la letra. Vuelve a intentarlo.',
  copiarDetalles: 'Copiar detalles'
} as const
