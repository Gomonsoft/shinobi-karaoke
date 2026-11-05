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

/** Textos del subpaso de separación (docs/ux/04, claves `prog.*` de la separación). */
export const SEP = {
  cargando: 'Preparando la separación…',
  separando: (n: number): string => `Separando… ${n} %`,
  guardando: 'Guardando las pistas…',
  reintentoMemoria: 'Reintentando por partes más pequeñas…',
  reintentoMemoriaCpu: 'Reintentando con el procesador… Tardará más.',
  cola: (otra: string): string => `En cola: se separará cuando termine «${otra}».`,
  colaSinTitulo: 'En cola para separar.',
  modelo: (rapido: boolean, n: number, x: string, y: string | null): string =>
    `Descargando el modelo ${rapido ? 'Rápido' : 'Calidad'}… ${n} %${y ? ` · ${x} de ${y}` : ''}`,
  modo: { calidad: 'Modelo Calidad', rapido: 'Modelo Rápido' },
  modoInfo: 'Información sobre el modelo',
  ayudaCalidad: (dispositivo: string): string =>
    `Shinobi Karaoke separa la voz con el modelo Calidad, que deja poca voz de fondo. En tu equipo se ejecuta con ${dispositivo}.`,
  dispositivoCuda: 'tu tarjeta gráfica NVIDIA',
  dispositivoCpu: 'el procesador',
  ayudaRapido:
    'Estás usando el modelo Rápido, que aceptaste usar bajo tu responsabilidad porque el modelo Calidad no funcionó. Sus autores no han declarado licencia. Puedes volver al modelo Calidad en Ajustes.',
  irAjustes: 'Ir a Ajustes',
  cancelar: 'Cancelar separación',
  dialogoTitulo: '¿Cancelar la separación?',
  dialogoCuerpo:
    'Tendrás que volver a empezarla más tarde. La letra y lo que hayas sincronizado se conservan.',
  seguir: 'Seguir separando',
  pendiente: 'La separación está pendiente.',
  separarAhora: 'Separar ahora',
  interrumpido: 'La separación se interrumpió',
  interrumpidoCuerpo: 'porque se cerró la aplicación. Hay que empezarla de nuevo.',
  ofertaRapido:
    'Si sigue fallando, hay otra opción: el modelo Rápido, más ligero. Antes de usarlo, lee el aviso.',
  usarRapido: 'Usar el modelo Rápido…',
  usarRapidoDirecto: 'Usar el modelo Rápido',
  botonEditor: 'Ir al editor',
  botonLetraFin: 'Buscar la letra',
  escuchar: 'Escucha el resultado:',
  pistaVoz: 'Voz',
  pistaInstrumental: 'Instrumental',
  reproducir: (pista: string): string => `Reproducir ${pista}`,
  pausar: (pista: string): string => `Pausar ${pista}`,
  posicion: (pista: string): string => `Posición de ${pista}`,
  errorPista: (pista: string): string =>
    `No se pudo cargar la pista de ${pista}. Puede que se haya borrado: vuelve a separar la canción.`,
  terminado: 'Terminado'
} as const

export interface TextoErrorSeparacion {
  titulo: string
  cuerpo: string
}

const ERRORES_SEPARACION: Record<string, TextoErrorSeparacion> = {
  SIN_CONEXION: {
    titulo: 'Sin conexión a internet.',
    cuerpo: 'La descarga se detuvo. Comprueba tu conexión.'
  },
  SIN_ESPACIO: {
    titulo: 'No queda espacio en el disco.',
    cuerpo: 'Libera espacio y vuelve a intentarlo.'
  },
  MODELO_NO_DISPONIBLE: {
    titulo: 'No hemos podido descargar el modelo de separación.',
    cuerpo: 'Hace falta para separar. Comprueba tu conexión y vuelve a intentarlo.'
  }
}
const GENERICO_SEPARACION: TextoErrorSeparacion = {
  titulo: 'Algo salió mal al separar.',
  cuerpo: 'Vuelve a intentarlo.'
}
const MEMORIA: Record<'calidad' | 'rapido', TextoErrorSeparacion> = {
  calidad: {
    titulo: 'Tu equipo no tiene memoria suficiente para el modelo Calidad.',
    cuerpo:
      'Ya lo intentamos por partes más pequeñas. Cierra otros programas y vuelve a intentarlo.'
  },
  rapido: {
    titulo: 'Tu equipo se quedó sin memoria.',
    cuerpo:
      'Ya lo intentamos por partes más pequeñas. Cierra otros programas y vuelve a intentarlo.'
  }
}

/** Texto del banner de error de la separación; `modo` = el modelo con el que se separaba. */
export function textoDeErrorSeparacion(
  codigo: string,
  modo: 'calidad' | 'rapido'
): TextoErrorSeparacion {
  if (codigo === 'MEMORIA_INSUFICIENTE') return MEMORIA[modo]
  return ERRORES_SEPARACION[codigo] ?? GENERICO_SEPARACION
}
export const esErrorGenericoSeparacion = (codigo: string): boolean =>
  codigo !== 'MEMORIA_INSUFICIENTE' && !(codigo in ERRORES_SEPARACION)

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
