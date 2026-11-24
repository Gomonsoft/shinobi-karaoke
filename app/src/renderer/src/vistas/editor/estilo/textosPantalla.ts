import { zonasEfectivas, type Pantalla, type TransicionPantalla } from '@shared/pantalla'

/** Textos de «Letra en pantalla» (spec 06 · Feature 1, claves `edi.pantalla.*`). */
const CAMBIO: Record<TransicionPantalla, string> = {
  desplazamiento: 'desplazamiento',
  fundido: 'fundido',
  ninguna: 'sin animación'
}

export const T_PANTALLA = {
  titulo: 'Letra en pantalla',
  ayuda: 'Cuántas líneas se ven a la vez y cómo cambian.',
  lineas: 'Líneas a la vez',
  pasadas: 'Líneas ya cantadas',
  ninguna: 'Ninguna',
  pasadasAyuda: 'La línea que acabas de cantar sube y se apaga.',
  minimo1: 'Líneas ya cantadas: disponible con 4 líneas o más.',
  minimo2: 'Dos líneas ya cantadas: disponible con 6 o 7 líneas.',
  cambio: 'Cambio de línea',
  opciones: {
    desplazamiento: ['Desplazamiento', 'Todas las líneas suben un puesto.'],
    fundido: ['Fundido', 'Cada línea se funde hacia su nuevo sitio, con menos movimiento.'],
    ninguna: ['Sin animación', 'Las líneas cambian de golpe.']
  } as Record<TransicionPantalla, [string, string]>,
  /** `p` = ya cantadas que se ven de verdad. */
  resumen: (p: Pantalla, pasadas: number): string => {
    const futuras = p.lineas - 1 - pasadas
    const cantadas = pasadas === 0 ? '' : pasadas === 1 ? ', 1 ya cantada' : ', 2 ya cantadas'
    const siguientes = futuras === 1 ? 'la siguiente' : `las ${futuras} siguientes`
    return `Se ven la línea que suena${cantadas} y ${siguientes}.`
  },
  /** `voces`: la canción tiene reparto; el resumen añade « · en zonas» o « · en un bloque». */
  resumenCorto: (p: Pantalla, pasadas: number, voces = false): string => {
    const cantadas = pasadas === 0 ? '' : pasadas === 1 ? ' · 1 ya cantada' : ' · 2 ya cantadas'
    const sufijo = !voces ? '' : zonasEfectivas(p) === 'una' ? ' · en un bloque' : ' · en zonas'
    return `${p.lineas} líneas${cantadas} · ${CAMBIO[p.transicion]}${sufijo}`
  },
  voces: 'Varias voces',
  bloqueSolapes:
    'Esta canción tiene voces a la vez: en un bloque solo se ve una cada vez. Se ven mejor en zonas.',
  verEnZonas: 'Ver en zonas',
  vocesOpciones: {
    por_parte: ['Cada una en su zona', 'Cada cantante y el coro tienen su franja en la pantalla.'],
    una: [
      'Todas en un bloque',
      'Las líneas se suceden en un solo bloque; cada voz con su color y su inicial.'
    ]
  } as Record<'por_parte' | 'una', [string, string]>,
  zonas:
    'Esta canción tiene varias voces: cada una se ve en su zona, con su línea y la siguiente. «Líneas a la vez» y «Líneas ya cantadas» no se aplican; «Cambio de línea» sí.',
  reducido:
    'Tu sistema pide reducir el movimiento: en este equipo las líneas cambiarán sin animación.',
  origen: (procedencia: string, tema: string | null): string =>
    procedencia === 'incluido'
      ? 'Del estilo incluido de Shinobi Karaoke'
      : procedencia === 'respaldo'
        ? 'Del aspecto guardado en esta canción'
        : `Del tema «${tema ?? ''}»`,
  propia: (tema: string | null): string =>
    `Propia de esta canción. El resto del aspecto sigue el tema «${tema ?? ''}».`,
  soloCancion: 'Cambiar solo en esta canción',
  usarTema: 'Usar la del tema',
  d3Propia:
    'Esta canción tiene su propia letra en pantalla: fuera de esta edición seguirá usándola.',
  ejemplo: 'Ver un ejemplo',
  detenerEjemplo: 'Detener el ejemplo',
  anuncio: {
    propia: 'Letra en pantalla propia de esta canción.',
    usarTema: 'Esta canción vuelve a usar la letra en pantalla del tema.',
    ejemploInicio: 'Mostrando un ejemplo de cambios de línea en la vista previa.',
    ejemploFin: 'Fin del ejemplo.'
  }
} as const
