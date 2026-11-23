/** Textos de la vista 03 (docs/ux/03 "Microcopy"); los `add.error.*` salen de `progreso/textos.ts`. */

export const TEXTO = {
  titulo: 'Añadir canción',
  pregunta: '¿Qué quieres añadir?',
  origen: 'Origen de la canción',
  origenArchivo: 'Archivos de tu equipo',
  origenYoutube: 'Enlaces de YouTube',
  arrastre: 'Arrastra aquí un archivo, varios o una carpeta entera',
  soltar: 'Suelta para añadir',
  o: 'o',
  elegir: 'Elegir archivos…',
  elegirCarpeta: 'Elegir carpeta…',
  formatos: 'MP3, M4A, FLAC, WAV, OGG/Opus, WebM · vídeo MP4, MKV, MOV',
  leyendo: 'Leyendo el audio…',
  datosTitulo: 'Revisa los datos de la canción',
  datosAyuda:
    'Los hemos rellenado por ti. Con ellos buscamos la letra y elegimos el tema. Puedes cambiarlos después.',
  campoTitulo: 'Título',
  campoArtista: 'Artista',
  campoAlbum: 'Álbum',
  campoAlbumAyuda: 'Opcional, ayuda a encontrar la letra exacta',
  tituloVacio: 'Escribe un título.',
  continuar: 'Continuar',
  cancelar: 'Cancelar',
  guardado: 'Guardado',
  notaResumen: 'Para usar otro audio, añade una canción nueva.',
  otroArchivo: 'Elegir otro archivo',
  copiarDetalles: 'Copiar detalles',
  // 0.2.2 · Feature 6 (`add.dato.*`)
  sugerencias: 'Mostrar sugerencias de tu biblioteca',
  numCanciones: (n: number): string => (n === 1 ? '1 canción' : `${n} canciones`),
  opcionSugerencia: (nombre: string, n: number): string =>
    `${nombre}, ${n === 1 ? '1 canción' : `${n} canciones`}`,
  sinArtista: 'Sin artista es más difícil encontrar la letra.',
  dudoso: (procedencia: string): string => `${procedencia}: compruébalo`,
  dudosoInvertido: 'Hemos intercambiado título y artista: compruébalo',
  unificar: (valor: string): string => `¿Te refieres a «${valor}», que ya está en tu biblioteca?`,
  usar: (valor: string): string => `Usar «${valor}»`,
  dejarlo: 'Dejarlo así',
  intercambiar: 'Intercambiar título y artista',
  intercambiado: 'Título y artista intercambiados.',
  // 0.2.2 · Feature 5 (F6-N7 y F6-N8)
  busquedaLrclib: 'Al continuar buscaremos la letra en LRCLIB con estos datos.',
  cambiarEnAjustes: 'Cambiar en Ajustes',
  origenLrclib: 'Tomado de LRCLIB',
  quitar: 'Quitar',
  sugerenciaLrclib: (titulo: string, artista: string): string =>
    `LRCLIB la llama «${titulo}», de «${artista}».`,
  usarEstosDatos: 'Usar estos datos'
} as const

/** `add.dato.origen.*`: bajo cada campo prerrellenado. */
export const ORIGEN_DATO = {
  etiquetas: 'De las etiquetas del archivo',
  nombre: 'Del nombre del archivo',
  carpeta: 'Del nombre de la carpeta',
  video: 'Del título del video',
  pista: 'De los datos de la canción en YouTube',
  canal: 'Del nombre del canal',
  lista: 'Del nombre de la lista',
  biblioteca: 'Como en tu biblioteca'
} as const

/** Pestaña "Enlace de YouTube" (docs/ux/03: `add.legal.*`, `add.url.*`, `add.pendiente.*`). */
export const TEXTO_YT = {
  legalSoloUnaVez: 'Solo te lo mostraremos esta vez. Puedes releerlo en Ajustes.',
  legalAceptar: 'Entendido',
  legalRechazar: 'Usar un archivo en su lugar',
  urlEtiqueta: 'Enlaces de YouTube',
  urlAyuda:
    'Pega el enlace de un video, varios enlaces (uno por renglón) o el de una lista de reproducción o un álbum.',
  buscar: 'Buscar',
  buscando: 'Buscando…',
  reintentoYtdlp:
    'Actualizando el descargador de YouTube y volviendo a buscar… Puede tardar hasta medio minuto.',
  descargar: 'Descargar y continuar',
  usarArchivo: 'Usar un archivo de tu equipo',
  pendienteTitulo: 'Falta descargar el audio.',
  pendienteCuerpo: 'Cancelaste la descarga antes de que terminara.',
  descargarAhora: 'Descargar ahora',
  otroEnlace: 'Usar otro enlace',
  reintentar: 'Reintentar',
  interrumpidoTitulo: 'La descarga se interrumpió',
  interrumpidoCuerpo: 'porque se cerró la aplicación.',
  errorAceptar: 'No se pudo guardar tu respuesta. Vuelve a intentarlo.'
} as const

export const textoLeido = (nombre: string, duracion: string): string =>
  `Audio leído: ${nombre} · ${duracion}`

/**
 * `add.aviso.larga`. La cifra ("unos {n} minutos en tu equipo") viene de
 * `runtime.estimarSeparacion` (0067); sin ella se omite el paréntesis.
 */
export const textoLarga = (duracion: string, minutos: number | null = null): string =>
  `Esta canción dura ${duracion}. Separarla tardará más de lo normal` +
  (minutos === null ? '.' : ` (unos ${minutos} minutos en tu equipo).`)
