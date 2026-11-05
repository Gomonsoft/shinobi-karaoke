/** Textos de la vista 03 (docs/ux/03 "Microcopy"); los `add.error.*` salen de `progreso/textos.ts`. */

export const TEXTO = {
  titulo: 'Añadir canción',
  pregunta: '¿De dónde sale la canción?',
  origen: 'Origen de la canción',
  origenArchivo: 'Archivo de tu equipo',
  origenYoutube: 'Enlace de YouTube',
  arrastre: 'Arrastra aquí un archivo de audio o vídeo',
  soltar: 'Suelta para añadir',
  o: 'o',
  elegir: 'Elegir archivo…',
  formatos: 'MP3, M4A, FLAC, WAV, OGG/Opus, WebM · vídeo MP4, MKV, MOV',
  varios: 'Añade las canciones de una en una.',
  leyendo: 'Leyendo el audio…',
  datosTitulo: 'Revisa los datos de la canción',
  datosAyuda: 'Los usaremos para buscar la letra. Puedes cambiarlos después.',
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
  copiarDetalles: 'Copiar detalles'
} as const

/** Pestaña "Enlace de YouTube" (docs/ux/03: `add.legal.*`, `add.url.*`, `add.pendiente.*`). */
export const TEXTO_YT = {
  legalSoloUnaVez: 'Solo te lo mostraremos esta vez. Puedes releerlo en Ajustes.',
  legalAceptar: 'Entendido',
  legalRechazar: 'Usar un archivo en su lugar',
  urlEtiqueta: 'Enlace del vídeo',
  urlAyuda: 'Pega el enlace de un vídeo (no de una lista ni de un directo).',
  buscar: 'Buscar vídeo',
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
