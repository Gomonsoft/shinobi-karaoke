/** Textos de la vista de progreso (docs/ux/04 y 03: `add.error.*`, `add.interrumpido`). */

export const TEXTO = {
  titulo: 'Separando la voz de la música',
  subtitulo: 'Puedes seguir trabajando: esto continúa aunque cambies de pantalla.',
  descargar: 'Descargar de YouTube',
  preparar: 'Preparar el audio',
  separar: 'Separar voz e instrumental',
  preparando: 'Preparando el audio…',
  reintentoYtdlp: 'Actualizando el descargador de YouTube y reintentando…',
  etaCalculando: 'Calculando tiempo…',
  mientrasTitulo: 'Mientras tanto…',
  mientrasCuerpo: 'Busca la letra y empieza a sincronizarla con la canción original.',
  botonLetra: 'Buscar la letra mientras tanto',
  botonBiblioteca: 'Volver a la biblioteca',
  cancelarDescarga: 'Cancelar descarga',
  seguirDescargando: 'Seguir descargando',
  descargarAhora: 'Descargar ahora',
  pendienteTitulo: 'Falta descargar el audio.',
  pendienteCuerpo:
    'Cancelaste la descarga antes de que terminara. La canción sigue en tu biblioteca como borrador.',
  interrumpidoTitulo: 'La descarga se interrumpió',
  interrumpidoCuerpo: 'porque se cerró la aplicación.',
  reintentar: 'Reintentar',
  otroEnlace: 'Usar otro enlace',
  copiarDetalles: 'Copiar detalles',
  colaMantenimiento: 'En cola: el descargador de YouTube se está actualizando. Empezará enseguida.'
} as const

export const dialogoCancelarCuerpo = (titulo: string): string =>
  `«${titulo}» se quedará en tu biblioteca como borrador, sin audio. Podrás descargarla de nuevo cuando quieras.`

export const textoCola = (otra: string): string =>
  `En cola: se descargará cuando termine «${otra}».`

interface TextoError {
  titulo: string
  cuerpo: string
  /** `false`: repetir la descarga con el mismo enlace no sirve ("Usar otro enlace"). */
  reintentable: boolean
}

const ERRORES: Record<string, TextoError> = {
  FORMATO_NO_SOPORTADO: {
    titulo: 'No podemos leer este archivo.',
    cuerpo: 'Puede estar dañado o no tener sonido. Prueba con otro archivo.',
    reintentable: false
  },
  AUDIO_DEMASIADO_CORTO: {
    titulo: 'El audio es demasiado corto.',
    cuerpo: 'Tiene que durar al menos 10 segundos.',
    reintentable: false
  },
  URL_NO_VALIDA: {
    titulo: 'Este enlace no es de un vídeo de YouTube.',
    cuerpo: 'Cópialo desde la barra de direcciones del vídeo o desde «Compartir».',
    reintentable: false
  },
  URL_NO_SOPORTADA: {
    titulo: 'Las listas y los directos no se pueden usar.',
    cuerpo: 'Abre el vídeo concreto y copia su enlace.',
    reintentable: false
  },
  VIDEO_NO_DISPONIBLE: {
    titulo: 'Este vídeo no está disponible.',
    cuerpo:
      'Puede ser privado, haberse eliminado o tener restricción de edad o de país. Prueba con otro vídeo o usa un archivo.',
    reintentable: false
  },
  YOUTUBE_BLOQUEADO: {
    titulo: 'YouTube no permite la descarga ahora mismo.',
    cuerpo:
      'Ya hemos probado a actualizar el descargador. Inténtalo más tarde o usa un archivo de tu equipo.',
    reintentable: true
  },
  SIN_CONEXION: {
    titulo: 'Sin conexión a internet.',
    cuerpo: 'YouTube necesita conexión. Puedes usar un archivo de tu equipo.',
    reintentable: true
  },
  SIN_ESPACIO: {
    titulo: 'No queda espacio en el disco.',
    cuerpo: 'Cada canción ocupa unos 100 MB. Libera espacio y vuelve a intentarlo.',
    reintentable: true
  }
}

const GENERICO: TextoError = {
  titulo: 'Algo salió mal.',
  cuerpo: 'Vuelve a intentarlo.',
  reintentable: true
}

export const textoDeError = (codigo: string): TextoError => ERRORES[codigo] ?? GENERICO
export const esErrorGenerico = (codigo: string): boolean => !(codigo in ERRORES)
