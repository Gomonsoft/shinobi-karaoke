import { AVISOS } from '@shared/avisos'

/** Textos de la vista de progreso para la preparación desatendida (docs/ux/04 · 0.2.2 · Feature 5). */
const plural = (n: number, uno: string, varios: string): string => (n === 1 ? uno : varios)

export const PREP = {
  titulo: 'Preparando tu canción',
  /** `prog.prep.titulo.fin`: el título con un resultado, sin subtítulo (spec 04, F5-P13). */
  tituloFin: {
    revisar: 'Tu canción está lista para revisar',
    elige: 'Falta que elijas la letra',
    sinLetra: 'No encontramos la letra',
    instrumental: 'No encontramos la letra',
    pendiente: 'Falta la letra'
  },
  subtitulo: 'No hace falta que esperes: te avisaremos cuando esté lista para revisar.',
  sub: {
    letra: 'Buscar la letra',
    comprobar: 'Comprobar la letra con la voz',
    fines: 'Ajustar los fines de línea'
  },
  buscando: 'Buscando la letra en LRCLIB…',
  comprobando: 'Comprobando la letra con la voz…',
  ajustando: 'Ajustando los fines…',
  esperaSeparacion: 'Empezará al terminar la separación.',
  res: {
    candidatas: (n: number) => `${n} ${plural(n, 'candidata', 'candidatas')} en LRCLIB`,
    noEncontrada: 'No encontrada',
    instrumental: 'Instrumental, según LRCLIB',
    sinConexion: 'Sin conexión',
    servicio: 'El servicio de letras no responde',
    coincide: 'Coincide',
    corregida: (d: string) => `Desfase corregido: ${d} s`,
    duda: 'No está claro',
    fines: (n: number) =>
      n === 0 ? 'Nada que ajustar' : `${n} ${plural(n, 'fin ajustado', 'fines ajustados')}`
  },
  omitido: {
    yaTieneLetra: 'Ya tiene letra',
    sinMarca: 'Letra de una versión anterior: no se comprueba'
  },
  botonVerLetra: 'Ver la letra',
  botonRevisar: 'Revisar',
  botonProbar: 'Probar',
  botonElegir: 'Elegir la letra',
  botonAnadir: 'Añadir la letra',
  botonReintentar: 'Reintentar',
  r1: {
    titulo: 'Lista para revisar',
    letraApp: 'Letra de LRCLIB, coincidencia exacta.',
    letraUsuario: 'Letra de LRCLIB, elegida por ti.',
    fines: (n: number) => `Fin de ${n} ${plural(n, 'línea', 'líneas')} ajustado con la voz.`,
    pie: 'Escúchala, corrige lo que no coincida y márcala como lista.'
  },
  r2: {
    titulo: 'Elige la letra',
    cuerpo: (n: number, motivo: string) =>
      `${plural(n, 'Hay 1 candidata', `Hay ${n} candidatas`)}. No la elegimos por ti porque ${motivo}.`
  },
  r3: {
    titulo: 'No encontramos la letra',
    cuerpo: 'Revisa el título y el artista, o pega la letra tú.',
    tituloInstrumental: 'Esta canción es instrumental, según LRCLIB',
    cuerpoInstrumental: 'Si tiene letra, pégala o impórtala.'
  },
  r4: {
    titulo: 'No pudimos buscar la letra: sin conexión a internet.',
    tituloServicio: 'No pudimos buscar la letra: el servicio de letras no responde.',
    cuerpo: 'Lo intentaremos de nuevo la próxima vez que abras la app.'
  },
  toast: {
    revisar: AVISOS.preparacion.revisar,
    elige: AVISOS.preparacion.elige,
    sinLetra: AVISOS.preparacion.sinLetra
  },
  atencion: 'necesita tu atención'
} as const
