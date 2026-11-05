/** Textos de `ux/08` (Acerca de) y `ux/03` (aviso de YouTube, wireframe B, literal). */
export const TEXTOS_ACERCA = {
  titulo: 'Acerca de Shinobi Karaoke',
  version: (v: string) => `Versión ${v} · Software libre con licencia GPL-3.0 o posterior.`,
  creditos:
    'Letras: LRCLIB (lrclib.net). Separación: audio-separator y MelBand RoFormer (Kimberley Jensen); modelo Rápido: comunidad UVR.',
  verLicencia: 'Ver licencia',
  verTerceros: 'Créditos y licencias de terceros',
  web: 'Web del proyecto',
  avisoYoutube: 'Aviso sobre YouTube',
  abrirCarpeta: 'Abrir carpeta de datos',
  copiarInfo: 'Copiar información para soporte',
  infoCopiada: 'Información copiada',
  noAceptado: 'No aceptado todavía',
  aceptadoEl: (fecha: string) => `Aceptado el ${fecha}`,
  cerrar: 'Cerrar',
  tituloLicencia: 'Licencia GPL-3.0',
  tituloTerceros: 'Créditos y licencias de terceros',
  errorTexto: 'No se pudo leer el texto.',
  errorCarpeta: 'No se pudo abrir la carpeta de datos.',
  cargando: 'Cargando…'
} as const

export const WEB_PROYECTO = 'https://github.com/Gomonsoft/shinobi-karaoke'

export const AVISO_YOUTUBE = {
  titulo: 'Antes de usar YouTube',
  intro:
    'Shinobi Karaoke puede descargar el audio de un vídeo de YouTube para que hagas tu karaoke en tu ordenador.',
  puntos: [
    'Usa solo contenido que tengas derecho a descargar (por ejemplo, tus propias canciones o música con licencia que lo permita).',
    'Las condiciones de YouTube no permiten descargar la mayoría de los vídeos sin su permiso.',
    'Lo que hagas es solo para uso personal y es tu responsabilidad. Shinobi Karaoke no comparte ni sube nada.'
  ]
} as const
