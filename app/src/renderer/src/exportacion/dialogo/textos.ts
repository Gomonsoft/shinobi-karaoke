import type { CodigoError } from '@shared/errores'
import {
  FORMATOS,
  type AudioExportacion,
  type FormatoId,
  type MotivoPerfilNoSoportado
} from '@shared/exportacion'

/** Microcopy de docs/ux/10-exportacion.md (claves `exp.*`, `bib.exp.*` y `act.exp`). */

export const NOMBRES_AUDIO: Record<AudioExportacion, string> = {
  instrumental: 'Solo instrumental',
  instrumental_voz: 'Instrumental y voz'
}

/** `exp.resolucion.*`: nombre comercial por «ancho x alto». */
export const NOMBRES_RESOLUCION: Record<string, string> = {
  '1280x720': 'HD',
  '1920x1080': 'Full HD',
  '2560x1440': 'QHD',
  '3840x2160': '4K UHD',
  '640x480': 'SD',
  '1024x768': 'XGA',
  '1600x1200': 'UXGA',
  '2880x2160': '4:3 máxima'
}

export const NOMBRES_PROPORCION = { '16:9': '16:9 · Panorámica', '4:3': '4:3 · Clásica' } as const

export const medidas = (ancho: number, alto: number): string => `${ancho} × ${alto}`

export const nombreResolucion = (ancho: number, alto: number): string => {
  const nombre = NOMBRES_RESOLUCION[`${ancho}x${alto}`]
  return nombre ? `${medidas(ancho, alto)} · ${nombre}` : medidas(ancho, alto)
}

export const PISTA_FORMATO: Record<FormatoId, string> = {
  mkv_av1:
    'Recomendado. Ocupa menos y es el formato de OBS. Si tu reproductor no lo abre, usa VLC.',
  webm_vp9:
    'Se abre en más sitios: navegadores (también Safari), Windows y Android. Ocupa algo más.'
}

export const MOTIVOS_PERFIL: Record<MotivoPerfilNoSoportado, string> = {
  codificador: 'el formato elegido no admite esta resolución en tu equipo',
  memoria: 'hace falta un equipo con al menos 8 GB de memoria',
  no_comprobado: 'no se pudo comprobar'
}

/** `exp.formato.ayuda`: título y párrafos. */
export const AYUDA_FORMATO = {
  titulo: 'Qué formato elegir',
  intro:
    'Los dos son formatos libres y llevan la misma imagen y el mismo sonido; cambian el tamaño del archivo y los programas que lo abren.',
  mkv: 'ocupa menos. Lo abren VLC, OBS, Chrome y Firefox. En Windows, el Reproductor multimedia necesita la «Extensión de video AV1», gratuita en Microsoft Store. En ordenadores de antes de 2020, un video 4K a 60 FPS puede verse a tirones.',
  webm: 'se abre en más sitios: todos los navegadores (también Safari), el Reproductor multimedia de Windows, Android, VLC y OBS. Ocupa algo más.',
  cierre:
    'Ninguno de los dos se abre con QuickTime (Mac): usa VLC o IINA. Algunos televisores no admiten ninguno: si no se ve, reprodúcelo desde el ordenador.'
} as const

export const EXP = {
  titulo: 'Exportar video',
  audio: 'Audio',
  audioSinVoz: 'La voz de esta canción no está disponible.',
  proporcion: 'Proporción',
  proporcionNoDisponible: 'Tu equipo no puede crear videos en esta proporción con este formato.',
  resolucion: 'Resolución',
  fps: 'Fotogramas por segundo',
  fpsAria: (n: number): string => `Fotogramas por segundo: ${n}`,
  formato: 'Formato',
  formatoAyudaBoton: 'Qué formato elegir',
  formatoNoDisponible: 'Tu equipo no puede crear videos en este formato.',
  perfilNoDisponible: ' — no disponible en este equipo',
  perfilNoSoportado: (
    ancho: number,
    alto: number,
    fps: number,
    formato: FormatoId,
    motivo: MotivoPerfilNoSoportado | null
  ): string =>
    `${medidas(ancho, alto)} a ${fps} FPS en ${FORMATOS[formato].nombreCorto} no está disponible en este equipo: ${MOTIVOS_PERFIL[motivo ?? 'no_comprobado']}.`,
  anuncioFps: (anterior: number, nuevo: number): string =>
    `Tu equipo no admite ${anterior} FPS con estas opciones. Se ha elegido ${nuevo}.`,
  anuncioResolucion: (ancho: number, alto: number): string =>
    `Resolución: ${medidas(ancho, alto)}.`,
  anuncioDestino: (nombre: string): string =>
    `Al cambiar el formato se ha vuelto a proponer el nombre: ${nombre}. Usa «Cambiar…» para elegir otro.`,
  destino: 'Guardar como',
  destinoAria: (ruta: string): string => `Guardar como, ${ruta}`,
  cambiar: 'Cambiar…',
  estimacion: (tamano: string | null, tiempo: string | null): string | null => {
    if (tamano && tiempo) return `Ocupará unos ${tamano} · tardará ${tiempo}`
    if (tamano) return `Ocupará unos ${tamano}`
    if (tiempo) return `Tardará ${tiempo}`
    return null
  },
  muestra: 'Muestra',
  muestraMarca: 'El video lleva la marca «Shinobi Karaoke» en esta esquina.',
  muestraAria:
    'Muestra del video: la letra con el estilo de la canción y la marca «Shinobi Karaoke» abajo a la derecha.',
  avisoExiste:
    'Ya hay un archivo con este nombre. Se sustituirá solo cuando el video nuevo esté terminado; si cancelas o falla, se conserva.',
  avisoEspacio: (tamano: string, libre: string): string =>
    `Puede que no haya espacio: el video ocuparía unos ${tamano} y quedan ${libre} libres en ese disco.`,
  notaSesion:
    'El reproductor está abierto en otra pantalla. Exportar a la vez usa más recursos del equipo: si notas cortes en la canción, cancela la exportación.',
  notaCostoso:
    'Con estas opciones el video tardará bastante y ocupará mucho. Para una prueba rápida, elige una resolución menor.',
  notaLetraLista:
    'Letra lista: en el video la letra cambiará línea a línea, sin barrido, igual que en el reproductor.',
  notaIncompleta: (n: number): string =>
    n === 1
      ? 'Falta 1 línea por sincronizar: no se verá en el video.'
      : `Faltan ${n} líneas por sincronizar: no se verán en el video.`,
  notaBorrador:
    'Esta canción aún es un borrador. El video se hará con lo que tiene ahora, con barrido.',
  notaCarpetaNoDisponible: (carpeta: string): string =>
    `La carpeta que usaste la última vez ya no está disponible. Se guardará en ${carpeta}.`,
  /** `edi.exp.temaBorrador` (spec 06 · Fase 6). */
  notaTemaBorrador:
    'Estás editando un tema sin guardar. El video usará el aspecto guardado; guarda el tema antes si quieres que salga en el video.',
  cargando: 'Comprobando qué puede exportar tu equipo…',
  cargandoCancion: 'Cargando la canción…',
  botonCancelar: 'Cancelar',
  botonExportar: 'Exportar',
  botonValidando: 'Exportando…',
  botonSustituir: 'Exportar y sustituir',
  botonCerrar: 'Cerrar',
  botonCopiar: 'Copiar detalles',
  copiados: 'Detalles copiados.',
  sinPerfilesTitulo: 'Este equipo no puede crear videos.',
  sinPerfilesCodificador: 'Falta el codificador de video en el motor de audio.',
  sinPerfilesNoComprobado:
    'No se pudo comprobar qué videos puede crear tu equipo. Cierra este cuadro y vuelve a intentarlo; si sigue igual, reinicia Shinobi Karaoke.',
  reparar: 'Reparar el motor de audio',
  noCancion: 'No se pudo cargar la canción para exportarla.'
} as const

export interface TextoError {
  titulo: string
  explicacion: string
}

/** Tabla «Errores» de la spec 10 (título y explicación). */
export const ERRORES_EXP: Partial<Record<CodigoError, TextoError>> & {
  ERROR_INTERNO: TextoError
} = {
  SIN_ESPACIO: {
    titulo: 'No queda espacio en el disco.',
    explicacion: 'Libera espacio o guarda el video en otra carpeta.'
  },
  DESTINO_NO_DISPONIBLE: {
    titulo: 'No se puede guardar en esa carpeta.',
    explicacion:
      'Puede que no tengas permiso, que el disco se haya desconectado o que el archivo esté abierto en otro programa. Elige otra carpeta o cierra ese programa.'
  },
  DESTINO_OCUPADO: {
    titulo: 'Ya se está exportando un video a ese archivo.',
    explicacion: 'Elige otro nombre o espera a que termine.'
  },
  CANCION_NO_DISPONIBLE: {
    titulo: 'No se encuentran las pistas de esta canción.',
    explicacion: 'Puede que se hayan borrado. Revisa la canción en la biblioteca.'
  },
  PERFIL_NO_SOPORTADO: {
    titulo: 'Tu equipo no puede crear el video con estas opciones.',
    explicacion: 'Prueba con otra resolución, menos fotogramas por segundo u otro formato.'
  },
  MEMORIA_INSUFICIENTE: {
    titulo: 'Tu equipo se quedó sin memoria.',
    explicacion: 'Cierra otros programas o elige una resolución menor.'
  },
  RUNTIME_NO_DISPONIBLE: {
    titulo: 'Hay que reparar el motor de audio.',
    explicacion: 'Falta una parte del motor que crea el video.'
  },
  SIN_CODIFICADOR: {
    titulo: 'Este equipo no puede crear videos en este formato.',
    explicacion: 'Falta el codificador de video. Prueba con el otro formato.'
  },
  LIMPIEZA_FALLIDA: {
    titulo: 'No se pudo borrar un archivo temporal.',
    explicacion: 'Puedes borrarlo a mano.'
  },
  ERROR_INTERNO: {
    titulo: 'Algo salió mal al crear el video.',
    explicacion: 'Vuelve a intentarlo.'
  }
}

export const textoErrorExp = (codigo: CodigoError): TextoError =>
  ERRORES_EXP[codigo] ?? ERRORES_EXP.ERROR_INTERNO

// --- Formato de cifras --------------------------------------------------------

/** MB por debajo de 1 GB y «1,4 GB» (coma decimal) a partir de ahí. */
export function formatearTamano(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1).replace('.', ',')} GB`
  return `${Math.max(1, Math.round(bytes / 1_000_000))} MB`
}

/** `exp.estimacion`, parte del tiempo: «unos 8 minutos», «menos de 1 minuto», «unos 1 h 20 min». */
export function formatearTiempoEstimado(segundos: number): string {
  if (segundos < 60) return 'menos de 1 minuto'
  const minutos = Math.round(segundos / 60)
  if (minutos < 60) return minutos === 1 ? 'alrededor de 1 minuto' : `unos ${minutos} minutos`
  return `unos ${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`
}

/** `mm:ss`, y `h:mm:ss` desde 1 hora. */
export function formatearPosicion(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** Código de un error de la IPC (`{ codigo, mensaje }`); `ERROR_INTERNO` si no hay. */
export function codigoDeError(err: unknown): CodigoError {
  if (err && typeof err === 'object' && 'codigo' in err && typeof err.codigo === 'string')
    return err.codigo as CodigoError
  return 'ERROR_INTERNO'
}
