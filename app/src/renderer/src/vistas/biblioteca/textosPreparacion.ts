import { MOTIVO } from './acciones/textos'
/** Textos de la Biblioteca para la preparación desatendida (docs/ux/02 · 0.2.2 · Feature 5). */
const plural = (n: number, uno: string, varios: string): string => (n === 1 ? uno : varios)

export const BIB_PREP = {
  estado: { revisar: 'Lista para revisar' },
  ayudaRevisar:
    'Ya tiene pistas y letra sincronizada. Escúchala y márcala como lista para poder cantarla.',
  origen: {
    auto: 'Letra elegida automáticamente',
    autoCorregida: 'Letra elegida automáticamente · desfase corregido'
  },
  accion: {
    revisar: 'Revisar',
    probar: 'Probar',
    elegirLetra: 'Elegir la letra',
    anadirLetra: 'Añadir la letra',
    reintentar: 'Reintentar'
  },
  probarSesion: 'No se puede probar mientras el reproductor está abierto en otra pantalla.',
  toastProbada: (titulo: string) => `¿Qué tal «${titulo}»?`,
  marcarLista: 'Marcar como lista',
  paso: {
    buscando: 'Buscando la letra…',
    comprobando: 'Comprobando la letra…',
    fines: 'Ajustando los fines…',
    elige: (n: number) => `Elige la letra · ${n} ${plural(n, 'candidata', 'candidatas')}`,
    noEncontrada: 'No encontramos la letra',
    instrumental: 'Instrumental, según LRCLIB',
    pendiente: 'Letra pendiente: sin conexión',
    pendienteServicio: 'Letra pendiente: el servicio no responde'
  },
  menu: {
    preparar: 'Preparar',
    ayuda: 'Busca la letra en LRCLIB con el título y el artista',
    revisar: 'Revisar',
    probar: 'Probar'
  },
  /** Revisión guiada en la Biblioteca (spec 02 · Feature 11): `bib.revision.*`. */
  revision: {
    linea: (n: number) => (n === 1 ? '1 línea por revisar' : `${n} líneas por revisar`),
    sinDudas: 'Sin líneas dudosas',
    menu: { lista: 'Marcar como lista', letraLista: 'Marcar como letra lista' },
    dialogoTitulo: '¿Marcar como lista sin revisar?',
    dialogoCuerpo: (titulo: string, n: number) =>
      `«${titulo}» tiene ${n === 1 ? '1 línea que conviene escuchar' : `${n} líneas que conviene escuchar`} antes de cantarla. Puedes revisarlas ahora (son un par de minutos) o marcarla igualmente y revisarlas después.`,
    marcarIgualmente: 'Marcar igualmente',
    revisarAhora: 'Revisar ahora'
  },
  toastPreparando: (titulo: string) => `Preparando «${titulo}». Te avisaremos al terminar.`,
  bandeja: {
    titulo: 'Pendientes de ti:',
    revisar: (n: number) => `${n} ${plural(n, 'lista para revisar', 'listas para revisar')}`,
    letra: (n: number) => `${n} ${plural(n, 'espera letra', 'esperan letra')}`,
    error: (n: number) => `${n} con error`
  },
  retomando: (n: number) =>
    n === 1
      ? 'Retomando 1 canción que quedó a medias al cerrar.'
      : `Retomando ${n} canciones que quedaron a medias al cerrar.`,
  enPausa: (n: number) =>
    n === 1
      ? 'Hay 1 canción en pausa, a medio preparar.'
      : `Hay ${n} canciones en pausa, a medio preparar.`,
  detener: 'Detener',
  reanudar: 'Reanudar',
  noSePuedePreparar: (titulo: string) => `«${titulo}» no se puede preparar ahora.`
} as const

/** Texto de una canción que «Preparar» no aceptó: los motivos de «Ajustar los fines…» tienen el suyo (0316). */
export const mensajeDeOmitida = (
  omitidas: readonly { id: string; motivo?: string }[],
  id: string,
  titulo: string
): string => {
  const motivo = omitidas.find((o) => o.id === id)?.motivo
  return motivo === 'SIN_VOZ' || motivo === 'SIN_PICOS'
    ? MOTIVO[motivo]!
    : BIB_PREP.noSePuedePreparar(titulo)
}

/** Clave de cada casilla de la bandeja (una sola activa a la vez). */
export type CasillaBandeja = 'revisar' | 'letra' | 'error'

/** Resultado de la preparación (diálogo `Resultado de la preparación`, spec 04 · Feature 7). */
export const BIB_RESULTADO = {
  titulo: 'Resultado de la preparación',
  resumen: (partes: string[]) => `${partes.join(' · ')}.`,
  total: (n: number) => `${n} ${plural(n, 'canción', 'canciones')}`,
  fila: {
    lista_para_revisar: 'Lista para revisar',
    elige_letra: 'Elige la letra',
    sin_letra: 'No encontramos la letra',
    letra_pendiente: 'Letra pendiente',
    error: 'No se pudo preparar',
    cancelada: 'Cancelada'
  },
  sinResultado: 'En preparación',
  verEnBiblioteca: 'Ver en la biblioteca',
  reintentarFallidas: 'Reintentar las fallidas',
  copiarDetalles: 'Copiar detalles',
  cerrar: 'Cerrar',
  vacio: 'Todavía no hay una preparación que mostrar.'
} as const
