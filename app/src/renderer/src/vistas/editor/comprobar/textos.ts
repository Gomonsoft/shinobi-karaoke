import { segundosDe } from '../../letra/textosComprobacion'

/** Textos de «Comprobar la letra con la voz» en el editor (spec 06 · Feature 4, claves `edi.comprobar.*`, `edi.desfase.*`). */
export const K = {
  funciones: {
    titulo: 'Comprobar la letra con la voz',
    ayuda:
      'Compara los tiempos de la letra con la voz separada. Si toda la letra va adelantada o atrasada, la mueve.',
    boton: 'Comprobar la letra con la voz…'
  },
  calculando: 'Comprobando…',
  falta: {
    lineas: 'Para comprobar la letra hacen falta al menos 5 líneas sincronizadas.'
  },
  toastCoincide: 'La letra coincide con la voz.',
  dudosa: {
    titulo: 'No está claro si la letra coincide con la voz',
    cuerpo:
      'Parte coincide y parte no; puede deberse a coros o a partes sin letra. No hemos cambiado nada.',
    cerrar: 'Cerrar'
  },
  noCoincide: {
    titulo: 'La letra no encaja con la voz',
    intro: 'Puede ser la letra de otra versión de la canción.',
    pie: 'No se puede arreglar moviendo toda la letra.',
    ir: 'Ir',
    irNombre: (a: string): string => `Ir a ${a}`,
    tramoAria: (a: string, b: string, motivo: string): string => `De ${a} a ${b}: ${motivo}`,
    otra: 'Buscar otra letra',
    cerrar: 'Cerrar'
  },
  desfase: {
    titulo: '¿Corregir el desfase de la letra?',
    explicacion: (d: number, n: number): string => {
      const s = segundosDe(d)
      return d > 0
        ? `Toda la letra va ${s} s adelantada respecto a la voz. Moveremos sus ${n} líneas ${s} s más tarde. No cambian el texto ni la duración de cada línea.`
        : `Toda la letra va ${s} s atrasada respecto a la voz. Moveremos sus ${n} líneas ${s} s antes. No cambian el texto ni la duración de cada línea.`
    },
    palabras: (k: number): string =>
      `También se mueven los fines fijados y los tiempos por palabra hechos a mano de ${k === 1 ? '1 línea' : `${k} líneas`}.`,
    boton: 'Corregir el desfase',
    cancelar: 'Cancelar',
    obsoleto:
      'Los tiempos cambiaron mientras decidías. Revisa los datos nuevos y confirma otra vez.',
    toast: (d: number): string =>
      d > 0
        ? `Letra movida ${segundosDe(d)} s más tarde.`
        : `Letra movida ${segundosDe(d)} s antes.`,
    corregido: (d: number): string =>
      d > 0
        ? `Desfase corregido: toda la letra ${segundosDe(d)} s más tarde.`
        : `Desfase corregido: toda la letra ${segundosDe(d)} s antes.`,
    quitar: 'Quitar la corrección',
    toastQuitada: 'Corrección quitada: la letra vuelve a sus tiempos anteriores.'
  },
  banner: {
    desfase: (d: number): string =>
      d > 0
        ? `Esta letra va ${segundosDe(d)} s adelantada respecto a la voz.`
        : `Esta letra va ${segundosDe(d)} s atrasada respecto a la voz.`,
    noCoincide: 'Esta letra no encaja con la voz: puede ser de otra versión de la canción.',
    ahoraNo: 'Ahora no',
    verPorQue: 'Ver por qué',
    cerrar: 'Cerrar aviso'
  }
} as const
